# Email-purpose inventory and consistency audit

**Generated:** 2026-10-13  
**Reconciled:** 2026-10-14 — see `AUDIT-RESULTS-2026-10-14.md` for full dispositions (read-only pass; no code changes).  
**Mode:** Source inventory + existing QA evidence. Runtime branding verified only where noted.  
**Production:** untouched.  
**Serving at reconcile:** `c75479e6db337037cb7730116a904b5a2711f2dc`

## Shared shells (intentional variation)

| Shell | Assets | Intended use |
|-------|--------|--------------|
| HTC staff notification | `buildVenueNotificationEmail` → logo + `#5D6F5D` CTA | Venue-facing ops alerts (inquiry, tour booked, obligations) |
| Venue-branded couple/client | `emailBrandFromVenue` + `renderBrandedEmailHtml` / `wrapConversationMessageHtml` | Client-facing venue identity (Inbox, tours, invoices, contracts, etc.) |
| HTC platform / auth | `shared/email/templates` + `htcEmailLogoHeaderHtml` | Account lifecycle, founder welcome, platform receipts |
| Team/vendor invite | `buildTeamInviteHtml` / `buildVendorInviteHtml` | HTC logo + Heritage Sage CTA |

Venue-authored Inbox bodies stay author content inside the venue-branded wrapper — intentional.

---

## Inventory by purpose

| # | Purpose | Recipient | Trigger / delivery | Template / layout | Shell | HTML+text | Status | Notes |
|---|---------|-----------|--------------------|-------------------|-------|-----------|--------|-------|
| 1 | Website inquiry → **venue** | Venue email | `POST /api/public/inquire` → `sendEmail` | `buildVenueNotificationEmail` | HTC staff | Yes | **Verified** (runtime Resend HTML on `5b7d35d1`) | See `docs/qa/inquiry-notification-branding/` |
| 2 | Website inquiry → **inquirer** | Lead email | Same route | Plain `text` only | **Bypass** | Text only | **Defect found** | Unbranded thank-you; raw-style plain body |
| 3 | Custom public form → venue | Venue email | `POST /api/public/forms/submit` | Plain `text` | **Bypass** | Text only | **Defect found** | Same class as pre-fix inquire venue path |
| 4 | Custom public form → inquirer | Lead email | Same | Plain `text` | **Bypass** | Text only | **Defect found** | Same as #2 |
| 5 | Tour booked → coordinator | Venue/coordinator | Queue only: DB `tour_scheduled` → `processVenueNotificationEmails` | `buildVenueNotificationEmail` | HTC staff | Yes | Single-email contract (pref-gated) | Immediate side-effect removed |
| 6 | Tour protection failure | Coordinator | Same file | Plain `text` + raw URLs | **Bypass** | Text only | Defect found | Ops alert; raw `/tours` URLs |
| 7 | Tour scheduled / confirm / confirmed | Couple | `lib/tours/communication.ts` | Venue brand + CTA | Venue | Yes | Verified (closeout unit) | Signature-path audit |
| 8 | Tour reminder (couple) | Couple | `lib/notifications/tour-reminder-email.ts` + engine | Venue brand | Venue | Yes | Verified (closeout unit) | |
| 9 | Obligation / reminder emails | Couple or staff | `obligation-engine.ts` / `templates.ts` | Venue wrap or HTC staff notify | Mixed intentional | Yes | Verified (source audit) | Staff path uses `buildVenueNotificationEmail` |
| 10 | Inbox / conversation send | Lead/client/vendor | `lib/conversations/service.ts` | `wrapConversationMessageHtml` | Venue | Yes | Verified (source audit) | Venue-authored body |
| 11 | Scheduled messages | Same | `lib/scheduled-messages/processor.ts` | Same wrap | Venue | Yes | Verified (source) | |
| 12 | Automations | Same | `lib/automation/engine.ts` → conversation/scheduled | Depends on step | Venue when email | — | Not fully runtime-verified | Uses conversation path when sending email |
| 13 | Contract invite / send | Signers | `lib/contracts/service.ts` + `buildContractInviteHtml` | Venue brand | Venue | Yes | Verified (source audit) | |
| 14 | Invoice / payment plan / payment request | Client | `lib/invoices/*-email.ts`, invoice actions | Venue brand | Venue | Yes | Verified (closeout unit) | |
| 15 | Commercial proposal | Couple | `lib/commercial-proposals/couple-email.ts` | Venue brand + CTA | Venue | Yes | Verified (source) | |
| 16 | Brochure | Prospect | `lib/brochures/service.ts` | Venue brand | Venue | Yes | Verified (source) | |
| 17 | Questionnaire invite | Couple | `lib/events/questionnaire.ts` | Conversation wrap | Venue | Yes | Verified (source) | |
| 18 | Event order representation | Vendor/client | `lib/event-orders/representation.ts` | Conversation wrap | Venue | Yes | Verified (source) | |
| 19 | Client portal invite | Client | `lib/client-auth/service.ts` | Venue brand | Venue | Yes | Verified (source) | |
| 20 | Contact invite | Contact | `lib/contacts/service.ts` | Venue brand | Venue | Yes | Verified (source) | |
| 21 | SMS consent email | Contact | `lib/communication/sms-consent-email.ts` | Venue brand | Venue | Yes | Verified (source) | |
| 22 | Team invite / owner invite | Staff | `lib/team/service.ts` + `team-invite.ts` | HTC invite | HTC | Yes | Verified (source) | |
| 23 | Vendor invite / assignment / removal | Vendor | `vendor-invite`, `notify-assignment`, `notify-removal` | HTC / assignment shells | HTC | Yes | Verified (source) | |
| 24 | Password recovery | User | `lib/auth/password-recovery-email.ts` | HTC logo | HTC | Yes | Verified (source) | |
| 25 | Platform templates (welcome, payment receipt, trial, etc.) | Account holder | `shared/email/send.ts` + registry | `renderEmailTemplate` | HTC platform | Yes | Verified (unit) | Some registry-only |
| 26 | Enrollment activate | New venue | `app/api/internal/enrollment/activate/route.ts` | Platform templates | HTC | — | Not runtime-verified this pass | |
| 27 | Admin onboarding email | Arbitrary | `app/admin/onboarding/actions.ts` | `html: body.replace(…)` | **Ad-hoc** | Thin HTML | Intentionally different / weak | Internal admin tool |
| 28 | Portal participant notify | Participant | `lib/portal/participant-invite-email.ts` via `app/api/portal/participants/route.ts` | Venue brand (`renderBrandedEmailHtml`) | Venue | Yes | Verified (unit + render) | D5 GREEN |
| 29 | Daily digest | Venue staff | `lib/notifications/digest-engine.ts` + `daily-digest.ts` | Digest builder | — | — | Not fully verified | Staff-facing |
| 30 | Saved report schedule | Venue | `lib/saved-reports/schedule-engine.ts` | Report body | — | — | Not verified | |
| 31 | Communication readiness test email | Venue email | `sendTestEmail` in readiness.ts | Plain text | **Intentional** (ops self-test) | Text | Intentional | Does **not** create conversation_message / provider_id for open-tracking E2E |
| 32 | Luv drafts / follow-ups | Lead/client when sent | Luv → Inbox send path | Same as #10 when sent | Venue | Yes | Drafts not emails until send | |
| 33 | DB `venue_notifications` email processor | Venue | `processVenueNotificationEmails` / notify path | `buildVenueNotificationEmail` | HTC staff | Yes | Verified (prior) | Parallel to sync inquire |

---

## Outstanding gaps (factual) — refreshed 2026-10-14

1. **Inquirer thank-you** on inquire + forms/submit — plain text, no venue/HTC shell (#2, #4) — **OPEN — DEFECT** (D1).
2. **Custom form → venue** plain text + `/leads` list CTA (not lead id) + incomplete fields (#3) — **OPEN — DEFECT** (D2).
3. **Event type label** shows canonical value `wedding` instead of `Wedding` in venue inquiry HTML — **OPEN — DEFECT** (D3); proven in `inquiry-notification-branding/captured-email.html`.
4. **Tour protection** coordinator alert — plain text + raw URLs (#6) — **OPEN — DEFECT** (D4, non-blocking).
5. **Portal participant** thin HTML shell (#28) — **GREEN** (D5) — see `GROUP-C-STATUS.md`.
6. **Saved report** schedule minimal HTML (#30) — Group B (D6); see `GROUP-B-STATUS.md`.
7. **Daily digest** — source PASS (HTC logo); runtime not re-proven.
8. **Tour dual-send** — **FIXED** to queue-only single coordinator email (`GROUP-C-STATUS.md`); Sandbox verify of fix pending if not yet served.
9. Open/click **E2E** — **BLOCKED — EXTERNAL** / **DEFERRED — PRE-LAUNCH** (DNS).
10. Automations (#12) / enrollment (#26) — **OPEN — VERIFICATION** (no dedicated runtime matrix).

## Intentionally different (not defects)

- Venue-branded client mail vs HTC staff notifications vs platform auth templates.
- Readiness test email plain text (ops).
- Venue-authored Inbox content inside branded wrapper.

## Tests / evidence referenced

- `lib/email/signature-path-audit.test.ts`
- `lib/email/customer-facing-branding.closeout.test.ts`
- `lib/lead-intake/inquire-venue-notification-branding.test.ts`
- `docs/qa/inquiry-notification-branding/` (runtime GREEN on `5b7d35d1`)
