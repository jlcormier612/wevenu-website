# HTC Email Infrastructure & E2E Readiness — Inspection Report

**Type:** Read-only inspection. No code, migrations, configuration, or commits were made to produce this report.
**Date:** 2026-08-13
**Scope:** Email system + the exact code path from Stripe `checkout.session.completed` through login and destination.

---

## Zero-th finding, before anything else

**This repository contains three separate Next.js applications**, and the E2E journey crosses all three:

| App | Path | Port | Role |
|---|---|---|---|
| Venue app | `app/` (repo root) | 3000 | The real HTC product — everything you've tested all engagement (Dashboard, Vendors, Contracts, Event Orders, etc.). Real Supabase database. |
| Marketing site | `marketing/` | — | Public site + Stripe SaaS Checkout + the CRM/"Relationship" sales pipeline. Owns the `checkout.session.completed` webhook. |
| Relationship workspace | `workspace/` (package name `wevenu-relationship-workspace`) | 3002 | Internal CRM tool for the HTC team, and — critically — **also owns the venue owner's account-activation page** (`/activate/[token]`). |

The marketing and workspace apps share a data layer (`shared/relationships`, `shared/product-sync`, `shared/email`) that is **entirely separate from the venue app's Supabase database** — it's a local, file-backed JSON store (`shared/relationships/store.ts`, plain `fs.readFile`/`writeFile`), not Postgres. This single fact explains most of what follows.

---

## A. Current architecture

```
Stripe Checkout (marketing/)
   → marketing/app/api/stripe/webhook/route.ts  [checkout.session.completed]
   → createVenueEnrollment()  (marketing/lib/crm/service.ts)
        → writes a "VenueEnrollmentRecord" + syncs a "Relationship"
          — both in the LOCAL FILE STORE (shared/relationships), not Supabase
        → sendEnrollmentProductEmails()  — welcome email via Resend (shared/email/)
        → enqueueProductSync()  — self-setup only; White Glove explicitly defers this
   → shared/product-sync/pipeline.ts
        → getProductSyncAdapter()  — "local" (default) or "http"
        → BOTH adapters write to the same local file store.
          The "http" adapter's own comment: "documents future product API
          URLs... still simulates locally (no real product write path
          exists yet)." Real fetch is commented out, gated behind a
          PRODUCT_SYNC_LIVE flag that has no effect because nothing on
          the receiving end exists (see Missing Pieces, D1).
   → Welcome email links to workspace/app/activate/[token]
   → workspace/app/activate/actions.ts → activateAccountAction()
        → completeAccountActivation()  — marks the LOCAL relationship record activated
        → recordOwnerActivationCredential()  — code's own comment:
          "Simulated product sync: persist password hash locally so the
           enroll → activate loop is testable without a real product
           Auth user."
        → redirect(`${PRODUCT_APP_URL}/login?activated=1`)
   → app/(auth)/login (the REAL venue app's real login page)
        → no Supabase Auth user and no `venues` row was ever created
          anywhere in the chain above.
```

**Email transport (two parallel, independent Resend integrations, both real):**
- `lib/email/send.ts` — used by the venue app (`app/`). Raw `fetch` to `api.resend.com`, no SDK. `RESEND_API_KEY` unset → falls back to generating a `mailto:` URL (no email actually sent).
- `shared/email/client.ts` + `shared/email/send.ts` — used by `marketing/` and `workspace/`. Same raw-fetch pattern, slightly different env var names (documented as back-compat aliases of each other). `RESEND_API_KEY` unset → console dry-run log, no email sent.

Both default the From address to Resend's own shared test domain, `"Hello to Cheers <onboarding@resend.dev>"`, when `FROM_EMAIL`/`EMAIL_FROM` isn't set.

**Delivery/error handling:** Synchronous, single attempt, no queue, no retry anywhere in either transport. Failure returns `{ok:false, message}`; callers mostly `console.error` and swallow it (dunning/reactivation emails do this explicitly). The venue app has a real bounce/complaint webhook receiver (`app/api/messaging/webhook/route.ts`, handles `email.bounced`/`email.complained`) — but it's wired to the lead/client messaging system only. **No equivalent Resend webhook receiver exists in `marketing/` or `workspace/`** — CRM/onboarding email delivery failures are not surfaced anywhere beyond the immediate API response.

---

## B. Existing email inventory

### Venue app (`lib/email/*.ts` + inline call sites) — 22 types, all confirmed wired to a real `sendEmail()` call

| Email | Trigger | Recipient | Location |
|---|---|---|---|
| Contract invite | `sendContract`/`resendContract` | Client/couple | `lib/contracts/service.ts` → `lib/email/contract-invite.ts` |
| Conversation message | Send/scheduled-message delivery | Client/couple, vendor | `lib/conversations/service.ts`, `lib/scheduled-messages/processor.ts` → `lib/email/conversation-brand.ts` |
| Daily digest | Cron | Venue staff | `lib/notifications/digest-engine.ts` → `lib/email/daily-digest.ts` |
| Team invite | Owner invites staff | Staff | `lib/team/service.ts` → `lib/email/team-invite.ts` |
| Vendor assignment | Vendor selected for event | Vendor | `lib/vendors/notify-assignment.ts` |
| Vendor invite (claim) | Unclaimed vendor profile created | Vendor | `lib/vendor-invites/service.ts` → `lib/email/vendor-invite.ts` |
| Vendor removed | Vendor unassigned | Vendor | `lib/vendors/notify-removal.ts` |
| Invoice email | Send invoice | Client/couple | `app/(app)/invoices/actions.ts` (inline) |
| HQ onboarding update | HQ admin messages venue | Venue owner | `app/admin/onboarding/actions.ts` (inline) |
| Tour booking notice | Public tour form submitted | Venue staff | `app/api/tours/book/route.ts` (inline) |
| Tour confirmation | Booking confirmed | Tour contact | `lib/tours/communication.ts` |
| Portal participant invite | Couple invites a helper | Participant | `app/api/portal/participants/route.ts` (inline) |
| Public inquiry confirmation | Inquiry form submitted | Inquirer | `app/api/public/inquire/route.ts` (inline) |
| Public inquiry internal notice | Same | Venue staff | Same file |
| **Client portal invite** | `inviteClient`/`resendClientInvitation` | Client/couple | `lib/client-auth/service.ts` |
| Brochure send | Send brochure | Lead | `lib/brochures/service.ts` |
| Contact portal invite | Named wedding-party contact | Contact | `lib/contacts/service.ts` |
| Event order share | Share Event Order | Client/couple | `lib/event-orders/representation.ts` |
| Generic thread message | `sendMessage` | Thread recipient | `lib/messaging/service.ts` |
| Comms test email | Admin "send test" | Venue's own address | `lib/communication/readiness.ts` |
| Questionnaire share | Share questionnaire | Client/couple | `lib/events/questionnaire.ts` |
| Saved report ready | Scheduled report job | Venue staff | `lib/saved-reports/schedule-engine.ts` |

Notably: **there is no "vendor invitation to a venue's SaaS account" or "staff account setup" email in this list that overlaps with venue-owner onboarding** — client portal invite (#15) and vendor invite (#6) are both real and working, but neither is the "venue owner sets up their own HTC account" email — that lives entirely in the CRM side below.

### CRM/SaaS side (`shared/email/templates/`) — 19 registered templates

| Template | Status | Actually called from |
|---|---|---|
| `welcome` | Live, called | `workspace/app/api/relationships/lifecycle/route.ts` |
| `founder_welcome` | Live, called | Same |
| `white_glove_welcome` | Live, called | Same |
| `welcome_home` | Live, called | Same |
| `welcome_back_verified` / `_rejected` | Live, called | `workspace/lib/welcome-back/resolve.ts` |
| `payment_reminder` / `account_suspended` | Live, called | Stripe dunning webhook + manual admin action |
| `subscription_link` | Live, called | Manual "activate subscription" admin action |
| `luv_suggestion` | Live, called | Multiple workspace CRM-staff surfaces |
| `welcome_back` | Registered, **no confirmed send call site** | Only appears as a Luv "kind" tag |
| `kickoff`, `white_glove_scheduling`, `account_reactivated`, `inquiry_confirmation`, `feedback_confirmation` | Registered as "live" in code, **but zero call sites found anywhere** | Registry-only |
| `payment_receipt`, `trial_reminder`, `renewal_reminder` | Registry explicitly marks these `status: "registry"` (not live) | Not called |

**This is the actual "invitation/welcome email" the E2E journey depends on.** It is real and does send (when `RESEND_API_KEY` is configured) — the gap is entirely downstream of the email, at activation (see C/D).

---

## C. First E2E journey — exact current flow

1. Venue completes Stripe Checkout on `marketing/`. **Real, working** (separate from the Connect/venue-payment system; not touched by this inspection).
2. `checkout.session.completed` webhook fires → `handleCheckoutCompleted()` → `createVenueEnrollment()`. **Real, working** — writes to the local file store, idempotent on session/subscription id.
3. Welcome email sends via Resend, with an `activationUrlFromToken()` link (self-setup / "Launch Yourself" only — White Glove gets no activation URL). **Real, working**, gated only on `RESEND_API_KEY` being set.
4. Self-setup also triggers `enqueueProductSync()` — **this step does not create anything in the venue app's real database.** Both its adapters ("local" and "http") only ever write to the same local file store. The "http" adapter's real-fetch branch is commented out and its target endpoints (`/api/internal/product-sync/venues`, `/owner-accounts`, etc.) **do not exist anywhere in `app/`** — confirmed by direct search.
5. Owner clicks the activation link → lands on `workspace/` (port 3002) → `ActivateAccountForm` → sets a password.
6. `activateAccountAction()` marks the local relationship record "activated" and calls `recordOwnerActivationCredential()` — **which, by its own code comment, is a simulation**: it stores a password hash in the local file store, not a Supabase Auth user.
7. Redirects to the real venue app's real `/login` page.
8. **Login has nothing to authenticate against.** No row was ever written to `public.venues`. No Supabase Auth user was ever created for this owner. Confirmed by repo-wide search: zero `.from("venues").insert(` call sites in `app/` or `lib/`, and zero venue-creation action anywhere in the HQ admin tooling (every existing HQ admin action requires an already-existing `venueId`). Every venue currently in any environment's database was created by direct SQL/migration, never through application code.

**White Glove path:** same welcome-email mechanism (no activation URL), but product provisioning is explicitly deferred to an internal 8-item task checklist ("Venue branding," "Packages," "Contracts," ... "Go Live") owned by a CRM staff member, tracked in the same local file store. Nothing found in that checklist's code, or anywhere else, that actually creates a real venue/owner account either — it defers to the same missing capability, just manually instead of automatically.

---

## D. Missing pieces

**Already working**
- Stripe SaaS Checkout → webhook → local enrollment record (idempotent, correctly distinguishes self-setup vs. White Glove).
- Resend email transport (both integrations) — real API calls, correct request shape, tracking flags set.
- Welcome/activation email content and the magic-link activation token itself — cryptographically random (`randomUUID`-based), single-use, 30-day expiry. Genuinely solid design, just pointed at nothing real downstream.
- Activation UI (`workspace/`) — real form, real validation, real redirect logic to the correct login URL.
- Venue app's own transactional email system (22 types) — mature, actively used, unrelated to this gap.
- Bounce/complaint webhook handling — real, but only for the venue app's lead/client messaging, not the CRM/onboarding side.

**Configured but unverified**
- `RESEND_API_KEY` / `FROM_EMAIL` / `EMAIL_FROM` — not set in either local `.env.local` (root or `marketing/`) today. As configured right now, in this environment, even the fully-working venue-app emails are running in mailto-fallback/dry-run mode, not actually sending.
- `PRODUCT_SYNC_ADAPTER=http` + `PRODUCT_API_BASE_URL` + `PRODUCT_SYNC_API_KEY` — real-looking config surface exists, but flipping it to `http` changes nothing observable, because the real-fetch code path is commented out pending endpoints that don't exist.

**Missing**
- Any code path, anywhere in the repository, that creates a real Supabase Auth user for a venue owner as part of this flow.
- Any code path that inserts a real row into `public.venues` as part of this flow.
- The seven planned `/api/internal/product-sync/*` endpoints in the venue app (only the sibling `/api/internal/product-access/lock` — suspend/hard-lock — actually exists).
- A Resend webhook receiver in `marketing/`/`workspace/` for delivery/bounce visibility on CRM emails.
- Any test coverage of the actual chain: the Stripe webhook handler, `activateAccountAction`, product-sync, or a real Supabase Auth user being created. (One pure-function pricing-unit test exists for `marketing/`, and it isn't even included in the root `npm test` glob.)
- A verified custom sending domain in Resend — nothing in the repo confirms `hellotocheers.com` (or any domain) has been domain-authenticated; every path defaults to Resend's own test address unless an operator sets the From address manually.

**Broken**
- Nothing is "broken" in the sense of a regression — every piece inspected does exactly what its own code and comments say it does. The gap is an honestly-documented, deliberate stub (the code says so itself, repeatedly), not a bug.

**Requires a product decision** — see the STOP CONDITION below. This is the load-bearing item.

---

## E. Smallest implementation plan

This section is intentionally incomplete pending the decision below — implementing either path without your sign-off would be inventing behavior, which this brief explicitly asked me not to do. What I can say without deciding anything:

- **Whatever the chosen mechanism, exactly one new capability is required**: a way for `checkout.session.completed` (self-setup) — and eventually the White Glove "Go Live" step — to result in a real `public.venues` row and a real Supabase Auth owner account in the venue app's database, reachable by a real credential the owner sets.
- Two shapes already exist as partial building blocks in this codebase and don't need to be invented from scratch:
  - The documented-but-unbuilt `/api/internal/product-sync/*` API surface (matches the sibling, already-real `/api/internal/product-access/lock` pattern — HQ-only, service-role, internal-only route).
  - `auth.admin.createUser(...)` is already a proven pattern in this codebase for two other account types (`lib/client-auth/service.ts`, `lib/vendor-auth/service.ts`) — the same shape, applied to a venue owner, is not a new architecture.
- Whichever shape is chosen, the existing activation UI, token, and email content do **not** need to change — only what happens after the password is submitted.

I have not sized this further (files, migration, etc.) because the two realistic shapes differ enough in scope that estimating before you choose one would be guessing.

---

## F. Manual setup you'll need to perform (provider dashboard)

Independent of the product decision above, these are needed for *any* real email to leave the building, for either app:

1. In Resend: verify a real sending domain (e.g., `hellotocheers.com` or a subdomain) — add the DNS records Resend provides (SPF/DKIM/DMARC), wait for verification.
2. Generate a `RESEND_API_KEY` and set it in both the venue app's and `marketing/`'s/`workspace/`'s environment (they read the same underlying provider, just different env var names — see G).
3. Set `FROM_EMAIL` (venue app) and `EMAIL_FROM` (marketing/workspace) to a real address on your verified domain, e.g. `Hello to Cheers <hello@hellotocheers.com>`.
4. If you want inbound reply-threading, configure a Resend inbound route and set `RESEND_INBOUND_ADDRESS`.
5. If you want bounce/delivery visibility on CRM/onboarding emails specifically, a Resend webhook pointed at a `marketing/`- or `workspace/`-side receiver would need to be configured in Resend — that receiver doesn't exist in code yet (named above as a Missing Piece, not something to build silently as a side effect of this inspection).

---

## G. Environment variables that will eventually be needed

Not asking you to paste any values — just the names, so you know what to have ready.

**Email (Resend), both apps:**
`RESEND_API_KEY`, `FROM_EMAIL` (venue app) / `EMAIL_FROM` (marketing/workspace — same purpose, different name), `EMAIL_REPLY_TO` / `REPLY_TO_EMAIL`, `RESEND_INBOUND_ADDRESS` / `RELATIONSHIP_INBOUND_ADDRESS`.

**Communication mode (venue app):** `COMMUNICATION_MODE`, `COMMUNICATION_SANDBOX_EMAIL`, `COMMUNICATION_SANDBOX_PHONE`.

**Stripe SaaS billing (`marketing/`, separate from the already-working Connect keys):** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, plus the price/coupon id set already documented in `marketing/.env.example` (`STRIPE_GATHER_PRICE_ID`, `STRIPE_PRICE_STARTER`/`GROWING`/`PROFESSIONAL` + founder variants, `STRIPE_FOUNDING_COUPON_ID`, `STRIPE_PRICE_WHITE_GLOVE`).

**Product/activation URLs:** `NEXT_PUBLIC_PRODUCT_APP_URL` / `NEXT_PUBLIC_APP_URL` (venue app's own public URL — where activation redirects to `/login`), `WORKSPACE_URL` / `NEXT_PUBLIC_WORKSPACE_URL` (where the activation link itself points), `NEXT_PUBLIC_MARKETING_URL` / `MARKETING_URL`.

**Product-sync (only matters once the product decision below is made):** `PRODUCT_SYNC_ADAPTER`, `PRODUCT_API_BASE_URL`, `PRODUCT_SYNC_API_KEY`, `PRODUCT_SYNC_LIVE`, `PRODUCT_SYNC_DATA_PATH`.

**Auth (venue app, already exists for other purposes, relevant if the decision reuses this pattern):** `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

None of these were read or exposed in producing this report — only variable names, sourced from code and `.env.example` files.

---

## Environment separation, as it stands today

- **Local development:** neither Resend key nor From-address is set in `.env.local` for the root app or `marketing/`. Emails silently no-op (mailto-fallback / console dry-run). `workspace/` has no `.env.local` at all, only `.env.example`.
- **Sandbox/test:** `COMMUNICATION_MODE=sandbox` + `COMMUNICATION_SANDBOX_EMAIL` exists as a real, working redirect-to-fixed-address mechanism — but only in the venue app's `lib/communication/mode.ts`. The CRM/onboarding side (`shared/email/`) has no equivalent sandbox redirect of its own; it only has the binary "real API call" vs. "dry-run to console" behavior.
- **Production:** no evidence in the repo that production values for any of the above have ever been set anywhere real — everything found is either unset locally or documented only as an example.

---

## STOP CONDITION

**A product decision is required before any implementation.** Per your own instruction, I'm stopping here rather than inventing it.

**The decision:** how should a real venue + real Supabase Auth owner account actually get created as part of this journey? The email, the token, the activation UI, and the CRM enrollment tracking are all real and don't need to change. What's missing is the one bridge from "CRM says this venue is paid and enrolled" to "a real, loggable-into account exists in the product database" — and that bridge doesn't exist in any form today, automated or manual, self-setup or White Glove.

Concretely, before I'd implement anything, I need you to tell me:
1. Should this be a new internal API in the venue app (`/api/internal/product-sync/...`, matching the pattern already documented and already used for the sibling suspend/lock endpoint), called by `workspace/`'s activation action? Or
2. Should the venue app itself own account creation directly against Supabase (reusing the `auth.admin.createUser` pattern already used for clients/vendors), with `workspace/` handing off rather than completing the loop itself? Or
3. For this first dogfood test specifically, do you want a smaller, temporary manual step (e.g., an HQ admin manually provisions the real venue+owner right after a Sandbox purchase, and we just verify the rest of the chain — email delivery, activation UX, login — around that one manual step) while the real automated bridge is designed properly later?

This is not a "just configure credentials" situation — the STOP CONDITION's first clause doesn't apply here. The email/domain/credential work in §F is real and necessary, but even with a perfectly verified Resend domain and every environment variable set, the journey as it exists today would still end at a login screen with no account to log into.
