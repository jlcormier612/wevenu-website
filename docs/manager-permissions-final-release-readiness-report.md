# Manager Permissions — Final Release Readiness Report

This closes the Manager Permissions Architecture Remediation. It documents what was implemented against the reviewed plan (`docs/manager-permissions-architecture-remediation-plan.md`), the live-validation results against that plan's explicit acceptance criteria, and the updated release recommendation.

## What Changed

Three migrations, plus one small application-layer change to surface a new error state clearly:

| # | File | Closes | Mechanism |
|---|---|---|---|
| 1 | `supabase/migrations/20261001000000_tr_g5_refund_rls_backstop.sql` | TR-G5 | One `WITH CHECK` condition added to the existing `payment_line_items_update` RLS policy |
| 2 | `supabase/migrations/20261002000000_tr_g6_core_object_delete_role_gate.sql` | TR-G6 | A `RESTRICTIVE FOR DELETE` policy added per table, across the 40 tables the original TR-G1 pass never reached — ANDed against each table's existing permissive policy, which is left completely untouched |
| 3 | `supabase/migrations/20261003000000_tr_g7_invite_identity_check.sql` | TR-G7 | `accept_team_invitation` rewritten with an email-match check; a new partial unique index makes duplicate active roles per user per venue structurally impossible |
| — | `lib/team/service.ts`, `app/join/page.tsx` | TR-G7 (UX) | `acceptTeamInvitation` now propagates the RPC's `error` field; `/join` shows a specific message for `email_mismatch` and `already_a_member` instead of a generic fallback |

One implementation detail worth noting explicitly: TR-G6 was implemented using Postgres `RESTRICTIVE` policies rather than the drop-and-resplit approach sketched in the original plan. This is a strictly safer mechanism for the same outcome — it narrows `DELETE` without needing to read, understand, or risk drifting from each table's current `SELECT`/`INSERT`/`UPDATE` policy text (several of these 40 tables have been touched by unrelated migrations since Sprint 107). The resulting RLS behavior is exactly what was approved; only the SQL mechanism used to get there changed.

All three migrations applied cleanly via a full local `db reset`, replaying the entire migration history from empty with no errors. `tsc --noEmit` is clean (the only two reported errors were pre-existing, unrelated stale `.next` type-validator entries for routes that don't exist in the source tree — confirmed by grep, not caused by this work).

## Validation Results

Re-run against the exact methodology used in the original audit: real second and third Supabase Auth accounts, walked through the real invite/accept flow, holding genuinely active Manager, Coordinator, and Staff roles — not superuser simulation. (The local database was fully reset as part of applying these migrations, which also wiped the venue/owner account created during the original audit; it was recreated through the real `complete_venue_setup` flow before testing resumed.)

Every row of the acceptance criteria defined in the reviewed plan was tested and passed:

**TR-G5 — Refund RLS backstop**
- Manager raw refund attempt → RLS denial (explicit policy-violation error, row unchanged) ✅
- Coordinator raw refund attempt → RLS denial ✅
- Staff raw refund attempt → still denied, no regression ✅
- Owner refund → still succeeds, no regression ✅
- Manager non-refund edit (`notes` field) → still succeeds, confirming the fix is scoped to the refund transition only ✅

**TR-G6 — DELETE role-gate on 40 tables**
- Staff raw `DELETE` on `clients` → denied, row survives; repeated on `leads` to confirm the fix generalizes across tables, not just the one tested in the original audit → denied, row survives ✅
- Coordinator raw `DELETE` on `clients` → denied ✅
- Manager raw `DELETE` → succeeds, matching the intended tier (same as contracts/payments) ✅
- Owner raw `DELETE` (on `clients` and `leads`) → still succeeds, no regression ✅
- Staff `UPDATE` on `clients` (editing guest count) → still succeeds, no collateral restriction on normal editing ✅

**TR-G7 — Invite identity check**
- Unrelated, already-registered account claiming a mismatched-email invite → rejected (`email_mismatch`), invite row left completely unmutated ✅
- The correctly-addressed invitee accepting their own invite → still succeeds, no regression (tested for Manager, Staff, and Coordinator) ✅
- Owner accidentally double-inviting an already-active member → rejected (`already_a_member`), no duplicate row created ✅
- Database-wide check for duplicate active `(venue_id, user_id)` pairs after all of the above → zero found ✅

**No-regression checks beyond the acceptance table**, since these fixes touch a shared surface (`venue_staff`, RLS policy composition) where a side effect was plausible:
- Manager can still invite a fresh Staff member — succeeds, unaffected by the new unique index ✅
- Manager still cannot self-promote to Owner — 0 rows affected, unchanged ✅
- Manager still cannot invite at the Manager tier (self-tier escalation) — explicit RLS denial, unchanged ✅

All test data — three real auth accounts, `venue_staff` rows for each, a full client/event/invoice/payment-schedule/payment-line-item chain, a test lead, and the relationship record — was created through real paths and fully removed. Final verification confirms the roster is back to exactly the one real owner, zero leftover clients/events/invoices/leads/relationships, zero duplicate active roles anywhere in the table, and all three test logins now fail with `invalid_credentials`.

## Trust Risk Register

`docs/trust-risk-register.md` updated: TR-G5, TR-G6, TR-G7 added under Governance, each marked ✅ Resolved with the test evidence above. TR-G1's own entry is unchanged — its original risk description, fix, and test record stand exactly as written, since they were accurate for what TR-G1 actually tested and shipped at the time. A new, clearly-labeled "Scope note" was appended after TR-G1's existing scorecard line, explaining that these three gaps were outside TR-G1's original scope rather than a failure of what TR-G1 claimed. The summary table and item count (now 24 items, 20 Resolved) were updated to match.

## Aside, Out of Scope

Supabase's advisory linter flagged during this work that two tables — `public.luv_rollups` and `public.vendor_health_scores` — have Row Level Security disabled entirely, fully exposed to the `anon`/`authenticated` roles. This is a pre-existing, already-known item from earlier in this project's work (explicitly deferred at the time as its own separate security pass, not part of Manager Permissions), not something introduced by this remediation. Flagging it here for visibility since the tooling surfaced it during this session, not because it's part of what closes now — it remains open and untouched.

## Recommendation: **Ready**

All three Architecture Issues from the original audit are closed, live-verified against explicit pass/fail criteria rather than a subjective read, with no regressions found in Owner workflows or in the Manager/Coordinator/Staff capabilities the permission model intends to preserve. The four Product Completion items from the original audit (UI role-transparency, stale copy, roster-visibility granularity, the silent no-op on owner role-change attempts) remain open by design — they were explicitly out of scope for this remediation and don't affect the trust boundary. Manager Permissions is formally closed.

Per the working agreement, the Product Completion roadmap resumes next with **Wedding Website Product Capabilities**.
