# Phase 11A — Test results

## Commands

```bash
npx tsx --test \
  lib/theme/phase11a-record-interactions.test.ts \
  lib/theme/clients-offerings-hospitality.test.ts \
  lib/theme/leads-vendors-hospitality.test.ts \
  lib/theme/color-distribution-phase10-polish.test.ts \
  lib/theme/color-distribution-phase8.test.ts
```

## Results

| Suite | Pass | Fail |
|---|---|---|
| Phase 11A — shared `.htc-record-link` | 3 | 0 |
| Phase 11A — record lists adopt shared link class | 8 | 0 |
| Clients & Offerings hospitality | 7 | 0 |
| Leads & Vendors hospitality (Stage 1) | 10 | 0 |
| Phase 10 polish (Documents + Reporting) | 8 | 0 |
| Phase 8 Contracts & Payments | 10 | 0 |
| **Total** | **46** | **0** |

## Coverage highlights (new)

- Shared CSS: charcoal, no botanical hover color, underline hover, inset focus-visible
- Clients attention inset preserved
- Leads/Contracts/Vendors/Payments/Events use `htc-record-link`; no `hover:text-primary` on record titles
- Requests: no permanent underline; selects preserved; no row `onClick`
- Documents: Phase 10 mobile/desktop action seams preserved
- Tours: name not converted to record link; rows remain non-clickable
