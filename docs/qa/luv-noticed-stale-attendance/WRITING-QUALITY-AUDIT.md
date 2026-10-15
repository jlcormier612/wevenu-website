# Luv Noticed writing-quality audit (completed-tour path)

**Date:** 2026-10-15  
**Scope:** Completed-tour Noticed composition in `lib/luv/completed-tour-intelligence.ts` (and the UI that renders `LuvObservation.message` / `detail` / `recommendation.label`).  
**Not in scope:** Full Luv redesign; privacy/factuality/discard closure (remains GREEN unless regression proven).

## Paths traced

1. `lib/luv/observations.ts` → `evaluateCompletedTour(...)`
2. `lib/luv/follow-up-presentation.ts` / drafts surfaces → same evaluator
3. UI: dashboard `luv-widget` StoryCard / ObservationRow; lead contextual observations panel — render observation fields as authored

Active completed-tour modes: `silence` | `actionable` (unresolved_question / explicit_request) | `contextual` | `positive`.

## Confirmed defects (corrected)

| Defect | Before | After |
|--------|--------|-------|
| Awkward quote stitching | `They asked about ${rawClause} after the tour…` → “They asked about Can I come in tonight…” | Compact topics only in “asked about {topic}”; otherwise neutral “asked a question…” |
| Overconfident / accusatory | “I don't see an answer recorded yet” + “still unanswered… not a generic thank-you” | Invite review: “Check the conversation…” / “confirm… before deciding next steps” |
| Prescriptive CTA tone | “Draft a reply to their question” | “Draft a reply” (draft still available when actionable) |

## Acceptable / unchanged

- Explicit pricing request copy (“asked for pricing… no proposal has been sent yet”) — factual vs `proposalSent`, not the Rory defect.
- Family-pause contextual copy.
- Attendance → **silence** (factual eligibility; not a wording polish of the false alert).

## Deferred (product decision, not implemented)

- Broader Noticed copy system beyond completed-tour helpers.
- Per-insight “review only” CTA without draft when evidence is weaker than a clear question — current actionable path still offers draft after inviting review.
