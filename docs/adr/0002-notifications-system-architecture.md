# ADR-0002: Notification System Architecture, Schema Contract, and Delivery Pipeline

[← Back to ADR Registry](README.md)

## Status
Accepted

## Date
2026-10-05

## Context
DramaShort currently includes a client-side `NotificationBell` component that renders hardcoded mock notifications from `data/notifications.mock.ts` to signed-in users. The read state resets on every client navigation, and the items do not reflect user activity, new episode releases, or account events.

Under Task 11.7, the mock notification bell must be hidden by default behind the `NEXT_PUBLIC_FEATURE_NOTIFICATIONS` feature flag until a real, persistent notifications engine is deployed.

This ADR specifies the target architecture, database schema, trigger hooks, and delivery pipeline for real notifications, harmonized with the Telegram bot integration described in `FUTURE_PLAN.md` §5.4.

## Decision

### 1. Feature Flag Controlled Activation
- The feature flag `NEXT_PUBLIC_FEATURE_NOTIFICATIONS` (default: `"false"` / unset) controls the visibility of the notification UI.
- When the flag is disabled or unset:
  - `HeaderActions` omits the `NotificationBell` component from the header navigation bar.
  - `NotificationBell` renders `null`.
  - The mock notifications dataset (`data/notifications.mock.ts`) is dynamically imported only when the feature flag is explicitly enabled, preventing mock data from shipping in client-side bundles.
- When enabled in development or upon production release, the bell renders real user notifications queried from the database.

### 2. Database Schema (User Database: `bpidsbcrvpkavvdvtpgh`)
Notifications are user-scoped transactional records stored in the User Database:

```sql
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('new_episode', 'system', 'reward', 'security')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Query optimization indexes
CREATE INDEX idx_notifications_user_unread ON public.notifications (user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_user_timeline ON public.notifications (user_id, created_at DESC);

-- Row Level Security
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users may only view their own notifications
CREATE POLICY "Users can read own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users may mark their own notifications as read
CREATE POLICY "Users can update read_at of own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Ingestion is reserved exclusively for the service role / backend workers
REVOKE INSERT, DELETE ON public.notifications FROM authenticated, anon;
GRANT INSERT, DELETE, SELECT, UPDATE ON public.notifications TO service_role;
```

### 3. Notification Types & Payload Contracts
1. **`new_episode`**:
   - Trigger: Fired when an episode of a favorited drama is published (Task 16.3 lifecycle hook).
   - Payload: `{ drama_slug: string, drama_title: string, episode_number: number, episode_id: string }`.
   - Deep link: `/watch/${drama_slug}?ep=${episode_number}`.
2. **`system`**:
   - Trigger: System announcements, platform maintenance notices, or support ticket resolutions (Task 11.4).
   - Payload: `{ ticket_id?: string, announcement_id?: string }`.
3. **`reward`**:
   - Trigger: Daily check-in rewards, bonus coins credited (Phase 8 monetization).
   - Payload: `{ amount: number, currency: "coins", reason: string }`.
4. **`security`**:
   - Trigger: Critical account changes (password changed, new session reauthentication, account deletion initiated).
   - Payload: `{ ip_address?: string, device_summary?: string }`.

### 4. Generation Pipeline & Event Triggers
1. **Episode Release Worker (Task 16.3)**:
   - When a scheduled or draft episode transitions to `status = 'Published'`:
   - A database trigger or background worker queries the Content DB for the drama's subscribers via `public.favorites` in the User DB.
   - Inserts notification rows into `public.notifications` via the service-role client.
2. **Telegram Delivery Bridge (`FUTURE_PLAN.md` §5.4)**:
   - For users who linked their Telegram account (`profiles.telegram_user_id IS NOT NULL`):
   - The worker enqueues an asynchronous Telegram bot message via `POST https://api.telegram.org/bot<TOKEN>/sendMessage` with an inline keyboard button opening the drama in the Telegram WebApp (`t.me/<bot>/app?startapp=watch_<slug>_<ep>`).

### 5. API Endpoints (Phase 16 Implementation)
- `GET /api/me/notifications`: Returns paginated notifications and unread badge count for the active session.
- `PATCH /api/me/notifications/[id]/read`: Marks an individual notification as read.
- `POST /api/me/notifications/read-all`: Bulk marks all unread notifications as read.

## Consequences
- **Positive**: Prevents confusion from fake notifications appearing for real signed-in users.
- **Positive**: Avoids shipping mock notification data in production client JavaScript bundles when the feature is not active.
- **Positive**: Provides a fully specified, compliant data architecture ready for immediate implementation in Phase 16 and Phase 8.
- **Negative**: The notification bell remains invisible in the header until backend ingestion and APIs are fully wired.
