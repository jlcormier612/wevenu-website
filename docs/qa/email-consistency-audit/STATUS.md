# Email consistency + Communications status language

**Workstream: OPEN** — inventory audit complete 2026-10-14; confirmed defects not yet fixed.  
Do **not** mark this workstream GREEN until authorized fixes + verification land.

Consolidated audit: [`AUDIT-RESULTS-2026-10-14.md`](./AUDIT-RESULTS-2026-10-14.md)  
Inventory: [`INVENTORY.md`](./INVENTORY.md)

## Serving baseline (audit reconcile)

| Field | Value |
|-------|--------|
| Sandbox image | `htc-sandbox-venue-app:c75479e6db337037cb7730116a904b5a2711f2dc` |
| Audit mode | READ-ONLY — no code, config, DNS, sends, or Production changes |

## Gate 1 — Inquiry branding (venue notify)

**GREEN** on `5b7d35d1` (ancestor of current serving). See `docs/qa/inquiry-notification-branding/`.  
Inquirer thank-you remains out of scope for that gate → defect D1 in audit results.

## Gate 2 — Inventory

**Audit complete / workstream OPEN.** Full dispositions in `AUDIT-RESULTS-2026-10-14.md`.

Launch-relevant open defects: **D1** (thank-you), **D2** (forms venue), **D3** (Wedding label).

## Gate 3 — Communications language + channel test split

**GREEN** on serving `ffbe34c7` (includes `d5e36593`); still in ancestry of `c75479e6`.

Deploy: https://github.com/jlcormier612/wevenu-website/actions/runs/38478298669 **success**

### Browser (`/messaging/health`, Fancy — texting unconfigured)

Evidence: `browser-results.json`, `comms-health-1280.png`, `comms-health-sms-gate.png`

| Check | Result |
|-------|--------|
| Test email successful / Test text successful | PASS |
| No generic “Test message successful” | PASS |
| Sent / Delivered / Opened / Clicked definitions | PASS |
| Opened/Clicked email-only engagement note | PASS |
| SMS test Not applicable when unconfigured | PASS |
| Send test text disabled; will not call provider | PASS |
| No email/SMS sent during verify | Confirmed |

## Gate 4 — Open/click E2E

Still **approval-gated / unverified** (**BLOCKED — EXTERNAL** DNS). No tracking test email sent.

## Production

Untouched.
