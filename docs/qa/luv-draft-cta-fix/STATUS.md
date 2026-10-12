# Luv follow-up drafting — eligibility alignment

## Status: IN PROGRESS (contradiction fix awaiting Sandbox tip)

**Working tip (local):** Luv Noticed / silence consistency — neutralize follow-up urging when draft gate closed; keep draft recommendation so Noticed shows server ineligible reason.  
**Last deployed Sandbox tip (pre-fix):** `ee3b67a9ae3e2935355d191ffa209c209fd21718`  
**Artifacts:** `eligibility-matrix-results.json`, `matrix-*.png` (re-run after deploy)

## Root cause (screenshot reopen)

1. Completed-tour silence correctly sets `draftEligible = false` and Luv tab silence copy.
2. Momentum observations still carried `recommendation.type = "draft"` plus urging detail (“may be worth following up while the interest is fresh”).
3. Tip `47272041` stripped the draft recommendation when ineligible — which hid the CTA but also prevented Noticed from rendering the accurate silence reason, while urging **detail** could still remain.
4. Screenshot defect: Noticed urged follow-up while the Luv tab said nothing needs a follow-up.

## Correction (this pass)

- `observationsForDraftSurface` **keeps** draft recommendations when ineligible so `ContextualLuvObservationsPanel` can show `sameRecordDraftIneligibleReason` (silence).
- `neutralizeFollowUpUrgingCopy` removes urging detail/message language when the gate is closed; factual interest language may remain.
- Lead page passes `isFollowUpSilenceBlock` + `workflowIntent` from `loadLeadFollowUpPresentation`.
- Matrix asserts Ellie: silence present, no draft CTA, no follow-up urging copy.

## Required behavior

| Case | Expected |
|---|---|
| Eligible lead | Draft CTA; draft persisted; no auto-send |
| Screenshot / Ellie silence | Silence on Luv tab; Noticed does not urge follow-up; ineligible reason when draft rec present |
| Completed-tour silence | Silence; no draft CTA; no false outreach fiction |
| Follow-up already sent | Blocked; no false outreach fiction |
| Existing draft | Visible; not duplicated |
| Lost lead | No inappropriate follow-up |
| Concurrent clicks | Single durable draft path |
| Internal notes | Never in customer draft context |

## Safety

No auto-send. Sandbox only. Disposable `@hellotocheers-test.invalid` leads cleaned after matrix runs.
