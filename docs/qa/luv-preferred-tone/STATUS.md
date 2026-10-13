# Luv preferred tone — verify, fix, prove

**Environment:** Sandbox only  
**Verdict:** IN PROGRESS (implementation + unit GREEN; Sandbox browser pending)

## Root cause

`preferred_tone` was persisted and loaded, and `luvToneInstruction(settings.preferredTone)` was appended to prompts, but hardcoded “warm” house-style language diluted or contradicted Professional/Formal:

1. Lead follow-up prompt opened with “write a warm, personal follow-up…” and judgment said “Prefer natural, warm…”.
2. Dashboard `/api/luv/draft` system prompt always said “Write warm, professional content…” before the tone line; user prompts also hardcoded “warm”.
3. Lead draft panel copy promised a fixed warm style regardless of settings.

## Fix (minimal)

- Strengthened distinct `LUV_TONE_INSTRUCTION` copy for warm / professional / formal.
- Tone-neutral lead follow-up prompt; required Tone block uses normalized preference; snapshot `preferredTone` in new `luv_drafts.context` only.
- Shared `lib/luv/dashboard-draft-prompt.ts` for dashboard draft system + user prompts; route wires saved preference through both.
- Panel copy replaced with tone-neutral wording from the contract.

Existing drafts are not rewritten when settings change (`saveLuvSettings` never touches `luv_drafts`).

## Files

- `lib/luv/settings.ts`
- `lib/luv/drafts.ts`
- `lib/luv/dashboard-draft-prompt.ts` (new)
- `app/api/luv/draft/route.ts`
- `components/luv/luv-draft-panel.tsx`
- `lib/luv/tone.test.ts`
- `lib/luv/preferred-tone.test.ts` (new)
- `lib/luv/launch-readiness.test.ts`

## Tests

```bash
npx tsx --test lib/luv/tone.test.ts lib/luv/preferred-tone.test.ts \
  lib/luv/launch-readiness.test.ts lib/luv/draft-context-boundary.test.ts \
  lib/luv/draft-discard-delete.test.ts lib/luv/follow-up-workflow-context.test.ts \
  lib/luv/draft-proposal-factuality.test.ts lib/luv/customer-facing-inquiry-context.test.ts \
  lib/luv/draft-send-lifecycle.test.ts lib/luv/owner-draft-capability.test.ts
```

Result: **130 pass / 0 fail**

## Sandbox proof

- Commit: pending
- Deploy run: pending
- Serving commit: pending
- Browser: save each tone → reload → generate disposable draft → capture tone snapshot + draft text
