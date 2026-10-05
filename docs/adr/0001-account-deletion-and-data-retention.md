# ADR-0001: Account Deletion, Right to Erasure, and Financial Records Retention Policy

## Status
Accepted

## Date
2026-10-05

## Context
Under the General Data Protection Regulation (GDPR, Article 17 "Right to erasure") and app store developer requirements (Apple App Store Guideline 5.1.1(v), Google Play User Data Policy), applications that allow account creation must also offer a complete, straightforward mechanism for users to request and execute the permanent deletion of their accounts and associated personal data.

At the same time, commercial platforms must comply with statutory tax, financial, and accounting record retention obligations (such as the UK Companies Act, US IRS regulations, and EU VAT rules) which mandate that transaction and purchase logs be preserved for statutory audit periods (typically 6 to 7 years).

DramaShort separates its database topology across two Supabase projects:
1. **Content DB** (`czkkzoiuyqybafacpgsp`): Public catalog, dramas, channels, episodes.
2. **User DB** (`bpidsbcrvpkavvdvtpgh`): `auth.users`, `profiles`, `favorites`, `watch_history`, `custom_lists`, `custom_list_items`, and upcoming monetization/credit ledger tables.

## Decision

### 1. Cascade Deletion of Personal & Engagement Data
When an authenticated user requests account deletion via `DELETE /api/account`:
- The application invokes Supabase Auth's service-role administration API: `auth.admin.deleteUser(userId)`.
- Foreign key constraints on the User Database are configured with `ON DELETE CASCADE` referencing `auth.users(id)`:
  - `profiles`: deleted immediately.
  - `favorites`: deleted immediately.
  - `watch_history`: deleted immediately.
  - `custom_lists` & `custom_list_items`: deleted immediately.
- Client-side storage (`localStorage`) containing guest viewing progress and device cached preferences is purged upon completion.

### 2. Pre-Deletion Authentication & Safety Safeguards
To prevent accidental erasure or malicious deletion via stolen or active sessions:
- The user must explicitly type the confirmation string `DELETE` into the modal dialog.
- Re-authentication is enforced:
  - Email/password users must either supply their current password or have signed in within the preceding 5 minutes.
  - OAuth users (Google) must have authenticated within the preceding 5 minutes. If the session is older, a `403 REAUTHENTICATION_REQUIRED` response is returned directing the user to sign in again.

### 3. Financial & Ledger Retention Anonymization (Phase 8 Invariant)
When monetization, coin balances, and transaction history are introduced in Phase 8:
- Direct ledger transaction rows (`purchases`, `credit_transactions`, `invoices`) **must NOT** be deleted via hard cascade when retention is legally required for accounting audits.
- Instead, financial audit rows must sever all Personally Identifiable Information (PII):
  - The foreign key relationship `user_id` will be set to `NULL` (`ON DELETE SET NULL`) or replaced with an irreversibly pseudonymized cryptographic token.
  - User email, display name, IP address, and billing addresses must be wiped from transaction metadata, preserving only non-PII financial audit fields (amount, currency, payment gateway reference ID, timestamp, and product SKU).

## Consequences
- **Positive**: Full compliance with GDPR right to erasure and mobile marketplace distribution rules.
- **Positive**: Immediate termination of account credentials preventing future sign-in or token refresh.
- **Positive**: Guaranteed regulatory compliance for corporate taxation and accounting audit trails.
- **Negative**: Deletion is irreversible; deleted users cannot recover watch history or favorites.
