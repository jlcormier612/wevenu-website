# Luv follow-up drafting — eligibility alignment

## Deployed tip (code)

Pending deploy of this pass — verify `dpl=` after Sandbox deploy.

## Root cause (reconstructed)

1. Tip `0425c455` fixed the unresponsive same-record **Link** by calling `handleGenerate` / `externalDraftRequest`.
2. That path also gated the Noticed CTA on `followUpDraftEligible`.
3. Momentum observations (e.g. “showing strong interest”) still attached `recommendation.type = "draft"` even when **completed-tour silence** correctly set `draftEligible = false`.
4. UI then showed a false explanation: “recent outreach may still be open, or drafting isn’t available for this stage” — **neither** was Ellie’s actual gate (completed tour → `no_outreach` / silence).

Ellie forensic: completed tour `2026-09-15`, `follow_up_sent_at=null`, no commercial proposal, inquiry origin `unknown` → `evaluateCompletedTour` → silence. Legitimate product silence; illegitimate CTA advertising + wrong reason copy.

## Correction

- `observationsForDraftSurface` strips draft recommendations when drafting is ineligible (observation text may remain).
- `followUpDraftBlockReason` returns `LUV_FOLLOW_UP_SILENCE` for completed-tour / `no_outreach` — never invents outreach/stage.
- Eligible leads still open drafting via Noticed button / primary CTA.

## Tests

- Unit: `lib/luv/draft-recommendation-surface.test.ts` + silence/same-record suites.
- Browser matrix: `scripts/qa/luv-draft-eligibility-matrix-browser.mts` (eligible draft persist; silence no false outreach; actionable completed tour; Ellie forensic).

## Safety

No auto-send. Internal notes excluded from customer drafts. Sandbox only.
