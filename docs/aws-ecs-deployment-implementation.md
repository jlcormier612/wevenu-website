# AWS CloudFormation/ECS deployment — implementation report

Implements `docs/aws-cloudformation-ecs-deployment-plan.md` exactly as approved: CloudFormation as the IaC layer, ECS (Fargate) as compute for all three Next.js apps, ALB as the public entry point, Supabase-hosted Postgres and Supabase Auth unchanged, no RDS, no split of the monolithic apps.

**Headline: nothing has been deployed to AWS.** This environment has no AWS CLI and no `~/.aws/` credentials — confirmed at the start of this work and still true. Everything below is code (Dockerfiles, `.dockerignore`, a CloudFormation template) plus **local Docker validation**, which is real evidence but is not a substitute for an actual Sandbox deployment. That gap is the one concrete blocker left, and it needs something from you (see "What Jennifer needs to provide," below) — not more implementation work on this end.

Per your closing instruction, this report stops at "ready to deploy to Sandbox." No live/production cutover has been attempted or will be until we review a real Sandbox deployment together.

## What was built

**Docker.** One `Dockerfile` per app (root, `marketing/Dockerfile`, `workspace/Dockerfile`), all multi-stage `node:22-alpine`, all producing a Next.js `output: "standalone"` image running as a non-root user on port 3000. `marketing/` and `workspace/` build with the repo root as context (they import `../shared/*`); their `next.config.ts` now sets `outputFileTracingRoot` so the standalone bundler traces those sibling files correctly. `NEXT_PUBLIC_*` values are `ARG`s baked in at build time, not runtime env — server-only values are runtime `Secrets`/`Environment` in the ECS task definition instead.

**`.dockerignore`** (new, repo root). The first venue-app build attempt sent an unfiltered ~8GB context (`node_modules`, `.next` caches, `.git` history) and timed out mid-transfer. This excludes those paths; all three Dockerfiles use multi-stage builds that install/build fresh inside the container, so nothing here removes anything the build actually needs.

**`infra/htc-ecs-stack.json`** (new). One CloudFormation template, JSON (chosen because this environment has no `cfn-lint`/`pyyaml`, and the file could be validated with Python's stdlib `json` module instead — syntax-checked, not deployed). Same template for Sandbox and production via an `EnvironmentName` parameter, not two templates. Contains:

- VPC, 2 public subnets across 2 AZs, IGW, routing
- ECS cluster (Fargate)
- 3 ECR repositories (one per app)
- 3 task definitions + services — venue app autoscalable in principle (created at desired count 1), **marketing and workspace pinned to desired count 1**, not autoscaled, because their CRM/"Relationship" state is a local on-disk JSON store, not Postgres — redesigning that is explicitly out of scope for this deployment
- One ALB, HTTP listener always on; an HTTPS listener is only created if a `CertificateArn` parameter is supplied (so a first Sandbox smoke test doesn't need a real cert or domain yet)
- 3 target groups with host-based routing. Health checks are not guesses — they match this repo's own local dev tooling (`scripts/dev_listen.py`) and were re-confirmed by literally running each container this session: venue app `/login` → 200, marketing `/` → 200, workspace `/` → **307** (its own session-gate redirect, correct behavior) — so workspace's target group matcher is set to accept 200-399, not the default 200
- Security groups: ALB open on 80/443, ECS tasks only reachable from the ALB's security group
- IAM: a task execution role (pulls images + reads the secrets below) and a near-empty task role — confirmed by search this session that there is zero direct AWS SDK usage anywhere in the app code, so the task role exists because ECS requires one, not because the app calls AWS APIs
- CloudWatch log groups, one per service
- Secrets Manager **resources** for the values that are genuinely sensitive (Supabase service-role key, Resend API key, `PRODUCT_SYNC_API_KEY`, Stripe SaaS + Connect key/webhook-secret pairs) — created with a literal `CHANGE_ME` placeholder, because CloudFormation cannot create a Secrets Manager secret with no value at all. **The real values must be set with `aws secretsmanager put-secret-value` (or the Console) immediately after the stack is created — they are never in the template.**

Deliberately **not** in the template, per your scope: the 9 EventBridge cron jobs, Route 53 records, and any change to the already-approved account-provisioning bridge.

## Two pre-existing bugs found and fixed along the way

Both were required to get an honest local build/run validation, not scope creep — same reasoning as the marketing TS fix from the deployment-readiness pass before this one.

1. **`patches/next-themes+0.4.6.patch` could not be applied by `patch-package` from a clean install.** This is not a Docker artifact — reproduced it in an isolated `/tmp` sandbox with no Docker involved. `patch-package`'s own parser choked on the file it had itself generated. Root cause: the patch was captured after `node_modules/next-themes` was hand-edited, but `patch-package`'s apply-side parser couldn't re-read that diff. This means **any environment that does a genuinely clean `npm ci`** — this Docker build, but also any real CI pipeline — has been silently broken since the patch was created; local dev never noticed because its `node_modules` was already in the post-patch state. Fixed by reconstructing the intended target file content from the broken patch's own diff, applying it to a fresh install, and regenerating the patch with `patch-package` itself. Verified: the regenerated patch (a) applies cleanly from a fresh install and (b) produces byte-identical output to the original patch's intended target — confirmed no behavior change to the app.
2. **`scripts/starter-library-final-validation.mts` imports `../marketing/node_modules/playwright/index.js` directly.** A standalone one-off validation script (not referenced by any `package.json` script or app code), but Next's full-project TypeScript check pulls it into the build regardless. Worked locally only because both apps happen to be installed on the same machine. Fixed by adding `scripts` to `tsconfig.json`'s existing `exclude` array, alongside the already-excluded `marketing`/`workspace` — same category (separate tooling, not part of the deployed app), same treatment.

## Local validation performed (real, not simulated)

| App | Image build | Container run | Health path | Result |
|---|---|---|---|---|
| venue app (root) | ✅ | ✅ | `/login` | **200** |
| marketing | ✅ | ✅ | `/` | **200** |
| workspace | ✅ | ✅ | `/` | **307** (expected — session-gate redirect, not a failure) |

All three containers were run, hit with real `curl` requests, logs checked for clean startup (`✓ Ready in 0ms`, no errors), then removed. No test images or containers remain on this machine.

CloudFormation template: JSON syntax validated with Python's stdlib `json` module — 45 resources, 14 parameters, 5 outputs, no syntax errors. **This is syntax validation only** — it has not been run through `aws cloudformation validate-template` or actually deployed, since neither is possible without AWS access.

## What Jennifer needs to provide before Sandbox deployment can happen

This is the actual blocker, not a to-do item on my end:

1. **AWS account access** — this environment has no AWS CLI installed and no `~/.aws/` credentials. Either provide credentials/SSO access for this environment, or run the deploy commands yourself from a machine that has AWS CLI configured.
2. **A production Supabase project** (if one doesn't already exist) — AWS hosts compute only; Supabase remains the database/auth/storage provider, and the current local dev Supabase stack obviously can't be what ECS tasks talk to.
3. Real values for the Secrets Manager placeholders once the stack exists (Supabase service-role key, Resend API key, `PRODUCT_SYNC_API_KEY`, Stripe keys) — never something I should generate or see in chat.
4. A decision on `CertificateArn`/domain for HTTPS — the template works over plain HTTP with no cert for a first smoke test (verifiable via `curl -H "Host: <hostname>" http://<alb-dns-name>/`, no DNS required), but real traffic needs a real cert.

## Exact next steps once AWS access exists

1. `aws ecr create-repository` is unnecessary — the stack creates the 3 repos. Build+push each image to its repo (`docker build` commands are exactly what was run locally above, plus `docker push`).
2. `aws cloudformation deploy --template-file infra/htc-ecs-stack.json --stack-name htc-sandbox --parameter-overrides EnvironmentName=sandbox VenueAppImage=<uri>:<tag> MarketingImage=<uri>:<tag> WorkspaceImage=<uri>:<tag> --capabilities CAPABILITY_NAMED_IAM`
3. `aws secretsmanager put-secret-value` for each of the 5 secrets created by the stack.
4. Force a new deployment on each ECS service so the tasks pick up the real secret values (they'll have started once already with `CHANGE_ME` placeholders).
5. Confirm all 3 target groups show healthy in the ALB console.
6. Smoke test via `curl -H "Host: <hostname>"` against the ALB's own DNS name (from the stack's `AlbDnsName` output) for all three apps.
7. Only then — and only after we review the results together — consider a first real Stripe Sandbox E2E test through the account-provisioning bridge.

No live/production cutover will be attempted before that review, per your instruction.
