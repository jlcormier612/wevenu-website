# Automation / Sequences — P1 Product Architecture Recommendation

**Type:** Product discovery/architecture only. No code, schema, migrations, or UI were modified to produce this document.
**Method:** Every claim about "what exists today" was verified directly against the current working tree — `lib/message-sequences/types.ts`, `lib/message-sequences/starters.ts`, `lib/message-sequences/stage-labels.ts`, `components/communication/series-enrollments.tsx`, `components/communication/series-form.tsx`, and the live `sequence_enrollments` table schema and `get_relationship_activity_timeline` RPC (both read directly from the database, not inferred from an earlier document). Nothing below assumes the P0 foundation is what an earlier document said it was — it's what the current tree and database actually show.

---

## 1. Executive Summary

The P0 foundation is real, verified, and stronger than a cursory read of prior documentation would suggest — the trigger picker, the pre-move confirmation, terminal-stage exits (now with `exited_lost`/`exited_cancelled` as their own distinct, honest statuses), enrollment completion, per-enrollment progress ("Step X of Y · Next [date]"), and automation lifecycle events in the unified Activity timeline are all confirmed live in the current tree. The Message Template / Sequence Step boundary the brief asked about is already perfectly clean — a sequence step is a pure reference to an existing template plus a channel and a delay; there is no inline content editing anywhere in the Automation builder to blur the line.

**The one real, load-bearing gap this pass found:** there is no way to pause a *single* enrolled person without pausing the entire Automation for everyone. This isn't a guess — the database has no column for it (`sequence_enrollments` has no `paused_at` or equivalent), only sequence-wide pause exists. This matters because it's the one thing that fails the brief's own mental-model test outright: *"Someone is enrolled but I don't want the next message to go out yet"* has no clean answer today. This document specifies the exact, minimal shape the fix should take — it does not build it.

**Re-enrollment, by contrast, needs no new work at all.** The database already enforces exactly the right rule via a partial unique index (`(sequence_id, relationship_id) WHERE status = 'active'`) — a relationship can never be enrolled twice *at once*, but can freely re-enter the same Automation after a prior enrollment ends. This is the simplest safe model the brief asks for, and it's already built.

**One new trigger is worth recommending, and the team's own code already names it as the blocker for a wanted starter:** `starters.ts` explicitly comments that the Tour Follow-Up starter is "intentionally deferred (no Tour Completed trigger)." Adding it is the single highest-leverage new trigger for this pass.

**No conditions, no branching, no generic "advance something" action.** All three are explicitly rejected below, not deferred for lack of time — deferred because nothing in the current evidence justifies them, and each would move the product away from "understandable without training."

---

## 2. Current Architecture — What Exists and Must Be Preserved

Confirmed directly, not assumed:

- **Trigger types:** `lead_created`, `lead_stage_changed` (all seven canonical `LeadStatus` values, venue stage names resolved for display via `stage-labels.ts`'s `venueStageNameForLeadStatus`/`triggerStageDisplayLabel`).
- **Enrollment status model:** `active | completed | exited_reply | exited_booking | exited_lost | exited_cancelled | cancelled` — seven values, each with a plain-language label already in `ENROLLMENT_STATUS_LABEL`.
- **Re-enrollment safety:** enforced at the database level by `sequence_enrollments_active_unique`, a partial unique index on `(sequence_id, relationship_id) WHERE status = 'active'`.
- **Progress display:** `SequenceEnrollment.stepsTotal` / `stepsSent` / `nextScheduledFor` are real fields, rendered today as "Step X of Y · Next [date]" in `series-enrollments.tsx`.
- **History:** `get_relationship_activity_timeline` has a real `automation` source branch — `automation_enrolled` plus one exit-reason event per terminal status, each with a plain-language title ("Automation stopped (lost): [name]").
- **Starters:** exactly one, `SEQ-01` "New Inquiry Welcome," two email steps at day 0 and day 3, both against the same template master until a venue customizes step 2.
- **Message Template boundary:** confirmed clean in `series-form.tsx` — a step's `templateId` is a pure select-from-existing-templates control; there is no message-body textarea anywhere in the Automation editor.
- **Delivery:** unchanged, still the existing Scheduled Sends cron; still the only execution engine.

**All of the above must be preserved exactly as-is.** Nothing in this document proposes changing any of it.

---

## 3. Venue Mental Model

- **Pipeline** — "Where is this person in how I sell?" A stage on the board, in the venue's own words.
- **Automation** — "When something happens, do this automatically." One thing a venue builds and turns on — not two concepts to learn.
- **Sequence** *(internal term only, never shown to a venue)* — the ordered messages underneath one Automation.
- **Enrollment** — "This specific person, right now, going through that Automation." Shown as a name, a status, and "Step X of Y · Next [date]."
- **History** — "What Hello to Cheers actually did with this person." Already answered today by the relationship's own Activity timeline — not a second screen to check.

---

## 4. P1 Automation Builder

### Trigger — "When…"

| Trigger | Status | Recommendation |
|---|---|---|
| Lead created | Built | Keep |
| Lead moves to a Pipeline stage (all 7 canonical stages) | Built | Keep |
| Tour completed | **Not built** | **P1 — build.** `tour_appointments.status = 'completed'` already exists as real, tracked data; only the trigger-firing hook is missing. The team's own code already names this as the blocker for a second, wanted starter |
| Proposal sent / Booking confirmed | Already covered | Not separate triggers — both are canonical Pipeline stages, already handled by "Lead moves to a Pipeline stage" |
| Payment due | Deferred | A fundamentally different shape (a date-crossing scan, not an instant on-write event) — real value, bigger lift, no current evidence it's blocking anything today |
| Contract signed | **P2** | Same instant, on-write shape as the existing triggers (a cheap addition once prioritized) — valuable next, not blocking anything today |

### Actions — "Then…"

| Action | Status | Recommendation |
|---|---|---|
| Send message | Built | Keep — the only action needed for every starter and every real Automation in the current account |
| Wait | Already implicit | Not a separate action — already expressed as each step's day-offset. Do not add a standalone "Wait" step |
| Create task | Deferred | No generic, relationship-scoped task-creation primitive exists yet (confirmed in the prior Automation document); building this action first would require building that primitive, which is its own piece of work |
| Notify team member | **P2** | The underlying notifications system already exists and works; this is a reuse job once prioritized, not a build |
| Move/advance a Pipeline stage | **Explicitly rejected, permanently** | This is precisely the "silent state change" the product's own principles exist to prevent — an Automation should never move a lead's business-process state on its own |

### Conditions — branching

**Explicitly deferred, with no evidence gap to note — this is a firm recommendation, not a placeholder.** The one common case that sounds like it needs a condition ("send a reminder *if* they haven't responded") is already solved without branching, because the existing "stop on reply" rule exits the whole enrollment the moment someone replies — the reminder step simply never fires for anyone who already answered. See Scenario 1 in §16.

---

## 5. P1 Sequence Builder

Already correct; described here, not redesigned:

1. **Choose what starts it** — Manual / a new inquiry / a Pipeline stage (with the venue's own stage name shown alongside the system meaning).
2. **Add steps** — each step is: pick a channel (email/SMS) → pick an existing Message Template → set a day offset from the previous step (or from enrollment, for the first step).
3. **Timing** is read directly off the step list — no separate "timing" screen.
4. **Preview** — **a gap, addressed in §13 (Safety), not here** — there is currently no preview of the resolved first message anywhere in this flow.
5. **Activate** — set status to Active; the "changes apply to new enrollments only" note is already shown.

**Message Template vs. Sequence Step, confirmed and preserved exactly as the brief requires:** a Message Template is the reusable content, owned and edited only in Library → Communication → Message Templates. A Sequence Step is nothing more than *a reference to one template, a channel, and a delay* — editing a step never edits the template, and there is no path in the current UI that would let it. This boundary does not need to be built; it needs to be protected from ever being blurred in a future pass.

---

## 6. Enrollment Management

| Capability | Status | P1? |
|---|---|---|
| Current step / next scheduled action | Built | Already P1 |
| Completed steps count | Built (implicit in "Step X of Y") | Already P1 |
| Manual exit (cancel) | Built | Already P1 |
| History | Built (via Activity timeline, not a separate surface) | Already P1 |
| **Pause (this one person)** | **Not built** | **P1 — see §7** |
| Resume | Not built (depends on pause existing) | **P1 — see §7** |
| Manual completion (force-complete without waiting for the last step) | Not built | Deferred — no evidence any real venue has needed this |

---

## 7. Pause / Resume

**The current architecture cannot support per-enrollment pause without a small, specific schema addition — stated plainly, not guessed around.**

**Exact recommended shape, sized as the minimal safe change:**

- Add a nullable `paused_at timestamp` to `sequence_enrollments`. **Not** a new status value — the enrollment stays `status = 'active'` while paused. This is the deliberate, load-bearing choice: it means the existing `sequence_enrollments_active_unique` constraint keeps working correctly with zero changes, and the existing "who's currently active" queries keep working unchanged.
- The Scheduled Sends processor's existing skip-check (`isEnrollmentSequencePaused`, which today only checks the whole sequence's status) gets one more condition: also skip if this specific enrollment's `paused_at` is set. Same mechanism, same code path, one more check — not a second pause system.
- **What Pause means:** no further steps send for this one person; everyone else in the same Automation is unaffected.
- **What happens to already-scheduled sends:** they remain scheduled (matching the existing sequence-level pause behavior exactly) — nothing is deleted or rescheduled while paused.
- **What happens on Resume:** any step that was already due while paused sends promptly (the same "catch up" behavior the existing sequence-level pause already has); steps not yet due stay on their original schedule. This is a deliberate consistency choice — two different pause semantics for "pause everyone" vs. "pause one person" would be a second thing to learn, not a simplification.
- **Terminal stages always override pause.** If a paused enrollment's relationship is later marked Lost, Cancelled, or Booked, the existing exit-before-enroll logic exits it exactly as it would an active one — pause must never become a loophole that keeps a stale enrollment alive past a terminal outcome.
- **History:** two new event types, `automation_paused` / `automation_resumed`, added to the exact same union the six existing automation events already use in `get_relationship_activity_timeline` — not a new history mechanism.

**This is scoped as P1** — it is the one gap that fails the brief's own mental-model test (§16, Scenario 3) outright, and the fix above is small, additive, and reuses the existing skip-check pattern rather than inventing a new one.

---

## 8. Manual Exit

**Already fully built; described, not redesigned.**

- **UI action:** the existing "X" button on an active enrollment row.
- **Confirmation:** not currently present as an explicit dialog (a single click cancels immediately) — worth a one-line confirmation given the action is irreversible-in-spirit (see §13), but this is a small addition, not a new capability.
- **Resulting status:** `cancelled` — distinct from every terminal-exit reason, so "a venue chose to stop this" is never confused with "they booked" or "they were lost" in History.
- **Scheduled messages:** already cancelled correctly (`exitEnrollments` marks pending `scheduled_messages` rows `cancelled`, confirmed in the prior Automation document's trace and unchanged since).
- **Conflict with booking/lost/cancelled exits:** none — those write `exited_booking`/`exited_lost`/`exited_cancelled` respectively, all distinct values from manual `cancelled`. No overlap possible.
- **Re-enrollment after manual exit:** allowed, per §9 — a `cancelled` enrollment is no longer `active`, so the unique constraint permits a fresh enrollment on the next matching trigger.

---

## 9. Re-enrollment

**Already correctly solved by the existing schema — no new work needed.**

> Can the same relationship enter the same Automation more than once? **Yes, sequentially, never concurrently.**

This is enforced by the database itself, not application logic that could drift: `sequence_enrollments_active_unique` is a partial unique index scoped to `status = 'active'`. Once an enrollment ends — for any reason (completed, cancelled, or any exit) — the next matching trigger event creates a brand-new enrollment without any special-casing required. This is the simplest safe model available, and it's already the model in production.

---

## 10. Timing Model

**Recommendation: keep exactly what exists — day-offset only, cumulative from enrollment or the previous step. No new timing capability for P1.**

| Capability | Status | P1 recommendation |
|---|---|---|
| Days after enrollment / previous step | Built | Keep — this is the entire P1 timing model |
| Immediately (offset 0) | Built (already used by the one real starter) | Keep |
| Hours/minutes granularity | Not built | Deferred — no evidence any real Automation needs finer than a day |
| Time-of-day control | Not built | Deferred |
| Business days vs. calendar days | Not built | Deferred |
| Timezone handling | Not explicit — sends compute from `Date.now()` at enrollment time | Deferred — worth a developer's attention if a venue ever reports a wrong-hour send, but no evidence of that today |
| Weekend/quiet-hours suppression | Not built | Deferred |

This list is deliberately long and entirely "Deferred" — the current, simple model is sufficient for every real Automation this account has, and adding any of the above without evidence would be the exact kind of feature inflation the brief warns against.

---

## 11. Message Templates Integration

**Already exactly correct — confirmed, not redesigned.**

The Automation builder consumes Message Templates as a plain reference: a step's channel narrows the picker (email templates for an email step, SMS for an SMS step), and selecting one stores only its ID. A venue never edits message wording inside the Automation screen — to change what a message says, they go to Library → Communication → Message Templates, exactly where the product already tells them reusable content lives. No database relationship is ever exposed to the venue; the picker just says "Choose a template."

---

## 12. Trigger Duplication / Conflicting Automations

**Confirmed live: this is already allowed, and it's the correct behavior — transparent, not restricted.** Two real Automations in the current account ("New Inquiry Follow-up" and "New Inquiry Welcome") both trigger on "a new inquiry comes in" today, and both fire and enroll independently — there is no artificial restriction preventing this, and there shouldn't be, since a venue may genuinely want two independent things to happen on the same event.

**What should change: a small, transparent signal, not a restriction.** When a venue is choosing a trigger and an existing Automation already uses it, show a plain note (e.g., "2 other Automations already start here") so the behavior is visible rather than surprising. **P2** — cheap, non-blocking, directly serves "prefer transparent behavior over hidden magic" without adding any restriction. Order between multiple Automations sharing a trigger doesn't matter today and there's no evidence it needs to (each sends independent, unrelated content) — no action needed.

---

## 13. Activation / Lifecycle

**Recommendation: keep the existing two-state model — Active / Paused — plus the existing hard Delete. Do not add Draft or Archived for P1.**

**Why no Draft:** a newly-created Automation with no trigger chosen defaults to "Manual only," which never fires anything automatically — this already gives a venue a safe space to build and test without a formal Draft state layered on top.

**Why no Archived:** a working Delete already exists as the "I don't want this anymore" action; Archived would only add value if venues were routinely building and discarding throwaway Automations, and there's no evidence of that in the one real account this product has today. Revisit only if that changes.

**What happens when an active Automation is edited:** unchanged, already correct — affects new enrollments only, already stated to the venue in the editor.

---

## 14. Safety Model

**Confirmed already built:** the pre-move confirmation (naming the exact consequence before it happens), the trigger always shown in plain language on both the list and the editor, "new enrollments only" messaging, terminal-stage exit-before-enroll, and duplicate-active-enrollment protection at the database level.

**One confirmed, positive safety property worth stating explicitly, since it's easy to worry about and wasn't obvious without tracing it:** activating a brand-new Automation targeting an existing Pipeline stage does **not** retroactively enroll every lead already sitting in that stage today. `triggerSequencesForRelationship` is only ever called at the moment of an actual lead-creation or stage-change event — there is no batch/backfill call site anywhere in the codebase. A venue turning on a new Automation will never be surprised by a flood of messages to their entire existing pipeline.

**One real, cheap gap: no message preview anywhere in the activation or confirmation flow.** A venue confirming a stage-move that will enroll someone, or activating an Automation for the first time, never sees what will actually be sent. **P1 — add a resolved preview of the first step's message (subject + opening text) to the existing `pipeline-automation-confirm` dialog**, reusing the same merge-resolution path the Scheduled Sends processor already uses at send time — not a new templating system.

**Secondary, smaller gap: manual "cancel" has no confirmation step.** **P2** — a one-line "Stop this Automation for [name]?" would match the weight already given to the pre-move confirmation, without becoming enterprise approval software.

---

## 15. History

**Already built and correct.** The full, current event set in `get_relationship_activity_timeline`: `automation_enrolled`, `automation_completed`, `automation_exited_reply`, `automation_exited_booking`, `automation_exited_lost`, `automation_exited_cancelled`, `automation_cancelled`. **Two additions needed for §7's Pause/Resume recommendation**, following the identical existing pattern: `automation_paused`, `automation_resumed`. No new history surface — this remains the one place a venue checks "what happened," exactly as intended.

---

## 16. Venue Scenario Walkthroughs

**Scenario 1 — "Every new inquiry gets an immediate thank-you, then another in two days, then a reminder if they haven't responded."** Fully buildable today for the messaging shape (trigger: new inquiry; three steps at day 0/2/N) — and the "if they haven't responded" clause is already handled correctly *without* a condition, because the existing "stop on reply" rule exits the whole enrollment the instant someone replies. The reminder step simply never sends to anyone who already answered. This is the clearest evidence in this document that P1 doesn't need branching logic.

**Scenario 2 — "When someone moves to Proposal Sent, send the proposal follow-up."** Fully supported today, exactly as asked — trigger: lead moves to a Pipeline stage, stage: Proposal Sent.

**Scenario 3 — "Someone is enrolled but I don't want the next message to go out yet. Can they pause it?"** **No, not today** — this is the one scenario in this document without a working answer, and it's the direct evidence behind the §7 recommendation.

**Scenario 4 — "Why did this person get this message? Can they see the answer in History?"** Yes — the relationship's Activity timeline shows "Enrolled in automation: [name]," and the actual sent message itself is visible in that same relationship's Conversation. Together, "which Automation" and "what was actually said" are both answered without a separate report.

---

## 17. Luv Opportunities (Future Only — Not Designed or Implemented Here)

Consistent with the prior Automation document and the brief's own examples, all remaining dismissible, non-primary, and reusing the existing `getLuvObservations` mechanism rather than a new one:

- After a venue's first Pipeline Template is created: *"Want help creating a follow-up sequence?"*
- Noticing new inquiries with no matching Automation: *"You don't have an Automation for new inquiries yet."*
- Noticing a lead stuck in one stage past a reasonable window — **explicitly blocked on the stage-duration history table already named as a dependency in the companion Pipeline document; do not build a parallel tracker here.**

---

## 18. Help & Guides Topics (Titles Only, Not Written Here)

- Building your first Automation, step by step.
- What happens when someone leaves an Automation (reply, booking, lost, cancelled — explained together in one place).
- Pausing vs. stopping an Automation — the difference, once §7 ships.
- Understanding "Step X of Y" on an enrolled person.
- Why two Automations can both start from the same event.

---

## 19. Final Product Recommendation

One model, no unresolved alternatives:

**Pipeline → Automation → Enrollment → History**, exactly as already built, with three additive, evidence-backed P1 changes and nothing else:

1. **Add a "Tour completed" trigger** — the team's own code already names this as the blocker for a wanted second starter.
2. **Add per-enrollment pause/resume** — the one scenario in this document without a working answer today; shape specified precisely in §7 (a nullable `paused_at` column, status stays `active`, terminal exits always override it, reuses the existing skip-check pattern).
3. **Add a resolved message preview to the existing pre-move confirmation dialog** — the one real gap in an otherwise strong safety model.

Everything else proposed by the brief's own inspiration material — conditions/branching, a generic "advance something" action, Draft/Archived states, business-day/quiet-hours timing, and Create Task/Notify Team as automation actions — is explicitly deferred, each for a stated reason grounded in current evidence rather than in what a more sophisticated CRM happens to offer. No evidence gap in this pass required stopping short of a recommendation — every question the brief asked has a firm answer above.

This document ends here. No code, schema, migrations, or UI were changed in producing it.
