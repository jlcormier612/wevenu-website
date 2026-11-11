# Manual Lead SMS Opt-In Request — Forensic Audit

**Updated:** 2026-09-23  
**Policies:** Terms/Privacy untouched (comms responsibility language already shipped).

## Canonical architecture (reuse — do not fork)

| Path | Mechanism | `communication_permissions` |
|---|---|---|
| Public Inquiry | Optional SMS checkbox → `applyInquiryConsent` | `opted_in` / `inquiry_form` |
| Public Tour | Same checkbox path | `opted_in` / `tour_form` |
| Manual Lead (email) | Token email → `/sms-consent/[token]` affirmative | Request: `not_opted_in` + `email_sms_consent_request`; Opt-in: `opted_in` + `email_sms_consent` |
| START/STOP | Twilio inbound keywords | `opted_in` / `opted_out` |

**Send gate:** `lib/sms/send.ts` → `assertChannelAllowed` (ordinary outbound requires `opted_in`). Enforced for Lead/Client/Inbox/automation/API when `venueId` is present. Only legacy purpose `sms_consent_request` may send while `not_opted_in`; that venue CTA is **disabled**.

## Channel decision (locked from provider audit)

| Channel | Supported? | Why |
|---|---|---|
| Unsolicited SMS “Request text permission” | **No** | `requestSmsConsentForLead` fails closed — HTC does not send an unsolicited text solely to obtain SMS consent. |
| Email “request → token page → affirmative opt-in” | **Yes (product)** | Relationship email path; consent only on affirmative checkbox + Allow. Legal/compliance counsel review of solicitation basis remains OPEN (not claimed as jurisdiction-wide lawful). |

## Pre-change gaps vs this RCJ

1. Venue copy did not match locked “Text messaging / hasn’t opted in / HTC requires…” language.
2. Primary CTA labeled “Request permission by email” rather than “Request text permission” (email is the delivery channel).
3. Customer page copy close but not the locked “Would you like…” / “Yes, I’d like…” framing.
4. Client Portal had **no** communication-preferences surface reflecting canonical SMS permission.

## Non-goals

- No second consent table/system
- No Terms/Privacy edits
- No Twilio/A2P/consent-model product changes beyond UI + portal read surface
- Public Inquiry/Tour flows unchanged
