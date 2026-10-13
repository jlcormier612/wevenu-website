# Luv preferred tone — verify, fix, prove

**Environment:** Sandbox only  
**Verdict:** GREEN

## Root cause

`preferred_tone` was persisted and loaded, and `luvToneInstruction(settings.preferredTone)` was appended to prompts, but hardcoded “warm” house-style language diluted or contradicted Professional/Formal:

1. Lead follow-up prompt opened with “write a warm, personal follow-up…” and judgment said “Prefer natural, warm…”.
2. Dashboard `/api/luv/draft` system prompt always said “Write warm, professional content…” before the tone line; user prompts also hardcoded “warm”.
3. Lead draft panel copy promised a fixed warm style regardless of settings.

## Fix

- Distinct `LUV_TONE_INSTRUCTION` for warm / professional / formal.
- Tone-neutral lead follow-up prompt; required Tone notes; snapshot `preferredTone` on new `luv_drafts.context` only.
- Shared `lib/luv/dashboard-draft-prompt.ts`; route wires saved preference through system + user prompts.
- Panel copy tone-neutral per contract.

## Evidence

- Commit: `ba3a95d6c161e5761f86952758db53d0af2f4244`
- Deploy: https://github.com/jlcormier612/wevenu-website/actions/runs/38327637779
- Serving tip: `ba3a95d6c161e5761f86952758db53d0af2f4244`
- Unit/regression: 130 pass (`tone`, `preferred-tone`, launch-readiness, privacy/discard/workflow suites)
- Browser: `docs/qa/luv-preferred-tone/browser-results.json` — **25/25 passed** (settings persist/reload each tone; draft `context.preferredTone`; existing draft unchanged; panel copy; runtime stayed expected)

Production untouched. Unrelated dirty/untracked work preserved.
