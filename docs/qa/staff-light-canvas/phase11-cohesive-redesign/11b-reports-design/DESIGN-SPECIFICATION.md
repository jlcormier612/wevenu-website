# Phase 11B — Design specification (screen-by-screen)

**Mode:** Design only — not implemented  
**Strategy:** Category-meaningful surfaces reused from Dashboard Snapshot tokens; Phase 10 chrome locked; white retained for analytical depth; comparison polarity stays in text/icons only.

---

## Global principles (accepted combination)

1. **Color = category** (A) — same family looks the same on Overview and dedicated pages.  
2. **Limited palette** (B) — four KPI families + white rest; no rainbow.  
3. **Analytical character** (C) — tables/charts stay white; color is for KPI/funnel wells only.  
4. **Hierarchy beyond fill** (D) — section labels, header bands vs full washes, spacing; icons already on Overview ComparisonCards — do not add decorative icon rows.  
5. **Contrast** (E) — charcoal numbers always; never botanical body text on eucalyptus.  
6. **Meaning preserved** (F) — no “green because up / blush because down.”

### KPI tone API (implementation target)

Extend `ComparisonCard` with optional `tone`:

| `tone` | Treatment |
|---|---|
| `sales` | Eucalyptus header band + white body (Lead Flow) |
| `bookings` | Green-mist full wash |
| `money` | Botanical-pale full wash |
| `owed` | If `value > 0`: ivory + blush header; else white |
| `ops` | Calm-blue header band + white body |
| `neutral` / omit | White (current) |

Equal grid geometry retained (`ComparisonCardGrid` / min-heights).

---

## 1. Reporting Overview

### Current
Phase 10 intro/filter strong; Funnel + ComparisonCards all white.

### Proposed structure
1. Keep Phase 10 intro + tabs + linen filter.  
2. **How the business moved** Card: white shell; period tiles get family tones (sales/sales/bookings/money/money/owed).  
3. Cohort tiles: Took a tour → `sales`; Leads who booked + Toured then booked → `bookings`.  
4. ComparisonCards: Leads/Tours `sales`; Bookings + Leads who booked `bookings`; Contracted/Collected `money`; Outstanding `owed`.  
5. Footnotes + outline buttons unchanged.

### Eye path
Intro → linen dates → funnel (category strip) → cohort rates → KPI grid → deep links.

### Desktop
4-col Comparison grid; 6-col funnel on xl.

### Mobile
Single-column stack; funnel tiles full width; same tones; preserve tab edge fades.

### Protected
Phase 10 chrome; metric math; polarity accessible sentences; Outstanding clock copy.

### Components
`page.tsx`, `business-funnel.tsx`, `comparison-card.tsx`.

---

## 2. Sales

### Current
White mega-cards; white mini-tiles; botanical magnitude bars OK.

### Proposed
- Card “Leads from this period”: top rule eucalyptus 3px; mini-tiles Leads=`sales`, booked metrics=`bookings`.  
- Funnel stage rows: keep white row + botanical bar (magnitude).  
- “During this period”: New leads/Tours=`sales`; Bookings=`bookings`; Currently booked=`neutral` white; Contracted/Collected=`money`.  
- Source/event tables + TrendChart: **white**.  
- Optional calm-blue tip strip only if adding short “how to read cohort vs period” — prefer existing copy, no new calm panel unless product asks.

### Eye path
Header → filter → cohort card (sales identity) → period card → chart.

### Mobile
Stack mini-tiles; tables already scroll horizontally — unchanged.

### Protected
Detail panels, attribution math, chart data, links.

### Components
`sales/page.tsx` (classNames on mini-tile Links/divs); shared tone utilities.

---

## 3. Bookings

### Current
Three white ComparisonCards mix bookings + money.

### Proposed
- Bookings → `bookings`  
- Contracted → `money`  
- Avg. contracted value → `money`  
- Source/trend/list Cards → white with eucalyptus **section label** styling optional via existing heading weight only (no full colored card).

### Mobile
Stack three KPIs; lists unchanged.

### Protected
Lifecycle booking definitions; list navigation.

### Components
`bookings/page.tsx`, `ComparisonCard` tones.

---

## 4. Revenue

### Current
Four white finance KPIs; Outstanding only differs by delta color.

### Proposed
- Contracted, Payments Collected, Avg → `money`  
- Outstanding Balance → `owed` (blush header iff > 0)  
- Trend / by source / by category → white analytical Cards  
- DetailPanel → white (overdue Badge preserved)

### Eye path
Money family KPIs first → owed attention → charts/tables.

### Mobile
Stack KPIs; owed header remains readable.

### Protected
Mixed-clock explanations; detail fetch-on-demand; Overdue badge.

### Components
`revenue/page.tsx`, `ComparisonCard`.

---

## 5. Events

### Current
Two white neutral KPIs; white lists.

### Proposed
- Events + Average Guest Count → `ops` (calm-blue header + white body)  
- Trend / types / list → white  
- **Do not** use calendar Event purple on KPI chrome.

### Mobile
Stack two KPIs then white panels.

### Protected
Event queries; client link destinations; polarity neutral.

### Components
`events/page.tsx`, `ComparisonCard` `tone="ops"`.

---

## 6. Saved Reports

### Current
White LibraryAssetCards; management actions.

### Proposed
- Optional linen nest around the list (like a filter shell) — **single** supporting surface.  
- Rows stay white; outline path badge; botanical “Open report” emphasis already on LibraryAssetCard.  
- Empty state remains dashed white.  
- **No** per-report family coloring by Sales/Revenue path.

### Mobile
Same; overflow menus unchanged.

### Protected
Duplicate/delete; open href + query presets; Templates back link.

### Components
`saved/page.tsx`, `saved-report-list.tsx` (wrapper class only).

---

## Empty / zero / long-label behavior

| Case | Treatment |
|---|---|
| Outstanding = 0 | `owed` collapses to white (no blush header) |
| Zero leads/bookings | White empty copy inside white panels |
| Long money strings | Existing tabular-nums + wrap sub; tones must not reduce padding |
| Missing prior period | Existing “No data for the prior period” — muted, not blush |

---

## Visual previews

Isolated mockups (banner: DESIGN PROPOSAL ONLY):

- `evidence/proposed/overview-desktop.png`
- `evidence/proposed/overview-mobile.png`
- `evidence/proposed/revenue-desktop.png`
- `evidence/proposed/revenue-mobile.png`
- `evidence/proposed/sales-desktop.png`
- `evidence/proposed/saved-mobile.png`

Source HTML: `mockups/*.html` — **not** application code.
