# DramaShort Architecture Decision Records (ADR) Registry

This directory maintains the immutable architectural history and technical decisions governing DramaShort's platform evolution. Architecture Decision Records capture significant architectural choices, along with their context, trade-offs, and consequences.

---

## ADR Index Registry

| ID | Title | Status | Date | Decision Summary | File Link |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ADR-0001** | Account Deletion, Right to Erasure, and Financial Records Retention Policy | **Accepted** | 2026-10-05 | Enforce GDPR Art. 17 right to erasure via `DELETE /api/account` and `auth.admin.deleteUser()`, cascading deletion across personal engagement tables while irreversibly anonymizing financial transaction ledgers for Phase 8 statutory audits. | [`0001-account-deletion-and-data-retention.md`](0001-account-deletion-and-data-retention.md) |
| **ADR-0002** | Notification System Architecture, Schema Contract, and Delivery Pipeline | **Accepted** | 2026-10-05 | Hide mock notification bell behind `NEXT_PUBLIC_FEATURE_NOTIFICATIONS` flag; establish target `public.notifications` schema in User DB with RLS; define lifecycle event triggers for episode releases and Telegram bridge. | [`0002-notifications-system-architecture.md`](0002-notifications-system-architecture.md) |
| **ADR-0003** | Database Topology Decision (Consolidated Single Project vs. Dual-Database Split) | **Accepted** — direction superseded by ADR-0005 | 2026-10-06 | Adopt **Option A (Consolidation)**: Merge Content DB and User DB into a single Supabase project partitioned into `content` and `public` schemas. Enforce true foreign keys (`ON DELETE CASCADE`), native cross-schema RLS for Phase 8 paywalls, single-query SQL joins for trending, server-signed video tokens (Task 10.6), and hybrid in-database analytics (Task 15.1). | [`0003-database-topology.md`](0003-database-topology.md) |
| **ADR-0004** | Payment Provider Architecture, Webhook Security & Idempotent Fulfillment | **Accepted** | 2026-10-10 | Adopt provider-agnostic hosted checkout backed by `payment_orders` state machine, fail-closed HMAC-SHA256 signature verification, 300s timestamp freshness, event deduplication, and atomic `fulfill_payment_order` procedure. | [`0004-payment-provider-architecture.md`](0004-payment-provider-architecture.md) |
| **ADR-0005** | Single Supabase Project in Singapore | **Accepted** | 2026-10-12 | Run on one new project, `dramashort` in Singapore (`ap-southeast-1`), with every table in `public` and one migration chain in `supabase/migrations/`. The catalog is copied from dramashort-content; accounts start fresh; the app reads three variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`). Supersedes ADR-0003's merge direction and `content` schema. | [`0005-single-supabase-project.md`](0005-single-supabase-project.md) |

---

## Architectural Context & Decision Gates

### ADR-0001: Data Privacy & Retention Policy
- **Primary Milestone**: Phase 11 (Task 11.3) & Phase 8 (Monetization Invariants)
- **Key Invariants**:
  - Personal data (`profiles`, `favorites`, `watch_history`, `custom_lists`) deleted immediately via foreign key cascade upon account deletion.
  - Financial records (`purchases`, `credit_transactions`, `invoices`) retain statutory tax audit data (amount, timestamp, SKU) while severing PII by setting `user_id = NULL` or applying one-way cryptographic pseudonymization.

### ADR-0002: Notification Infrastructure
- **Primary Milestone**: Phase 11 (Task 11.7 Concealment) & Phase 16 (Task 16.3 / Telegram Bot Bridge)
- **Key Invariants**:
  - Zero mock data in production bundles when feature flag is off.
  - User-scoped transactional records in `public.notifications` with strictly isolated RLS policies.
  - Bi-directional notification delivery supporting Web UI and Telegram Bot (`@DramaShortBot`) inline streaming buttons.

### ADR-0003: Database Topology (Decision Gate for Phase 13.2 & Phase 8)
> **Direction superseded by [ADR-0005](0005-single-supabase-project.md) on 2026-10-12.** The Task 13.2 merge below was prepared but never carried out. The single project is a new Singapore project with every table in `public`, not a `content` schema inside dramashort-user. ADR-0003's case for running on one project still stands.

- **Primary Milestone**: Phase 13 (Task 13.1 Decision Gate & Task 13.2 Execution)
- **Downstream Dependencies & Interlocks**:
  - **Task 10.6 (Episode Media Lockdown & Signed Delivery)**: Adopts server-signed video tokens (Bunny Stream / Cloudflare Stream token signing with 300s TTL) evaluated directly alongside user entitlements in `/api/playback/[episodeId]`.
  - **Task 13.2 Execution**: Defines the 6-step cutover roadmap to merge `czkkzoiuyqybafacpgsp` (Content DB) into `bpidsbcrvpkavvdvtpgh` (User DB) under the `content` schema in `supabase/user/supabase/migrations/`.
  - **Task 15.1 & 15.3 (Real-Time Playback Analytics & Trending)**: Adopts hybrid analytics architecture: in-database `public.analytics_events` for native SQL trending rollups (`JOIN content.titles`) and external telemetry for marketing funnels.
  - **Phase 8 (Freemium Monetization & Coin Paywall)**: Direct PostgreSQL RLS evaluation between `content.episode_media` and `public.user_unlocked_episodes`, removing multi-hop `service_role` proxy vulnerabilities.

### ADR-0005: Single Supabase Project (Task 13.7)
- **Primary Milestone**: Phase 13 (Task 13.7)
- **Key Invariants**:
  - One project, one schema (`public`), one migration chain (`supabase/migrations/`), one generated types file (`types/supabase.ts`).
  - Three environment variables. `NEXT_PUBLIC_*` values are read as literal `process.env` expressions so Next.js builds them into browser code.
  - Tables that existed in both old projects keep the definition of the side the app reads and writes them through (ADR-0005 decision 6). A schema fingerprint comparison checks the single chain against both old databases.
  - Vercel functions run in `sin1`, next to the database.

---

## Governance & Life Cycle

1. **Format Standards**: Each ADR must follow the standardized structure:
   - **Status**: Proposed, Accepted, Rejected, Deprecated, Superseded
   - **Date**: YYYY-MM-DD
   - **Context**: Problem background, business motivation, and technical environment
   - **Problem Statement**: Explicit definition of architectural tension
   - **Options Considered**: Exhaustive analysis of candidate architectures
   - **Comparative Trade-Off Matrix**: Multi-dimensional evaluation across data integrity, performance, cost, and complexity
   - **Decision Criteria**: Objective filters applied to choose the winning option
   - **Recommendation / Decision**: Definite architectural decision
   - **Implementation Roadmap**: Phased execution schedule and migration plan
   - **Consequences**: Positive benefits and negative trade-offs with mitigations

2. **Immutability Principle**: Once an ADR is marked **Accepted**, its text remains historically immutable. If architecture evolves, author a new ADR superseding the previous record (e.g. *Superseded by ADR-000X*).
