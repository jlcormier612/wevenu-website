# Phase 11A — Interaction matrix (after implementation)

| List | Primary nav | Default | Hover | Focus-visible | Whole row clickable? | Independent controls | Row bg | Semantic bg | Mobile |
|---|---|---|---|---|---|---|---|---|---|---|
| Clients | `/clients/:id` | Charcoal `.htc-record-link` | Underline, charcoal | Inset ring + underline | No | View →; portal actions | White; hospitality canvas hover | Soft-rose left inset `data-attention` | Same link class |
| Leads | `/leads/:id` | `.htc-record-link` | Underline, charcoal | Inset ring | No | View →; indicators | Hospitality hover | Indicators only | Same |
| Contracts | `/contracts/:id?returnTo=` | `.htc-record-link` | Underline, charcoal | Inset ring | No | View → | Hospitality hover (warm canvas — not status blush) | Status badges only | Mobile cards use same class |
| Vendors | `/vendors/:id` | `.htc-record-link` | Underline, charcoal | Inset ring | No | View → | Hospitality | Preference badges | Same |
| Payments | `/payments/:id` | `.htc-record-link` | Underline, charcoal | Inset ring | No | View → | Hospitality | Destructive attention **text** | Same |
| Events (`EventList`) | `/events/:id` | `.htc-record-link` | Underline, charcoal | Inset ring | No | View → | Table muted/hospitality (no list page — `/events` → Clients) | Countdown text | N/A on staff list route |
| Requests | `/requests/:id` | `.htc-record-link` (no permanent underline) | Underline, charcoal | Inset ring | **No** | Status + assignee selects | Plain table | None | Same |
| Tours | Lead via chevron only | Name **not** a link | N/A | Button focus | **No** | Status, confirm, overflow, outcome | `.htc-tours-row` | Status badges | Same |
| Documents | Title button → viewer | `.htc-record-link` on button | Underline | Inset ring | **No** | Pin, menus, open | Card muted hover | Pin warning | Phase 10 mobile actions kept |
| Invoices | Whole card | `.htc-record-card-link` | Card `hover:bg-muted/30` | Card focus ring | **Yes** (no nested controls) | None | Card | Balance-due destructive text | Card stack |
| Messaging history | Lead/client/conversation | `.htc-record-link` wrapper | Underline | Inset ring | Name block only | Timeline popover outside | None | Status labels | Same |

## Browser-measured (Clients / Leads / Contracts desktop)

| Check | Clients | Leads | Contracts |
|---|---|---|---|
| Default color | `rgb(36, 51, 43)` | same | same |
| Default decoration | none | none | none |
| Hover decoration | underline | underline | underline |
| Hover color | charcoal | charcoal | charcoal |
| Focus outline | 2px solid inset (−2px) | same | same |
