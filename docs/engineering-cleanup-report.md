# Engineering Cleanup — Report

**Date:** 2026-07-17
**Status:** Complete. All 7 items from `docs/release-readiness-status.md` §3 closed — 5 by a bounded code/migration fix, 1 by an accurate documentation correction (no code was broken), 1 confirmed as an environment limitation that stays open by nature, not oversight.
**Governing scope:** `docs/release-readiness-status.md`, per explicit direction — improve implementation quality without changing approved product behavior, and no new platform-wide architectural principles introduced. Nothing below reopens Commitment Lifecycle, Timeline, or any other completed initiative; two items touch Timeline/Hosted Experience files, but both are narrow correctness fixes inside the already-approved model, not extensions to it.

---

## What shipped

### 1. RLS enabled on `luv_rollups` and `vendor_health_scores`
Both tables had RLS disabled and were anon-exposed — flagged repeatedly by the local database's own security advisory across this session, never fixed. `luv_rollups` gets a `current_user_venue_id()`-scoped SELECT policy (a real defense-in-depth backstop; the app's only actual access path, `save_luv_rollup()`/`get_luv_rollups()`, is `SECURITY DEFINER` and unaffected). `vendor_health_scores` gets the exact same dual-access shape already used by its two closest structural siblings, `vendor_packages`/`vendor_availability`: a related venue may `SELECT`, any active `vendor_users` member (any role — this is a system-computed score, not a role-gated edit) may read and write their own vendor's row.
Migration: `supabase/migrations/20261101020000_engineering_cleanup_rls_luv_rollups_vendor_health.sql`.
**Live-tested** (real authenticated sessions via anon key, not service-role bypass — service_role has no table grants in this project's local setup, confirmed while building the test): 8/8 checks passed — related venue reads, unrelated venue blocked, vendor's own user reads and writes its own score, unrelated venue blocked from another venue's roll-up, a vendor user blocked from any venue's roll-up, and the `get_luv_rollups` RPC still works end-to-end (confirming the `SECURITY DEFINER` bypass is intact). All test data (2 venues, 1 vendor, 3 auth users, 1 relationship, 1 health score, 1 roll-up) removed; final sweep confirmed zero leftovers.

### 2. Trust Risk Register bookkeeping corrected
`docs/trust-risk-register.md`'s summary table had TR-M5 listed as "Identified" while its own detailed entry above showed ✅ Resolved with full shipped/test evidence, and the closing count read "24 items... 3 Identified" against an actual 25-row table. Corrected the summary row and the count (25 tracked, 20 Resolved, 1 Mitigated, 4 Identified), with a note explaining the correction rather than silently editing history.

### 3. Timeline residual gaps closed
- **`reorderEntry`/`shiftEntriesAfter`** (`lib/timeline/repository.ts`) now carry the same `owner='venue'` guard as their siblings `updateEntry`/`deleteEntry`/`reorderEntries` — a coordinator-only path can no longer read or mutate a client-owned row through either function, closing the one gap `docs/timeline-implementation-report.md` named as not yet defense-in-depth.
- **Change-notification nudge false positives fixed.** Investigation found the actual defect was more specific than originally scoped: `get_website_change_nudges` (Hosted Experience Phase 5) detected "the Schedule changed" by checking whether *any* `timeline_entries` row for the client/venue had a newer `updated_at` than the last publish — no filter on audience or owner. Under the shipped Owner/Lock-State/Visibility model, this meant a coordinator editing an internal-only note, or a couple privately drafting an item never tagged for guests, would silently trigger "your Day-of Schedule was updated... guests who already RSVP'd haven't been told" — untrue on both counts. **Correction to the item's original framing:** gating this on Timeline *Submission* (as originally scoped in the release-readiness doc) would have been wrong — per Commitment Lifecycle §6, audience publication is independent of venue submission, so a couple can publish to guests without ever submitting to their venue. The correct, and actually applied, fix filters on `'guests' = any(audiences)` — the same condition the Schedule section itself already reads by. Migration: `supabase/migrations/20261101000000_engineering_cleanup_change_nudge_audience_filter.sql`. Verified single overload post-migration.

### 4. Refund button hidden client-side for non-Owner roles
TR-M3's refund action was server + RLS enforced correctly (Owner-only, TR-G5's RLS backstop) but visible to every role client-side before the rejection. `app/(app)/payments/[id]/page.tsx` now fetches `getCurrentUserRole()` and passes it through `PaymentScheduleDetail` → `LineItemRow`; the Refund button only renders when `currentUserRole === "owner"`. Fails closed by default (an unset/未-passed role hides the button, doesn't show it). Cosmetic only — the real enforcement is unchanged.

### 5. Live end-to-end browser QA — confirmed still open, by environment limitation
TR-L1/TR-L2/TR-L4 and the TR-B2-adjacent webhook fixes remain verified by code review, `tsc`/`build`, and rolled-back live-database tests, but not by a driven authenticated-browser flow — this environment has no way to do that. Nothing to fix here; carried forward as a named manual QA item, not silently dropped.

### 6. Lead-source mismatch fixed
`create_public_lead` (the live definition, `20260719000000_program2_phase2_relationship_and_conversation_foundation.sql`) hardcoded `leads.source = 'website_form'`, never matching `LEAD_SOURCES`' `'website'` value that every other lead-creation path (manual entry, CSV import) writes. One real channel was silently splitting into two in any by-source report. Migration `supabase/migrations/20261101010000_engineering_cleanup_lead_source_website_mismatch.sql` corrects the literal and backfills existing `'website_form'` rows to `'website'` (the informational `source_data` JSONB sub-field, which separately and correctly still says `"website_form"` for UTM/referrer purposes, is untouched). Verified single overload post-migration.

### 7. Dead `"payment_received"` trigger — verified not a bug, documentation corrected instead
This is the one item where investigation reversed the premise rather than confirming it. `lib/payments/service.ts`'s `markLineItemPaid` already calls `triggerAutoComplete(..., "payment_received", ...)`, dated by its own code comment to a 2026-07-10 fix — three days *after* the 2026-07-07 audit that originally flagged the trigger as dead. `autoCompleteTrigger` (`lib/playbooks/repository.ts`) correctly completes every matching pending/blocked/overdue task on the event, not scoped to a single line item; both stock tasks that default to this trigger ("Final payment," "Verify deposit") work correctly. This finding had been carried forward stale into `docs/release-readiness-status.md` without re-verification — the same staleness pattern as item 2 above, just caught one level later (a finding repeated across two documents rather than one table's own internal inconsistency). No code changed. `docs/release-readiness-status.md` §3 item 7, the Workflow Automation Program 2 bullet, and the Trust Beta Scorecard's Workflow Automation row (#6) were all corrected to remove the stale claim.

---

## Verification

- `tsc --noEmit`: clean except the two pre-existing, unrelated stale `.next` type-validator entries already noted throughout this session (`floor-plan/page.js`, `portal/seating/table/route.js`) — not touched by, or related to, this work.
- `next build`: clean, full production build completed with no errors.
- 3 corrective migrations applied to local (never editing an already-applied one): `20261101000000` (change-nudge audience filter), `20261101010000` (lead-source mismatch), `20261101020000` (RLS enablement). Every changed/new Postgres function verified at exactly one overload.
- 1 live-tested item (RLS enablement) with real authenticated sessions, not service-role bypass; full cleanup with a final zero-leftover sweep.
- No architecture changed. No new platform-wide principle introduced. Two items (3, 7) touched files inside the Timeline / Hosted Experience Platform initiatives; both are narrow correctness fixes inside the already-approved model (an existing ownership guard extended to two functions that were missing it; a detection filter corrected to match a condition the same feature's own read path already uses elsewhere) — not extensions to the architecture itself.

## What's left

Nothing from the Engineering Cleanup scope remains open except item 5 (live browser QA), which is a standing environment limitation, not a deferred fix — it stays a manual pre-launch QA item. `docs/release-readiness-status.md` §3 and its cross-referenced scorecard rows have been updated to reflect all of the above; no other section of that document needed changes.
