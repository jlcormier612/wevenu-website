# RC-Launch Validation Runbook

Operational validation, not engineering — this is the checklist for whoever has access to production infrastructure (hosting dashboard, DNS registrar, Twilio/Resend/Stripe consoles) to work through before launch. Every item below is grounded in this actual codebase — exact variable names, exact files, exact behavior when misconfigured — not generic SaaS-launch advice.

This runbook covers categories 3 (External Integrations) and 4 (Production Configuration) of the RC-Launch Validation checklist. For device/role/human-workflow verification (categories 1, 2, 5), see `docs/launch-verification-script.md`. For the current overall platform state, see `docs/platform-status-snapshot.md`.

**One bug found and fixed while researching this runbook:** the couple portal's photo/document upload route (`app/api/portal/upload/route.ts`) targeted a storage bucket, `couple-media`, that has never existed — confirmed live (`Bucket not found`, HTTP 400). The real bucket, created by a later migration, is `client-media`; the route was never updated to match. Fixed and live-verified this pass. This affected wedding website hero/cover photos, the couple's own profile photo, and couple document uploads — worth specifically re-testing in category 3's "File uploads/downloads" step below, since this is exactly the kind of gap only real exercising (not code review) catches.

---

## Every environment variable this app reads

Grouped by what breaks if it's missing. `NEXT_PUBLIC_*` variables are exposed to the browser — never put a secret in one.

### Core platform (nothing works without these)
| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | The Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public, RLS-scoped key — every authenticated user session goes through this |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only, bypasses RLS — used for admin operations (webhooks, cron jobs, cross-tenant lookups). **Must never be exposed to the browser or committed anywhere.** |
| `NEXT_PUBLIC_APP_URL` | The main app's own public origin. Used to build links in emails (tour confirmations, vendor invitations, contract sign links), the Stripe Connect OAuth redirect URI, and the target URL you register with Twilio/Resend for inbound webhooks. **Get this wrong and every link in every outbound email points somewhere broken.** |

### Email (Resend)
| Variable | Purpose |
|---|---|
| `RESEND_API_KEY` | Server-only. Without it, `sendEmail()` falls back to a `mailto:` link — the app still "works" but nothing is actually sent |
| `FROM_EMAIL` | e.g. `"Hello to Cheers <notifications@yourdomain.com>"`. Without it, defaults to Resend's shared test address — real deliverability requires a verified domain here (see DNS section) |
| `RESEND_WEBHOOK_SECRET` | Verifies Resend's delivery/engagement webhooks (`app/api/messaging/webhook/route.ts`) are actually from Resend, not spoofed |
| `RESEND_INBOUND_ADDRESS` | e.g. `inbox@replies.yourdomain.com` — the address inbound replies route through (`app/api/messaging/inbound/route.ts`) |

### SMS (Twilio)
| Variable | Purpose |
|---|---|
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | Server-only credentials. Without both, `sendSms()` returns a clear `ok:false` — texting has no silent fallback the way email does |
| `TWILIO_MESSAGING_SERVICE_SID` | Preferred over a raw number — gets Twilio's built-in STOP/START/HELP opt-out compliance for free |
| `TWILIO_FROM_NUMBER` | Fallback if no Messaging Service is set up; opt-out handling would need to be built separately if used long-term |

### Communication mode (governs both email and SMS)
| Variable | Purpose |
|---|---|
| `COMMUNICATION_MODE` | `real` (default) sends to actual recipients. `sandbox` still calls the real provider but redirects every send to the sandbox address/phone below — use this for a pre-launch dry run without messaging real people. `disabled` makes no network call at all. **Confirm this is unset or explicitly `real` before launch — if it's still `sandbox` or `disabled` from testing, nothing reaches real customers and nothing will look wrong in the UI.** |
| `COMMUNICATION_SANDBOX_EMAIL` / `COMMUNICATION_SANDBOX_PHONE` | Where sandbox-mode sends redirect to |

### Abuse protection
| Variable | Purpose |
|---|---|
| `TURNSTILE_SECRET_KEY` | Server-side Cloudflare Turnstile verification. Gracefully inert if unset — the public tour-booking widget still works, just without this layer |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Client-side widget key, must match the secret above (same Turnstile site) |

### Payments (Stripe — Connect OAuth only; real charge collection is not built, see below)
| Variable | Purpose |
|---|---|
| `STRIPE_SECRET_KEY` | Powers the "Connect with Stripe" OAuth flow in Settings (`app/api/stripe/callback/route.ts`) — a venue can link their own Stripe account today. Real payment collection through that link is designed but unbuilt (TR-M1, blocked on a live Stripe account this dev environment never had) |
| `STRIPE_WEBHOOK_SECRET` | Referenced for the eventual real-collection webhook path |

### Automation / cron (see "Cron jobs" section below — these gate who can trigger them)
| Variable | Purpose |
|---|---|
| `CRON_SECRET` | Required on every scheduled job route (`/api/notifications/process`, `/api/digest`, `/api/communication/scheduled/process`, `/api/automation/process`) — Vercel Cron sends this automatically if set, but it must be set in your hosting environment or these routes 401 |
| `AUTOMATION_SECRET` | Alternate auth path into `/api/automation/process` for manual/external triggering |
| `NOTIFICATIONS_SECRET` | Alternate auth path into the notification/scheduled-message processors |

### Wevenu-internal (not customer-facing)
| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_WEVENU_ADMIN` | `"true"` reveals internal-only nav/HQ affordances — confirm this is unset (or `false`) in the customer-facing production deployment |
| `WEVENU_INTERNAL_EMAIL` | Where the in-app feedback form sends (defaults to `feedback@wevenu.com`) |
| `ANTHROPIC_API_KEY` | Powers Luv (Platform Intelligence) and the Email Intake Engine's Claude-based extraction |

### The separate `marketing/` sub-app (do not confuse with the main app's vars)
`marketing/` is a genuinely separate Next.js app — Wevenu's own marketing site plus its own Stripe billing for the SaaS subscription itself ("System A," structurally distinct from "System B," the venue↔couple payments the main app handles). It reads its own set of URL variables:
- `NEXT_PUBLIC_SITE_URL` — the marketing site's own origin
- `NEXT_PUBLIC_PRODUCT_APP_URL` — where the marketing site links *into* the main app (its nav's "Log In" / "Get Started" links)
- `NEXT_PUBLIC_MARKETING_URL` — the reverse: where the main app or its Stripe config links back to marketing

**Do not set `NEXT_PUBLIC_APP_URL` (main app) and `NEXT_PUBLIC_PRODUCT_APP_URL` (marketing's pointer to the main app) to different values by accident** — they should point at the same place, but they're independent variables in independent deployments.

---

## 3. External integrations — exact steps to actually exercise each

### Twilio SMS
1. Confirm `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and (`TWILIO_MESSAGING_SERVICE_SID` or `TWILIO_FROM_NUMBER`) are set in production, and `COMMUNICATION_MODE` is not `disabled`.
2. In the Twilio Console, set the number's (or Messaging Service's) "A message comes in" webhook to `{NEXT_PUBLIC_APP_URL}/api/messaging/sms-inbound`, POST method.
3. Send a real text to a real client/lead from a Conversation. Confirm it arrives on a real phone.
4. Reply from that real phone. Confirm the reply lands back in the same Conversation thread (`app/api/messaging/sms-inbound/route.ts` matches by sender phone number).
5. Confirm STOP/START/HELP compliance actually works if using a Messaging Service (Twilio handles this automatically, but verify the Messaging Service is actually configured with a compliant sender pool, not just a bare number).

### Resend email
1. Confirm `RESEND_API_KEY` and `FROM_EMAIL` are set, `FROM_EMAIL`'s domain is the one you've verified in Resend (see DNS/SPF/DKIM/DMARC below), and `COMMUNICATION_MODE` is not `disabled`.
2. In the Resend Dashboard, set the delivery/engagement webhook endpoint to `{NEXT_PUBLIC_APP_URL}/api/messaging/webhook`, and set `RESEND_WEBHOOK_SECRET` to match.
3. Send a real email (a tour confirmation, a Conversation message) to a real inbox. Confirm it arrives — check spam folder too, since domain reputation is fresh on a new domain.
4. Confirm the webhook actually updates status: open the message in the app, confirm it shows delivered (not stuck on "accepted") once the real inbox receives it.
5. For inbound replies: in Resend Dashboard → Inbound → Add Domain (verify it), add an MX record pointing to Resend's inbound servers, set `RESEND_INBOUND_ADDRESS`, and configure the inbound endpoint to `{NEXT_PUBLIC_APP_URL}/api/messaging/inbound`. Reply to a real sent email and confirm the reply lands in the same thread.

### Contract signing
1. No special production config beyond the app itself running over HTTPS — the signing flow (`lib/contracts/service.ts`'s `signContractByToken`) captures the real requester IP and user-agent via `x-forwarded-for`/`user-agent` headers.
2. **Verify the hosting platform actually forwards a real client IP**, not the load balancer's own address — a misconfigured reverse proxy would make every signature (and every rate-limit check, see below) look like it came from the same IP. Send a contract, sign it from a real device on a real network, and confirm `signer_ip` in the database is a real, plausible client IP, not `127.0.0.1` or the server's own address.
3. Confirm the "I agree this constitutes my legal signature" consent checkbox is required (it is, server-side — `sign_contract()` rejects `p_consent = false`) and that the resulting audit trail (name, IP, user-agent, consent, timestamp) is complete.

### Calendar invitations (.ics)
1. No production config needed — both the tour-scheduler's "Add to Calendar" link and the confirmation email's calendar link are generated entirely client-side/inline (a `data:text/calendar` URI and a Google Calendar template URL respectively, `components/tours/tour-scheduler.tsx`, `lib/tours/communication.ts`). No server round-trip, no env var.
2. Still worth actually clicking both on a real device — confirm the `.ics` download opens correctly in the device's real calendar app (iOS/Android have historically been finicky about `data:` URI downloads specifically), and confirm the Google Calendar link pre-fills correctly.

### File uploads/downloads
1. **Re-test the exact bug fixed this pass**: upload a wedding website hero photo, a couple profile photo, and a couple document, from the couple portal. Confirm all three actually appear (this specific path was completely broken until this runbook's research caught it).
2. Confirm every storage bucket is reachable in production: `client-media`, `couple-messages`, `documents`, `floor-plans`, `inventory`, `request-uploads`, `uploads`. These are created via Supabase migrations and should exist automatically in any environment the migrations have run against — but confirm directly (Supabase Dashboard → Storage) rather than assuming.
3. Exercise a download from each: a coordinator attachment in a Conversation, a floor plan PDF export, a vendor's shared floor plan, a document from the Documents tab.
4. Confirm file-size limits behave as expected (10MB for portal image uploads, 20MB for Conversation attachments) — try a file just over the limit and confirm a clear error, not a silent failure.

### Payment provider
1. Real charge collection is not built (TR-M1) — there is nothing to sandbox-test on the collection side yet.
2. What **is** built and should be tested: the Stripe Connect OAuth link/unlink flow in Settings. Click "Connect with Stripe," complete a real (test-mode) Stripe OAuth authorization, confirm the callback (`app/api/stripe/callback/route.ts`) correctly stores the connected account and redirects back to Settings with a success state. Confirm the error path too (deny the OAuth request, confirm a clear `stripe_error` message appears).

---

## 4. Production configuration

### Environment variables
Walk the full table above against your actual hosting dashboard (Vercel, presumably — see Cron jobs below) — confirm every variable your feature set depends on is actually set, not just present in `.env.example` or a teammate's local `.env`. Pay specific attention to `COMMUNICATION_MODE` (must not still be `sandbox`/`disabled` from testing) and `NEXT_PUBLIC_WEVENU_ADMIN` (must not be `true` in the customer-facing deployment).

### DNS / Email domains / SPF / DKIM / DMARC
1. `FROM_EMAIL`'s domain needs to be added and verified in the Resend Dashboard (Domains → Add Domain) before real sends will have good deliverability.
2. Resend will give you the exact DNS records to add (typically an SPF `TXT` record, a DKIM `CNAME`/`TXT`, and a return-path record). Add all of them at your DNS registrar and wait for Resend to show the domain as verified — sending before verification completes routes through Resend's shared reputation, which is worse deliverability, not a hard failure.
3. Add a `DMARC` record (`_dmarc.yourdomain.com`, `TXT`) even though Resend doesn't strictly require it — without one, receiving mail servers have no policy to check SPF/DKIM alignment against, which hurts inbox placement especially at Gmail/Outlook scale.
4. If using Resend's inbound email routing (for reply-to-thread), add the MX record Resend's Inbound Domain setup gives you — this is a **separate** DNS record from the SPF/DKIM/DMARC ones above, easy to forget since it's configured in a different part of the Resend Dashboard.
5. Confirm `NEXT_PUBLIC_APP_URL`'s own domain has valid HTTPS (see below) and that it's the domain you actually registered as the Twilio/Resend webhook target — a domain mismatch here means webhooks silently never arrive, and there's no in-app error to notice, only a growing set of messages permanently stuck at "accepted" instead of advancing to "delivered."

### Storage buckets
Covered under "File uploads/downloads" above — confirm all seven buckets exist and are reachable, and specifically re-verify the `client-media` fix from this pass.

### Rate limiting
1. `lib/lead-intake/rate-limit.ts` is a real, DB-driven sliding-window limiter (5 submissions per IP per venue per 10 minutes, 50 venue-wide per hour) — no external service, no env var, works identically in any environment the database is reachable from.
2. **The one thing that can silently break it in production**: it keys on the request's IP address. If the hosting platform's reverse proxy doesn't correctly forward the real client IP (or the app reads the wrong header), every request could appear to come from the same IP — either falsely rate-limiting everyone behind a shared NAT/proxy, or (worse) never limiting anyone because every request looks like a fresh, distinct source. Confirm the IP captured on a real public tour-booking submission is a real, plausible client IP.
3. This same IP-capture path also feeds Turnstile's escalation logic (`lib/lead-intake/turnstile.ts`'s `isNearRateLimit`) and contract-signing's audit trail (above) — one misconfiguration affects three separate features at once, worth checking carefully rather than assuming it's fine because rate limiting itself isn't erroring.

### Turnstile/CAPTCHA
1. Set `TURNSTILE_SECRET_KEY` (server) and `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (client) to the same Turnstile site's keys, from the Cloudflare dashboard.
2. This is deliberately escalation-only — most tour-booking submissions never see a widget at all. To actually test it, submit enough tour-booking requests from the same IP to approach the rate limit (5 within 10 minutes) and confirm a Turnstile challenge appears on a later attempt, and that a valid solve lets the submission through.
3. Confirm the fail-open behavior is acceptable to you: if Cloudflare's verification service itself is down, `verifyTurnstileToken` fails open (treats it as verified) rather than blocking legitimate submissions — intentional, but worth knowing before launch, not discovering during an incident.

### HTTPS
1. Required, not optional — cookies, webhook signature verification (both Resend's and Twilio's), and the IP-forwarding behavior above all assume a real TLS-terminating proxy in front of the app.
2. Confirm the actual production URL is HTTPS end-to-end (no mixed-content warnings, no HTTP redirect loops) before testing anything else in this runbook — a broken HTTPS setup will produce confusing failures in every other section that look unrelated to HTTPS.

### Branding assets
1. Confirm `FROM_EMAIL`'s display name and the transactional email templates render the *venue's* brand (RC1's baseline wiring — logo, primary color), not Wevenu's own, on every customer-facing send (tour confirmation, contract, questionnaire, review nudge).
2. Confirm Wevenu's own branding correctly persists on software-user-facing surfaces (coordinator app chrome, vendor portal chrome) — this split is intentional (`docs/venue-brand-experience-phase1-final-report.md`'s governing rule: *a couple should remember the venue, not the software*), so verify it wasn't accidentally inverted anywhere.
3. Confirm favicons and any hardcoded fallback logo/color values look intentional, not like a placeholder, for a venue that hasn't set custom branding yet.

### Cron jobs
Four jobs are already declared in `vercel.json` and will auto-register on a Vercel deployment — nothing to configure there beyond deploying to Vercel and setting `CRON_SECRET`:

| Path | Schedule | Powers |
|---|---|---|
| `/api/notifications/process` | every 30 min | Task reminders, tour reminders |
| `/api/digest` | hourly | Daily digest emails |
| `/api/communication/scheduled/process` | every 5 min | Scheduled Sends, Sequences |
| `/api/automation/process` | every 15 min | Automation Rules (including the Event.Completed review/referral nudge) |

**If you're not deploying to Vercel, none of these fire automatically** — you'll need your own scheduler (cron, a managed scheduled-task service) hitting each path with `Authorization: Bearer {CRON_SECRET}`. This is easy to miss because nothing in the UI indicates these aren't running — Scheduled Sends and Automations will simply never fire, silently, with no error visible to a coordinator.

---

## Sign-off

- Checked by: _____________
- Date: _____________
- Environment validated: _____________
- Issues found: _____________
