# RCJ Human-Facing Cleanup Workstream

**Status:** PARTIAL — NOT full-workstream GREEN  
**Production:** untouched  
**Updated:** 2026-09-23

## Proven on Sandbox (code + DB + runtime + browser)

| Layer | Result |
|---|---|
| Commit (E2E runtime) | `0086371c` |
| Migration | `20261405900000_…` applied — [run 35898554084](https://github.com/jlcormier612/wevenu-website/actions/runs/35898554084) |
| Deploy | [35898557440](https://github.com/jlcormier612/wevenu-website/actions/runs/35898557440) success |
| ECS | `htc-sandbox-venue-app:357` image `…:0086371c…` health 200 |
| Pre-portal pay page | Wedding Deposit · Pay $800 · no portal nav · system # as Reference |
| Stripe | Checkout + currency conversion · paid |
| DB | Same invoice/line paid; balance_due 0; **financial session only** |
| Confirmation | Payment received · What's next (no premature portal) · settled $0.00 |

Evidence: `01-pre-portal-payment-page.png`, `02-payment-confirmation.png`, `03-payment-confirmation-settled.png`, `pre-portal-fixture.json`, `results.json`.

Follow-up commit `7dc63d6f` (confirmation refetch race) redeploying: [35899840462](https://github.com/jlcormier612/wevenu-website/actions/runs/35899840462).

## Product decisions locked

1. Payment access ≠ portal access (`financial` sessions → `PaymentAccessShell`).
2. `invoice_number` immutable; `display_name` human editable.
3. Unsolicited SMS consent solicitation **fails closed**; email solicitation OPEN pending legal.
4. Spaces: `space_operating_mode` + `permitted_uses` + `event_space_assignments`; calendar filter only when `multi`.
5. Payment ≠ Booked unless venue-configured.

## OPEN (do not invent / still unproven in browser)

- Legal basis for venue-initiated email SMS-consent solicitation.
- Tour datetime consistency browser sweep (unit/regression green).
- Manual-lead SMS UI browser proof.
- Venue invoice-name edit UI browser proof.
- Multi-space assignment editor + calendar filter browser proof.
- Named deposit email mailbox capture on financial send path.

## Automated tests

47 focused tests pass (timezone, invoice display-name, SMS fail-closed, payment-access, spaces uses, contract merge).
