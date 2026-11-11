# Phase 11A Final Verification — Events routing

## Findings

| Question | Answer |
|---|---|
| Does `/events` redirect to `/clients`? | **Yes — intentional.** `app/(app)/events/page.tsx` comments: standalone Events list is retired; Bookings (`/clients`) is the master workspace list. |
| Where is `EventList` rendered? | **Nowhere.** `components/events/event-list.tsx` exports `EventList`, but no page/component imports it (repo search excluding worktrees/docs). |
| Reachable via normal staff nav? | **No.** Sidebar has no Events list item; `/events` lands on Clients. |
| Record-name links in component? | Yes — `htc-record-link` → `/events/${id}` plus trailing `View →` to the same destination. |
| Whole-row click? | **No** — `TableRow` has no `onClick`. |

## Browser evidence

- Navigating `/events` → final URL `/clients`, h1 “Clients”.
- Screenshot: `evidence/events-route-redirect-clients.png`

## Verification method

Because `EventList` is an intentionally unreachable legacy component:

- **No new route created.**
- **Component not removed.**
- Component-level regression in `lib/theme/phase11a-record-interactions.test.ts`:
  - `/events` page redirects to `/clients`
  - record name uses `htc-record-link` to `/events/${id}`
  - `View →` dual affordance preserved
  - no whole-row click / no `hover:text-primary`

## Exception classification

**Documented exception — not a product defect.** Staff booking discovery is Clients; event detail remains at `/events/[id]` from other entry points (client detail, celebrations, etc.).

## Separate finding?

None for this styling task. The redirect is product-intended, not a Phase 11A regression.
