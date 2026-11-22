# CRM DATA-CLEAN scripts (preparation only)

**Do not run destructive mode without founder approval of the exact manifest.**

Manifest source of truth (Desktop package):

`~/Desktop/HTC-LAUNCH-FINAL/CRM-READINESS/DATA-CLEAN-MANIFEST/`

## Scripts

| Script | Purpose |
|---|---|
| `dry-run-purge.mts` | Load store + manifest; print would-delete counts; **never writes** |
| `purge-approved.mts` | Requires `--i-approve-manifest=<sha256>` and `EXECUTE=1`; cascades delete inside CRM store only |

## Safety

- Targets CRM Postgres document store only (`htc_crm_*` via `withLiveStore`)
- Never calls Stripe / Resend / Twilio / QuickBooks
- Never touches `htc_internal_staff` or Auth users
- Never touches venue-app tables
- Refuses to delete `rel_841b2c03925e` (Jen's Fancy Venue) even if listed
