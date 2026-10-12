# Luv intelligence + owner-initiated drafting

## Status: PARTIAL → pending Sandbox deploy verify

**Prior tip (insufficient):** `73060291cfe5a29ea920f4ce765b14b55ff0a25f` — matrix GREEN under old criteria; live Oct 12 screenshot still showed duplicate Noticed + interest/silence contradiction. **Do not treat 73060291 as product GREEN.**

**This assignment tip:** _(filled after commit)_  

## Root causes (this pass)

1. **Duplicate “Luv noticed”:** Overview rendered `ContextualLuvObservationsPanel` and `LuvDraftPanel` rendered it again.
2. **Capability conflated with recommendation:** `followUpDraftEligible` / `resolveFollowUpDraftEligibility` reused completed-tour `no_outreach` as a drafting permission gate — hiding the owner CTA when Luv had nothing urgent to urge.
3. **Contradiction:** Momentum “strong interest / follow up” survived beside silence empty-state because neutralization kept interest rows and prior tip kept draft recommendations when “ineligible.”

## Correction

| Change | Behavior |
|---|---|
| `draftCapable` vs `proactiveRecommended` | Independent gates in `follow-up-draft-eligibility.ts` |
| `generateFollowUpDraft` | Blocks only on `!gate.draftCapable`; passes `workflowIntent` (gentle_check_in when proactive silent) |
| `luvPanelDescription` | Owner-available copy when capable + not proactive; silence is empty-state, not a draft ban |
| `observationsForDraftSurface` + `observation-coherence` | Dedupe, drop zero-value, suppress interest+draft under proactive silence |
| Lead detail | Single Noticed mount; `showContextualObservations={false}` on Luv tab panel |

## Acceptance (unit)

- `lib/luv/owner-draft-capability.test.ts`
- `lib/luv/draft-recommendation-surface.test.ts`
- `lib/luv/luv-silence-copy.test.ts`
- `lib/luv/completed-tour-thoughts.test.ts`
- `lib/luv/venue-facing-tour-thoughts.test.ts`

## Browser matrix (post-deploy)

`scripts/qa/luv-draft-eligibility-matrix-browser.mts` updated:
- Silence / follow-up-sent → **keeps** owner draft CTA
- Ellie → no interest/silence contradiction; ≤1 Noticed label; CTA present

## Safety

No auto-send. Internal notes excluded from draft context. Sandbox only. Discard still deletes `luv_drafts` with no history.
