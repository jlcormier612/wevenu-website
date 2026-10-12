# New tour booking email branding — read-only audit

**Environment:** Sandbox only  
**Status:** AUDIT ONLY — not GREEN; no code/deploy in this pass  
**Date:** 2026-10-12  
**Observed subject:** `New tour booked — Thursday, October 15 at 4:00 PM`

## Verdict

The public tour-booking coordinator email is sent by a **separate plain-text side-effect path** that never calls the shared HTC venue-notification HTML builder. That is why it appears as plain text with a raw lead URL and no branded button.

## Exact source

| Role | Path |
|------|------|
| Public book entry | `app/api/tours/book/route.ts` → `bookTour` then `void runTourBookedSideEffects(result)` |
| Paid/protection book | `lib/tours/protection.ts` → same `runTourBookedSideEffects` |
| **Email that matches the screenshot** | `lib/tours/booked-side-effects.ts` → `sendCoordinatorNotification` |
| Send transport | `lib/email/send.ts` `sendEmail({ to, subject, text })` — **no `html`** |

Subject construction (exact match to the delivered mail):

```ts
subject: `New tour booked — ${scheduledDate}`
```

Body is newline-joined plain text ending in `${appUrl}/leads/${result.leadId}` (raw URL). No logo, no button, no HTML alternative.

## Established branded path (comparison)

| Role | Path |
|------|------|
| DB trigger on `tour_appointments` INSERT | `_trigger_tour_scheduled_notification` (`supabase/migrations/20261407100000_customer_action_notification_preferences.sql`) |
| In-app + email queue row | `create_venue_notification(..., 'tour_scheduled', 'New tour scheduled — ' \|\| name, body, '/leads/'\|\|lead_id, ...)` with `needs_email` from prefs |
| Dispatcher | `lib/notifications/obligation-engine.ts` → `processVenueNotificationEmails` |
| Shared builder | `lib/notifications/venue-notification-email.ts` → `buildVenueNotificationEmail` |
| Brand chrome | `htcEmailLogoHeaderHtml()` from `shared/brand/logo.ts` |
| CTA | Inline `<a>` button + `venueNotificationCta` → e.g. `View Nicole's lead` for `/leads/...` |

Rendered branded HTML includes HTC logo header, white card, title, detail paragraph, and a solid `#1a1a1a` CTA button. Plain-text alternative includes title, body, CTA label, and absolute href.

New-inquiry staff mail uses this same builder via `venue_notifications` + the obligation dispatcher — it does **not** use a parallel plain `sendEmail` side effect.

## Why this email differs

1. **Bypasses the shared wrapper entirely.** `sendCoordinatorNotification` never imports or calls `buildVenueNotificationEmail`.
2. **Omits `html`.** Resend therefore delivers text-only (or client-generated plain rendering) with a naked URL.
3. **Parallel channel, not the preference-gated queue.** The DB trigger still creates a `tour_scheduled` `venue_notifications` row titled `New tour scheduled — {contact}`, which *can* later send a branded email via cron — different subject from the immediate side-effect mail. Screenshot subject proves the mail seen is the side-effect path, not the queue path.
4. **Recipient/purpose preserved:** venue/coordinator notification (`result.venueEmail ?? COORDINATOR_NOTIFY_EMAIL`), not prospect confirmation.

## Generated output evidence (local render)

**Plain path (reconstructed from source — no html field):**

```
subject: New tour booked — Thursday, October 15 at 4:00 PM
A new tour has been scheduled at {venue}.
Date: …
Duration: … minutes
Contact: …
A new lead has been created in Hello to Cheers.
https://app.sandbox.hellotocheers.com/leads/{leadId}
```

**Branded path (`buildVenueNotificationEmail` executed):** HTML contains `hello-to-cheers-logo-primary-transparent`, styled CTA `View Nicole's lead`, and text alternative with label + absolute URL (no raw URL in visible HTML body text).

## Can the fix use existing shared components?

Yes. Smallest scoped correction:

1. In `sendCoordinatorNotification`, build the message with `buildVenueNotificationEmail` (or extract a thin helper that reuses its HTML shell/CTA).
2. Pass both `html` and `text` into `sendEmail`.
3. Keep venue recipient, tour details, and lead deep-link.
4. **Subject / CTA care:** Today’s subject is date-based (`New tour booked — {datetime}`). `venueNotificationCta` parses the segment after `—` as a person name, so feeding the current subject unchanged would produce a nonsense CTA like `View Thursday's lead`. Prefer either:
   - title `New tour booked — {contactName}` with date/duration in `body` (aligned with `New tour scheduled — {name}`), CTA = existing `View {First}'s lead`, **or**
   - keep date-based subject and extend CTA selection for this notification to an explicit label such as **View Tour Details** / **View this lead** without person-name parsing.
5. Decide dual-send policy: after branding the side-effect mail, the preference-gated `tour_scheduled` email may still fire (second mail). Smallest follow-up is either rely only on the queue (like new inquiry) or suppress one path — out of scope for a pure style fix unless product wants a single notification.

`notifyPaidUnbookedTour` in the same file is also plain-text-only; treat as adjacent unless authorized.

## Proposed regression tests (for a later authorized implement pass)

- `sendCoordinatorNotification` / side-effects path asserts `sendEmail` receives `html` containing HTC logo + CTA href to `/leads/{id}`.
- Subject and tour date/duration/contact remain accurate.
- CTA label is not derived from the weekday token of a date-based subject.
- Plain-text alternative still present.
- Existing `venue-notification-email.test.ts` cases remain green.
- Optional: assert public `POST /api/tours/book` success path still invokes side-effects without changing booking semantics.

## Explicitly not done this pass

No code edits, commits, pushes, or Sandbox/Production deploys. Not GREEN — implementation requires a subsequent authorized step (related work also appears in the on-brand CTA styling contract).
