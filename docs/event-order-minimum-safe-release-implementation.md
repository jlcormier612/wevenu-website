# Event Order — Minimum Safe Release Implementation

**Date:** 2026-08-13  
**Repo:** `wevenu-website`  
**Sources of truth:**
- `docs/event-order-product-readiness-recommendation.md`
- `docs/event-order-enable-control-recommendation.md`  
**Scope:** Exactly four approved changes. No commit/push. No venue automatically enabled.

---

## 1. Exact files changed

### Schema (grant only)
- `supabase/migrations/20261289000000_event_order_hq_venues_update_grant.sql` *(new)*  
  — `grant update on public.venues to service_role;` only. No default change, no backfill, no row updates.

### HQ control
- `lib/hq/crm-service.ts` — `setEventOrderEnabled` via `createAdminClient()`
- `app/admin/actions.ts` — `setEventOrderEnabledAction(venueId, formData)`
- `components/hq/venue-detail/event-order-enable-section.tsx` *(new)* — Enable / Disable forms
- `app/admin/venues/[venueId]/page.tsx` — wires the section
- `lib/hq/venue-detail-types.ts` — `eventOrderEnabled`
- `lib/hq/venue-detail-service.ts` — reads `event_order_enabled`

### $0 warning
- `lib/event-orders/zero-total-warning.ts` *(new)* — pure helper + copy
- `components/event-orders/zero-total-confirm.tsx` *(new)* — Cancel / Continue dialog
- `components/event-orders/event-order-panel.tsx` — Finalize and Share gated through warning
- `components/sharing/share-dialog.tsx` — respects `cancelled` from share path

### Tests
- `lib/event-orders/minimum-safe-release.test.ts` *(new)*

### QA (not product)
- `docs/qa/event-order-minimum-safe-release/smoke.mjs`
- `docs/qa/event-order-minimum-safe-release/results.json`
- `docs/qa/event-order-minimum-safe-release/*.png` (browser evidence)

### This document
- `docs/event-order-minimum-safe-release-implementation.md`

### Local data hygiene (no code)
- Two leftover **D7A Test Wedding Template** rows deleted from Sweet Daisy QA venue earlier in this engagement. Confirmed absent at finish (`0` matching rows). Not re-deleted.

---

## 2. Exact behavior implemented

Four approved changes only:

1. **HQ per-venue Event Orders enable/disable** on `/admin/venues/[venueId]`.
2. **$0 total warning** before Finalize and before Share when running total is exactly `$0.00`.
3. **Focused automated regression tests** for the warning helpers and related domain gates.
4. **D7A duplicate template cleanup** on the Sweet Daisy QA account (local data only).

No Event Order architecture redesign. No starter content changes. No generalized feature-flag system. No venue-facing Settings toggle.

---

## 3. HQ control behavior

- Visible only on HQ venue detail (`EventOrderEnableSection`).
- Status shows **Enabled** or **Disabled**.
- **Enable Event Orders** / **Disable Event Orders** submit forms bound to `setEventOrderEnabledAction`.
- Action requires HQ admin (`requireAdminUser` / `getHqAdmin`); updates only `venues.event_order_enabled` for that venue id.
- Enabling shows the Event Order tab on that venue’s event workspace; disabling hides it.
- Toggle does **not** create, delete, or mutate Event Order rows.
- Applied migration grants `service_role` **UPDATE** on `public.venues` so the admin client can persist the flip (see Issues).

---

## 4. $0 warning behavior

- Helper: `eventOrderRequiresZeroTotalWarning(total)` → `true` only when `total === 0`.
- Copy discloses that `$0.00` must be intentional; complimentary/unpriced items remain allowed.
- Finalize and Share both open `EventOrderZeroTotalConfirmDialog` when total is `$0.00`.
- **Cancel** (default / Escape / backdrop) leaves the order editable and does not commit.
- **Continue — Finalize** / **Continue — Share** runs the existing action unchanged.
- Non-zero totals skip the dialog.
- Starter content and `$0` line items were **not** changed.

---

## 5. Test coverage

`lib/event-orders/minimum-safe-release.test.ts` covers:

- warning required at total `0`, not above `0`
- warning copy discloses intentional `$0.00` without forbidding priced lines
- starter masters remain deliberately zero-priced structure
- related domain gates (share requires finalized; finalize needs ≥1 line; sum/fingerprint helpers)

**Validation run (2026-08-13):**

- `npx tsc --noEmit` — pass (exit 0)
- `npm test` — **549 pass / 0 fail**

---

## 6. Browser validation

Script: `docs/qa/event-order-minimum-safe-release/smoke.mjs`  
Venue: Sweet Daisy `69cfd906-0d15-4e5c-8bab-ed106b411c34`  
Result: **17 pass / 0 fail** (`docs/qa/event-order-minimum-safe-release/results.json`)

Verified:

| Check | Result |
|---|---|
| HQ section visible while Disabled | PASS |
| Enable via HQ UI persists in DB (`event_order_enabled = t`) | PASS (`db-enabled-via-hq`) |
| HQ UI shows Enabled + Disable | PASS |
| Event Order tab visible when enabled | PASS |
| Running total `$0` / `$0.00` accepted | PASS (`Running total: $0`) |
| Zero-total warning appears before Finalize | PASS |
| Dialog-scoped Cancel leaves Finalize available | PASS |
| Continue — Finalize commits | PASS |
| Disable via HQ restores DB `false` | PASS |
| Tab/content hidden when disabled | PASS |
| Final flag forced `false` in `finally` | PASS |

Evidence screenshots: `01`–`05` under `docs/qa/event-order-minimum-safe-release/`.

---

## 7. Issues encountered

### service_role UPDATE grant gap (root cause of HQ enable 500)

- Recommendation assumed service-role UPDATE on `venues` already worked.
- Live fact: `service_role` had **SELECT only** (`20260909000000_notification_engine_service_role_grants.sql`); `has_table_privilege(...,'UPDATE')` was `false`.
- RLS allows venue-owner UPDATE only; HQ has SELECT via `venues_hq_select`. Admin client bypasses RLS but still needs table privilege.
- Symptom: POST Enable → 500 `permission denied for table venues`.
- Fix: migration `20261289000000_event_order_hq_venues_update_grant.sql` — **only** `grant update on public.venues to service_role;`. Applied to local Docker Supabase. After grant, HQ Enable persisted without DB fallback.

### Smoke script fixes (QA only)

1. Accept UI total as `$0` or `$0.00`.
2. Scope Cancel to `getByRole('alertdialog').getByRole('button', { name: /^Cancel$/i })` (backdrop also has `aria-label="Cancel"`).
3. Continue Finalize path + always restore `event_order_enabled = false` in `finally`.

### HQ admin row for local QA

- `owner@example.com` already had `hq_admins.is_active = true` for local QA; left unchanged.

---

## 8. DO-NOT-TOUCH confirmation

Unchanged / not touched:

- Event Order domain model, schema fields, copy-at-application, finalization architecture, immutability triggers, `shared_at` / portal release semantics
- Starter content, pricing, line items, provisioning/idempotency
- Packages, Inventory, Invoices, Payments, Payment Plans, Contracts coupling
- Left navigation, Library IA, Help & Guides, Luv, Dashboard
- Pipeline, Automations, Messaging, Leads, Vendors, Clients, Tasks, Requests, Tours, Branding
- No generalized feature-flag system; no unrelated venue flag changes
- No column default change; no backfill of `event_order_enabled = true`

---

## 9. Venue enablement state

**No venue was automatically enabled.**

Validation venue after smoke:

| Venue | ID | `event_order_enabled` |
|---|---|---|
| Sweet Daisy Barn & Farm | `69cfd906-0d15-4e5c-8bab-ed106b411c34` | **false** |

All venues in local DB: **0** with `event_order_enabled = true` (8 venues total).

Temporary enable during smoke was restored via HQ Disable + `finally` SQL guard.

---

## 10. STOP

Four approved changes implemented and validated. Stopped here — no commit, no push, no real-venue enablement, no scope expansion.

---

## Follow-up (2026-08-14)

Remaining controlled-release gaps (clearer `$0` copy, lifecycle gate extraction + expanded regression tests, CERT template rename hygiene, reopen/templates UI re-check) are documented in `docs/event-order-controlled-release-remaining.md`. No commit/push; no venue left enabled.
