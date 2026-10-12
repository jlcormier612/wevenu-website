# Tour / inquiry SMS consent opt-in — STATUS

**Environment:** Sandbox only  
**Production:** Untouched  
**Priority:** Critical consent-recording defect

## Confirmed root cause

On the **existing-lead / personal tour scheduling** path (`?o=` origin token):

1. `resolveExistingLeadTourContext` prefills name/email/event type but **omitted phone**.
2. `InquiryForm` initialized `phone` to `""` for that path.
3. Submit coerced `smsPermissionGranted: smsPermissionGranted && !!phone.trim()`, so a checked consent box became **`false` in the request** whenever the form phone field was blank.
4. `applyInquiryCommunicationCapture` still saved preferred channels (including Text), then exited without writing `communication_permissions`.
5. Contact UI correctly showed **Not opted in** for the lead’s on-file phone — the write never happened. Venue texting configuration is unrelated.

Authoritative Sandbox proof (Lydia Cormier / Meadowbrook, tour Thu Oct 15 4:00 PM):

| Fact | Value |
|------|--------|
| Lead | `ba696be0-8565-4385-a226-24e0565242df` |
| Source | `email` (tour attached later) |
| Phone | `(508) 989-6064` |
| Prefs | `["email","sms"]` |
| `communication_permissions` for Meadowbrook + that phone | **none** (before fix) |
| Entire Sandbox `source=tour_form` rows | **zero** historically |

**Data recovery:** Do **not** invent consent for Lydia (or other historical rows) without trustworthy checkbox evidence. Prefs ≠ consent. Treat as a separate recovery issue if product wants outreach.

## Scoped fix

- Prefill phone from existing-lead context.
- Send raw checkbox boolean from the public form.
- Resolve consent phone: form phone, else lead/contact on-file phone.
- Surface/log consent write failures; check upsert `ok`.
- Same inquire path logging; tour source remains `tour_form`.

## Files

- `lib/tours/existing-lead-tour-context.ts`
- `components/form/inquiry-form.tsx`
- `lib/communication/apply-inquiry-consent.ts` (+ tests)
- `app/api/tours/book/route.ts`
- `app/api/public/inquire/route.ts`
- `lib/tours/existing-lead-tour-context.test.ts`

## Closure

Pending: commit → Sandbox deploy → live checked/unchecked browser + DB proof on disposable records.
