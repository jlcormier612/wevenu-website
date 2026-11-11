# Phase 11B — Cross-screen color matrix

Locked tokens (existing CSS variables — do not invent new palette hexes):

| Token | Hex / var | Role |
|---|---|---|
| Botanical | `#446B56` | Accents, selected tabs, bar fills (not body text) |
| Eucalyptus surface | `#DCE8E0` (`--htc-eucalyptus-surface`) | Sales family headers / wells |
| Green mist | `#F1F5F2` (`--htc-green-mist`) | Bookings family wash |
| Botanical pale | `#E8F0EA` (`--htc-botanical-pale`) | Money-in wash |
| Ivory | `#FAF9F5` (`--htc-ivory`) | Outstanding body when owed > 0 |
| Soft blush | `#F7E9EB` | Outstanding **header only** when owed > 0 |
| Calm blue | `#EAF1F7` | Events / ops family header (or quiet definitional) |
| Linen | `#F3F0E9` | Phase 10 date toolbar; Saved grouping shell |
| White | `#FFFFFF` | Charts, tables, detail panels, zero-owed, rest cards |
| Charcoal | `#24332B` | Numbers, titles |
| Success / destructive | existing semantic | Comparison delta text only |

## Matrix

| Family / component | Overview | Dedicated page | Mobile | Background | Accent / border | Text | Why |
|---|---|---|---|---|---|---|---|
| **Sales demand** (Leads, Tours) | Eucalyptus **header band** + white body on ComparisonCard; funnel tiles eucalyptus wash | Sales mini-tiles + period leads/tours same | Stack full-width same tones | Header `#DCE8E0` / body white | Eucalyptus mix border on header | Charcoal | Matches Dashboard Lead Flow; demand family |
| **Bookings / commitment** (Bookings, Leads who booked, tour→book rates) | Green-mist **full wash** ComparisonCard; funnel booking tile mist | Bookings primary KPI mist; Sales cohort booking tiles mist | Same stacked | `#F1F5F2` | Warm border | Charcoal | Dashboard Booked Business model; not “money done” |
| **Money in** (Contracted, Collected, Avg contracted) | Botanical-pale wash | Revenue KPIs pale; Sales/Bookings money tiles pale | Same | `#E8F0EA` | Warm border | Charcoal | Dashboard Cash Collected; credible finance |
| **Money owed** (Outstanding) | Ivory body + blush **header** iff value > 0; pure white if 0 | Same on Revenue | Same | Ivory / white | Soft-rose header rule when >0 | Charcoal | Attention without painting polarity into surface; delta text still up-bad |
| **Events / ops** (Events count, Avg guests) | N/A on Overview KPIs | Calm-blue **header band** + white body | Same | Header `#EAF1F7` | Calm border | Charcoal | Distinct from sales/money; not calendar taxonomy colors |
| **Definitional / snapshot** (Currently booked pipeline) | — | White card (no family wash) | White | White | Neutral border | Charcoal | Not a period metric — avoid false family |
| **Funnel period strip** | Per-stage family tones above | — | 1-col stack | Family tones | Restrained | Charcoal | Same mapping as KPI families |
| **Cohort rate tiles** | Tour rate = sales; booked rates = bookings | Same | Stack | Family | — | Charcoal | Consistent category meaning |
| **Analytical tables / charts** | White panels | White Cards | White | White | Warm border | Charcoal | Eye rest; data focus |
| **Phase 10 intro** | Eucalyptus + botanical left | Unchanged | Unchanged | `#DCE8E0` | Botanical 5px | Charcoal | Locked |
| **Phase 10 date toolbar** | Linen | Linen | Linen | `#F3F0E9` | Warm | Charcoal | Locked |
| **Saved report rows** | — | White rows in optional linen nest | Same | White / linen shell | Warm | Charcoal | Management, not KPI |
| **Comparison delta** | success/destructive text | Same | Same | — | — | Semantic | Never drive card fill |

## Structural exceptions

| Component | Exception |
|---|---|
| Funnel bar charts (`bg-primary/70`) | Keep botanical fill as **magnitude bar**, not category paint for the row label |
| Overdue Badge on outstanding detail | Keep destructive Badge (icon + text) |
| Saved `LibraryAssetCard` | No per-path color tiles; outline badge only |
| Empty states | White/dashed — no blush/eucalyptus fills |
