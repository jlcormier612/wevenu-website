# Phase 11A — Local browser visual acceptance

**App:** `http://127.0.0.1:3000` (dirty tree including Phase 10)  
**Venue:** Jen’s Fancy Venue  
**Capture:** `capture-browser.mts` → `browser-results.json`  

## Screenshots

| Surface | Desktop | Mobile | Hover | Focus |
|---|---|---|---|---|
| Clients | `evidence/clients-desktop.png` | `evidence/clients-mobile.png` | `evidence/clients-desktop-hover.png` | `evidence/clients-desktop-focus.png` |
| Leads | `evidence/leads-desktop.png` | `evidence/leads-mobile.png` | `evidence/leads-desktop-hover.png` | `evidence/leads-desktop-focus.png` |
| Contracts | `evidence/contracts-desktop.png` | `evidence/contracts-mobile.png` | `evidence/contracts-desktop-hover.png` | `evidence/contracts-desktop-focus.png` |
| Vendors | `evidence/vendors-desktop.png` | `evidence/vendors-mobile.png` | — | — |
| Requests | `evidence/requests-desktop.png` | `evidence/requests-mobile.png` | — | — |
| Tours | `evidence/tours-desktop.png` | `evidence/tours-mobile.png` | — | — |
| Documents | `evidence/documents-desktop.png` | `evidence/documents-mobile.png` | — | — |
| Payments | `evidence/payments-desktop.png` | `evidence/payments-mobile.png` | — | — |
| Events* | `evidence/events-desktop.png` | `evidence/events-mobile.png` | — | — |

\* `/events` redirects to `/clients` in product — Events screenshots are the Clients list (see `EXCEPTIONS.md`). `EventList` class change verified by source/tests.

## Verified (Clients / Leads / Contracts)

| Check | Result |
|---|---|
| Charcoal default `#24332B` / `rgb(36, 51, 43)` | Pass (probe) |
| No botanical text hover | Pass |
| Underline on hover | Pass (probe + screenshot review) |
| Visible focus-visible inset ring | Pass (probe) |
| Soft-rose attention inset on Clients | Pass (14 attention rows; screenshots) |
| No overflow-X introduced | Pass (`overflowX: false` all captures) |
| Three lists feel like one interaction language | Pass |

## Documents limitation

Fancy Venue Documents workspace showed **zero** `.htc-record-link` nodes at capture time (empty or no rendered title buttons). Phase 10 mobile structure preserved in source/tests; live title hover not screenshot-verified on this venue.

## Review notes

- Contracts first-row warm wash under hover is hospitality **row** hover (canvas mix), not a status blush fill — contracts have no `data-attention`.
- Requests titles no longer permanently underlined.
- Tours correctly expose **no** record-name links.
