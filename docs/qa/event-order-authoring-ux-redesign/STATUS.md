# Event Order — Authoring UX Redesign (S0–S2)

## Verdict: **NOT GREEN** (awaiting Sandbox deploy + browser acceptance)

## Scope

Implements approved S0 + S1 + S2:

- Plain-English template landing and detail orientation
- Remove preliminary selection-pattern quiz from ordinary path
- Single contextual category workspace (included + primary + under-option follow-ups)
- Preserve Catering Simplify behaviors (`depends_on_option_ids`, exact-N, review/preview)
- Specialist rules accessible outside preview; no second dependency system; no migration

## Commits / deploy

| Item | Value |
|---|---|
| Feature commit | _(pending)_ |
| Deploy ref | _(pending)_ |
| Production | Untouched |

## Automated tests (local)

```bash
npx tsx --test \
  lib/event-order-templates/guided-setup.test.ts \
  lib/event-order-templates/builder-ux.test.ts \
  lib/event-order-templates/group-dependencies.test.ts \
  lib/event-order-templates/section-workspace.test.ts \
  lib/library/template-catalog-integration.test.ts \
  lib/event-order-templates/starter-commercial-semantics.test.ts \
  lib/client-choices/validate-answers.test.ts
→ 85 pass / 0 fail
```
