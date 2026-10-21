# Booking-to-portal simplification (corrective)

## Status

**GREEN / CLOSED** (corrective pass)

Prior acceptance on `db43eff7` was insufficient — see `FORENSIC-CORRECTIVE.md`.

## Serving

| Item | Value |
|------|-------|
| Product commit | `19eb9a01e7d556e784f9d796094c4daea21be3ec` |
| Deploy | https://github.com/jlcormier612/wevenu-website/actions/runs/39645643517 success |
| Serving SHA | `19eb9a01e7d556e784f9d796094c4daea21be3ec` |

## What was corrected

1. Removed separate Inventory / Event Order prepare/start CTAs from Event Setup.
2. Missing included drafts recover only via **Prepare and release portal**.
3. Removed embedded BookingSetupCard / TimelineSetupCard wizards from Event Setup.
4. Prepare/release also applies missing timeline + floor-plan offers when configured.
5. Booking no longer copies a second vendor recommendation list; Vendors tab shows Vendor Network.
6. Questionnaire copy frames separate scheduled/authorized send (still not sent by portal release).
7. Harness now asserts absence of component prepare CTAs and embedded apply wizards.

## Acceptance

`scripts/qa/booking-to-portal-simplification-acceptance.mts` → **29/29 PASS**  
`docs/qa/booking-to-portal-simplification/browser-results.json`

Synthetic fixture: event `a51e01ba-1632-4dbf-9cde-a816577281df` / client `30e09cb2-934f-4362-b956-83bdf8531fe6`

## Unit tests

`lib/event-setup/*.test.ts` + phase3 invite seams → **112/112 PASS**

## Production

Untouched. Unrelated dirty work preserved (~897 paths).
