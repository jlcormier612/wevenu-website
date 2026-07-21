# Sprint 2 — Vendor Certification Pass: Final Report

**Status: Complete.** Every item from the last reconciliation was re-verified against live code rather than trusted from documentation. All 12 core vendor workflows are certified end-to-end under a real authenticated vendor session. Vendor Payment Visibility is built and live-verified. Two real mobile breaks were found and fixed by running concrete scenarios, not by assumption.

This sprint's own framing, from the brief: *"Every vendor-facing workflow must succeed end-to-end under a real authenticated vendor account. That's the thing you're certifying — not individual pages."* Every claim below was verified that way: a real signed vendor JWT (never the superuser CLI session, which bypasses RLS entirely), real fixtures created and cleaned up after each check, real reads and writes attempted and their actual database effect confirmed — not just that an RPC returned `{ok: true}`.

## What Sprint 2 shipped

| Area | Outcome |
|---|---|
| Fresh assessment | Every item in the prior roadmap re-verified live; one item (pipeline stage customization) found stale — more done than documented; two items (calendar sync sub-claims) partially stale |
| Vendor Certification Pass | All 12 named workflows certified end-to-end; 7 real defects found and fixed |
| Vendor Payment Visibility | Built and live-verified — a summary only, per explicit scope decision |
| Mobile scenarios | 5 scenarios defined and run against real layouts; 2 genuine breaks found and fixed |
| Documentation | Stale roadmap claims corrected; `docs/platform-status-snapshot.md`, `docs/launch-verification-script.md`, `docs/launch-confidence-matrix.md` created |

## The Vendor Certification Pass

Twelve workflows, each certified end-to-end:

1. **Receive invitation** — venue sends a real email via `sendEmail()`, records a `vendor_invitations` row. Already correct.
2. **Accept invitation** — `claim_vendor_profile` RPC correctly claims the profile. **Found and fixed:** the post-claim engagement-event lookup (`vendor.invitation_accepted`) read `vendor_invitations` through the newly-claimed vendor's own session; that table has no vendor-scoped RLS policy, so the read silently returned nothing and the analytics event silently never fired, on every single claim. No user-facing failure — just quietly missing telemetry. Fixed by routing that one internal lookup through the admin client, the same sanctioned pattern `lib/contracts/service.ts`'s `signContractByToken` already uses for "no venue_staff session yet" reads.
3. **Open dashboard** — **found and fixed:** `getVendorDashboardData`'s "upcoming events" query read `event_vendor_assignments` directly through the vendor's RLS-scoped session — the same defect class as the bug Sprint 1 fixed in the per-event workspace, just in a different function nobody had re-checked. The Dashboard's own events section was empty for every real vendor. Fixed by routing through `get_vendor_events` (see below) instead of adding a fourth near-duplicate query shape.
4. **View event** — Sprint 1's fix (`get_vendor_event_detail`), re-verified this sprint as part of a combined live test (assignment, event, venue, client, shared document, all in one fixture).
5. **Upload attachment / send message** — Sprint 1's vendor Conversation attachment work, re-verified this sprint (message sent, RPCs confirmed present, build clean throughout).
6. **Download floor plan** — Sprint 1's Vendor Event Assets work, re-verified this sprint (`get_vendor_floor_plan` returns a real shared plan by name).
7. **Complete task** — **found and fixed, two bugs at once.** `completeEventTask` had the same RLS-blocks-silently-succeeds defect (confirmed live: `HTTP 204` while the database showed the task never actually completed), *and* a separate authorization gap — it received `vendorId` but never used it to verify the task's event belonged to an assignment the calling vendor owns (`void vendorId`). Latent only because RLS happened to block the write anyway; fixing the RLS gap without also fixing this would have let any vendor complete any other vendor's task. Fixed both in one RPC (`complete_vendor_event_task`), and live-verified the fix specifically: created a second, unrelated vendor and confirmed it **cannot** complete the first vendor's task (`{"ok":false,"error":"not_found"}`, task status unchanged).
8. **Update notes** — **found and fixed:** `updateAssignmentNotes` had the identical RLS-blocks-silently-succeeds defect — `HTTP 204`, note field confirmed unchanged via a direct database read. Fixed via a new `update_vendor_assignment_notes` RPC; live-verified the note actually persists now.
9. **Check documents** — the original event_documents/wrong-column bug Sprint 1 fixed, re-verified this sprint as part of the combined live test.
10. **Respond to inquiry** — **found and fixed, a different bug class entirely.** `vendor_inquiries` has a completely correct RLS policy (`vendor_inquiries_vendor_access`), but the table was **never granted to the `authenticated` role at all** — a real `42501 permission denied` error, not a silent RLS block. This is a Postgres privilege-layer gap, evaluated *before* RLS runs. Confirmed the same gap independently blocks the entire feature (list, create, update, delete), not just "respond." Fixed with `grant select, insert, update, delete on vendor_inquiries to authenticated`; live-verified a real status update succeeds and persists.
11. **View payment** — the new Sprint 2 capability (below).
12. — (Personal Tasks, found along the way): **the exact same missing-GRANT defect also existed on `vendor_tasks`.** This wasn't one of the 12 named workflows verbatim, but it's the entire "Personal Tasks" feature (create/complete/uncomplete) inside the Tasks tab, and it was completely broken — `permission denied for table vendor_tasks` on every read. Previously assumed correct (Sprint 1 checked its RLS policy and stopped there, the same shallow-verification blind spot this pass exists to catch). Fixed with the same GRANT pattern; live-verified: created a real personal task, marked it complete, confirmed both operations actually persisted.

**A note on what this confirms about the audit method:** checking `pg_policies` alone — what Sprint 1's "sibling audit" did — is not sufficient. A table can have a perfectly correct RLS policy and still be completely unreachable because the underlying `GRANT` was never added. This sprint checked `information_schema.role_table_grants` for every vendor-relevant table after finding the first instance (`vendor_inquiries`), which is how `vendor_tasks` was caught in the same pass rather than in a future one.

## Vendor Payment Visibility

Built exactly to the approved scope: *"What am I being paid?" and "Has it been paid?"* — nothing else. Explicitly resisted: invoices, payment history, ACH, Stripe, refunds, deposits — those belong to a later, separate accounting initiative.

- `event_vendor_assignments` gained two columns: `agreed_fee numeric`, `payment_status` (`pending`/`paid`).
- Venue side: `components/events/vendors/event-vendors-section.tsx` gained an inline `VendorPaymentControl` on each assignment row — a fee amount (click to edit, `window.prompt`-based, matching the existing `handleRenamePlan` convention) and a Pending/Paid toggle pill (matching the existing `ShareForSeatingToggle` convention). No new modal; both patterns were already established elsewhere in this codebase.
- Vendor side: a payment summary card in the Overview tab, rendered only once the venue has set a fee.
- `get_vendor_event_detail` extended to return both fields; **live-verified full round trip**: set a fee as the venue, confirmed the vendor's own RPC call sees it; flipped status to Paid, confirmed the vendor sees the update.

## Mobile scenarios — run, not assumed

Five scenarios, chosen to cover every login type against real risk already found across both sprints:

1. Couple manages the guest list and RSVPs from a phone.
2. Vendor checks in on wedding day, views a shared floor plan, and messages the venue from a phone.
3. Coordinator checks the calendar and today's payments from a phone/tablet on-site.
4. Couple submits their seating chart from a phone (regression check on Sprint 1's fix).
5. Vendor uploads an attachment and completes a task from a phone.

Running these against the actual component code (the same reasoning-based method the Sprint 1 seating-chart audit used — no browser available in this environment, so every judgment is made by reading the real layout code and reasoning through 375px/768px behavior) found two genuine breaks, not just the one already flagged going in:

- **Guest List row** (`components/portal/guest-section.tsx`) — up to 9 always-visible elements in one non-wrapping flex row. Fixed by collapsing the three least time-critical actions (Copy Link, Edit, Delete) into a `DropdownMenu`, keeping name, invitation status, RSVP status, RSVP preview, and the details-expand chevron directly visible.
- **Vendor Tasks tab "Add task" form** (`components/vendor-app/vendor-event-workspace.tsx`) — a fixed `w-36` date input sitting next to a `flex-1` text input with no wrap, found while walking scenario 5. Fixed with `flex-col sm:flex-row` — stacks on phone, sits inline from `sm:` up.

Everything else run against the scenarios (the attachment compose bar, the new payment summary card, the seating chart, the coordinator calendar/payments views) held up — confirmed via the same code-reading method, and (for calendar/payments) already characterized correctly in the prior broad audit as "usable but rough, not broken."

## Documentation corrections

- **Pipeline stage customization** — the roadmap claimed "still fixed at 7 stages." Re-verified: a full Pipeline Templates feature exists (`lib/pipeline-templates/*`, editable UI at `components/settings/pipeline-template-form.tsx`, drag-to-reorder), and the live Leads board renders from venue-defined stages, not a hardcoded list. What's actually fixed is a much narrower thing: each stage maps to one of 7 *canonical* stages for reporting purposes, an intentional taxonomy constraint, not "no customization." Removed from the roadmap's remaining-work list; added to the done-capabilities list.
- **Calendar gaps** — the roadmap bundled three sub-claims. Two are done (week/day views, staff visibility on the grid); only iCal/webcal sync is still genuinely absent. Narrowed accordingly.

## What's next

Nothing on the platform is currently known-unbuilt. The only remaining gap is verification, not construction: `docs/launch-verification-script.md`'s Verification Flow needs to actually be run by a person on a real device — this environment cannot do that. See `docs/platform-status-snapshot.md` for the current single-document answer to what's complete, what remains, what's verified, and what still needs human validation.
