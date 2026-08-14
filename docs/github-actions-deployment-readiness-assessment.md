# GitHub Actions deployment — read-only readiness assessment

**Type:** Read-only. Maps the confirmed decision — GitHub Actions is the deployment mechanism, no manual deploys from a workstation — onto the already-built `docs/aws-cloudformation-ecs-deployment-plan.md`, `docs/aws-ecs-deployment-implementation.md`, the three Dockerfiles, and `infra/htc-ecs-stack.json`.
**Date:** 2026-08-13.
**Not done in this pass:** no AWS/GitHub/any external service authenticated to, no workflow files created or modified, nothing deployed. This document proposes file names, resource names, and permissions — it doesn't create any of them.

---

## The one real finding: ECR ownership has a bootstrap conflict with GitHub Actions

`infra/htc-ecs-stack.json` currently defines the 3 ECR repositories (`VenueAppRepository`, `MarketingRepository`, `WorkspaceRepository`) as CloudFormation-managed resources inside the *same* stack as the VPC/ECS/ALB. That's fine for a stack CloudFormation deploys and owns end-to-end by itself. It's a real problem for a CI-driven pipeline, because of the order things actually have to happen in:

- You can't `docker push` to an ECR repo that doesn't exist yet.
- The stack's `VenueAppImage`/`MarketingImage`/`WorkspaceImage` parameters have no default — the ECS services can't be created without pointing at a real, already-pushed image.
- So the very first deploy needs the ECR repos to exist *before* the rest of the stack — but they're defined inside that same stack.

If the very first `cloudformation deploy` is run before any image exists, `AWS::ECS::Service` creation will sit waiting for tasks that can never start (no image to pull), and by default CloudFormation rolls back a failed stack **creation** — which deletes everything it just created in that attempt, including the ECR repos, taking the images-would-have-gone-here problem back to square one.

**Recommendation (not yet implemented): split the ECR repositories into their own small, long-lived "foundation" stack** (proposed name: `infra/htc-ecr-repos.json`), deployed once per environment, independent of and ahead of the compute stack. This is a standard CloudFormation pattern — durable resources that must survive every redeploy live in one stack; resources that change on every deploy live in another. It cleanly removes the bootstrap ordering problem: create the foundation stack once (repos persist forever after that), then every subsequent GitHub Actions run only ever touches the compute stack.

The alternative — keep ECR repos in the one stack as they are now, and document a one-time manual bootstrap sequence (`--disable-rollback` on the very first `create-stack` call, so a failed-to-stabilize ECS service doesn't delete the freshly created repos) — works too, but is more fragile and harder to reproduce correctly a second time in a new environment (e.g., when production is stood up later). I'd recommend the split; flagging both because this is a real decision, not something to silently resolve.

---

## GitHub Actions → AWS authentication: OIDC, no long-lived keys

Fully compatible with the existing architecture — nothing about ECS/Fargate, ECR, CloudFormation, or Secrets Manager requires static AWS access keys. Recommended mechanism: `aws-actions/configure-aws-credentials` using GitHub's OIDC token, with `permissions: id-token: write` set explicitly on the job (not inherited from a broader default).

This requires one AWS-side resource that's a genuine bootstrap paradox and can't be created by a GitHub Actions run: an **IAM OIDC Identity Provider** for `token.actions.githubusercontent.com` must already exist in the AWS account before any workflow can assume a role via OIDC — you need AWS credentials to create the very thing that gives GitHub Actions AWS credentials. This has to be a manual, one-time, per-account step (Console, CLI, or a tiny CloudFormation template someone runs manually) — not something achievable via the workflow itself, ever.

## IAM role(s) required

**One deploy role per GitHub Environment**, not one shared role — so a Sandbox workflow run can't touch anything scoped to a future production stack, even by mistake. For now, only:

- `htc-sandbox-github-actions-deploy` — trust policy scoped narrowly to this repo and this environment specifically (the OIDC `sub` claim supports scoping to `repo:jlcormier612/wevenu-website:environment:sandbox`, not a bare wildcard on the repo). A `production` counterpart is a later addition, out of scope until a production GitHub Environment is actually decided on.

**Recommended indirection for the IAM-creation problem:** the CloudFormation template creates IAM resources (`EcsTaskExecutionRole`, `EcsTaskRole`), which requires `CAPABILITY_NAMED_IAM` and, naively, would require granting the GitHub Actions role broad `iam:CreateRole`/`iam:PutRolePolicy`/`iam:AttachRolePolicy` permissions directly. The safer, standard pattern: give the GitHub Actions role only `cloudformation:*` scoped to the specific stack ARN, plus a single `iam:PassRole` for one dedicated **CloudFormation service/execution role** that itself holds the broader permissions (EC2, ECS, ELB, IAM-role-creation, Secrets Manager resource creation, Logs) needed to actually provision the stack's resources. CloudFormation assumes that service role to do the provisioning; the GitHub Actions role itself never holds those broad permissions directly. This is the single most important permission-scoping decision here.

### Permissions the deploy role needs

| Area | Actions | Scope |
|---|---|---|
| ECR | `ecr:GetAuthorizationToken` | `Resource: "*"` (this specific action doesn't support resource scoping) |
| ECR | `ecr:BatchCheckLayerAvailability`, `ecr:InitiateLayerUpload`, `ecr:UploadLayerPart`, `ecr:CompleteLayerUpload`, `ecr:PutImage`, `ecr:BatchGetImage` | Scoped to the 3 `htc-sandbox-*` repo ARNs only |
| CloudFormation | `cloudformation:CreateStack`, `UpdateStack`, `DescribeStacks`, `DescribeStackEvents`, `CreateChangeSet`, `ExecuteChangeSet`, `DescribeChangeSet`, `GetTemplate` | Scoped to the `htc-sandbox` (and later `htc-production`) stack ARN(s) only |
| IAM | `iam:PassRole` | Scoped to exactly one ARN — the dedicated CloudFormation execution role described above, nothing else |
| ECS | `ecs:DescribeServices`, `ecs:DescribeTasks`, `ecs:ListTasks` | Scoped to the `htc-sandbox` cluster — used for the wait/verify step, read-only |
| ELBv2 | `elasticloadbalancing:DescribeLoadBalancers`, `DescribeTargetGroups`, `DescribeTargetHealth` | Read-only, used to fetch the ALB DNS name and confirm targets are healthy before declaring success |

### Should NOT be granted to the GitHub Actions role

- Any direct `iam:CreateRole` / `iam:AttachRolePolicy` / `iam:PutRolePolicy` / `iam:CreatePolicy` — delegate to the CloudFormation execution role instead, per above.
- `secretsmanager:PutSecretValue`, `secretsmanager:DeleteSecret`, or any write action on secret *values* — real secret values are entered manually by Jennifer, never by a workflow. The role should have no Secrets Manager permissions at all; it never needs to read or write secret contents (the ECS task execution role does that, at container-start time, independent of GitHub Actions entirely).
- `iam:CreateUser`, `iam:CreateAccessKey` — no reason for a deploy pipeline to ever create IAM users or static credentials; this would also undermine the whole point of using OIDC.
- Unscoped `Resource: "*"` on anything that supports resource-level scoping (ECS, ECR, CloudFormation, ELB above are all scoped to the `htc-sandbox` naming convention already established by the template).
- Anything outside the `htc-*`-prefixed/tagged resources — this AWS account may hold other, unrelated projects; the role's policy should not be able to touch them.

---

## Which AWS resources must exist before the first GitHub Actions run, vs. which the workflow can create

**Must exist first (manual, one-time, by Jennifer — this environment still has no AWS CLI/credentials and won't authenticate to create these):**

1. The target AWS account and region.
2. The IAM OIDC Identity Provider for `token.actions.githubusercontent.com` — unavoidably manual, explained above.
3. The `htc-sandbox-github-actions-deploy` IAM role and its trust policy.
4. The dedicated CloudFormation execution role (the `iam:PassRole` target above), with the broader provisioning permissions CloudFormation needs on the pipeline's behalf.
5. If the ECR-repos-split recommendation is adopted: the `infra/htc-ecr-repos.json` foundation stack (or the 3 repos created some other one-time way). If it's not adopted: nothing extra here, but the fragile bootstrap sequence described above applies to the very first run only.
6. Everything already identified as outstanding in the prior implementation report and unrelated to CI mechanics: a production Supabase project, and real values for the 5 Secrets Manager placeholders the compute stack creates.

**Can be created by the workflow itself, every run, idempotently, once the above exists:** the entire compute stack in `infra/htc-ecs-stack.json` — VPC, subnets, ECS cluster, task definitions, services, ALB, target groups, listener rules, security groups, CloudWatch log groups, and the Secrets Manager secret *resources* (placeholder values only — the workflow never writes real values into them).

---

## Deployment order inside the workflow

1. **Checkout** — full monorepo, no sparse checkout (both `marketing/Dockerfile` and `workspace/Dockerfile` build with the repo root as context because both import `../shared/*` — this was already established and is why the existing `.dockerignore` at the repo root, not per-app, is what keeps all three builds from resending gigabytes of `node_modules`/`.next` on every run; the file already exists and needs no change for CI).
2. **Build all 3 images**, tagged with the commit SHA (not `:latest` — a unique tag per build is what makes step 4 below a real, traceable CloudFormation parameter change instead of an ambiguous no-op). A matrix strategy (3 parallel jobs) shortens wall-clock time versus building sequentially; the venue app was the slowest of the three locally (~80s image build, ~64s of that in `next build` alone across 150+ routes).
3. **Authenticate to AWS via OIDC**, then `docker push` all 3 images to their already-existing ECR repos.
4. **Deploy/update the compute stack**: `aws cloudformation deploy --template-file infra/htc-ecs-stack.json --stack-name htc-sandbox --parameter-overrides EnvironmentName=sandbox VenueAppImage=<sha-tagged-uri> MarketingImage=<sha-tagged-uri> WorkspaceImage=<sha-tagged-uri> ... --capabilities CAPABILITY_NAMED_IAM --role-arn <cloudformation-execution-role-arn>`. Because the template gives each task definition's `Image` a new value, CloudFormation creates a new task-definition revision and updates each `AWS::ECS::Service` to point at it automatically — **no separate `aws ecs update-service --force-new-deployment` call is needed**; that mechanism is already implicit in the existing template.
5. **Wait for stability.** CloudFormation's own `UpdateStack` already blocks until each `AWS::ECS::Service` resource stabilizes (with its own timeout/rollback behavior) — that's the primary gate. Add an explicit `aws ecs wait services-stable --cluster htc-sandbox --services htc-sandbox-venue-app htc-sandbox-marketing htc-sandbox-workspace` as a secondary, clearer-to-read signal in the workflow log.
6. **Verify the ALB/application endpoints** — the thing CFN's own wait can't tell you, since a task can be "stable" per ECS while the app itself still misbehaves. Read the stack's `AlbDnsName` output, then `curl -H "Host: <hostname>"` against it for all three: venue app `/login` expects **200**, marketing `/` expects **200**, workspace `/` expects **200-399** (its own session-gate redirect returns 307 — confirmed by actually running the container this session, not assumed). A non-matching status fails the job.

**On service ordering specifically:** the plan doc's earlier "venue app first, then marketing/workspace" language was about the other two apps not being *meaningfully testable* until the venue app is reachable — but in the template as written, `VenueAppHostname` is a fixed parameter value substituted directly into marketing/workspace's `PRODUCT_API_BASE_URL`, not a URL discovered at runtime from a live deployment. There's no CloudFormation-level `DependsOn` between the three `AWS::ECS::Service` resources (each depends only on its own listener rule), so a single `UpdateStack` call already updates all three together. No multi-stage sequential deploy is required by the infrastructure itself; it's only the verification order in step 6 that's worth doing venue-app-first, so a venue app problem surfaces with a clear error before checking the two services that depend on it being up.

---

## Secrets Manager references vs. GitHub secrets

The existing template already keeps these fully separate, and the workflow shouldn't change that boundary:

- **Application secret values** (Supabase service-role key, Resend API key, `PRODUCT_SYNC_API_KEY`, Stripe SaaS + Connect key/webhook-secret pairs) live **only** in AWS Secrets Manager, entered manually by Jennifer via `aws secretsmanager put-secret-value` or the Console — never by GitHub Actions, never passed through a workflow, never echoed in a log. The ECS task definitions already reference them by ARN (`Fn::Sub "${SecretArn}:key::"`), resolved by AWS at container start via the task execution role, completely outside GitHub Actions' path.
- **GitHub encrypted secrets**, concretely, may not be needed *at all* for the AWS-auth/deploy mechanism itself: OIDC removes the need for `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` as stored secrets, and no application secret value should ever live in GitHub. Worth calling out as a genuinely small, positive footprint rather than assuming secrets are needed by default.
- **GitHub Environment *variables* (non-secret)** are the right place for everything that's config, not a credential: the deploy role ARN, AWS account ID/region, the CloudFormation stack name, the three hostname parameters, and — confirmed already non-sensitive/browser-safe in the existing docs — the full list of `NEXT_PUBLIC_*` Docker build-args per app, itemized below.

## How the three apps' env vars/secrets are actually supplied, end to end

| Layer | Examples | Supplied via |
|---|---|---|
| Build-time (baked into the client bundle) | `NEXT_PUBLIC_*` (see table below) | `--build-arg` in the workflow's `docker build` step, sourced from GitHub Environment **variables** |
| Runtime, non-secret | `NODE_ENV`, `FROM_EMAIL`, `EMAIL_REPLY_TO`, `PRODUCT_API_BASE_URL`, `SUPABASE_URL` | CloudFormation template parameters → plain ECS task-definition `Environment` entries, passed as `--parameter-overrides` from GitHub Environment variables |
| Runtime, secret | `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `PRODUCT_SYNC_API_KEY`, Stripe keys | AWS Secrets Manager only — never touched by the workflow at all |

### `NEXT_PUBLIC_*` build-args confirmed per Dockerfile (non-secret; environment variables, not secrets)

| App | Build-args |
|---|---|
| Venue app (root) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_MARKETING_URL`, `NEXT_PUBLIC_STRIPE_CLIENT_ID`, `NEXT_PUBLIC_FACEBOOK_APP_ID`, `NEXT_PUBLIC_QUICKBOOKS_CLIENT_ID`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_NOTIFICATIONS_SECRET`, `NEXT_PUBLIC_WEVENU_ADMIN` |
| marketing | `NEXT_PUBLIC_MARKETING_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_PRODUCT_APP_URL`, `NEXT_PUBLIC_CALENDLY_URL` |
| workspace | `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_MARKETING_URL`, `NEXT_PUBLIC_PRODUCT_APP_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_WORKSPACE_URL` |

These differ between Sandbox and a future production (different URLs) — which is exactly what GitHub Environment-scoped variables are for: the same variable *name* holds a different value depending on which Environment (`sandbox` vs. `production`) the job runs under.

---

## Monorepo/shared-package build context, restated for the CI-specific implications

Already established during implementation, restated because it constrains how the workflow's build step must be written: `marketing/` and `workspace/` both import `../shared/*`, so their `docker build` invocations must use the **repo root** as build context (`-f marketing/Dockerfile .`, `-f workspace/Dockerfile .`), not their own subdirectory — a workflow step that `cd`s into `marketing/` before building would break. The venue app's own Dockerfile also builds from the repo root. `actions/checkout@v4`'s default (full, non-sparse checkout) satisfies this with no extra configuration.

The `.dockerignore` fix from the implementation phase — which resolved an 8GB, timed-out build-context transfer locally — carries over identically in CI and is arguably more important there: GitHub-hosted runners have finite disk, and an unfiltered multi-gigabyte context transfer risks the same failure mode inside a time- and disk-constrained runner. No change needed; it's a committed repo file and applies the same way regardless of where `docker build` runs.

---

## Sandbox-first support

The existing template already supports this cleanly — `EnvironmentName` (sandbox/production) drives every resource name (`htc-${EnvironmentName}-...`) and every Secrets Manager path (`htc/${EnvironmentName}/...`). The natural mapping is a GitHub **Environment** named `sandbox`, with its variables set to `EnvironmentName=sandbox` and the sandbox-specific hostnames/URLs, deployed by a workflow scoped to that Environment. A `production` GitHub Environment, configured later with **required reviewers**, would be the concrete technical enforcement of "no production cutover without review" — turning that from a verbal agreement into an actual gate GitHub itself enforces. Worth noting as a natural benefit of this design; not being proposed for creation now, since no production Environment or workflow exists yet and none is being built in this pass.

---

## Proposed workflow files (names/structure only — none created)

- `.github/workflows/deploy-sandbox.yml` — triggered on push to `main` and/or `workflow_dispatch`, targeting the `sandbox` GitHub Environment. Two logical jobs: a build-matrix job (3 images, parallel) and a deploy job (CloudFormation deploy → wait → verify), the deploy job gated on the build job succeeding.
- `.github/workflows/bootstrap-ecr.yml` (only if the ECR-repos-split recommendation is adopted) — `workflow_dispatch`-only, never triggered by push, run once per environment to create the foundation stack.
- A `production` counterpart workflow is a natural future addition once a production GitHub Environment and its protection rules exist — not proposed for creation now.

## Required GitHub repository configuration

- **Environments:** `sandbox` (no protection rules needed yet); `production` (future, required reviewers).
- **Environment variables** (`sandbox`): AWS region, AWS account ID (or embed in the role ARN), the deploy role ARN, the CloudFormation stack name (`htc-sandbox`), `VenueAppHostname`/`MarketingHostname`/`WorkspaceHostname`, and the full `NEXT_PUBLIC_*` list per app above.
- **Environment/repo secrets:** none identified as required for the AWS-auth/deploy mechanism itself — OIDC removes the AWS-key requirement, and application secrets never pass through GitHub. If that changes (e.g., a deploy-status Slack webhook is wanted later), that would be its own, separate, small addition.
- **Workflow-level permissions:** `id-token: write`, `contents: read` — explicit in the workflow YAML, not inherited from a broader default.

## Required AWS resources

See "Which AWS resources must exist before the first GitHub Actions run" above — reproduced in summary form:

| Resource | Who creates it |
|---|---|
| AWS account/region | Jennifer (pre-existing decision, not part of this assessment) |
| IAM OIDC provider (`token.actions.githubusercontent.com`) | Jennifer, manually — unavoidable bootstrap step |
| `htc-sandbox-github-actions-deploy` IAM role | Jennifer, manually (or by me, later, once given AWS access) |
| CloudFormation execution role (PassRole target) | Same as above |
| 3 ECR repositories | Either a one-time foundation stack (recommended) or the existing compute stack's first, carefully-sequenced bootstrap run |
| VPC, ECS cluster, task defs, services, ALB, target groups, security groups, log groups, Secrets Manager secret resources | The workflow itself, every run, via `infra/htc-ecs-stack.json` |
| Production Supabase project + real Secrets Manager values | Jennifer, manually — already an outstanding item from the prior implementation report |

## Required IAM/OIDC configuration

- One OIDC identity provider, account-wide.
- One deploy role per GitHub Environment (only `sandbox` for now), trust policy scoped to `repo:jlcormier612/wevenu-website:environment:sandbox`.
- Permission set exactly as tabled above — scoped ECR/CloudFormation/ECS-read/ELB-read, one narrow `iam:PassRole`, and explicitly no Secrets Manager write access, no broad IAM-creation access, no unscoped resources.
- One CloudFormation execution role, assumed by CloudFormation (not by GitHub Actions directly) to perform the actual resource provisioning.

## Required secrets/variables (names only)

**GitHub Environment variables (`sandbox`):** `AWS_REGION`, `AWS_DEPLOY_ROLE_ARN`, `CFN_EXECUTION_ROLE_ARN`, `CFN_STACK_NAME`, `VENUE_APP_HOSTNAME`, `MARKETING_HOSTNAME`, `WORKSPACE_HOSTNAME`, plus the 10+4+5 `NEXT_PUBLIC_*` names tabled above (values are already-established as non-secret/browser-safe).

**GitHub secrets:** none identified as required.

**AWS Secrets Manager (already defined by the existing template; values entered manually, never via GitHub):** `htc/sandbox/supabase-service-role-key`, `htc/sandbox/resend-api-key`, `htc/sandbox/product-sync-api-key`, `htc/sandbox/stripe-saas`, `htc/sandbox/stripe-connect`.

## Deployment order (summary)

1. Foundation stack / ECR repos (once, manual or `workflow_dispatch`-only).
2. Build 3 images (SHA-tagged, matrix/parallel).
3. Push to ECR (OIDC-authenticated).
4. `cloudformation deploy` on the compute stack with the new image parameters (all three services updated together — no artificial sequencing needed at the infra level).
5. Wait for ECS service stability (CFN's own wait, plus an explicit `ecs wait services-stable` for a clearer log signal).
6. Verify ALB endpoints by hostname (`/login`→200 venue, `/`→200 marketing, `/`→200-399 workspace) — venue-app-first order in this step specifically, so a venue-app problem surfaces before checking its dependents.

## Manual steps only Jennifer can perform

1. Confirm the target AWS account/region.
2. Create the IAM OIDC provider (one-time, unavoidably manual).
3. Create the `htc-sandbox-github-actions-deploy` role and the CloudFormation execution role, with the trust policies and permissions specified above.
4. Decide on the ECR-repos foundation-stack split (recommended) vs. the fragile single-stack bootstrap sequence.
5. Create the `sandbox` GitHub Environment and populate its variables.
6. Everything still outstanding from the prior implementation report: production Supabase project, real Secrets Manager values, `CertificateArn`/domain decision.

No AWS, GitHub, or other external service was authenticated to in producing this assessment. No workflow files were created or modified. Nothing was deployed.
