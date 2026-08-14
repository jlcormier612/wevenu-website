# AWS Deployment Readiness Assessment — Read Only

**Type:** Read-only architecture assessment. No code changed, no AWS or Vercel service authenticated to, nothing deployed.
**Date:** 2026-08-14
**Premise, stated by you, taken as given:** AWS is the confirmed target hosting architecture. The repository's Vercel-oriented configuration (`vercel.json` ×2, README's "Hosting: Vercel (target)") reflects a not-yet-updated prior direction, not the production architecture. This document does not re-litigate that decision — it starts from AWS as settled and asks what that requires.

**One clarification load-bearing enough to state before anything else:** "AWS deployment" here can only sensibly mean AWS hosts the three applications' **compute**. It cannot mean moving the Postgres database itself off Supabase, because `auth.uid()`, all 360+ RLS policies, and the entire login/session model depend on Supabase's own Auth service (GoTrue) running against that same database — and you've explicitly ruled out replacing Supabase Auth. Every recommendation below treats Supabase (a cloud service reachable from anywhere, not tied to Vercel) as the unchanged database/auth/storage provider, with AWS hosting the Next.js applications that call it.

---

## 1. Application components

### Venue / product app (repo root, `app/`)
**What it is:** The full multi-tenant SaaS product — venue dashboard, vendors, contracts, event orders, couple portal, vendor portal, HQ admin. The only one of the three apps with real Supabase Auth sessions and RLS-scoped data access.

**What must run in production:**
- The Next.js server itself (SSR pages, ~150+ API routes, 8 scheduled jobs).
- Confirmed from the repo: no `output: "standalone"` set in `next.config.ts`, no Edge runtime used anywhere (every route that declares a runtime declares `"nodejs"`) — this is a standard Node.js SSR app, not statically exportable and not Edge-compatible as configured today.

**Depends on:**
- A production Supabase project (Postgres + Auth + Storage — confirmed real Storage usage across 23 files via `.storage.from(...)`).
- Resend (transactional email — 5 independent call sites in this app alone, all already reading `FROM_EMAIL`).
- Stripe Connect (venue-collected couple payments — separate webhook/keys from marketing's SaaS billing).
- QuickBooks, Facebook Lead Ads (OAuth + webhook integrations).
- 8 scheduled jobs (§2 below).
- Now also: the two new internal endpoints (`/api/internal/enrollment/*`) that `marketing/` and `workspace/` call into — this app is the *receiving* side of the account-provisioning bridge, not a caller.

### Marketing site (`marketing/`)
**What it is:** Public site + Stripe Checkout for SaaS subscriptions + a CRM/"Relationship" sales pipeline (dunning, health scoring, welcome-back flow).

**What must run in production:**
- The Next.js server (public pages, no user login of its own — confirmed no Supabase session cookie use here).
- Its own Stripe webhook (`/api/stripe/webhook` — `checkout.session.completed`, `customer.subscription.*`, `invoice.paid`, `invoice.payment_failed`) — a **different** Stripe webhook/secret from the venue app's Connect webhook.

**Depends on:**
- Stripe (SaaS billing product, separate API keys/webhook secret from Connect).
- Resend, via `@shared/email` (welcome/founder/dunning/reactivation emails).
- The venue app's internal API (`PRODUCT_API_BASE_URL` + `PRODUCT_SYNC_API_KEY`) — for the legal-acceptance bridge (pre-existing) and the new enrollment bridge (this session's work).
- **A local, file-backed JSON store** (`shared/relationships/store.ts`, plain `fs.readFile`/`writeFile`) for its own CRM/"Relationship" data — this is *not* Postgres, and it's the one genuinely load-bearing infrastructure fact this assessment needs to flag clearly (see §3 and §6).
- No cron jobs of its own (no `vercel.json`, no scheduled routes found in this app).

### Relationship Workspace (`workspace/`)
**What it is:** Internal staff CRM tool. Its own login (`ws_session` cookie, file-backed credential store — this is a *separate, internal-only* auth system from the customer-facing product's Supabase Auth, and out of scope to change).

**What must run in production:**
- The Next.js server (internal staff pages, `/activate/[token]` — the customer-facing owner-activation page).
- Its own cron: `/api/cron/automations` every 10 minutes (sequence/workflow ticking, renewal stages, payment dunning).

**Depends on:**
- The same local JSON file store as `marketing/` (they share `shared/relationships`).
- Resend, via the same `@shared/email` module.
- The venue app's internal API (same two bridges as marketing).
- `CRON_SECRET` for its own scheduled job, matching the same pattern as the venue app's crons.

---

## 2. AWS hosting requirements

Facts from the repo first, then options — not a single prescribed choice, per your instruction.

**Established facts constraining the choice:**
- All three apps are standard Next.js SSR servers (Node.js runtime, no Edge routes, no static export configured).
- `marketing/` and `workspace/` both set `turbopack: { root: "../".. }` because they import sibling code from `shared/` at the repo root — **whatever builds these two apps needs the entire monorepo in its build context, not just the app's own subdirectory.** This rules out treating any of the three as an independently-buildable, self-contained package without either restructuring the build (out of scope) or making sure the AWS build pipeline checks out/builds from the full repo root.
- None of the three currently sets `output: "standalone"` — the one small, cheap prerequisite change if a container-based AWS compute option is chosen (Fargate, App Runner via container). Noted here as a fact, not proposed as an action to take now.

**Compute — architecture decision required.** The repo doesn't establish which AWS compute service to use; none of these is implied by anything in the code. Three real candidates, differing mainly in operational complexity vs. control:
- **AWS App Runner** — closest operational shape to what the app already assumes (git- or container-based deploy, managed autoscaling, managed HTTPS/load balancing, minimal ops). Simplest match for "smallest production-capable."
- **ECS on Fargate** — more control (VPC placement, task sizing, ALB configuration), more setup; would need `output: "standalone"` + a Dockerfile (neither exists in the repo today).
- **AWS Amplify Hosting** — has native Next.js SSR support, positioned by AWS as the closest thing to a Vercel-equivalent; would need evaluation against the monorepo/shared-code build requirement above.
This choice should be made once, consistently, for all three apps unless there's a specific reason to split them.

**Scheduled jobs — translates cleanly, low risk.** The 9 cron routes across the two `vercel.json` files (8 in root, 1 in workspace) are already written to be scheduler-agnostic: each is guarded by `CRON_SECRET` checked via `Authorization: Bearer`, not by any Vercel-specific mechanism — confirmed directly in `workspace/README.md`: *"If you're not deploying to Vercel... you'll need your own scheduler... hitting each path with Authorization: Bearer {CRON_SECRET}."* **Amazon EventBridge Scheduler**, targeting each route's HTTPS URL directly with that header, is a direct, low-risk translation of the existing `vercel.json` cron declarations — this is the one piece of this whole assessment I'm comfortable stating plainly rather than presenting as an open decision, because the code already anticipated exactly this substitution.

**Networking/TLS — architecture decision required.** Custom domain (`hellotocheers.com` and whatever subdomains the three apps use) → Route 53 + ACM certificates + a load balancer or the chosen compute service's built-in HTTPS, is the standard shape, but which pieces are needed depends entirely on the compute choice above.

**Secrets — architecture decision required, but the shape is already known.** Every secret this app needs is already enumerated by name across the existing `.env.example` files and this session's own prior reports (§5 below is the consolidated list). AWS Secrets Manager or Parameter Store (SecureString) are the two standard candidates; either satisfies what the app needs (env vars read via `process.env.*` at runtime) — no code depends on a specific secrets-delivery mechanism.

---

## 3. Database

**Postgres remains the production database, and it remains Supabase-hosted — not migrated to AWS RDS.** Restating this precisely because it's the crux of the whole assessment: this app's authorization model is not "Postgres with RLS" in the abstract, it's "Postgres with RLS predicates that call `auth.uid()`, a function Supabase's Auth service populates from the session JWT it issues." Standing up a vanilla AWS RDS Postgres instance would give you a database with the same tables but none of the identity plumbing that makes `auth.uid()` resolve to anything — every one of the 360+ RLS policies audited earlier this engagement would need rework. That's explicitly not what's approved.

**What "production database" concretely means here:** a real Supabase **project** (not the local CLI stack every environment in this engagement has used to date) — created once, with the `venue_enrollments` migration and every other migration in `supabase/migrations/` applied to it.

**Database connectivity — a genuinely good fact, not a risk to manage.** Confirmed by direct search: **zero raw Postgres driver usage anywhere in this codebase** (`pg`, `postgres`, `@vercel/postgres`, no ORM). Every database call in all three apps goes through Supabase's PostgREST-based JS client (`.from(...)`/`.rpc(...)`) — meaning every "database" call is actually a stateless HTTPS request. There is no connection-pool exhaustion risk to design around, regardless of which AWS compute option is chosen (Lambda-style ephemeral compute included) — Supabase's own infrastructure (Supavisor) handles pooling on its side, invisibly to this app.

**Migrations.** Already flagged in an earlier pass this engagement: 4 unresolved migration-timestamp collision groups exist in this repo's history, specifically because every migration to date has been applied by direct SQL rather than `supabase db push`. That fact doesn't change with AWS as the hosting target — recommend continuing to apply migrations by direct SQL execution against the production Supabase project (Dashboard SQL editor or a direct `psql` connection) rather than making `supabase db push` the first-ever CLI-applied migration against a real target.

**What must remain in Supabase Auth, stated explicitly per your instruction:** `auth.uid()`, the full RLS policy set, `app/auth/actions.ts`'s `signInWithPassword` login path, session cookie handling via `@supabase/ssr`, and Supabase Storage. None of this is touched by an AWS hosting change — these are calls the AWS-hosted app makes *to* Supabase over the network, exactly the same shape as today, just with a production Supabase URL instead of `127.0.0.1:54321`.

**A real, separate finding — not Supabase-related, worth flagging precisely because AWS is where it stops being deferrable:** `marketing/`'s and `workspace/`'s own CRM/"Relationship" data (dunning schedules, health scores, welcome-back state, the local activation-token mirror this session's bridge still writes alongside the new Postgres table) lives in a **local, on-disk JSON file store**, not Postgres. That's incompatible with any AWS compute pattern involving more than one instance, autoscaling, or ephemeral/recycled compute (Lambda-style) — a second instance wouldn't see the first instance's writes, and a redeployed/replaced instance loses its disk entirely unless a persistent volume is explicitly attached and preserved. This was already true architecturally under "Vercel (target)" (Vercel's own serverless functions are similarly ephemeral) — AWS doesn't introduce this problem, it just makes it impossible to paper over with "it happened to work locally." **This is explicitly out of scope for the narrow, already-approved enrollment/activation bridge** (which is fully Postgres-backed and safe for any compute shape) — named here only so it's a known, deliberate deferral rather than a surprise later. See §6 and §7 for how this bounds the first E2E test specifically.

---

## 4. External integrations

| Integration | Required for first E2E dogfood? | Production requirement |
|---|---|---|
| **Stripe (SaaS billing, `marketing/`)** | **Required** | Real webhook endpoint registered against `marketing/`'s production URL; `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` (SaaS-specific, separate from Connect) in marketing's environment. Presumably already in progress per your separate Stripe Sandbox E2E work — not re-litigated here. |
| **Stripe (Connect, venue app)** | Not required for this specific E2E path (checkout → login), but already-live infrastructure in the venue app — unaffected by this change either way. |
| **Resend** | **Required** | Already verified (DKIM/SPF, sending enabled) per your prior request. Production API key needs to land in all three apps' environments under the two different variable names already established (`FROM_EMAIL` for the venue app, `EMAIL_FROM`/`EMAIL_REPLY_TO` for marketing/workspace). |
| **Supabase Auth** | **Required** | A real production Supabase project must exist; not yet created anywhere evidenced in this repo (only local dev stacks referenced throughout). |
| **product-sync bridge (this session's work)** | **Required** | `PRODUCT_SYNC_API_KEY` identical across all three apps' environments; `PRODUCT_API_BASE_URL` in marketing/workspace pointing at the venue app's real AWS URL once it exists. |
| **Cron jobs** | **Required**, but only the ones the E2E path touches — none of the 9 scheduled jobs are actually in the critical path of checkout→login (they handle notifications, digests, automation ticking, QuickBooks/Facebook sync, saved reports). Can be stood up after the first E2E test passes, not before. |
| **QuickBooks, Facebook Lead Ads** | **Can remain deferred** — unrelated to this E2E path. |
| **Twilio** | **Explicitly deferred**, per your own standing instruction across this engagement. |
| **White Glove provisioning** | **Explicitly deferred** — no activation token is ever generated for White Glove enrollments, so it never touches this bridge at all, on AWS or anywhere else. |

---

## 5. Environment variables — production matrix

Names only, no values. "Already configured in code" means the app already reads this exact variable name correctly today (confirmed by source, this session and prior ones) — not that a production value exists yet.

### Venue app
| Variable | Status |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Required · already configured in code · **production Supabase project doesn't exist yet** (§3) |
| `RESEND_API_KEY`, `FROM_EMAIL` | Required · already configured in code |
| `PRODUCT_SYNC_API_KEY` | Required · already configured in code · must match marketing/workspace exactly |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (Connect) | Required for existing Connect functionality · already configured in code · not part of this E2E path |
| `CRON_SECRET` | Required once cron jobs are stood up · already configured in code · not required for the E2E path itself |
| `NEXT_PUBLIC_APP_URL` | Required · already configured in code · value = the venue app's real AWS URL (architecture/deployment decision required — depends on §2/§6) |

### Marketing app
| Variable | Status |
|---|---|
| `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` | Required · already configured in code |
| `PRODUCT_API_BASE_URL`, `PRODUCT_SYNC_API_KEY` | Required · already configured in code · base URL depends on the venue app's real AWS URL |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (SaaS billing) | Required · already configured in code · likely already in progress on your side |
| `NEXT_PUBLIC_PRODUCT_APP_URL` | Required · already configured in code |
| Various `STRIPE_PRICE_*`/`STRIPE_PAYMENT_LINK_*`/founder-program vars | Required for the specific plan being tested · already configured in code |

### Workspace app
| Variable | Status |
|---|---|
| `RESEND_API_KEY`, `EMAIL_FROM` | Required · already configured in code |
| `PRODUCT_API_BASE_URL`, `PRODUCT_SYNC_API_KEY` | Required · already configured in code |
| `NEXT_PUBLIC_PRODUCT_APP_URL` | Required · already configured in code |
| `CRON_SECRET` | Required for its own scheduled job · already configured in code · not required for the E2E path itself |

### Cutting across all three — architecture decision required
| Variable | Notes |
|---|---|
| Any AWS-specific runtime/region/secrets-source variables | Not established by the repo at all — depends entirely on §2's compute choice (e.g., App Runner vs. Fargate have different conventions for how secrets are injected) |
| A real value for `PRODUCT_API_BASE_URL` / `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_PRODUCT_APP_URL` | Circular until the venue app's own URL is decided — needs to be settled once, early, since two other apps point at it |

---

## 6. Deployment topology

**Facts established by the repo:**
- Three independently-buildable-but-monorepo-coupled Next.js apps, one Postgres/Auth/Storage backend (Supabase, external to whatever hosts the compute), one shared code directory (`shared/`) that two of the three apps require access to at build time.
- One GitHub remote already exists with real history — a real precondition for whichever CI/CD approach gets chosen, regardless of AWS specifics.

**Decisions already made (per this conversation):**
- AWS hosts the compute for all three apps.
- Supabase remains the database/auth/storage provider, unchanged.
- The account-provisioning bridge (enrollment → real Postgres venue/owner account) stays exactly as already implemented and verified this session — not touched by this hosting change.

**Decisions still requiring your approval, not decided here:**
- Which AWS compute service (App Runner / Fargate / Amplify Hosting) — §2.
- How the three apps' build pipeline accesses the shared monorepo root — a CI/CD design question, not something this assessment resolves.
- Whether `marketing/`/`workspace/` run as a single persistent instance (simplest, matches today's local-file-store CRM data) or a resilient multi-instance setup (which would require migrating that CRM data off local disk first — explicitly out of scope right now, named as a future decision).
- Secrets delivery mechanism (Secrets Manager vs. Parameter Store).
- Custom domain / TLS setup shape, which depends on the compute choice.

**Proposed high-level shape, contingent on the above, offered as a starting point, not a decision:**
```
Route 53 (hellotocheers.com + subdomains)
        │
   ACM certs / HTTPS
        │
┌───────┴────────┬─────────────────┬──────────────────┐
│  Venue app      │  Marketing      │  Workspace        │
│  (App Runner /  │  (App Runner /  │  (App Runner /    │
│   Fargate /      │   Fargate /     │   Fargate /       │
│   Amplify)       │   Amplify)      │   Amplify)        │
└───────┬─────────┴────────┬────────┴─────────┬─────────┘
        │                  │                   │
        │         PRODUCT_API_BASE_URL (internal calls, both ways)
        │                  │                   │
        └──────────────────┴───────────────────┘
                           │
                 Supabase (managed, external):
                 Postgres + Auth + Storage
                           │
        EventBridge Scheduler → the 9 existing cron routes,
        Bearer CRON_SECRET, same shape as vercel.json today
```

---

## 7. Critical path to first real Sandbox E2E

Only what `Stripe checkout → enrollment → Resend email → activation → real account → password → login → venue portal` actually needs. Twilio, White Glove, QuickBooks, Facebook, and the 9 scheduled jobs are all genuinely absent from this specific path and are not listed below.

1. **Create the production Supabase project.** Apply every migration in `supabase/migrations/`, including this session's `20261293000000_venue_enrollments.sql`, by direct SQL (§3) — not `supabase db push`.
2. **Decide and stand up AWS compute for the venue app first** (§2/§6) — marketing and workspace both call into it; it has to exist and be reachable before the other two are usefully deployed.
3. **Set the venue app's production environment variables** (§5) — Supabase project values, `RESEND_API_KEY`/`FROM_EMAIL`, `PRODUCT_SYNC_API_KEY`.
4. **Stand up AWS compute for marketing and workspace**, each pointing `PRODUCT_API_BASE_URL` at the venue app's now-real URL, `PRODUCT_SYNC_API_KEY` matching exactly.
5. **Register marketing's Stripe SaaS webhook** against its real, now-live URL (likely already in progress on your side, per your own note).
6. **Run the exact E2E sequence already specified in `docs/postgres-account-bridge-deployment-checklist.md` §7** — real Sandbox checkout → confirm enrollment row in production Postgres → confirm welcome email arrives → activate → confirm real `venues`/`auth.users` rows → log in → confirm portal access → re-open the same activation link once more to confirm retry-safety holds in the real environment too.

Nothing else is required to reach that first real test. Everything past step 6 (scheduling, QuickBooks, Facebook, Twilio, multi-instance resilience for the CRM's local file store) is genuinely deferrable, not silently skipped — named in §3/§4 so it isn't forgotten, just correctly kept off the critical path.
