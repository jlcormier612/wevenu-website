# Phase 11B — Reports current state

**Captured:** 2026-11-03 from local dirty tree (Phases 10 + 11A present)  
**Evidence:** `evidence/current/*`  
**Phase 10 chrome verified on all six views:** accented eucalyptus intro + report tabs; linen date filter on all except Saved.

## Inventory by view

### 1. Overview (`/reporting`)
- `DateRangeControl` (linen filter)
- `BusinessFunnel` — white Card; period strip = 6 identical white bordered tiles; cohort = 3 identical white tiles
- `ComparisonCardGrid` — 7 white `ComparisonCard`s (Leads, Tours, Bookings, Leads who booked, Contracted, Collected, Outstanding)
- Footnote + outline deep-links
- **Weakness:** After Phase 10 header, content is a monochrome white KPI wall; Dashboard Snapshot already shows category color

### 2. Sales (`/reporting/sales`)
- `ReportHeader` + linen filter
- Large white Card “Leads from this period” with 3 white mini-tiles, source/event-type tables, financial funnel bars (`bg-primary/70`)
- White Card “During this period” with 4 white mini-tiles + Contracted/Collected white tiles + attribution lists + TrendChart card
- **Weakness:** Dense but undifferentiated; sales vs bookings vs money wells look identical

### 3. Bookings (`/reporting/bookings`)
- 3 white ComparisonCards (Bookings, Contracted, Avg. contracted value)
- White Cards: by source, trend, booking list
- **Weakness:** Bookings count and money metrics share same white treatment

### 4. Revenue (`/reporting/revenue`)
- 4 white ComparisonCards (Contracted, Collected, Outstanding, Avg)
- Detail panels on demand; white trend/source/category cards; botanical bar fills
- **Weakness:** Outstanding (up-bad polarity) only differs via comparison text color — card surface identical to Contracted

### 5. Events (`/reporting/events`)
- 2 white ComparisonCards (Events, Avg guests) — polarity neutral
- White trend / types / list cards
- **Weakness:** No operational family identity; easy to confuse with sales KPIs

### 6. Saved (`/reporting/saved`)
- No date filter (correct)
- `LibraryAssetCard` rows — white management list
- Empty: dashed white card
- **Weakness:** Fine as management UI; must not become colored KPI tiles

### Dashboard reference (`/dashboard`)
- Business Snapshot already uses eucalyptus header / green-mist / botanical-pale / ivory+blush header — **role model for Reports KPI families**

## Shared components
`ComparisonCard` (always white Card), `ComparisonCardGrid`, `BusinessFunnel` (white), `ReportHeader`, `DateRangeControl`, `ReportTabs`, `TrendChart`, `DetailPanel`, `LibraryAssetCard`, `ReportsLayoutShell`.
