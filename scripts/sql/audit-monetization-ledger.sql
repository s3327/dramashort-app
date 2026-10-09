-- ============================================================================
-- AUDIT MONETIZATION LEDGER & SIMULATED CHECKOUT PURCHASES
-- ============================================================================
-- Purpose: Read-only diagnostic queries to inspect any simulated orders,
-- duplicate purchase references, and active VIP grants in User DB.
-- Run in Supabase SQL Editor (User DB Project bpidsbcrvpkavvdvtpgh) before
-- applying the unique constraint in 20261010100000_payment_orders.sql.

-- ----------------------------------------------------------------------------
-- 1. Purchases Created by Simulated Checkout
-- ----------------------------------------------------------------------------
-- Simulated checkouts generate references starting with 'order_<timestamp>_<random>'
SELECT 
    user_id,
    COUNT(*) AS total_simulated_purchases,
    SUM(amount) AS total_coins_credited,
    MIN(created_at) AS first_purchase_at,
    MAX(created_at) AS last_purchase_at
FROM public.coin_transactions
WHERE transaction_type = 'purchase'
  AND reference_id LIKE 'order\_%' ESCAPE '\'
GROUP BY user_id
ORDER BY total_coins_credited DESC;

-- ----------------------------------------------------------------------------
-- 2. Duplicate Purchase References
-- ----------------------------------------------------------------------------
-- MUST RETURN 0 ROWS before applying the unique index:
-- uq_coin_tx_purchase_reference ON coin_transactions (reference_id)
SELECT 
    reference_id,
    COUNT(*) AS duplicate_count,
    array_agg(id) AS transaction_ids,
    array_agg(user_id) AS user_ids,
    array_agg(amount) AS amounts,
    MIN(created_at) AS first_created_at,
    MAX(created_at) AS last_created_at
FROM public.coin_transactions
WHERE transaction_type = 'purchase' 
  AND reference_id IS NOT NULL
GROUP BY reference_id
HAVING COUNT(*) > 1;

-- ----------------------------------------------------------------------------
-- 3. Active VIP Grants & Expirations
-- ----------------------------------------------------------------------------
SELECT 
    user_id,
    is_vip,
    vip_expires_at,
    CASE 
        WHEN vip_expires_at IS NULL THEN 'Permanent/Unknown'
        WHEN vip_expires_at > timezone('utc'::text, now()) THEN 'Active'
        ELSE 'Expired'
    END AS vip_status,
    updated_at
FROM public.wallets
WHERE is_vip = true
ORDER BY vip_expires_at DESC NULLS LAST;

-- ----------------------------------------------------------------------------
-- 4. Audit Coin Transactions vs Wallets Invariant Check
-- ----------------------------------------------------------------------------
-- Verifies whether ledger net sum equals current balance in wallets
SELECT 
    w.user_id,
    w.balance AS wallet_balance,
    COALESCE(SUM(t.amount), 0) AS calculated_ledger_balance,
    (w.balance - COALESCE(SUM(t.amount), 0)) AS balance_discrepancy
FROM public.wallets w
LEFT JOIN public.coin_transactions t ON t.user_id = w.user_id
GROUP BY w.user_id, w.balance
HAVING (w.balance - COALESCE(SUM(t.amount), 0)) <> 0;

-- ----------------------------------------------------------------------------
-- 5. Safe Remediation Template (Append-Only Ledger Policy)
-- ----------------------------------------------------------------------------
-- If test accounts or errant free coins need adjustment on live accounts,
-- NEVER delete or edit rows in coin_transactions.
-- Instead, insert an adjusting ledger row with transaction_type = 'refund'
-- and debit the wallet atomically using the debit_wallet_coins stored procedure:
--
-- Example:
-- SELECT public.debit_wallet_coins(
--   'USER_UUID_HERE'::uuid,
--   AMOUNT_TO_DEDUCT,
--   'refund',
--   'adj_simulated_rollback_' || now()::text,
--   'Administrative correction for simulated test checkout'
-- );
