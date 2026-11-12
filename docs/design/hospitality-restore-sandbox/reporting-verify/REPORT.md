# Reporting Sandbox verification — PR #29 / `df1aa331`

**Deploy:** https://github.com/jlcormier612/wevenu-website/actions/runs/43118598098  
**Conclusion:** success  
**Source SHA:** `df1aa331dc8cd38d7b6db6e6762d8d8c2a2d1070` (merge of PR #29 into `main`)  
**ECS task definition:** `htc-sandbox-venue-app:1172`  
**Image:** `…/htc-sandbox-venue-app:df1aa331dc8cd38d7b6db6e6762d8d8c2a2d1070`  
**ECR digest:** `sha256:5a109d1376e6a38d6090ccd03d285713f2ad4889aacee66511a26a07951f2f9e`  
**Health:** `200` `{"ok":true,...}`

## Visual / functional checks

| Check | Result |
| --- | --- |
| Overview colored KPI tiles (`data-report-metric-tile`) | **PASS** — 9 tiles (6 period + 3 cohort); tones sales/bookings/contracted/collected/outstanding present |
| Match vs marketing `features-showroom/reporting.png` | **PASS** — six soft sage/rose period cards restored; plain white funnel boxes gone |
| Day/Week/Month control | **PASS** — Week default for This Month; Day click → `?grain=day` + “Daily view…” |
| Events Cocktail Hour / Private Event | **PASS** — friendly labels; no raw `cocktail_hour`; Not recorded not lumping known tokens |
| Saved Reports compact rows | **PASS** — 4 starter rows; Open Report / Manage present |
| Desktop + mobile captures | Under `desktop/` and `mobile/` |

Screenshots: `docs/design/hospitality-restore-sandbox/reporting-verify/`.

## Explicit non-closure

This verifies **reporting** on Sandbox only. Full hospitality restoration inventory and remaining launch blockers remain open.
