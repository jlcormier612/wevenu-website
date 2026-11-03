# Phase 11B — Live visual acceptance

**Source:** Local app `http://127.0.0.1:3000` (not HTML mockups)  
**Venue:** Jen’s Fancy Venue  
**Desktop copies:** `~/Desktop/htc-phase11b-reports-implementation/`

## Screenshots (15)

| File | Notes |
|---|---|
| `evidence/overview-{desktop,mobile}.png` | Funnel + KPI tones |
| `evidence/overview-desktop-below.png` | Below-fold KPIs |
| `evidence/sales-{desktop,mobile}.png` | Mini-tile tones |
| `evidence/sales-desktop-below.png` | |
| `evidence/bookings-{desktop,mobile}.png` | |
| `evidence/revenue-{desktop,mobile}.png` | Contracted/Collected/Outstanding |
| `evidence/revenue-desktop-below.png` | White trend panel |
| `evidence/events-{desktop,mobile}.png` | Calm-blue ops headers |
| `evidence/saved-{desktop,mobile}.png` | Linen shell + white rows |

## Live probes (Overview / Revenue desktop)

| Metric | Background | Expected |
|---|---|---|
| Outstanding | `rgb(243, 240, 233)` linen | Neutral — **not blush** |
| Contracted | `rgb(232, 240, 234)` botanical-pale | Pale botanical |
| Collected | `rgb(220, 232, 224)` eucalyptus | Stronger botanical |

Phase 10 intro accent + linen date filter present on KPI routes; Saved has intro, no date filter (correct).  
`overflowX: false` on all captures.

## Intentional deviations from mockups

- Real Phase 10 tabs/date/Save Report controls retained (not mockup pills).
- Outstanding always linen (approved refinement vs blush mockup).
- Collected = eucalyptus surface vs Contracted pale (approved stronger botanical).
- Zero-data month still shows family surfaces (correct — category ≠ magnitude).
