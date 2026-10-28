# EO Template category integrity + editable package setup — STATUS

**Verdict: GREEN**

## Commit / serving
| Item | Value |
|---|---|
| Implementation commit | `36c6fe71e9a4853cbe749f6a255929cca5818f90` |
| Included in tip | `ee0e78101957f078df7e7886032e814a350d802b` |
| ECS image | `htc-sandbox-venue-app:ee0e78101957f078df7e7886032e814a350d802b` |
| Deploy (tip) | https://github.com/jlcormier612/wevenu-website/actions/runs/40768875416 |
| Prior deploy of this SHA | https://github.com/jlcormier612/wevenu-website/actions/runs/40766349078 — success |

## Browser acceptance
```bash
EXPECTED_SHA=ee0e78101957f078df7e7886032e814a350d802b \
  npx tsx docs/qa/eo-template-category-integrity/verify-browser.mts
→ GREEN — 13 pass / 0 fail
```

Evidence: `browser-results.json`, `browser-run.log`, `persisted-state.json`, `shots/`.

### Proven
- Offerings dropdown includes Décor and Florals
- Persisted Décor offering category row
- Return via **Change package categories** after Continue
- Custom EO section provisions matching `offering_categories` row (venue-scoped)
- Custom appears in Offerings dropdown without manual recreate; no duplicate rows
- Removing custom from template keeps shared category row; Catering retained
- 390px package-categories reachable

## Migration
None.

## Production
Untouched. Unrelated dirty work preserved.
