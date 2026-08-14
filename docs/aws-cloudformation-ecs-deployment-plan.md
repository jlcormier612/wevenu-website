# AWS CloudFormation + ECS Deployment Plan — Read Only

**Type:** Read-only mapping of the confirmed architecture onto the actual repo. No code changed, no AWS service authenticated to, nothing deployed.
**Date:** 2026-08-14
**Confirmed, not re-evaluated:** CloudFormation (IaC), AWS-hosted frontend/application layer, ECS for backend/container workloads, Postgres via Supabase (not RDS), Supabase Auth unchanged, Resend, Stripe. This document maps that decision onto `docs/aws-deployment-readiness-assessment.md` and the real repo — it does not reconsider the decision itself.

---

## Reconciling one thing before the resource lists

Your architecture lists **"AWS-hosted frontend/application layer"** and **"AWS ECS — backend/container workloads"** as two separate items. Mapped against the actual repo, they collapse into one: **all three apps (venue app, marketing, workspace) are monolithic Next.js servers — each app's pages and each app's API routes/webhooks are the same process, not separate frontend/backend services.** Confirmed directly: no separate API/backend package exists anywhere in the repo; every app's `app/api/*` routes and `app/*` pages ship in the same `next build` output.

So the faithful mapping is: **ECS hosts the actual compute for all three apps** (each app = one Next.js server, serving both its pages and its API routes), and the **"frontend/application layer"** is the entry point in front of that compute — an Application Load Balancer (and optionally CloudFront in front of the ALB for CDN/edge caching of static assets, a real option but not a requirement). I'm not proposing splitting any app into a separate static frontend + API backend — that would be a redesign of working software, not a mapping of it.

---

## 1. CloudFormation — resources for first production-capable deployment

| Resource | Purpose | Needed for first E2E? |
|---|---|---|
| VPC, public + private subnets (≥2 AZs) | Network isolation — public subnets for the ALB, private subnets for ECS tasks | Yes |
| Internet Gateway + NAT Gateway (or public-subnet tasks, see §3 networking) | Outbound internet for ECS tasks to reach Supabase/Resend/Stripe | Yes |
| ECS Cluster | Hosts all three services | Yes |
| 3× ECR Repository (venue app, marketing, workspace) | Container image storage — CloudFormation provisions the repos; pushing images is a CI/CD action, not IaC | Yes |
| 3× ECS Task Definition | Container spec per app (§3) | Yes |
| 3× ECS Service | Runs/maintains the tasks | Yes |
| 1× Application Load Balancer, 3× Target Group, host- or path-based listener rules | Public entry point, routes by domain/subdomain to the right service | Yes |
| Security Groups (ALB: 443 from internet; ECS tasks: container port from ALB SG only) | Network boundary | Yes |
| 3× CloudWatch Log Group | Container stdout/stderr | Yes |
| IAM: ECS Task Execution Role (pull from ECR, write logs, read secrets) | Required by ECS itself | Yes |
| IAM: ECS Task Role | Runtime AWS permissions — **confirmed minimal-to-empty**: no AWS SDK call of any kind exists anywhere in this codebase (checked directly; all "storage" and "database" calls go to Supabase over HTTPS, not to any AWS API) | Yes, but trivial |
| Secrets Manager secrets or SSM Parameter Store (SecureString) — resources only, not values | Holds the env-var matrix (§6) | Yes |
| ACM Certificate(s) for the real domain(s) | HTTPS on the ALB | Yes |
| Route 53 records | DNS — **open question**: not established by the repo whether `hellotocheers.com`'s DNS is already in Route 53 or an external registrar (the launch runbook says only "add DNS records at your DNS registrar," not naming which) | Yes, in some form |
| EventBridge Scheduler rules (9 total: 8 venue-app crons + 1 workspace cron) | Scheduled jobs — direct translation of the existing `vercel.json` cron declarations | **No** — none of the 9 are in the checkout→login path (§8) |

---

## 2. Frontend/application layer

All three apps need AWS hosting; there is no fourth "frontend-only" component to host separately. Per the reconciliation above: the ALB (§1) is the frontend/application-layer entry point; ECS is what it routes to. If a CDN layer is wanted for static asset caching, CloudFront sits in front of the same ALB — additive, not a different hosting target, and not required for the first E2E test to function.

---

## 3. ECS

**Which components belong in ECS:** all three — venue app, marketing, workspace. Each is one ECS service running one container.

**Containers required, per app — the one real gap:** none of the three apps has a `Dockerfile` today, and none sets `output: "standalone"` in `next.config.ts` (confirmed by direct read of all three `next.config.ts` files) — Fargate/ECS needs a container image, and `standalone` output is what keeps that image small and self-contained rather than shipping the full `node_modules` tree. Both are small, mechanical additions, not architecture questions — listed as implementation tasks in the closing section, not done here.

**One real build-context constraint, already flagged in the prior assessment, restated because it directly affects the Dockerfile:** `marketing/` and `workspace/` both import from `../shared/*` (confirmed in their `next.config.ts`'s own `turbopack.root` setting). Their container builds need the **whole repo**, not just their own subdirectory, as build context.

**Ports:** the local dev ports (3000/3001/3002) exist only so all three can run simultaneously on one developer machine — that's not a production requirement. In ECS, each app runs in its own isolated task; there's no reason not to let all three simply listen on Next.js's default (3000) inside their own container. The ALB target groups map the public host/path to whichever internal port each task actually exposes, regardless of what that number is.

**Environment variables/secrets:** per-app matrix in §6, sourced into the task definition as Secrets Manager/SSM references (task execution role permission, not application code).

**Networking:** ECS tasks in private subnets, reachable only from the ALB's security group on the container port; outbound internet access required (via NAT Gateway or public-subnet placement) for HTTPS calls to Supabase, Resend, Stripe, and — for marketing/workspace specifically — the venue app's own ALB endpoint (`PRODUCT_API_BASE_URL`).

**Health checks — a real gap, not a decision:** the only route in the repo with "health" in its name (`app/api/analytics/health`) is a business analytics endpoint that requires an authenticated Supabase session and returns 401 without one — **not usable as an ALB target-group health check**, which needs an unauthenticated, reliably-200 path. The repo's own local dev tooling (`scripts/dev_listen.py`) already treats `/login` (venue app) and `/` (marketing, workspace) as the "is this server actually up" check — the same paths are the natural, already-proven ALB health-check targets, requiring no new route to be built.

**Dependencies between services:** the venue app has no dependency on the other two. Marketing and workspace both depend on the venue app being reachable (`PRODUCT_API_BASE_URL`) for the legal-acceptance and enrollment/activation bridges — the venue app's ECS service needs to exist and be healthy before the other two are meaningfully deployed (this is a deployment-order fact, not a CloudFormation cross-stack-reference requirement — the URL can simply be a config value set after the venue app's ALB DNS name is known).

**Instance count — a real constraint carried over from the prior assessment, not new here:** marketing's and workspace's CRM/"Relationship" data lives in a local on-disk JSON file (`shared/relationships/store.ts`), not Postgres. Running either of those two services with more than one task, or with tasks that get frequently replaced, means each task sees a different (or empty) copy of that data. For the first E2E test specifically, this doesn't matter — the account-provisioning bridge itself is fully Postgres-backed — but it does mean marketing/workspace should run as a single task each (desired count = 1, no autoscaling) until that data layer is addressed as a separate, later piece of work.

---

## 4. Postgres

**Where it currently lives:** a local Supabase CLI stack (`supabase start`, the Postgres container this whole engagement has run every test against) — **no production Supabase project exists yet**, confirmed by the absence of any production Supabase URL/keys anywhere in the repo (only `.env.example` placeholders and local `.env.local` values).

**Production connection/API configuration:** unchanged in shape from local — every database call in all three apps goes through Supabase's PostgREST-based JS client (`.from(...)`/`.rpc(...)` over HTTPS), confirmed by direct search: **zero raw Postgres driver usage anywhere** (`pg`, `postgres`, any ORM). This means "Postgres in production" concretely means: create a real Supabase project, and point `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` at it instead of `127.0.0.1:54321`. No connection pooling to design — Supabase's own infrastructure (Supavisor) handles that transparently behind the HTTPS API, regardless of how many ECS tasks call it concurrently.

**Migrations required:** every file in `supabase/migrations/`, applied by direct SQL execution (Dashboard SQL editor or a direct `psql` connection) — **not** `supabase db push`, because of the 4 unresolved migration-timestamp collision groups already on record from an earlier pass this engagement (never resolved, not something this plan reopens). This includes this session's `20261293000000_venue_enrollments.sql`.

**Remaining Supabase dependencies, preserved exactly as approved:** `auth.uid()`, all 360+ RLS policies, `app/auth/actions.ts`'s `signInWithPassword` login, `@supabase/ssr` session-cookie handling, and Supabase Storage (23 files' worth of real usage, confirmed) — none of this is touched by an AWS hosting change. **No document anywhere in this repo proposes moving to RDS** — confirmed by search; the only file that even mentions RDS is this engagement's own prior assessment, which named it only to rule it out.

---

## 5. External integrations

| Integration | First E2E? | What's needed |
|---|---|---|
| **Stripe — SaaS billing (`marketing/`)** | **Required** | Webhook endpoint registered against marketing's real ALB/domain URL once deployed; `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` (SaaS-specific — separate from the venue app's own Stripe Connect keys, which are unrelated to this path) |
| **Stripe — Connect (venue app)** | Not required for this path | Pre-existing, unaffected either way |
| **Resend** | **Required** | Already domain-verified per your earlier work; production key needs to land in Secrets Manager/Parameter Store under the two established variable-name conventions (`FROM_EMAIL` for the venue app; `EMAIL_FROM`/`EMAIL_REPLY_TO` for marketing/workspace) |
| **Supabase Auth** | **Required** | Production project must exist (§4) — doesn't yet |
| **product-sync bridge (this session's work)** | **Required** | `PRODUCT_SYNC_API_KEY` identical across all three ECS services' secrets; `PRODUCT_API_BASE_URL` in marketing/workspace set to the venue app's real ALB/domain URL |
| **Required webhooks for this path** | Marketing's Stripe SaaS webhook only | The venue app's two new internal routes (`/api/internal/enrollment/*`) aren't "webhooks" in the external sense — they're internal, Bearer-secret-authenticated endpoints only marketing/workspace call, already covered by the `PRODUCT_SYNC_API_KEY` requirement above |
| **Required scheduled jobs for this path** | **None** | All 9 EventBridge cron targets (§1) handle notifications, digests, automation ticking, QuickBooks/Facebook sync, and saved reports — none of them run in the checkout→login path |
| Twilio, Luv, White Glove, QuickBooks, Facebook | **Deferred** | No hard dependency found anywhere in this path — Luv's own data/compute is entirely within the venue app's existing Postgres/RLS model and isn't a separate infrastructure component; White Glove specifically never generates an activation token, so it structurally cannot reach the new bridge regardless of infrastructure |

---

## 6. Secrets/configuration — production environment-variable matrix

Names only; no values.

**Venue app**
| Variable | Status |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Required · code already reads these · production Supabase project doesn't exist yet |
| `RESEND_API_KEY`, `FROM_EMAIL` | Required · code already reads these |
| `PRODUCT_SYNC_API_KEY` | Required · code already reads this · must be byte-identical across all three services |
| `NEXT_PUBLIC_APP_URL` | Required · code already reads this · value = this app's own real ALB/domain URL, needed by the other two apps too |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (Connect) | Required for existing functionality · not part of this E2E path |
| `CRON_SECRET` | Required once EventBridge rules exist · not required for this E2E path |

**Marketing**
| Variable | Status |
|---|---|
| `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` | Required · code already reads these |
| `PRODUCT_API_BASE_URL`, `PRODUCT_SYNC_API_KEY` | Required · code already reads these · base URL depends on the venue app's real URL existing first |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (SaaS billing) | Required · code already reads these |
| `NEXT_PUBLIC_PRODUCT_APP_URL` | Required · code already reads this |
| Plan/price/founder-program variables (`STRIPE_PRICE_*`, `STRIPE_PAYMENT_LINK_*`) | Required for whichever plan is used in the E2E test · code already reads these |

**Workspace**
| Variable | Status |
|---|---|
| `RESEND_API_KEY`, `EMAIL_FROM` | Required · code already reads these |
| `PRODUCT_API_BASE_URL`, `PRODUCT_SYNC_API_KEY` | Required · code already reads these |
| `NEXT_PUBLIC_PRODUCT_APP_URL` | Required · code already reads this |
| `CRON_SECRET` | Required for its own scheduled job · not required for this E2E path |

**Not established by the repo — architecture/deployment decisions, not code gaps:**
- The real values for `NEXT_PUBLIC_APP_URL`/`PRODUCT_API_BASE_URL`/`NEXT_PUBLIC_PRODUCT_APP_URL` — circular until the venue app's ALB/domain exists.
- Whether DNS for the chosen domain(s) is already in Route 53 or needs delegating there.

---

## 7. Deployment order

1. **CloudFormation — network + cluster + registries.** VPC, subnets, NAT/IGW, ECS cluster, 3 ECR repos, security groups, IAM roles, log groups, ACM cert(s), (Route 53 records once the DNS question above is answered).
2. **Postgres/database preparation.** Create the production Supabase project; apply every migration by direct SQL, in order, ending with `20261293000000_venue_enrollments.sql`; verify `activate_venue_enrollment()` is the corrected version (the one that does not null the activation token — see the implementation report's "bug found and fixed" note).
3. **Secrets.** Populate Secrets Manager/Parameter Store for the venue app first (§6) — nothing downstream can be tested without it.
4. **Backend/ECS — venue app first.** Build its image (needs the Dockerfile + `standalone` output prerequisite), push to its ECR repo, deploy its ECS service + target group, confirm the ALB health check (`/login`) passes.
5. **Frontend/application deployments — marketing and workspace.** Now that the venue app's real URL exists, set `PRODUCT_API_BASE_URL`/`NEXT_PUBLIC_PRODUCT_APP_URL` in their secrets, build and deploy both ECS services, confirm their health checks (`/`) pass.
6. **Environment/secrets, second pass.** Confirm `PRODUCT_SYNC_API_KEY` is byte-identical across all three now-real services (the single easiest thing to get subtly wrong).
7. **Stripe/Resend webhook configuration.** Register marketing's real Stripe SaaS webhook URL in Stripe (Sandbox mode) with the matching `STRIPE_WEBHOOK_SECRET`. Resend needs no further action beyond the key already being in Secrets Manager — domain verification is already done.
8. **First E2E test** — §8 below.

---

## 8. Minimum infrastructure for the first E2E

`Stripe Sandbox checkout → enrollment → real account provisioning → Resend invitation → activation → real login → venue portal`

**Required:**
- Production Supabase project + all migrations applied (§4).
- Venue app deployed on ECS, reachable via its ALB/domain, with its full §6 secret set.
- Marketing deployed on ECS, reachable via its own ALB/domain, with its full §6 secret set, `PRODUCT_API_BASE_URL` pointed at the now-real venue app.
- Workspace deployed on ECS, same dependency.
- Marketing's Stripe Sandbox webhook registered and verified receiving events.
- Resend production key in place (already domain-verified).

**Not required for this specific test**, confirmed with no hard dependency found: Twilio, Luv (its compute/data lives inside the venue app's existing Postgres model, not a separate infrastructure piece), White Glove (structurally can't reach this bridge — no activation token is ever generated for it), QuickBooks, Facebook Lead Ads, and all 9 EventBridge-scheduled cron jobs.

---

## Confirmed architecture

CloudFormation-provisioned VPC + ECS cluster running all three Next.js apps as containerized services (each app = pages + API routes together, no frontend/backend split), fronted by an ALB (optionally CloudFront), connecting outbound to a production Supabase project (Postgres + Auth + Storage, unchanged from the already-approved narrow scope), Resend for email, Stripe for SaaS billing.

## Resources required

Everything enumerated in §1, minus the 9 EventBridge cron rules (needed for full production readiness, not for the first E2E).

## Open decisions

- Compute sizing/task count beyond the "marketing/workspace = 1 task" constraint (§3) — not addressed here, genuinely a later tuning question, not a launch blocker.
- Shared ALB with host-based routing vs. one ALB per app — a cost/complexity tradeoff, not resolved by anything in the repo.
- Whether DNS is already in Route 53 or needs delegating there.
- CloudFront in front of the ALB — optional, not required for the E2E test.
- Private-subnet-with-NAT vs. public-subnet ECS tasks — standard security-vs-cost tradeoff, not established by the repo either way.

## Exact manual AWS setup required from Jennifer

- Confirm/provide the AWS account and region this should be built in (this assessment doesn't have access to any AWS account, per your instruction).
- Create the production Supabase project (or confirm one already exists that this work hasn't been told about) and share its URL/keys through your secrets process — not pasted in chat.
- Confirm where DNS for the relevant domain(s) currently lives.
- Confirm the Stripe Sandbox/production webhook registration once marketing's real URL exists (likely already something you're tracking separately).
- Approve the open decisions above, or explicitly defer them with a stated default.

## Exact implementation tasks I can perform after your approval

- Add `output: "standalone"` to all three `next.config.ts` files and write a `Dockerfile` per app (small, mechanical, no architecture judgment required beyond what's already decided).
- Write the CloudFormation template(s) for the resources in §1.
- Write the EventBridge Scheduler definitions mirroring the existing `vercel.json` cron declarations (deferred past the first E2E, but small and low-risk whenever it's wanted).
- Nothing here touches the already-approved and already-verified account-provisioning bridge itself — that code doesn't change for this hosting move.

No code changes made. No AWS or Vercel service authenticated to. Nothing deployed.
