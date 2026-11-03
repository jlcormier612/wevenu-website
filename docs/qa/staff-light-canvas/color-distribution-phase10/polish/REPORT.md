# HTC Phase 10 Final Polish — Mobile Documents + Reporting Nav

**Verdict: IMPLEMENTED — AWAITING FINAL VISUAL APPROVAL**  
**Not GREEN/CLOSED.**

| Field | Value |
|---|---|
| Date | 2026-11-02 |
| Branch | `feat/spaces-booking-e1-smart-fields` |
| HEAD | `69cacab8508c40f4d4716b552f2b88e831816ca3` |
| Evidence | live-local `http://127.0.0.1:3000` |
| Commit / push / deploy | **None** |
| DB writes / migrations | **None** |

Prior Phase 10 color evidence preserved at `../evidence/`.  
This polish evidence: `polish/evidence/` · Desktop mirror: `~/Desktop/htc-color-distribution-phase10-polish/`

---

## A. Implementation summary

### Files changed

| File | Change |
|---|---|
| `components/document-workspace/document-card.tsx` | Mobile stacked identity + metadata; secondary actions in overflow; desktop strip preserved |
| `components/reporting/report-tabs.tsx` | Active-tab scroll-into-view; left/right edge fades + chevron affordances on mobile |
| `lib/theme/color-distribution-phase10-polish.test.ts` | **New** structural regression tests |
| `docs/qa/staff-light-canvas/color-distribution-phase10/polish/*` | Capture script + evidence + this REPORT |

### Documents mobile row

- **Identity:** icon + title (`line-clamp-2`) + Pin / Open / More
- **Context:** category/status badges and metadata wrap below (no narrow columns)
- **Actions:** secondary View / Details / Share / Download / Version History / Edit / Delete in overflow (permission-gated as before)
- **Desktop (`sm+`):** prior horizontal title+badges + hover action strip unchanged
- **Surfaces:** white `bg-card` rows only

### Reporting navigation

- Six tabs / routes unchanged (`REPORT_TABS`)
- On route change, scroller centers the active tab horizontally (no page scroll)
- When more tabs exist offscreen: canvas edge fade + chevron (`Show more/previous report tabs`), mobile-only (`md:hidden`)
- Affordance clears at scroll ends; swipe/scroll retained
- Desktop: all six tabs visible; no dropdown

### Preserved

- Document handlers, permissions, delete confirmation, title → View
- Report routes, date-range qs preservation, Saved exclusion from qs
- Phase 10 hospitality color classes/tokens

---

## B. Color integrity

| Surface | Live computed |
|---|---|
| Documents / Reports / Library intros | `#DCE8E0` + `5px rgb(68, 107, 86)` |
| Documents toolbar | `#FFFFFF` |
| Documents section labels | `#DCE8E0` |
| Document rows | `#FFFFFF` |
| Reporting date filter | `#F3F0E9` (absent on Saved) |
| New palette colors | **None** |

---

## C. Test results

```bash
npx tsx --test \
  lib/theme/color-distribution-phase10-polish.test.ts \
  lib/theme/color-distribution-phase10.test.ts \
  lib/document-workspace/viewer.test.ts \
  lib/reporting/saved-reports-back-nav.test.ts \
  lib/theme/color-distribution-phase9.test.ts \
  lib/theme/color-distribution-phase8.test.ts
```

**38 pass / 0 fail** (includes viewer wiring + Saved back-nav). No tests weakened.

---

## D. Browser evidence

### Documents

| Shot | Path |
|---|---|
| Mobile after | `polish/evidence/documents-mobile.png` |
| Mobile overflow open | `polish/evidence/documents-mobile-overflow-open.png` |
| Desktop | `polish/evidence/documents-desktop.png` |
| Tablet | `polish/evidence/documents-tablet.png` |
| Before (Phase 10 impl) | `../evidence/documents-workspace-mobile.png` |

Checks: readable title (`Barn-master-floorplan`); grouped metadata; overflow shows View / Details / Version History (Share/Download absent for this floor-plan perms); desktop actions visible / mobile actions hidden on desktop.

### Reporting

| Shot | Path | Notes |
|---|---|---|
| Overview mobile | `reporting-overview-mobile.png` | Active fully visible; right fade + more btn |
| Revenue mobile | `reporting-revenue-mobile.png` | Active fully visible; left fade + prev btn |
| Events mobile | `reporting-events-mobile.png` | Same end-state pattern |
| Saved mobile | `reporting-saved-mobile.png` | Active fully visible; left affordance |
| Nav interaction | `reporting-nav-interaction-saved-mobile.png` | Overview→Revenue→Saved |
| Desktop | `reporting-desktop.png` | All six tabs |

### Color regression samples

`library-documents-color-{desktop,mobile}.png`, `reporting-bookings-color-{desktop,mobile}.png` — intros/filter hex match Phase 10 locks.

---

## E. Scope integrity

| Check | Status |
|---|---|
| Branch | `feat/spaces-booking-e1-smart-fields` |
| HEAD | `69cacab8508c40f4d4716b552f2b88e831816ca3` (no commit) |
| Unrelated dirty tree | Preserved |
| No commit / push / deploy / migration / DB writes | Confirmed |

---

## F. Verdict

**IMPLEMENTED — AWAITING FINAL VISUAL APPROVAL**
