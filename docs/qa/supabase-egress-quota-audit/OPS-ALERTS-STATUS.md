# Ops Alerts dual-channel — STATUS

**Observation (UTC):** 2026-10-12T03:15Z  
**App tip:** `0425c4558dab474d0c90b200703801a4689c3971` (live on `app.sandbox.hellotocheers.com`)  
**Ops Lambda:** redeployed with incident persist (`htc-sandbox-ops-alert-email`)  
**Migration:** `20261415200000_ops_incidents_hq.sql` applied ([run](https://github.com/jlcormier612/wevenu-website/actions/runs/38198955385))  
**App deploy:** [success](https://github.com/jlcormier612/wevenu-website/actions/runs/38198957084)  
**Production / billing / Spend Cap:** untouched  

## Channel proof (lifecycle)

| Step | Result |
|---|---|
| Persist ALARM → one `ops_incidents` row | PASS (`ops-incidents-lifecycle.json`) |
| Duplicate ALARM → same row, email skipped | PASS (`skipped_duplicate`) |
| Recovery OK → status `recovered` + email | PASS |
| Email delivered (Resend `last_event`) | PASS ALARM + OK to `jennifer@hellotocheers.com` |
| Anon cannot read incidents | PASS |
| HQ UI list + banner + acknowledge (not resolve) | PASS (`ops-alerts-hq-browser.json`) |

Resend IDs (delivered):

- `01a12e1b-8cfe-71ce-9f5a-63334c0c015d` — `[ALARM] HTC Sandbox: htc-sandbox-qa-lifecycle-probe`
- `01a12e1b-966e-7934-99ff-bec9d5a9467d` — `[OK] HTC Sandbox: htc-sandbox-qa-lifecycle-probe`

## Current Resend usage (canary invoke)

- Daily: **65 / 100** (65%)
- Monthly: **2295 / 3000** (**76.5%**) — monthly warning threshold 70% remains breached

## Capacity / customer-traffic

**YELLOW** — notifications work; Spend Cap + authoritative Supabase current-cycle meters still not owner-closed.

## In-product surface

- HQ `/admin/ops-alerts` (+ detail), nav badge, home banner  
- RLS: `is_hq_admin()` only (`jennifer@` is HQ admin)
