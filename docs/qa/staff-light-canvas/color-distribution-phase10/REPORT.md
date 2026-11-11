# HTC Phase 10 Implementation — Reporting + Documents Hybrid C+B

**Verdict: IMPLEMENTED — AWAITING VISUAL APPROVAL**  
**Not GREEN/CLOSED.**

| Field | Value |
|---|---|
| Date | 2026-11-02 |
| Branch | `feat/spaces-booking-e1-smart-fields` |
| HEAD | `69cacab8508c40f4d4716b552f2b88e831816ca3` |
| Live venue | Jen's Fancy Venue (`a415ac52-…`) |
| Evidence kind | **live-local** (`http://127.0.0.1:3000`) — not Sandbox |
| Commit / push / deploy | **None** |
| DB writes / migrations | **None** |

Evidence: `docs/qa/staff-light-canvas/color-distribution-phase10/`  
Desktop mirror: `~/Desktop/htc-color-distribution-phase10/`  
Discovery refs: `docs/qa/staff-light-canvas/phase10-reporting-documents-discovery/`

---

## A. Implementation summary

### Files changed

| File | Change |
|---|---|
| `app/globals.css` | `.htc-hospitality-intro-accent` (5px botanical left), `.htc-hospitality-filter` (linen toolbar), `.htc-hospitality-section-label` (compact eucalyptus band); dark-mode companions |
| `components/reporting/reports-layout-shell.tsx` | Shared accented eucalyptus intro wrapping existing Reports `PageHeader`; `data-htc-phase10="reporting"` |
| `components/reporting/date-range-control.tsx` | Linen `.htc-hospitality-filter` on existing date/Save Report row; `data-htc-phase10="reporting-date-toolbar"` |
| `components/document-workspace/document-workspace.tsx` | Accented intro; eucalyptus section labels (Pinned / Categories / list heading); white `.htc-hospitality-toolbar` for search/filter/sort; white rows unchanged |
| `app/(app)/library/documents/page.tsx` | Accented intro only around existing `PageHeader` |
| `lib/theme/color-distribution-phase10.test.ts` | **New** — structural / token regression seams |
| `docs/qa/staff-light-canvas/color-distribution-phase10/*` | Capture script + 16 PNGs + `browser-results.json` + this REPORT |

### Classes reused / added

| Class | Role |
|---|---|
| `.htc-hospitality-intro` | Existing eucalyptus intro (Phases 8+) |
| `.htc-hospitality-intro-accent` | **New modifier** — botanical left accent; Phase 8 Contracts/Payments keep plain intro |
| `.htc-hospitality-filter` | **New** — linen date/filter toolbar (Reporting only) |
| `.htc-hospitality-toolbar` | Existing white operational toolbar (Documents search) |
| `.htc-hospitality-section-label` | **New** — compact eucalyptus section band |

### Treatment by route

| Route | Intro | Date/filter | Content |
|---|---|---|---|
| `/reporting` (+ sales/bookings/revenue/events) | Shared accented eucalyptus via shell | Linen date toolbar | White KPI/chart/table cards |
| `/reporting/saved` | Same shared intro | **No** date toolbar | White saved-report cards |
| `/documents` | Accented eucalyptus | White search toolbar (Option B) | Eucalyptus Categories + list heading; white rows |
| `/library/documents` | Accented eucalyptus only | Unchanged manager chrome | Unchanged file list / Add Document |

### Explicit exclusions honored

- No linen wrapper around Bookings KPIs
- No linen Documents list wrapper
- No date toolbar inventing on Saved Reports
- No category bands / linen toolbar on Library Documents
- No chart series / status / badge recolor
- No mobile document-row redesign (pre-existing truncation noted as UX follow-up)

---

## B. Computed-style evidence (live browser)

| Surface | Measured |
|---|---|
| Reports / Documents / Library intros | bg `#DCE8E0`; left border `5px rgb(68, 107, 86)` (`#446B56`) |
| Reporting date toolbar | bg `#F3F0E9` (linen) — present on Overview/Sales/Bookings/Revenue/Events |
| Saved Reports date toolbar | **absent** (`hasDateToolbar: false`) |
| Documents search toolbar | bg `#FFFFFF` |
| Documents section labels | bg `#DCE8E0` — `Categories`, `All Documents (290)` |
| Reporting KPI/cards | `#FFFFFF` |
| Document rows | `bg-card` white cards on canvas (unchanged markup) |
| Page canvas | warm `#F8F7F3` |
| Mobile overflow-X | **false** on all 16 captures |

Full probes: `browser-results.json`.

---

## C. Tests

```bash
npx tsx --test \
  lib/theme/color-distribution-phase10.test.ts \
  lib/theme/color-distribution-phase9.test.ts \
  lib/theme/color-distribution-phase8.test.ts \
  lib/theme/color-distribution-phase4.test.ts
```

| Suite | Result |
|---|---|
| Phase 10 | 6/6 pass |
| Phase 9 | 3/3 pass |
| Phase 8 | 6/6 pass |
| Phase 4 | 6/6 pass |
| **Total** | **21 pass / 0 fail** |

No tests weakened. No pre-existing failures in this focused set.

---

## D. Browser verification

### Routes × viewports (16 required)

| Screen | Desktop | Mobile |
|---|---|---|
| Reporting Overview | `evidence/reporting-overview-desktop.png` | `…-mobile.png` |
| Reporting Sales | `evidence/reporting-sales-desktop.png` | `…-mobile.png` |
| Reporting Bookings | `evidence/reporting-bookings-desktop.png` | `…-mobile.png` |
| Reporting Revenue | `evidence/reporting-revenue-desktop.png` | `…-mobile.png` |
| Reporting Events | `evidence/reporting-events-desktop.png` | `…-mobile.png` |
| Reporting Saved | `evidence/reporting-saved-desktop.png` | `…-mobile.png` |
| Documents workspace | `evidence/documents-workspace-desktop.png` | `…-mobile.png` |
| Library Documents | `evidence/library-documents-desktop.png` | `…-mobile.png` |

### Interaction checks

- Report tab navigation Overview → Bookings → `http://127.0.0.1:3000/reporting/bookings`
- Documents category filter “Contracts” clickable (`contractsFilterClicked: true`)

### UX follow-up (not Phase 10 scope)

Mobile Documents rows still show aggressive title truncation and crowded action icons (pre-existing). Captured for separate UX work; not redesigned here.

---

## E. Integrity

| Check | Status |
|---|---|
| Branch | `feat/spaces-booking-e1-smart-fields` |
| HEAD SHA | `69cacab8508c40f4d4716b552f2b88e831816ca3` (unchanged — no commit) |
| Working tree | Phase 10 files added/modified alongside pre-existing unrelated dirty work — **preserved** |
| No reset/stash/clean | Confirmed |
| No commit / push / deploy | Confirmed |
| No DB writes / migrations | Confirmed (auth magic-link session only for capture) |
| Phases 1–9 Contracts/Payments plain intro | Tests assert no `intro-accent` on those pages |

---

## F. Verdict

**IMPLEMENTED — AWAITING VISUAL APPROVAL**

Stop. No Phase 11. Awaiting ChatGPT visual review.
