-- ADR-0005: 20261009170000 and 20261009220000 guard their public.profiles statements
-- with to_regclass('public.profiles'), which is NULL when they run (the catalog chain comes first). profiles
-- exists now (20261012100000), so the same statements run here.

-- From 20261009170000_admin_user_management.sql (Task 16.7)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('user', 'editor', 'admin'));
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ban_reason TEXT;
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_banned ON public.profiles(is_banned);
GRANT ALL ON TABLE public.profiles TO service_role;

-- From 20261009220000_monetization_wallets_and_entitlements.sql (Task 8.1)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS coin_balance INTEGER NOT NULL DEFAULT 0 CHECK (coin_balance >= 0),
  ADD COLUMN IF NOT EXISTS is_vip BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vip_expires_at TIMESTAMPTZ;
