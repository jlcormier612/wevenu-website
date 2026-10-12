# Luv follow-up drafting — eligibility alignment

## Status: GREEN

**Deployed Sandbox tip:** `73060291cfe5a29ea920f4ce765b14b55ff0a25f`  
**Evidence (UTC):** 2026-10-12T05:14Z matrix 13/13 PASS  
**Deploy:** https://github.com/jlcormier612/wevenu-website/actions/runs/38206396959  
**Artifacts:** `eligibility-matrix-results.json`, `matrix-*.png`

## Root cause (screenshot reopen)

1. Completed-tour silence correctly sets `draftEligible = false` and Luv tab silence copy.
2. Momentum observations still carried `recommendation.type = "draft"` plus urging detail (“may be worth following up while the interest is fresh”).
3. Tip `47272041` stripped the draft recommendation when ineligible — which hid the CTA but also prevented Noticed from rendering the accurate silence reason, while urging **detail** could still remain.
4. Screenshot defect: Noticed urged follow-up while the Luv tab said nothing needs a follow-up.

## Correction (tip `73060291`)

- `observationsForDraftSurface` **keeps** draft recommendations when ineligible so `ContextualLuvObservationsPanel` can show `sameRecordDraftIneligibleReason` (silence).
- `neutralizeFollowUpUrgingCopy` removes urging detail/message language when the gate is closed; factual interest language may remain.
- Lead page passes `isFollowUpSilenceBlock` + `workflowIntent` from `loadLeadFollowUpPresentation`.
- Matrix asserts Ellie: silence present, no draft CTA, no follow-up urging copy.

## Required behavior verified

| Case | Result |
|---|---|
| Eligible lead, no conflicting outreach | CTA present; draft persisted (`n=1`) |
| Ellie / screenshot contradiction | Silence; no draft CTA; no follow-up urging |
| Completed-tour silence | Silence copy; no draft CTA; no false outreach copy |
| Completed tour + unanswered inbound | CTA allowed |
| Follow-up already sent | Draft blocked; silence; no false outreach fiction |
| Existing pending draft | Existing draft visible; CTA safe |
| Lost lead | No false outreach fiction |
| Concurrent CTA clicks | 1 draft persisted |
| Tip gate | `dpl=73060291…` |

## Tests

- Unit: `lib/luv/draft-recommendation-surface.test.ts` (PASS).
- Browser: `scripts/qa/luv-draft-eligibility-matrix-browser.mts` with `EXPECTED_TIP_PREFIX=73060291` → **13/13 PASS**.

## Safety

No auto-send. Sandbox only. Disposable `@hellotocheers-test.invalid` leads cleaned up after matrix runs.
