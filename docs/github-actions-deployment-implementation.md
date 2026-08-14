# GitHub Actions deployment pipeline — implementation report

Implements `docs/github-actions-deployment-readiness-assessment.md` exactly as approved: GitHub OIDC → AWS, one Sandbox Environment/deploy role, a separate CloudFormation execution role with `iam:PassRole`, the ECR foundation stack split out and deployed before the application stack, Secrets Manager for application secrets, SHA-tagged images, CloudFormation-driven ECS updates, automated health verification.

**Nothing was deployed and nothing was authenticated to.** All work below is new/changed files, validated for syntax only (JSON via Python's `json` module, YAML via PyYAML — both confirmed parse cleanly). No workflow has ever run. Per your instruction, this stops at "ready to bootstrap" — the exact manual AWS steps you need to run yourself are at the end of this report, and nothing past them should happen until you've run them.

## What changed

**`infra/htc-ecs-stack.json`** (modified) — the 3 `AWS::ECR::Repository` resources and their 3 outputs were removed. Nothing else changed: it still owns ECS, ALB, networking, task definitions, services, IAM, and logging, exactly as scoped. The `VenueAppImage`/`MarketingImage`/`WorkspaceImage` parameters were already plain "full image URI:tag" strings, so removing the repo resources required no other changes — the stack never needed to reference them directly.

**`infra/htc-ecr-repos.json`** (new) — the foundation stack. Three ECR repositories only (`htc-sandbox-venue-app`, `htc-sandbox-marketing`, `htc-sandbox-workspace`), `EnvironmentName`-parameterized the same way as the compute stack so the same template covers a future production environment. Long-lived by design — deployed once, not touched by routine app deploys, so a failed compute-stack deploy can never take it down.

**`infra/htc-github-oidc.json`** (new) — the one piece of this pipeline that cannot be deployed by GitHub Actions itself, because a workflow has no AWS credentials until this exists. Creates:
- The IAM OIDC identity provider for `token.actions.githubusercontent.com` (skippable via a parameter if one already exists in the account — only one can exist per URL per account).
- `htc-sandbox-github-actions-deploy` — the role GitHub Actions assumes. Trust policy scoped to `repo:jlcormier612/wevenu-website:environment:sandbox` specifically (confirmed from this repo's own git remote), not the whole repo. Permissions: ECR push scoped to the 3 sandbox repo ARNs, CloudFormation actions scoped to the `htc-sandbox`/`htc-sandbox-ecr` stack ARNs, one `iam:PassRole` scoped to exactly the CloudFormation execution role below (conditioned on `iam:PassedToService: cloudformation.amazonaws.com`), read-only ECS/ELB actions for the verify step. No Secrets Manager permissions of any kind, no broad IAM permissions, no unscoped `iam:CreateRole`.
- `htc-sandbox-cfn-execution` — the role CloudFormation itself assumes to actually provision resources. Scoped to the `htc-sandbox-*` naming prefix everywhere the underlying AWS service supports resource-level IAM (ECS, CloudWatch Logs, IAM role management, Secrets Manager); left at `Resource: "*"` only where AWS genuinely doesn't support finer scoping (EC2 networking create/attach actions, ELBv2 create actions) — that's a documented AWS limitation, not a scoping choice made here. Its Secrets Manager permissions are deliberately `CreateSecret`/`DescribeSecret`/`TagResource`/`DeleteSecret` only — **no `PutSecretValue`, no `GetSecretValue`**. `CreateSecret` already sets the initial `CHANGE_ME` placeholder as part of creation, which is all this role or this pipeline ever does; populating the real value stays a human-only action, entirely outside anything either IAM role in this template can do.

**`.github/workflows/deploy-foundation-sandbox.yml`** (new) — `workflow_dispatch` only, never on push. Deploys `htc-ecr-repos.json`. Meant to run once, rarely again.

**`.github/workflows/deploy-sandbox.yml`** (new) — triggered on push to `main` or manual dispatch. Three jobs:
1. **`build-and-push`** — matrix over the 3 apps (venue app, marketing, workspace), each building from the repo root (required — marketing/workspace both import `../shared/*`) with its own Dockerfile and its own exact `NEXT_PUBLIC_*` build-arg list (verified against each Dockerfile's actual declared `ARG`s, not assumed), tagged `<ecr-registry>/<repo>:<git-sha>` — never `:latest`, so every deploy is a real, traceable CloudFormation parameter change.
2. **`deploy`** — one `cloudformation deploy` call updates the compute stack with the three just-pushed image URIs plus the non-secret config parameters (hostnames, `FromEmailAddress`, `EmailReplyTo`, `SupabaseUrl`). Because each task definition's `Image` changes, CloudFormation creates new task-definition revisions and updates all three ECS services automatically — no separate `ecs update-service` call.
3. **`verify`** — `aws ecs wait services-stable` on all three services first (a real wait, not a fixed sleep), then reads the stack's `AlbDnsName` output and `curl`s each app through the ALB with the right `Host` header: venue app `/login` must be exactly 200, marketing `/` must be exactly 200, workspace `/` must be 2xx/3xx (its own session-gate redirect returns 307 by design — confirmed by running the container, not assumed, same as the ALB target group's own health-check matcher). Any mismatch fails the job with `::error::`.

## What was deliberately not built

- No production workflow, environment, or IAM role — only Sandbox exists anywhere in this pipeline, per "do not expand beyond what is required for the approved Sandbox deployment."
- No GitHub secrets of any kind. Only GitHub Environment **variables** (non-secret by definition) are referenced — `vars.*` throughout both workflows. No AWS access key, no application secret value, appears in either workflow file.
- No change to the account-provisioning bridge, the EventBridge cron jobs, Route 53, or anything outside this pipeline's own scope.

## Required GitHub Environment variables (Sandbox) — names only

| Variable | Used for |
|---|---|
| `AWS_REGION` | All AWS CLI calls |
| `AWS_DEPLOY_ROLE_ARN` | OIDC role both workflows assume |
| `CFN_EXECUTION_ROLE_ARN` | Passed to `cloudformation deploy --role-arn` |
| `ECR_STACK_NAME` | e.g. `htc-sandbox-ecr` |
| `CFN_STACK_NAME` | e.g. `htc-sandbox` |
| `VENUE_APP_HOSTNAME`, `MARKETING_HOSTNAME`, `WORKSPACE_HOSTNAME` | ALB listener-rule host headers + verify step |
| `FROM_EMAIL_ADDRESS`, `EMAIL_REPLY_TO`, `SUPABASE_URL` | Non-secret runtime config parameters |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_MARKETING_URL`, `NEXT_PUBLIC_STRIPE_CLIENT_ID`, `NEXT_PUBLIC_FACEBOOK_APP_ID`, `NEXT_PUBLIC_QUICKBOOKS_CLIENT_ID`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_NOTIFICATIONS_SECRET`, `NEXT_PUBLIC_WEVENU_ADMIN` | Venue app build-args |
| `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_PRODUCT_APP_URL`, `NEXT_PUBLIC_CALENDLY_URL` | Marketing build-args (plus `NEXT_PUBLIC_MARKETING_URL` above) |
| `NEXT_PUBLIC_WORKSPACE_URL` | Workspace build-args (plus `NEXT_PUBLIC_APP_URL`/`NEXT_PUBLIC_MARKETING_URL`/`NEXT_PUBLIC_PRODUCT_APP_URL`/`NEXT_PUBLIC_SITE_URL` above) |

No values are set anywhere in this repo — these are variable *names* the Sandbox GitHub Environment needs populated before the workflows can run.

## Exact manual AWS bootstrap steps — required before the first GitHub Actions Sandbox deployment

These are the only things standing between what's now written and a real first deployment. In order:

1. **Configure your own AWS CLI credentials locally** (or however you access this account) — this session still has no AWS CLI and no credentials, so none of the following can be run from here.

2. **Deploy the OIDC/IAM bootstrap stack, once:**
   ```bash
   aws cloudformation deploy \
     --template-file infra/htc-github-oidc.json \
     --stack-name htc-github-oidc \
     --capabilities CAPABILITY_NAMED_IAM
   ```
   If this AWS account already has a GitHub OIDC provider from an earlier project (only one can exist per account), find its ARN first (`aws iam list-open-id-connect-providers`) and pass it instead of letting the template create a second one:
   ```bash
   aws cloudformation deploy \
     --template-file infra/htc-github-oidc.json \
     --stack-name htc-github-oidc \
     --parameter-overrides ExistingOidcProviderArn=<that-arn> \
     --capabilities CAPABILITY_NAMED_IAM
   ```

3. **Read the two role ARNs back out:**
   ```bash
   aws cloudformation describe-stacks --stack-name htc-github-oidc \
     --query "Stacks[0].Outputs" --output table
   ```

4. **Create the `sandbox` GitHub Environment** (repo Settings → Environments) and populate every variable in the table above — the two role ARNs from step 3 go into `AWS_DEPLOY_ROLE_ARN` and `CFN_EXECUTION_ROLE_ARN`.

5. **Run the foundation workflow once** (Actions tab → "Deploy foundation stack (Sandbox)" → Run workflow) — creates the 3 ECR repositories via `infra/htc-ecr-repos.json`.

6. **Populate the application secrets** the compute stack will create as placeholders on its first deploy — this can happen either right before or right after step 7, but must happen before the apps will actually work:
   ```bash
   aws secretsmanager put-secret-value --secret-id htc/sandbox/supabase-service-role-key --secret-string '{"value":"<real value>"}'
   aws secretsmanager put-secret-value --secret-id htc/sandbox/resend-api-key --secret-string '{"value":"<real value>"}'
   aws secretsmanager put-secret-value --secret-id htc/sandbox/product-sync-api-key --secret-string '{"value":"<real value>"}'
   aws secretsmanager put-secret-value --secret-id htc/sandbox/stripe-saas --secret-string '{"STRIPE_SECRET_KEY":"<real value>","STRIPE_WEBHOOK_SECRET":"<real value>"}'
   aws secretsmanager put-secret-value --secret-id htc/sandbox/stripe-connect --secret-string '{"STRIPE_SECRET_KEY":"<real value>","STRIPE_WEBHOOK_SECRET":"<real value>"}'
   ```
   (These secret resources don't exist yet the very first time — they're created by the compute stack in step 7 below, with `CHANGE_ME` placeholders. Run this step after step 7's first deploy, then force a new ECS deployment on each service so the tasks pick up the real values.)

7. **Push to `main` (or run "Deploy Sandbox" manually via workflow dispatch)** — this is the first real end-to-end run: builds all three images, pushes to the now-existing ECR repos, deploys the compute stack, waits for ECS stability, verifies all three ALB endpoints.

8. **After step 7's first run, go back and do step 6**, then force a new deployment on each service (`aws ecs update-service --cluster htc-sandbox --service htc-sandbox-<app> --force-new-deployment`) so the real secret values actually get read.

9. **Still outstanding regardless of any of the above**, carried over unchanged from the prior implementation report: a production Supabase project needs to exist, and a `CertificateArn`/domain decision is needed before real HTTPS traffic (plain HTTP + `curl -H "Host: ..."` against the ALB's own DNS name works for steps 7-8's verification with no DNS or cert required).

No live/production cutover is proposed or implied anywhere in this report — only Sandbox exists in this pipeline.
