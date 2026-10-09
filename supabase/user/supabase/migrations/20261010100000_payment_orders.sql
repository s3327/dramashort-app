-- ============================================================================
-- TASK P0 / STEP 3: PAYMENT ORDERS, WEBHOOK DEDUPLICATION & ATOMIC FULFILLMENT
-- ============================================================================
-- Implements database safety net for monetization:
-- 1. public.payment_orders: Authoritative purchase order state machine
-- 2. public.payment_webhook_events: Tamper-proof webhook event idempotency deduplication
-- 3. uq_coin_tx_purchase_reference: Partial unique index on purchase references
-- 4. public.fulfill_payment_order: Atomic SECURITY DEFINER procedure locking order + wallet
-- 5. Least-privilege RLS policies: Users can SELECT their own orders; only service_role writes.

-- ----------------------------------------------------------------------------
-- 1. Payment Orders Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_orders (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    package_id          TEXT NOT NULL,
    amount_minor        INTEGER NOT NULL CHECK (amount_minor > 0),
    currency            TEXT NOT NULL DEFAULT 'USD',
    provider            TEXT NOT NULL,
    provider_session_id TEXT,
    provider_payment_id TEXT,
    status              TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'paid', 'failed', 'expired', 'refunded')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    paid_at             TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_orders_provider_session
    ON public.payment_orders (provider, provider_session_id)
    WHERE provider_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_orders_user
    ON public.payment_orders (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_orders_status
    ON public.payment_orders (status);

-- ----------------------------------------------------------------------------
-- 2. Processed Webhook Events Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
    provider     TEXT NOT NULL,
    event_id     TEXT NOT NULL,
    received_at  TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (provider, event_id)
);

-- ----------------------------------------------------------------------------
-- 3. Unique Index on Purchase Ledger Rows Only
-- ----------------------------------------------------------------------------
-- Prevents race conditions where two simultaneous transactions record the same purchase reference
CREATE UNIQUE INDEX IF NOT EXISTS uq_coin_tx_purchase_reference
    ON public.coin_transactions (reference_id)
    WHERE transaction_type = 'purchase' AND reference_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 4. Row Level Security (RLS) & Permissions
-- ----------------------------------------------------------------------------
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.payment_orders FROM anon, authenticated;
REVOKE ALL ON public.payment_webhook_events FROM anon, authenticated;

-- Users may only view their own payment orders
GRANT SELECT ON public.payment_orders TO authenticated;
DROP POLICY IF EXISTS "Users read own orders" ON public.payment_orders;
CREATE POLICY "Users read own orders" ON public.payment_orders
    FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

-- Service role has full administrative management
GRANT ALL ON public.payment_orders TO service_role;
GRANT ALL ON public.payment_webhook_events TO service_role;

-- ----------------------------------------------------------------------------
-- 5. Atomic Order Fulfillment Stored Procedure (SECURITY DEFINER)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fulfill_payment_order(
    p_order_id UUID,
    p_provider_payment_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_coins_to_credit INT := 0;
    v_is_vip BOOLEAN := false;
    v_vip_days INT := 7;
    v_new_balance INT := 0;
    v_new_vip_expires_at TIMESTAMPTZ := NULL;
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
BEGIN
    -- 1. Lock order row for update
    SELECT * INTO v_order
    FROM public.payment_orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ORDER_NOT_FOUND: %', p_order_id;
    END IF;

    -- 2. Idempotency Check: if already fulfilled, return duplicate without double-crediting
    IF v_order.status = 'paid' THEN
        SELECT balance, is_vip, vip_expires_at 
        INTO v_new_balance, v_is_vip, v_new_vip_expires_at
        FROM public.wallets
        WHERE user_id = v_order.user_id;

        RETURN jsonb_build_object(
            'success', true,
            'duplicate', true,
            'order_id', v_order.id,
            'package_id', v_order.package_id,
            'user_id', v_order.user_id,
            'status', 'paid',
            'new_balance', COALESCE(v_new_balance, 0),
            'is_vip', COALESCE(v_is_vip, false),
            'vip_expires_at', v_new_vip_expires_at
        );
    END IF;

    IF v_order.status <> 'pending' THEN
        RAISE EXCEPTION 'ORDER_NOT_PAYABLE: order status is %', v_order.status;
    END IF;

    -- 3. Mark order as paid atomically
    UPDATE public.payment_orders
    SET status = 'paid',
        paid_at = v_now,
        provider_payment_id = COALESCE(p_provider_payment_id, provider_payment_id)
    WHERE id = p_order_id;

    -- 4. Ensure user wallet exists
    PERFORM public.ensure_user_wallet(v_order.user_id);

    -- 5. Determine package grant specifications
    IF v_order.package_id = 'coins_starter_100' THEN
        v_coins_to_credit := 100;
    ELSIF v_order.package_id = 'coins_popular_350' THEN
        v_coins_to_credit := 350;
    ELSIF v_order.package_id = 'coins_binge_800' THEN
        v_coins_to_credit := 800;
    ELSIF v_order.package_id = 'vip_weekly_pass' THEN
        v_is_vip := true;
        v_vip_days := 7;
    ELSE
        -- Fallback default: zero coins credited
        v_coins_to_credit := 0;
    END IF;

    -- 6. Execute fulfillment with wallet row locking
    IF v_is_vip THEN
        DECLARE
            v_current_vip_expiry TIMESTAMPTZ;
            v_base_time TIMESTAMPTZ;
            v_current_bal INT;
        BEGIN
            SELECT balance, is_vip, vip_expires_at 
            INTO v_current_bal, v_is_vip, v_current_vip_expiry
            FROM public.wallets
            WHERE user_id = v_order.user_id
            FOR UPDATE;

            v_base_time := v_now;
            IF v_current_vip_expiry IS NOT NULL AND v_current_vip_expiry > v_now THEN
                v_base_time := v_current_vip_expiry;
            END IF;

            v_new_vip_expires_at := v_base_time + (v_vip_days || ' days')::interval;

            UPDATE public.wallets
            SET is_vip = true,
                vip_expires_at = v_new_vip_expires_at,
                updated_at = v_now
            WHERE user_id = v_order.user_id;

            -- Ledger record for VIP grant
            INSERT INTO public.coin_transactions (
                user_id, amount, balance_after, transaction_type, reference_id, description, created_at
            ) VALUES (
                v_order.user_id, 0, COALESCE(v_current_bal, 0), 'purchase', v_order.id::text, 'VIP Pass (7 Days)', v_now
            );

            v_new_balance := COALESCE(v_current_bal, 0);
        END;
    ELSIF v_coins_to_credit > 0 THEN
        DECLARE
            v_current_bal INT;
        BEGIN
            SELECT balance INTO v_current_bal
            FROM public.wallets
            WHERE user_id = v_order.user_id
            FOR UPDATE;

            v_new_balance := COALESCE(v_current_bal, 0) + v_coins_to_credit;

            UPDATE public.wallets
            SET balance = v_new_balance,
                updated_at = v_now
            WHERE user_id = v_order.user_id;

            -- Ledger record for coin credit (reference_id = order.id protected by unique index)
            INSERT INTO public.coin_transactions (
                user_id, amount, balance_after, transaction_type, reference_id, description, created_at
            ) VALUES (
                v_order.user_id, v_coins_to_credit, v_new_balance, 'purchase', v_order.id::text,
                'Purchase: ' || v_order.package_id || ' (+' || v_coins_to_credit || ' Coins)', v_now
            );
        END;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'duplicate', false,
        'order_id', v_order.id,
        'package_id', v_order.package_id,
        'user_id', v_order.user_id,
        'status', 'paid',
        'coins_credited', v_coins_to_credit,
        'vip_granted', v_is_vip,
        'new_balance', v_new_balance,
        'vip_expires_at', v_new_vip_expires_at
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;
