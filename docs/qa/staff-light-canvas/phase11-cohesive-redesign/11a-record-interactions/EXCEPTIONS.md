# Phase 11A — Exceptions & preserved semantics

| Item | Decision | Reason |
|---|---|---|
| **Tours couple name** | Not converted to `.htc-record-link` | Action-dense row (status, confirm, overflow, outcome). Lead nav remains chevron button. Making the name a link would add a third affordance and risk nested-control confusion. |
| **Leads pipeline board cards** | Unchanged whole-card `router.push` | Kanban cards are a different interaction model; not a table record-name link. |
| **Lead filter chips** | Keep `text-primary hover:underline` | Secondary filters, not record titles. |
| **Clients `data-attention` soft-rose inset** | Preserved | Verified semantic attention indicator — not generic hover. |
| **Payments / invoices financial colors** | Preserved | Destructive/success text for money semantics — not record-link chrome. |
| **Invoices whole-card link** | Uses `.htc-record-card-link` (not title underline pattern) | Card has no nested controls; hover = muted card wash; focus = ring on card. |
| **`/events` route** | Redirects to `/clients` | Existing product behavior. `EventList` still updated for any embed/call site. No live Events list screenshot. |
| **Documents empty venue capture** | Class applied in source; no live title nodes | Cannot claim hover screenshot for Documents on Fancy Venue this run. |
| **Messaging “Load more”** | Remains `text-primary hover:underline` | Pagination control, not a record name. |
| **Contracts row wash on hover** | Left as hospitality canvas row hover | Not classified as business-state blush; no contract `data-attention` attribute exists. |

## Safety rules honored

1. No whole-row links added where selects/menus/buttons exist (Requests, Tours, Documents, Clients portal).
2. No nested interactive wrappers introduced.
3. Destinations / `returnTo` / permissions / filters / search untouched.
4. No Phase 11B–11E visual chrome in this wave.
