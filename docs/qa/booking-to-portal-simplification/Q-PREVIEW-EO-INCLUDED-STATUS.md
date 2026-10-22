# Surgical — Questionnaire preview restore + Event Order Overview Included

**Verdict: NOT GREEN** — product pending deploy + SHA-matched browser proof.

Production untouched. Unrelated dirty tree preserved.

## Root causes

1. **Preview** — commit `7df38cd8` wrapped `CoupleFamilyQuestionnaireForm` in `min-h-screen bg-[#F7F5F1]` + sticky chrome, overriding the original full-bleed form presentation (washed-out look). Only back-nav was requested.
2. **Event Order badge** — Overview used readiness `draft` → label “Draft”; Inventory already maps to Included via `setupStatusBadgeLabel`.

## Fixes

- Restore form as direct page content; add sticky nav only (Preview — not sent, Back to Questionnaires, Back to Overview). Same-tab Links. No cream theme wrapper.
- Map Event Order Overview `set_up` + `draft|included` → **Included** (same as Inventory). Readiness/editor copy unchanged.

## Local tests

```text
npx tsx --test lib/event-setup/outstanding-follow-ups.test.ts lib/questionnaire-family/selector-availability.test.ts …
→ 29 pass / 0 fail
```

## Browser

```text
EXPECTED_SHA=<product> npx tsx scripts/qa/questionnaire-preview-eo-included-acceptance.mts
```
