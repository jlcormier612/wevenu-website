# Surgical — Questionnaire preview restore + Event Order Overview Included

**Verdict: GREEN** — SHA-matched Sandbox browser + persistence proof on serving `592a69b5`.

Production untouched. Unrelated dirty tree preserved.

## Product / deploy

| Item | Value |
| --- | --- |
| Product commit | `592a69b513685876d3efe3cab708d6af822632da` (anchors fix atop `abbada77`) |
| Deploy | [39730706358](https://github.com/jlcormier612/wevenu-website/actions/runs/39730706358) success |
| Serving proof | `dpl=` / harness = `592a69b513685876d3efe3cab708d6af822632da` |
| Acceptance | `q-preview-eo-included-results.json` GREEN passed=15 failed=0 |

## Root causes

1. **Preview** — `7df38cd8` wrapped `CoupleFamilyQuestionnaireForm` in `min-h-screen bg-[#F7F5F1]` + sticky chrome, washing out the original form. Only return-nav was requested.
2. **Event Order badge** — Overview mapped readiness `draft` → “Draft”; Inventory already used Included via `setupStatusBadgeLabel`.

## Fixes

- Restore form as direct page content; sticky nav only (**Preview — not sent**, **Back to Questionnaires**, **Back to Overview**) as same-tab `<a>` anchors (no cream wrapper, no `_blank`).
- Map Event Order Overview `set_up` + `draft|included` → **Included** (Inventory parity). Editor/lifecycle copy unchanged.

## Local tests

```text
npx tsx --test lib/event-setup/outstanding-follow-ups.test.ts lib/questionnaire-family/selector-availability.test.ts
→ pass (focused)
```

## Browser / DB (GREEN)

| Check | Result |
| --- | --- |
| serving_sha | `592a69b5…` |
| event_order_badge_included | badge=Included |
| preview shells (3 kinds) | mark + h1; cream wrapper absent; heading luminance ~0.355 |
| back_overview / back_questionnaires (×3) | client context retained |
| questionnaire_persistence_unchanged | before=1 after=1 |
| event_order_state_unchanged | open / shared_at null |
| no_invoice_side_effect | 38→38 |

### Evidence

- `q-preview-eo-included-results.json`
- `q-preview-client-planning-1280.png`
- `q-preview-final-details-1280.png`
- `q-preview-post-event-1280.png`
- `q-preview-eo-overview-1280.png`
