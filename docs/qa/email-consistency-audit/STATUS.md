# Email consistency + Communications status language

**Workstream: OPEN** — A/B/D/C-D5 closed on Sandbox; dual-tour single-email fix pending serve verify; Group E external.  
Do **not** mark the full workstream GREEN until remaining authorized groups land.

Consolidated audit: [`AUDIT-RESULTS-2026-10-14.md`](./AUDIT-RESULTS-2026-10-14.md)  
Group A: [`GROUP-A-STATUS.md`](./GROUP-A-STATUS.md)  
Group B: [`GROUP-B-STATUS.md`](./GROUP-B-STATUS.md)  
Group C: [`GROUP-C-STATUS.md`](./GROUP-C-STATUS.md)  
Group D: [`GROUP-D-STATUS.md`](./GROUP-D-STATUS.md)  
Inventory: [`INVENTORY.md`](./INVENTORY.md)

## Serving baseline (Group A close)

| Field | Value |
|-------|--------|
| Sandbox image | `htc-sandbox-venue-app:5132aebfbfa0d5c8d904689caf369f9db8707f20` |
| Group A | GREEN — no sends; Production/DNS/Resend untouched |

## Gate 1 — Inquiry branding (venue notify)

**GREEN** on `5b7d35d1` (ancestor of current serving). See `docs/qa/inquiry-notification-branding/`.  
Inquirer thank-you remains out of scope for that gate → defect D1 in audit results.

## Gate 2 — Inventory / Group A

**Audit complete.** Full dispositions in `AUDIT-RESULTS-2026-10-14.md`.

| Item | Status |
|------|--------|
| Group A D1–D3 | **GREEN** on `5132aebf` — see `GROUP-A-STATUS.md` |
| Group B D4/D6 | **GREEN** on serving `3fe94472` — see `GROUP-B-STATUS.md` |
| Group C D5 | **GREEN** on serving `3fe94472` — see `GROUP-C-STATUS.md` |
| Group C dual-tour | Single-email fix committed; Sandbox verify pending — see `GROUP-C-STATUS.md` |
| Group D `$500` | **GREEN / CLOSED** (test-only) — see `GROUP-D-STATUS.md` |
| Group E open/click | Still OPEN / external |

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
