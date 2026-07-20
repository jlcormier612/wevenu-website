# Commitment Alignment Sprint — Guest List Submission Report

Closes item 1 of 5 in the Commitment Alignment Sprint (formerly Product Completion Sprint), per `docs/commitment-lifecycle-architecture.md` §9's Domain Mapping Matrix. Next: Seating Delegation & Submission.

## What Shipped

| # | File | Delivers |
|---|---|---|
| 1 | `supabase/migrations/20261024000000_commitment_alignment_guest_count_submission.sql` | `guest_count_submissions` table (append-only history); `submit_guest_count`, `get_guest_count_status`, `get_latest_guest_count_submission` RPCs |
| 2 | `supabase/migrations/20261024010000_commitment_alignment_backfill_guest_count_trigger.sql` | Backfills `auto_complete_trigger = 'guest_count_finalized'` onto any already-instantiated "Submit your guest count" task left at its old default of `null` |
| 3 | `lib/playbooks/constants.ts` | New `guest_count_finalized` value in `AUTO_COMPLETE_TRIGGERS`; the stock "Submit your guest count" Client Planning task now wired to it (was `null` — the task existed but had no real commit action, exactly the gap the Domain Mapping Matrix named) |
| 4 | `app/api/portal/guest-count/route.ts` | GET (live status) / POST (the Submit action) |
| 5 | `components/portal/finalize-guest-count-card.tsx` | The couple's Commitment UI — live private suggestion, an explicit two-step confirm-then-submit flow, submission history |
| 6 | `components/portal/guest-section.tsx` | Mounts the card |
| 7 | `lib/events/types.ts`, `lib/events/repository.ts` | `EventWithDetails.guestCountSubmission`, fetched alongside the event's other detail queries |
| 8 | `components/events/booking-overview-summary.tsx`, `components/events/event-detail.tsx` | Coordinator-facing "(submitted by couple [date])" indicator next to the existing guest-count display |

## What This Actually Closes

Two related findings from earlier in this review series land here at once:

- **`docs/booking-financial-architecture-final-release-assessment.md` Finding 1** (guest count triplication/drift) — `events.guest_count` was, and remains, a plainly-editable coordinator field (Event stays venue-owned, per `docs/domain-model.md` — no regression, no capability removed). What was missing was any *other* legitimate way for that number to get set. Now it can also be set by the couple's own explicit Commitment, which is attributable and permanently logged, rather than the coordinator's manual entry silently going stale as the real answer, unlogged and unchallenged, forever.
- **`docs/commitment-lifecycle-architecture.md` §9's Guest List row** — the domain needed "a real 'Finalize Guest Count' Submit action (a Task) that sets `events.guest_count` as a Commitment." That's exactly what shipped: the stock Playbook task ("Submit your guest count," already present in every venue's default Client Planning template, previously wired to nothing — `autoCompleteTrigger: null`) now completes as a direct side effect of the couple's submission, not a separate manual toggle a coordinator has to remember to click.

## Design Decisions Made During Implementation

1. **`events.guest_count` stays coordinator-editable.** Removing that capability would have been a bigger, riskier change than what was asked, and Event's own ownership (venue-owned, per the domain model) doesn't require it. The couple's submission is a second, *attributable* writer, not a replacement for the coordinator's own operational judgment — whichever happened most recently is what's operative, matching the Ownership triad's framing (§4 of the architecture doc): Venue is the Operational Owner of Event, full stop; a client submission is an operational input to that record, the same shape as a Vendor Selection feeding an Event Order line the coordinator ultimately owns.
2. **`guest_count_submissions` is append-only by design**, per "Never Silently Change an Agreement" (§1) — a resubmission never overwrites the prior row; live-tested (see below) with two real submissions, both still present afterward. `events.guest_count` always reflects the latest, but the full history is preserved for whenever a "what did they actually tell us, and when" question comes up.
3. **The live suggested count formula is `attending + attending-with-plus-one`**, not raw invited-guest-list size — a venue plans food/seating around who's actually coming, not who was invited. It's presented as a *suggestion* the couple can override, not a forced value, since a real final headcount sometimes needs a human adjustment (a last-minute no-show, a rounding decision) the raw RSVP data can't capture.
4. **The auto-complete wiring uses native SQL inside the SECURITY DEFINER RPC, not the existing TS-level `triggerAutoComplete` helper.** Investigating that helper's call sites turned up an inconsistency: `lib/contracts/service.ts` explicitly passes an admin/service-role client to it, while `app/api/portal/vendors/route.ts` passes the regular anon-key client — meaning the vendor-selection auto-complete may silently no-op for an anonymous portal request if `event_tasks` RLS doesn't grant it write access (not confirmed either way, out of this item's scope to chase down). Rather than inherit that same fragility, `submit_guest_count` does the `event_tasks` update itself, inside the same SECURITY DEFINER function that already handles token auth — avoiding the whole class of bug by construction. **Flagged as a finding, not fixed**: worth a follow-up look at whether `vendor_selected` (and any other portal-triggered auto-complete) actually fires in production.
5. **Private Until Committed is preserved structurally, not just by convention.** The portal card only ever displays the couple's *own* live count (their own RSVP data, already Client-Owned and already visible to them) — nothing new is exposed. The venue gains visibility to nothing until the explicit two-step (edit → confirm) submit action completes.

## Live Validation

Real venue, client, event (seeded with a coordinator-entered `guest_count: 100`), one real guest created via `/api/portal/guests` and RSVP'd `attending` via `/api/portal/rsvp`, one real Playbook task wired to `guest_count_finalized`, all through real API routes except account-scaffolding rows (venue/venue_staff/portal session — infrastructure, not the feature under test, consistent with this session's established scoping).

- **Live suggestion correctness**: `get_guest_count_status` returned `liveSuggestedCount: 1` for the one attending guest (the plus-one arithmetic path wasn't separately exercised — the test guest's `plus_one` flag, a coordinator/couple-set invitation attribute distinct from the RSVP-time `plus_one_name`, was never set to `true` for this specific test guest; not a defect, just an untested branch of an otherwise-correct formula).
- **Submit → three-way commit, verified independently**: after submitting `142`, confirmed all three effects landed correctly in one transaction: `events.guest_count` updated to `142` (was `100`); a new `guest_count_submissions` row recorded; the wired `event_tasks` row flipped to `complete` with `completed_by: 'system'` and a real `completed_at` timestamp.
- **Resubmission preserves history**: submitted again (`138`). `events.guest_count` correctly updated to the latest value; **both** submission rows (`142` and `138`) remained in `guest_count_submissions`, neither mutated — Never Silently Change an Agreement, confirmed with a live write, not just read from the migration.
- **Security**: invalid token rejected on both GET (`401 invalid_token`) and POST (`{ok:false, error:"invalid_token"}`); a negative count rejected (`invalid_count`) before touching any table.
- **Coordinator-facing read**: `get_latest_guest_count_submission` confirmed to return the latest submission's count and timestamp, scoped correctly by venue and event.
- `tsc --noEmit` clean throughout, aside from the same two pre-existing, unrelated stale `.next` entries noted in every prior report this session.

All test data (venue, venue_staff, client, event, guest, portal session, task, both guest-count submissions, the scaffolding auth user) created and fully removed; final verification confirmed zero rows across every touched table.

## A Process Note, Not a Code Finding

`supabase db query --local -f <migration>` (and piping a multi-statement file into `db query` generally) fails with "cannot insert multiple commands into a prepared statement" — it only accepts one statement at a time. **`supabase migration up --local`** is the correct way to apply a new migration file incrementally: it applies only pending migrations (check first with `migration list --local` — an unapplied file shows `"remote": ""`) and leaves all existing local data untouched, unlike `db reset --local`. Used throughout this item instead of a reset, consistent with the standing instruction not to reach for `db reset --local` casually.

## Recommendation: Guest List Submission Complete

Ready to proceed to item 2 of the Commitment Alignment Sprint — Seating Delegation & Submission — per `docs/commitment-lifecycle-architecture.md` §9/§11's scoping: a real Submit action for the couple's seating plan, plus the Delegation mechanism (§7) for venue-assisted seating, replacing the paused "coordinator seat assignment" item's original ambient-access design.
