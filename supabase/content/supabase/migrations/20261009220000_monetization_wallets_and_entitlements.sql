-- ============================================================================
-- TASK 8.1: MONETIZATION WALLETS, TRANSACTIONS, ENTITLEMENTS & DAILY CHECKINS
-- ============================================================================
-- Mirrored in Content DB for ADR-0003 topology parity:
-- 1. Adds coin_balance, is_vip, vip_expires_at to public.profiles.
-- 2. Dedicated public.wallets table with SELECT-only client RLS and SECURITY DEFINER RPCs.
-- 3. public.coin_transactions immutable ledger for auditing and financial tracking.
-- 4. public.user_unlocked_episodes tracking permanent paywall episode unlocks.
-- 5. public.daily_checkins tracking 7-day progressive check-in streaks.
-- 6. Atomic RPC procedures for credit, debit, episode unlock, and streak claims.

-- ----------------------------------------------------------------------------
-- 1. Profiles Table Expansion (Mirror / Cache Columns)
-- ----------------------------------------------------------------------------
-- `public.profiles` lives in the User DB, so it only exists here in single-database
-- environments; guarded so the chain applies cleanly on a fresh Content DB.
DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    ALTER TABLE public.profiles
      ADD COLUMN IF NOT EXISTS coin_balance INTEGER NOT NULL DEFAULT 0 CHECK (coin_balance >= 0),
      ADD COLUMN IF NOT EXISTS is_vip BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS vip_expires_at TIMESTAMPTZ;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Wallets Table (Authoritative Balance Ledger)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wallets (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
    is_vip BOOLEAN NOT NULL DEFAULT false,
    vip_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_wallets_vip ON public.wallets(is_vip) WHERE is_vip = true;

-- Trigger to sync wallets -> profiles and bump updated_at
CREATE OR REPLACE FUNCTION public.fn_sync_wallet_to_profile()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  UPDATE public.profiles
  SET coin_balance = NEW.balance,
      is_vip = NEW.is_vip,
      vip_expires_at = NEW.vip_expires_at,
      updated_at = timezone('utc'::text, now())
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_wallets_sync_profiles ON public.wallets;
CREATE TRIGGER trg_wallets_sync_profiles
BEFORE INSERT OR UPDATE ON public.wallets
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_wallet_to_profile();

-- ----------------------------------------------------------------------------
-- 3. Coin Transactions Table (Immutable Financial Ledger)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coin_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL, -- positive for credit, negative for debit
    balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
    transaction_type TEXT NOT NULL CHECK (transaction_type IN (
        'purchase', 'episode_unlock', 'daily_checkin', 'streak_bonus', 'referral', 'admin_grant', 'refund'
    )),
    reference_id TEXT, -- payment session ID, episode UUID, or checkin date
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_coin_transactions_user_created ON public.coin_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_type ON public.coin_transactions(transaction_type);

-- ----------------------------------------------------------------------------
-- 4. User Unlocked Episodes Table (Paywall Entitlements)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_unlocked_episodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    drama_id UUID NOT NULL,
    drama_slug TEXT NOT NULL,
    episode_id UUID NOT NULL,
    episode_number INTEGER NOT NULL CHECK (episode_number >= 1),
    coins_spent INTEGER NOT NULL DEFAULT 0 CHECK (coins_spent >= 0),
    unlocked_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_user_drama_episode UNIQUE (user_id, drama_id, episode_number)
);

CREATE INDEX IF NOT EXISTS idx_unlocked_user_drama ON public.user_unlocked_episodes(user_id, drama_slug);
CREATE INDEX IF NOT EXISTS idx_unlocked_drama_id ON public.user_unlocked_episodes(drama_id);
CREATE INDEX IF NOT EXISTS idx_unlocked_episode_id ON public.user_unlocked_episodes(episode_id);
CREATE INDEX IF NOT EXISTS idx_unlocked_user_id ON public.user_unlocked_episodes(user_id);

-- ----------------------------------------------------------------------------
-- 5. Daily Check-ins Table (7-Day Streak Rewards)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    streak_count INTEGER NOT NULL DEFAULT 1 CHECK (streak_count BETWEEN 1 AND 7),
    last_checkin_date DATE NOT NULL DEFAULT CURRENT_DATE,
    coins_awarded INTEGER NOT NULL DEFAULT 5 CHECK (coins_awarded > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_daily_checkin_user_date UNIQUE (user_id, last_checkin_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_checkins_user_date ON public.daily_checkins(user_id, last_checkin_date DESC);

-- ----------------------------------------------------------------------------
-- 6. Row Level Security (RLS) & Privilege Hardening (Least Privilege)
-- ----------------------------------------------------------------------------
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_unlocked_episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;

-- Revoke all direct mutations from anon & authenticated
REVOKE ALL ON public.wallets FROM anon, authenticated;
REVOKE ALL ON public.coin_transactions FROM anon, authenticated;
REVOKE ALL ON public.user_unlocked_episodes FROM anon, authenticated;
REVOKE ALL ON public.daily_checkins FROM anon, authenticated;

-- Allow authenticated users to read their own rows only
GRANT SELECT ON public.wallets TO authenticated;
GRANT SELECT ON public.coin_transactions TO authenticated;
GRANT SELECT ON public.user_unlocked_episodes TO authenticated;
GRANT SELECT ON public.daily_checkins TO authenticated;

-- Service role has full access
GRANT ALL ON public.wallets TO service_role;
GRANT ALL ON public.coin_transactions TO service_role;
GRANT ALL ON public.user_unlocked_episodes TO service_role;
GRANT ALL ON public.daily_checkins TO service_role;

DROP POLICY IF EXISTS "Users read own wallet" ON public.wallets;
CREATE POLICY "Users read own wallet" ON public.wallets
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users read own coin transactions" ON public.coin_transactions;
CREATE POLICY "Users read own coin transactions" ON public.coin_transactions
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users read own unlocked episodes" ON public.user_unlocked_episodes;
CREATE POLICY "Users read own unlocked episodes" ON public.user_unlocked_episodes
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users read own daily checkins" ON public.daily_checkins;
CREATE POLICY "Users read own daily checkins" ON public.daily_checkins
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

-- ----------------------------------------------------------------------------
-- 7. Atomic PostgreSQL Stored Procedures (SECURITY DEFINER)
-- ----------------------------------------------------------------------------

-- Procedure: ensure_user_wallet
CREATE OR REPLACE FUNCTION public.ensure_user_wallet(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_wallet RECORD;
BEGIN
  INSERT INTO public.wallets (user_id, balance, is_vip, vip_expires_at)
  VALUES (p_user_id, 0, false, NULL)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT user_id, balance, is_vip, vip_expires_at, created_at, updated_at
  INTO v_wallet
  FROM public.wallets
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'user_id', v_wallet.user_id,
    'balance', v_wallet.balance,
    'is_vip', v_wallet.is_vip,
    'vip_expires_at', v_wallet.vip_expires_at,
    'created_at', v_wallet.created_at,
    'updated_at', v_wallet.updated_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Procedure: credit_wallet_coins
CREATE OR REPLACE FUNCTION public.credit_wallet_coins(
  p_user_id UUID,
  p_amount INT,
  p_type TEXT,
  p_ref_id TEXT DEFAULT NULL,
  p_description TEXT DEFAULT 'Coins credited'
)
RETURNS JSONB AS $$
DECLARE
  v_current_balance INT;
  v_new_balance INT;
  v_tx_id UUID;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'CREDIT_AMOUNT_MUST_BE_POSITIVE';
  END IF;

  PERFORM public.ensure_user_wallet(p_user_id);

  -- Lock row for update
  SELECT balance INTO v_current_balance
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  v_new_balance := v_current_balance + p_amount;

  UPDATE public.wallets
  SET balance = v_new_balance,
      updated_at = timezone('utc'::text, now())
  WHERE user_id = p_user_id;

  INSERT INTO public.coin_transactions (
    user_id, amount, balance_after, transaction_type, reference_id, description
  ) VALUES (
    p_user_id, p_amount, v_new_balance, p_type, p_ref_id, p_description
  ) RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'success', true,
    'amount', p_amount,
    'balance_before', v_current_balance,
    'balance_after', v_new_balance,
    'transaction_id', v_tx_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Procedure: debit_wallet_coins
CREATE OR REPLACE FUNCTION public.debit_wallet_coins(
  p_user_id UUID,
  p_amount INT,
  p_type TEXT,
  p_ref_id TEXT DEFAULT NULL,
  p_description TEXT DEFAULT 'Coins debited'
)
RETURNS JSONB AS $$
DECLARE
  v_current_balance INT;
  v_new_balance INT;
  v_tx_id UUID;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'DEBIT_AMOUNT_MUST_BE_POSITIVE';
  END IF;

  PERFORM public.ensure_user_wallet(p_user_id);

  SELECT balance INTO v_current_balance
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_COINS: Required %, available %', p_amount, v_current_balance;
  END IF;

  v_new_balance := v_current_balance - p_amount;

  UPDATE public.wallets
  SET balance = v_new_balance,
      updated_at = timezone('utc'::text, now())
  WHERE user_id = p_user_id;

  INSERT INTO public.coin_transactions (
    user_id, amount, balance_after, transaction_type, reference_id, description
  ) VALUES (
    p_user_id, -p_amount, v_new_balance, p_type, p_ref_id, p_description
  ) RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'success', true,
    'amount', p_amount,
    'balance_before', v_current_balance,
    'balance_after', v_new_balance,
    'transaction_id', v_tx_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Procedure: unlock_episode_with_coins
CREATE OR REPLACE FUNCTION public.unlock_episode_with_coins(
  p_user_id UUID,
  p_drama_id UUID,
  p_drama_slug TEXT,
  p_episode_id UUID,
  p_episode_number INT,
  p_cost INT DEFAULT 10
)
RETURNS JSONB AS $$
DECLARE
  v_wallet RECORD;
  v_existing_id UUID;
  v_is_vip_active BOOLEAN;
  v_effective_cost INT := p_cost;
  v_new_balance INT;
  v_unlock_id UUID;
  v_tx_id UUID;
BEGIN
  -- 1. Check idempotency: already unlocked?
  SELECT id INTO v_existing_id
  FROM public.user_unlocked_episodes
  WHERE user_id = p_user_id
    AND drama_id = p_drama_id
    AND episode_number = p_episode_number;

  IF v_existing_id IS NOT NULL THEN
    SELECT balance INTO v_new_balance FROM public.wallets WHERE user_id = p_user_id;
    RETURN jsonb_build_object(
      'success', true,
      'already_unlocked', true,
      'unlocked_episode_id', v_existing_id,
      'coins_spent', 0,
      'new_balance', COALESCE(v_new_balance, 0)
    );
  END IF;

  PERFORM public.ensure_user_wallet(p_user_id);

  -- 2. Inspect wallet and VIP status
  SELECT * INTO v_wallet
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  v_is_vip_active := v_wallet.is_vip = true AND (
    v_wallet.vip_expires_at IS NULL OR v_wallet.vip_expires_at > timezone('utc'::text, now())
  );

  IF v_is_vip_active THEN
    v_effective_cost := 0;
  END IF;

  -- 3. Verify balance if non-zero cost
  IF v_effective_cost > 0 THEN
    IF v_wallet.balance < v_effective_cost THEN
      RAISE EXCEPTION 'INSUFFICIENT_COINS: Required %, available %', v_effective_cost, v_wallet.balance;
    END IF;

    v_new_balance := v_wallet.balance - v_effective_cost;

    UPDATE public.wallets
    SET balance = v_new_balance,
        updated_at = timezone('utc'::text, now())
    WHERE user_id = p_user_id;

    INSERT INTO public.coin_transactions (
      user_id, amount, balance_after, transaction_type, reference_id, description
    ) VALUES (
      p_user_id, -v_effective_cost, v_new_balance, 'episode_unlock', p_episode_id::text,
      'Unlocked episode ' || p_episode_number || ' of ' || p_drama_slug
    ) RETURNING id INTO v_tx_id;
  ELSE
    v_new_balance := v_wallet.balance;
  END IF;

  -- 4. Record unlocked episode
  INSERT INTO public.user_unlocked_episodes (
    user_id, drama_id, drama_slug, episode_id, episode_number, coins_spent
  ) VALUES (
    p_user_id, p_drama_id, p_drama_slug, p_episode_id, p_episode_number, v_effective_cost
  ) RETURNING id INTO v_unlock_id;

  RETURN jsonb_build_object(
    'success', true,
    'already_unlocked', false,
    'unlocked_episode_id', v_unlock_id,
    'coins_spent', v_effective_cost,
    'new_balance', v_new_balance,
    'is_vip_unlock', v_is_vip_active
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Procedure: claim_daily_checkin
CREATE OR REPLACE FUNCTION public.claim_daily_checkin(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_last_checkin RECORD;
  v_today DATE := CURRENT_DATE;
  v_new_streak INT := 1;
  v_reward_coins INT := 5;
  v_checkin_id UUID;
  v_credit_res JSONB;
BEGIN
  -- 1. Check last checkin
  SELECT * INTO v_last_checkin
  FROM public.daily_checkins
  WHERE user_id = p_user_id
  ORDER BY last_checkin_date DESC
  LIMIT 1;

  IF v_last_checkin.last_checkin_date = v_today THEN
    RAISE EXCEPTION 'ALREADY_CHECKED_IN_TODAY';
  END IF;

  IF v_last_checkin.last_checkin_date IS NOT NULL AND v_last_checkin.last_checkin_date = (v_today - 1) THEN
    -- Consecutive day: increment up to 7, then reset to 1
    v_new_streak := (v_last_checkin.streak_count % 7) + 1;
  ELSE
    -- Gap > 1 day or first time: streak restarts at 1
    v_new_streak := 1;
  END IF;

  -- 2. Reward coins schedule:
  -- Day 1: 5, Day 2: 10, Day 3: 10, Day 4: 15, Day 5: 15, Day 6: 20, Day 7: 50
  CASE v_new_streak
    WHEN 1 THEN v_reward_coins := 5;
    WHEN 2 THEN v_reward_coins := 10;
    WHEN 3 THEN v_reward_coins := 10;
    WHEN 4 THEN v_reward_coins := 15;
    WHEN 5 THEN v_reward_coins := 15;
    WHEN 6 THEN v_reward_coins := 20;
    WHEN 7 THEN v_reward_coins := 50;
    ELSE v_reward_coins := 5;
  END CASE;

  -- 3. Record check-in
  INSERT INTO public.daily_checkins (
    user_id, streak_count, last_checkin_date, coins_awarded
  ) VALUES (
    p_user_id, v_new_streak, v_today, v_reward_coins
  ) RETURNING id INTO v_checkin_id;

  -- 4. Credit coins to wallet
  v_credit_res := public.credit_wallet_coins(
    p_user_id,
    v_reward_coins,
    'daily_checkin',
    v_today::text,
    'Day ' || v_new_streak || ' daily check-in bonus'
  );

  RETURN jsonb_build_object(
    'success', true,
    'checkin_id', v_checkin_id,
    'streak_count', v_new_streak,
    'coins_awarded', v_reward_coins,
    'new_balance', (v_credit_res->>'balance_after')::INT
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;
