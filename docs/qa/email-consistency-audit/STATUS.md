# Email consistency + Communications status language

## Gate 1 — Inquiry branding

**GREEN.** Serving `5b7d35d1` (ECS image match). Delivered Resend HTML verified (logo, `#5D6F5D` CTA, `/leads/{id}`). See `docs/qa/inquiry-notification-branding/STATUS.md`.

## Gate 2 — Inventory

See `INVENTORY.md`. Priority remaining branding defects: inquirer thank-you (plain), custom form → venue (plain), tour-protection alert (plain).

## Gate 3 — Communications language + channel test split

### Wording (Message statuses panel)

| Label | Definition (shipped) |
|-------|----------------------|
| Sent | The sending system accepted the send request. This does not necessarily mean the message reached the recipient’s inbox. |
| Delivered | The email or texting provider reported the message as delivered. This does not mean the recipient read it. |
| Opened | An email-open tracking event was recorded. Indicative signal; not proof of personal read; clients/privacy can affect tracking. |
| Clicked | A tracked link-click event was recorded. Does not prove the linked action was completed. |
| EMAIL_ENGAGEMENT_NOTE | Opened/Clicked are email-only provider tracking signals, not proof of read/completion; privacy can suppress opens. |

Dashboard count **semantics unchanged**; `DASHBOARD_COUNT_NOTE` retained.

### Readiness test split

| Before | After |
|--------|-------|
| `test_message` ready if email_at **OR** sms_at | `test_email` ↔ email_at; `test_sms` ↔ sms_at |
| “Test message successful” / channel-neutral detail | Email- and SMS-specific labels/details |
| Email success implied SMS success | SMS shows “Not applicable” when texting off |

SMS send guard unchanged. Focused tests: `test-send.test.ts`, `message-status-definitions.test.ts`.

## Gate 4 — Open/click E2E

**Still requires explicit recipient/procedure approval.** No open/click test email sent. Copy does not claim E2E proof. See `docs/qa/email-open-tracking/PHASE-2-PREFLIGHT.md`.

## Gate 5

| Item | Value |
|------|--------|
| Commit | `d5e36593051f1868b42fa198d36116829db3b65f` |
| Focused tests | 26/26 pass (`message-status-definitions`, `test-send`, inquire branding, htc-cta, venue-notification-email) |
| Deploy | https://github.com/jlcormier612/wevenu-website/actions/runs/38475580540 — **in progress** (queued after prior success; no overlap) |
| Browser verify | `verify-comms-browser.mts` — **pending** serving of `d5e36593` |
| Production | untouched |
| Open/click E2E | **not sent** — approval gate retained |

**Communications language / channel-split:** NOT GREEN until deploy succeeds and browser script passes on serving `d5e36593`.  
**Inquiry branding (Gate 1):** GREEN on prior serving `5b7d35d1`.
