# Phase 11A Final Verification — Tests

## Commands

```bash
npx tsx --test \
  lib/theme/phase11a-record-interactions.test.ts \
  lib/theme/color-distribution-phase10-polish.test.ts \
  lib/theme/color-distribution-phase10.test.ts

npx tsx --test \
  lib/theme/phase11a-record-interactions.test.ts \
  lib/theme/clients-offerings-hospitality.test.ts \
  lib/theme/leads-vendors-hospitality.test.ts \
  lib/theme/color-distribution-phase10-polish.test.ts \
  lib/theme/color-distribution-phase8.test.ts
```

## Results

### Focused (Phase 11A + Phase 10 Documents/Reporting)

| Suite | Pass | Fail |
|---|---|---|
| Phase 11A shared link + list adoption (incl. EventList routing assertion) | 12 | 0 |
| Phase 10 polish Documents + Reporting | 8 | 0 |
| Phase 10 color-distribution Documents/Reporting | 6 | 0 |
| **Subtotal** | **26** | **0** |

### Broader related hospitality (closeout)

| Suite | Pass | Fail |
|---|---|---|
| Combined hospitality + Phase 8/10/11A | **47** | **0** |

## Narrow addition this closeout

One new assertion in `phase11a-record-interactions.test.ts`:

> `EventList preserves dual navigation and no whole-row click (legacy unreachable list)`

Covers `/events` → `/clients` redirect comment/code, `htc-record-link` destination, `View →`, no row `onClick`.

No existing assertions weakened.
