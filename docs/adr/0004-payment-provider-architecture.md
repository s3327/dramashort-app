# ADR-0004: Payment Provider Architecture, Webhook Security & Idempotent Fulfillment

[← Back to ADR Registry](README.md)

## Status
Accepted

## Date
2026-10-10

## Context
DramaShort Phase 8 introduced the short drama freemium monetization engine, allowing viewers to purchase coin bundles (`coins_starter_100`, `coins_popular_350`, `coins_binge_800`) or subscribe to VIP Weekly Passes (`vip_weekly_pass`) to unlock premium episodes beyond Episode 5.

Initial prototypes implemented a simulated checkout endpoint (`POST /api/payments/create-checkout`) and a preliminary webhook listener (`POST /api/payments/webhook`). During security review (October 2026 Security & Stability Review), critical vulnerabilities and architectural deficiencies were identified:
1. **Unrestricted Client-Side Minting (P0)**: In production, `POST /api/payments/create-checkout` immediately credited user wallets without verifying external financial settlement or checking environment execution mode.
2. **Forged Webhook Acceptance (P0)**: Webhook secret verification was optional, comparisons used non-constant-time equality, and fulfillment trusted untrusted user/package IDs from the request body rather than an authoritative database record.
3. **Database Check-Then-Insert Race Conditions (P0)**: Webhook retries arriving simultaneously could bypass application-layer idempotency checks due to lack of database row locks and unique constraints on purchase references.
4. **Open Redirect Risks**: The checkout endpoint echoed unvalidated user-supplied `returnUrl` parameters without restricting URLs to relative paths.

---

## Decision

We adopt a **Provider-Agnostic Hosted Checkout Architecture** backed by an authoritative database state machine (`public.payment_orders`), idempotent webhook deduplication (`public.payment_webhook_events`), cryptographic HMAC-SHA256 signature verification, and atomic database procedure fulfillment (`public.fulfill_payment_order`).

### 1. Hosted Checkout Over Direct Card Ingestion (PCI DSS Compliance)
- Cardholder PAN data, expiration dates, and CVVs must **never** touch DramaShort application servers or Supabase databases.
- The platform delegates checkout UI and card capture entirely to PCI DSS Level 1 certified hosted checkout sessions (e.g., Stripe Checkout, LemonSqueezy, or Paddle).
- The server creates an order in `payment_orders` with status `'pending'`, initiates the hosted checkout session with the provider, and redirects the client to the provider's secure hosted domain.

### 2. Authoritative Database State Machine (`public.payment_orders`)
- The server creates a `payment_orders` row containing:
  - `id`: Canonical UUIDv4 order identifier.
  - `user_id`: Authenticated user UUID bound to `auth.users(id)`.
  - `package_id`: Canonical coin package or VIP pass identifier.
  - `amount_minor`: Smallest currency unit (cents), derived strictly from server package definitions.
  - `currency`: ISO 4217 currency code (default: `'USD'`).
  - `provider`: Target payment gateway provider (`'stripe'`, `'lemonsqueezy'`, or `'simulated'`).
  - `status`: State machine: `'pending'` → `'paid'` | `'failed'` | `'expired'` | `'refunded'`.
- Row Level Security (RLS) restricts access: authenticated users may only `SELECT` their own orders. Mutations are strictly restricted to `service_role`.

### 3. Fail-Closed Webhook Verification & Nonce Deduplication
- **Fail-Closed Guarantee**: If `PAYMENT_WEBHOOK_SECRET` is unset, `POST /api/payments/webhook` returns HTTP 500 immediately. Unsigned payment events are never accepted.
- **Raw Body Consumption**: The raw request body is read as unparsed text (`req.text()`) to compute exact HMAC-SHA256 digests.
- **Constant-Time Verification**: Signatures are verified using `crypto.timingSafeEqual` over fixed-length buffer digests to eliminate timing side-channel attacks.
- **Replay Protection**: Webhook timestamps must fall within 300 seconds (5 minutes) of server time.
- **Event Deduplication**: Webhook event IDs are inserted into `public.payment_webhook_events`. Duplicates (`23505`) return HTTP 200 `{ received: true, duplicate: true }` without repeating fulfillment.
- **Zero-Trust Body Payload**: The webhook handler **never** reads `userId`, `packageId`, or `amount` from the webhook body to grant benefits. It resolves the `payment_orders` record by order ID / session metadata and fulfills according to the verified database order.

### 4. Atomic Database Stored Procedure (`public.fulfill_payment_order`)
- Fulfillment executes inside a single PostgreSQL transaction with row-level locking (`SELECT ... FOR UPDATE`):
  1. If `order.status = 'paid'`, returns `{ duplicate: true }` immediately.
  2. If `order.status = 'pending'`, transitions order to `'paid'`, updates `paid_at`, and credits the wallet balance or extends VIP pass.
  3. Writes an immutable audit row into `public.coin_transactions` with `reference_id = order.id::text`.
  4. Partial unique index `uq_coin_tx_purchase_reference` on `coin_transactions (reference_id) WHERE transaction_type = 'purchase'` provides a hard cryptographic database guarantee against double-crediting.

### 5. Append-Only Financial Ledger & Refund Policy
- Financial records in `coin_transactions` are immutable and append-only.
- In the event of chargebacks or refunds, the order status transitions to `'refunded'` and an offsetting debit row with `transaction_type = 'refund'` is inserted. Historical ledger rows are never updated or deleted.

---

## Consequences

### Positive
- **Complete Elimination of Free Coin Exploits**: No code path in production can mint coins without authenticated provider confirmation or admin credentials.
- **Deterministic Idempotency**: Concurrently arriving webhooks are safely deduplicated at both the webhook table and the ledger index level.
- **Zero Sensitive Data Footprint**: PCI DSS scope is minimized to SAQ-A compliance via hosted checkout.
- **Provider Agnosticism**: The platform core is completely decoupled from payment vendor specifics, allowing seamless transitions between Stripe, LemonSqueezy, or local regional gateways.

### Trade-offs & Mitigations
- **Asynchronous Settlement**: Users returning from hosted checkout may experience a short delay while webhooks process.
  *Mitigation*: The frontend displays a smooth polling screen querying `/api/user/wallet` until the updated balance or VIP state is confirmed.
- **Testing Requirements**: Local testing requires explicit simulation flags (`ENABLE_SIMULATED_CHECKOUT=true` in non-production) or webhook forwarding CLIs (e.g. `stripe listen`).
