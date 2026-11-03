# HTC Phase 10 — Mobile Reporting Edge-Fade Polish

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

Prior nav polish preserved under `../evidence/`.  
This package: `polish/final-navigation/edge-fade/` · Desktop mirror: `~/Desktop/htc-color-distribution-phase10-edge-fade/`

---

## A. Implementation

### Files changed

| File | Change |
|---|---|
| `components/reporting/report-tabs.tsx` | In-scroller CSS mask + canvas edge overlays; active-tab pad cleared of fade band |
| `lib/theme/color-distribution-phase10-polish.test.ts` | Assert mask + directional fades; reserved `w-9` slots unchanged |
| `docs/qa/.../edge-fade/*` | Capture, probes, screenshots, this REPORT |

### Fade / mask approach

1. **Reserved chevron slots unchanged** — `w-9` flex edges outside the scroller (`md:hidden`).
2. **Scroller CSS mask** (`mask-image` / `-webkit-mask-image`) — 48px directional dissolve when that side can scroll:
   - Left: `transparent → rgba(0,0,0,0.25) @ 18px → #000 @ 48px`
   - Right: mirror from `calc(100% - 48px)`
3. **Canvas overlays** (`w-12`, `from-[var(--htc-canvas,#F8F7F3)]`) inside the clipped scroller wrapper only — never over chevrons (`pointer-events-none`, `md:hidden`).
4. **Boundary rules** — left fade/chevron only when `canScrollLeft`; right only when `canScrollRight`.
5. **Active tab** — `scrollActiveIntoView` pad `52px` so active label/underline stay clear of the fade band.

### Confirmed reserved slots intact

Live probes: `fadeOverChevron: false` on all states; chevrons remain in `data-htc-report-tabs-edge` slots; desktop shows no fades/chevrons.

---

## B. Tests

```bash
npx tsx --test \
  lib/theme/color-distribution-phase10-polish.test.ts \
  lib/theme/color-distribution-phase10.test.ts \
  lib/reporting/saved-reports-back-nav.test.ts
```

**17 pass / 0 fail.**

Computed mask (Saved):  
`linear-gradient(to right, transparent 0, rgba(0,0,0,0.25) 18px, #000 48px, #000 100%)`

---

## C. Browser verification

### Screenshots (390px + desktop)

| State | Full | Tabs crop |
|---|---|---|
| Overview | `evidence/reporting-overview-mobile.png` | `…-tabs.png` |
| Sales | `…-sales-mobile.png` | `…-tabs.png` |
| Bookings | `…-bookings-mobile.png` | `…-tabs.png` |
| Revenue | `…-revenue-mobile.png` | `…-tabs.png` |
| Events | `…-events-mobile.png` | `…-tabs.png` |
| Saved | `…-saved-mobile.png` | `…-tabs.png` |
| Desktop | `evidence/reporting-desktop.png` | `…-tabs.png` |
| Interactions | `evidence/reporting-nav-interaction-mobile.png` | |

### Probe results

| Active | Visible | Clear of fade | Fade L/R | Fade over chevron | pageOverflowX |
|---|---|---|---|---|---|
| Overview | yes | yes | — / yes | no | false |
| Sales | yes | yes | — / yes | no | false |
| Bookings | yes | yes | yes / yes | no | false |
| Revenue | yes | yes | yes / yes | no | false |
| Events | yes | yes | yes / yes | no | false |
| Saved | yes | yes | yes / — | no | false |
| Desktop | yes | yes | — / — | no | false |

### Interactions

Chevron more/prev, Overview ↔ Saved, swipe: fades track scroll; `fadeOverChevron` always false.

### Visual inspection notes

- Overview right edge: Revenue fragment softens into canvas before the chevron (not a hard “Reve” cut).
- Saved left edge: Bookings remnant washes out via fade; no right fade/chevron.
- Active underlines remain fully readable on all six states.

---

## D. Scope integrity

- Phase 10 colors, Documents mobile layout, report content: **unchanged**
- Dirty working tree: **preserved**
- No commit / push / deploy / migration / DB writes

---

## E. Verdict

**IMPLEMENTED — AWAITING FINAL VISUAL APPROVAL**
