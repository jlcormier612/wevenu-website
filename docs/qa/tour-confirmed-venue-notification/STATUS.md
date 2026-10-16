# Tour confirmed venue notification — prefs gate email only

**Date:** 2026-10-16  
**Status:** **GREEN (Sandbox DB contract verified)** — migration applied; runtime OFF/ON probes PASS. App deploy `38837832058` for tip `b011a13e` was still in progress at close (SQL gate is live in Supabase independent of the ECS image).

## Product contract (locked)

Settings copy (`app/(app)/settings/communications/page.tsx`):

> These are optional extras — your important activity and alerts will still appear in Hello to Cheers.

**Intended:** Notification preferences control optional **email** (`needs_email` → `processVenueNotificationEmails`). They must **not** suppress in-app `venue_notifications` rows.

## Forensic root cause

`create_venue_notification` early-returned when the per-type preference was OFF → no in-app row. Meadowbrook `pref_tour_confirmed=false` hid Tour confirmed from the bell while the customer confirm email still worked.

Prior evidence: `runtime-probe.json`, `prefs-and-history.json`, `rpc-confirm-probe.json`, `trigger-probe.json`.

## Shared defect scope

**All** preference-gated types in `create_venue_notification` (not only `tour_confirmed`): new_lead, message_received, tour_scheduled, tour_confirmed, proposal_accepted, payments, contracts, vendor check-in, feedback, referral, etc.

## Fix

| Change | Purpose |
|---|---|
| `supabase/migrations/20261419000000_venue_notification_prefs_email_only.sql` | Always insert in-app; `needs_email` from preference CASE |
| Focused tests | `venue-notification-email-pref-contract.test.ts` + matrix / customer-action / tour-coordinator updates |
| Prove script | OFF → in-app + `needs_email=false` |

Commit: **`b011a13ee0f02ff46e52bead039c8aa32f4cf3d9`**

## Runs

| Run | URL | Result |
|---|---|---|
| Apply Sandbox Migration | https://github.com/jlcormier612/wevenu-website/actions/runs/38837830165 | **success** — `202614190…` applied |
| Deploy Sandbox | https://github.com/jlcormier612/wevenu-website/actions/runs/38837832058 | in progress at report time (image tip; DB already fixed) |

## Tests

**48/48 PASS** — `venue-notification-email-pref-contract`, preference-matrix, customer-action-prefs, tour-coordinator-dual-notify, lead-delete-tour-reconcile.

## Runtime verify (disposable fixtures; cleaned; Gina untouched)

`pref-contract-runtime-verify.json`:

| Probe | Result |
|---|---|
| Meadowbrook `pref_tour_confirmed=false` + `confirm_tour_by_token` | **1** in-app `tour_confirmed`, **`needs_email=false`**, `emailed_at=null` |
| Fancy `pref_tour_confirmed=true` + same RPC | **1** in-app, **`needs_email=true`**, `emailed_at=null` |
| Staff email send | **Not attempted** (`processVenueNotificationEmails` skipped to avoid real venue email) |
| Gina tour `81c85d1b…` | Unchanged |

## Untouched

Production, DNS, Resend config, Meadowbrook preference values (left `pref_tour_confirmed=false`), Gina tour/lead/history, real customer communications.
