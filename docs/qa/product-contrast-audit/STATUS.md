# Product-wide contrast & legibility — closure report

**STATUS: GREEN / COMPLETE**  
**Date:** 2026-10-23  
Production untouched. Unrelated dirty tree preserved.

## Serving / deploy (independent ECS check)

| Item | Value |
| --- | --- |
| Contrast product commit | `c5bdafc029ca9ee0a3ad356e96131e30bd1b96bd` |
| Deploy that first rolled contrast | [39981141119](https://github.com/jlcormier612/wevenu-website/actions/runs/39981141119) — **success** (head `c5bdafc0`) |
| Follow-on Sandbox tip (includes contrast) | [39986636620](https://github.com/jlcormier612/wevenu-website/actions/runs/39986636620) — **success** (head `df95f7c4`) |
| Live ECS task def | `htc-sandbox-venue-app:900` |
| Live image tag | `…/htc-sandbox-venue-app:df95f7c4c17a3e522396df98df818754994d37b6` |
| Immutable digest | `sha256:70693919b07f05813418d15b52ddb68e493b7b677874d0b5ae255a7b04365fe9` |

`c5bdafc0` contrast fixes are present in the live tip `df95f7c4` (ancestor). Live browser gates used `EXPECTED_SHA=df95f7c4…`.

## Original screenshot defect (task category labels)

```text
EXPECTED_SHA=df95f7c4c17a3e522396df98df818754994d37b6 \
  npx tsx docs/qa/product-contrast-audit/verify-task-category-labels.mts
→ 23 pass / 0 fail
```

Planning on dark heritage: **5.69:1** (fg `rgb(247,245,241)` on forest). Light Planning: **14.30:1**. Evidence: `task-category-browser-results.json`, `shots/`, `verify-log-live.txt`.

## Three-portal representative live checks

```text
EXPECTED_SHA=df95f7c4… npx tsx docs/qa/product-contrast-audit/verify-portals-live.mts
→ 7 pass / 0 fail
```

| Surface | Theme | Result |
| --- | --- | --- |
| Venue staff event/planning content | light + dark | PASS (rgb text AA) |
| Auth `/login` | light-locked | PASS (`data-theme-lock="light"`) |
| Couple portal home + tasks | default | PASS |
| Vendor `/vendor/login` | light auth | PASS |

**Not claimed:** all 221 `page.tsx` routes. Representative routes only — see `COVERAGE.md` + `browser-results-portals.json`, `shots-portals/`.

## Units / email renders (unchanged code path)

- Contrast-related units: **64/64** PASS  
- Email renderer: **29** HTML artifacts, **failCount: 0** (`email-renders/results.json`) — no sends  

## Systemic fixes (already in `c5bdafc0`)

Task category `labelInkLight`/`labelInkDark`; `--muted-foreground` 92%; email `EMAIL_INK` / `inkOn(primary)`.

## Exceptions

- Soft-sage accent surfaces are not body text surfaces.  
- Full dynamic commercial email bodies with every venue primary extreme not re-rendered at runtime (unit + 29 safe renders cover shells/CTAs).
