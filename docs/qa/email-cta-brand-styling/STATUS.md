# HTC email CTA brand styling — STATUS

**Environment:** Sandbox only  
**Production:** Untouched  
**Status:** PENDING deploy verification  

## Root cause

HTC-owned transactional HTML used a hardcoded solid black CTA (`background:#1a1a1a`) in `buildVenueNotificationEmail` and duplicated the same inline style in team/vendor invite templates. Venue staff new-inquiry / new-tour-scheduled mails go through that builder; the public tour-booked coordinator side-effect previously sent **text-only** and bypassed the shell entirely.

## Scoped fix

- Shared `lib/email/htc-cta.ts` — Heritage Sage `#5D6F5D` (`DEFAULT_PRIMARY_COLOR`).
- `venue-notification-email.ts` uses the shared CTA; date-based tour subjects no longer invent “View Thursday’s lead”.
- `booked-side-effects.ts` sends branded HTML via `buildVenueNotificationEmail` (subject preserved).
- Team / vendor invite + assignment templates use the same CTA helper (no copy/layout changes).

## Files

- `lib/email/htc-cta.ts` (+ test)
- `lib/notifications/venue-notification-email.ts` (+ test)
- `lib/tours/booked-side-effects.ts`
- `lib/email/team-invite.ts`
- `lib/email/vendor-invite.ts`
- `lib/email/vendor-assignment.ts`
