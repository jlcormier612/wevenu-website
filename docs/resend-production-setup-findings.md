# Resend Production Setup — Findings

**Type:** Inspection only. No code, environment, or configuration changes were made.
**Date:** 2026-08-13
**Context:** `hellotocheers.com` is now DKIM/SPF-verified in Resend, sending enabled, receiving intentionally left to Google Workspace. This report determines exactly where the production `RESEND_API_KEY`, `EMAIL_FROM`, and `EMAIL_REPLY_TO` need to go, and what — if anything — still blocks the full E2E test after that config lands.

---

## 1. Every app that sends email, and its email client(s)

Three separate Next.js apps, three separate deployments (confirmed: root and `workspace/` each have their own `vercel.json`; `marketing/` has its own `package.json`/`next.config.ts` and is deployed independently even though it has no `vercel.json` of its own). Each reads its own `.env.local` locally and will need its own environment variables set in its own Vercel project in production — they do not share environment configuration.

**Venue app (`app/`, `lib/`) — five independent raw-Resend call sites, not one:**
| File | Reads |
|---|---|
| `lib/email/send.ts` (the intended central helper) | `RESEND_API_KEY`, `FROM_EMAIL`, `RESEND_INBOUND_ADDRESS` |
| `app/api/portal/invite/route.ts` | `RESEND_API_KEY`, `FROM_EMAIL` |
| `lib/messages/notify.ts` | `RESEND_API_KEY`, `FROM_EMAIL` |
| `lib/feedback/notify.ts` | `RESEND_API_KEY`, `FROM_EMAIL`, `WEVENU_INTERNAL_EMAIL` |
| `lib/notifications/engine.ts` | `RESEND_API_KEY`, `FROM_EMAIL` |

All five are consistent with each other — same variable name (`FROM_EMAIL`), same fallback (`"Hello to Cheers <onboarding@resend.dev>"`). **None of the five read any Reply-To environment variable, global or otherwise.** Reply-To in this app is either per-send (e.g. contract invites use the venue's own contact email as Reply-To) or thread-based subaddressing (`RESEND_INBOUND_ADDRESS`), never a single global default.

**`marketing/` and `workspace/` — one shared client, `shared/email/client.ts`:**
Reads `EMAIL_FROM` (falls back to `FROM_EMAIL`), `EMAIL_REPLY_TO` (falls back to `REPLY_TO_EMAIL`), `RESEND_INBOUND_ADDRESS` (falls back to `RELATIONSHIP_INBOUND_ADDRESS`), `RESEND_API_KEY`. This is the transport underneath `sendRelationshipEmail`/`sendEnrollmentProductEmails` — traced directly: `sendEnrollmentProductEmails` → `sendRelationshipEmail` → `sendRawEmail` in `client.ts`. **This is the exact function that sends the welcome/activation email in your E2E journey.**

No other raw-Resend call sites exist anywhere in `marketing/` or `workspace/` — confirmed by search.

---

## 2. Does the existing implementation already support `EMAIL_FROM` / `EMAIL_REPLY_TO`?

**Yes, fully, for `marketing/` and `workspace/`** — those are the exact, preferred variable names `shared/email/client.ts` already reads first. No code change needed there. This also means **the invitation/welcome email itself is already fully configured correctly** by setting these two variables in `marketing/`'s and `workspace/`'s environments.

**No, not as named, for the venue app (`app/`).** All five call sites there read `FROM_EMAIL`, not `EMAIL_FROM` — setting only `EMAIL_FROM` would leave the venue app's own 22 transactional emails (contract sends, team invites, vendor emails, invoices, etc.) still defaulting to Resend's test address. And **none of the five read any Reply-To variable at all** — setting `EMAIL_REPLY_TO` would have zero effect in the venue app; there is no global-default-Reply-To concept there today.

This is a real, existing naming inconsistency between the two codebases (`FROM_EMAIL` vs. `EMAIL_FROM`) — already self-documented in the root `.env.example`'s own comment: *"Hello to Cheers marketing / Relationship Workspace product email aliases (shared/email prefers these; falls back to FROM_EMAIL)."* It is not something this task introduces, and closing it is pure configuration (setting both variable names to the same value), not a redesign.

---

## 3. Exact configuration needed

**No code changes are required to ship your two requested values.** Set both variable names, per app, to the same values:

| App | Where (production) | Variables |
|---|---|---|
| `marketing/` | Its Vercel project → Environment Variables | `RESEND_API_KEY=<the new production key>`, `EMAIL_FROM=Hello to Cheers <hello@hellotocheers.com>`, `EMAIL_REPLY_TO=jen@hellotocheers.com` |
| `workspace/` | Its Vercel project → Environment Variables | Same three — this is the app that actually sends your activation email, so it must not be skipped |
| `app/` (venue app) | Its Vercel project → Environment Variables | `RESEND_API_KEY=<the new production key>`, `FROM_EMAIL=Hello to Cheers <hello@hellotocheers.com>` (note: `FROM_EMAIL`, not `EMAIL_FROM`, or the venue app's own emails keep using the Resend test address) |

The production key itself goes in Vercel's **Environment Variables** panel for each of the three projects (marked "Sensitive" so it isn't exposed in build logs), not in any `.env` file in the repo — consistent with how `RESEND_API_KEY` is already documented (`.env.example` files contain only the variable name, never a value, and `.env.local` is already git-ignored).

**Reply-To gap in the venue app, worth a decision, not a blocker:** if you also want `jen@hellotocheers.com` as the default Reply-To for the venue app's own transactional emails (not just marketing/workspace), that's a small, additive code change (one fallback line in five files, or centralizing those five call sites through the one existing `lib/email/send.ts` helper first) — not something I've done, since you asked for a report only. Today, replies to the venue app's automated emails that don't set their own Reply-To will land on `hello@hellotocheers.com` by default mail-client behavior (reply-to-From) — and since Resend receiving is intentionally off and Google Workspace owns inbound for the domain, that reply would correctly land in a real Google Workspace inbox, just not Jen's personally. Not broken, just worth knowing it's a separate, smaller decision from the two variables you asked for.

**One pre-existing, currently-inert variable, for awareness only:** `RESEND_WEBHOOK_SECRET` is documented in the root `.env.example` but is not read anywhere in the codebase today (no webhook signature verification exists yet for the delivery/bounce webhook). Not part of what you asked for; flagging only so it isn't mistaken for something that's already wired up.

---

## 4. Remaining gaps for the full E2E test

Everything above makes the **email step itself** production-ready once the three Vercel projects have their variables set. It does **not**, on its own, make this fully testable end to end:

> Stripe checkout → enrollment → invitation email → account activation → credentials → login → portal access

**Unchanged from the prior inspection (`docs/htc-email-infrastructure-e2e-readiness-inspection.md`) and still the load-bearing blocker:** no code path anywhere in the repository creates a real Supabase Auth user or a real `public.venues` row as part of this flow. `workspace/`'s account-activation action explicitly simulates this — its own code comment says so — storing a password hash in a local file store, not a real product account. Checkout, enrollment tracking, and the invitation email itself will all work correctly with today's config change; the activation step will still end at a real login page with no real account behind it. That decision (three options were laid out in the prior report's STOP CONDITION) is still open and is **not** an email-configuration matter, so I haven't touched it here — naming it again only so it isn't lost between reports.

**Not Twilio** — out of scope per your instruction, not touched.

**Nothing else new** surfaced in this pass. The domain/DKIM/SPF work you've done, plus the two variables above (correctly named per app), closes every email-specific gap the prior inspection identified.

---

## Summary

- **Already correct, no action needed:** `marketing/` and `workspace/` already read exactly `EMAIL_FROM`/`EMAIL_REPLY_TO` — the invitation email itself is fully covered by your two requested values.
- **Needs the value under a second name too:** the venue app's five send paths read `FROM_EMAIL`, not `EMAIL_FROM` — set both names (same value) if you want the venue app's own transactional emails on the verified domain as well.
- **Not supported anywhere, by design, in the venue app:** a global Reply-To default. `EMAIL_REPLY_TO` will do nothing there unless you want the small additive change described above.
- **Still blocking the literal E2E test you described, unrelated to email:** the missing real-account-provisioning bridge, unchanged since the last report, and still awaiting your decision.

No changes made. Ready to implement the three Vercel environment-variable sets on your go-ahead.
