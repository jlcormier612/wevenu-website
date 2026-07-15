# Booking Financial Architecture — Phase 3c Implementation Record

**Status: shipped and verified.** The amendment workflow, Event Order revision traceability, and Payment Plan review status, per your Phase 3c refinements. Tenth document in the series — and, with this, Phase 3 (the trust migration) is complete.

## What shipped

- **Create Amended Invoice** creates a new invoice, in Draft, linked to the same Event Order, carrying forward the original's ad hoc lines (tax, fees, one-offs) but never its frozen Event-Order-derived lines — those come from Phase 3a's live projection instead, correctly, from the moment the amendment exists. **The original invoice is never touched** — its status, total, and balance stay exactly as they were. It remains the active financial record until the amendment is itself explicitly reviewed and sent, exactly as you specified. A second amendment is blocked while an unresolved one already exists, so there's never ambiguity about which draft is the real one.
- **Update Draft Invoice** reopens a sent invoice as Draft, deleting its frozen Event-Order lines (Phase 3a's live projection takes back over immediately) while leaving every ad hoc line untouched. **Structurally blocked, not just discouraged**, the moment any payment has been recorded — the guard lives in the one function capable of performing the reversal, not in a UI affordance a coordinator could route around.
- **Event Order revision traceability**: every invoice now permanently records which Event Order revision produced it, stamped once at the freeze moment and never touched again — visible on the invoice as "Generated from Event Order v2," independent of whatever revision Event Order has since moved to.
- **Payment Plan review status** — 🟢 Current / 🟡 Needs Review, computed by direct comparison against the linked invoice's current total, never a timestamp or automatic update. Four resolution actions, always a human choice:
  - **Keep Existing Schedule** and **Collect Remaining Balance Manually** both work the same way underneath — recording which invoice total was reviewed and accepted — with different activity-log wording, since *why* a coordinator chose to leave the schedule alone is real information worth preserving even when the mechanism is identical.
  - **Regenerate Schedule** touches only installments that haven't happened yet. Anything already collected, refunded, or explicitly cancelled is untouched, full stop — the new installments are computed from what's actually still owed (new total minus what's already collected), split by whatever preset the coordinator picks now.
  - **Add Additional Installment** is the surgical option: one new pending line, then the schedule's total is set to match the invoice — it now genuinely does, so this isn't a workaround, it's the schedule catching up to reality.

## Verified

- `tsc --noEmit` clean after fixing one real bug it caught directly: `mapInvoice`'s new optional second parameter turned `.map(mapInvoice)` into an accidental bug, since `Array.prototype.map` passes the array index as the second argument — every list-view invoice would have silently received its own array index as a fake "amended by" object. Fixed by wrapping both call sites in an explicit arrow function.
- `eslint` clean on every new and touched file — the handful of warnings/errors that did surface were individually confirmed via `git diff` as pre-existing content this phase never touched (an unescaped-quote lint error and three unused-import warnings, none introduced here).
- Real-data verification as the simulated `authenticated` role:
  - Created an amended invoice and confirmed the original's status and total were **provably unchanged** afterward — the single most important guarantee in this phase.
  - Confirmed the amendment correctly carries forward only its ad hoc line (a "Rush Fee"), never a copy of the frozen Event-Order line, and that the reverse "amended by" lookup resolves correctly from the original's side.
  - Confirmed a Payment Schedule's `total_amount` does **not** move on its own when its linked invoice's total changes — the core guarantee behind "never automatically."
  - Confirmed `acknowledged_invoice_total` persists correctly for the Keep/Collect-manually path.
  - Confirmed Update Draft Invoice's reversal removes exactly the frozen Event-Order line, keeps the ad hoc line, and resets status back to draft.
  - Confirmed Regenerate Schedule leaves a paid installment completely untouched while replacing only the pending one — the exact guarantee "never touch collected money" depends on.
  - All test data cleaned up via self-rolling-back transactions; confirmed zero leftover rows afterward.
- **One environment note, not a code issue**: mid-session the local dev server wasn't running at all (`ERR_CONNECTION_REFUSED` on `localhost:3000`) — unrelated to this phase's work, just needed to be started. Also worth remembering for future verification passes in this project: after reassigning `venues.owner_user_id` to a real login earlier in this session, any `SET LOCAL request.jwt.claims` simulation needs to use that new owner id, not the original synthetic test user — the old id no longer resolves to this venue under `current_user_venue_id()`.

## Not built, on purpose

- No UI for viewing a full amendment *history* beyond one level (original ↔ its one amendment) — a chain of multiple amendments isn't possible today by design (a second amendment is blocked while one is pending), so this wasn't needed.
- No automated notification when an amendment is created or when a Payment Plan needs review — Phase 7 (Automation/Platform Events maturation) is where proactive notification belongs, per the roadmap; this phase only makes the facts visible and actionable when a coordinator is looking.

## Where this leaves the Booking Financial Architecture

Phase 3, in full, is done: Draft is a live projection (3a), sending is the one real commitment moment with calm, honest drift detection (3b), and the two mutating resolutions plus full Payment Plan protection are live (3c). The core trust question — can a coordinator ever send, edit, or collect against something that silently differs from what they intended — now has a real, verified answer: no. Every one of Catalog vs. Commitment, Copy at Commitment, Grouping-is-disposable, and Never-silently-change-an-agreement is now expressed in working code, not just design documents.

Phase 4 (Floor Plan reconciliation) and beyond remain per the roadmap, whenever you're ready.
