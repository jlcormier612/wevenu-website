# HTC AWS infrastructure (CloudFormation)

Read-only plan → implemented as IaC source → deployment mechanism is GitHub Actions, not manual deploys from a workstation. See `docs/aws-cloudformation-ecs-deployment-plan.md`, `docs/aws-ecs-deployment-implementation.md`, `docs/github-actions-deployment-readiness-assessment.md`, and `docs/github-actions-deployment-implementation.md` for the full trail.

**Not yet deployed anywhere** — this environment has no AWS CLI and no AWS credentials configured, and never authenticates to AWS. `docs/github-actions-deployment-implementation.md` has the exact manual bootstrap steps needed from Jennifer before the first real GitHub Actions Sandbox deployment.

## Files, and the order they're deployed in

1. **`htc-github-oidc.json`** — the GitHub Actions OIDC provider + the Sandbox deploy role + the CloudFormation execution role. The one stack that can never be deployed by GitHub Actions itself (a workflow has no AWS credentials until this exists) — deployed manually, once, by Jennifer.
2. **`htc-ecr-repos.json`** — the 3 ECR repositories only. Long-lived on purpose, split out from the compute stack specifically so a failed compute-stack deploy can never take the repos (and the images in them) down with it. Deployed via `.github/workflows/deploy-foundation-sandbox.yml` (manual trigger, not on every push).
3. **`htc-ecs-stack.json`** — the application/compute stack: VPC, ECS cluster, 3 ECS services (venue app, marketing, workspace), ALB with host-based routing, security groups, IAM roles (task execution + task role, not the two OIDC-related roles above), CloudWatch log groups, Secrets Manager secret placeholders (names only — no values). Deployed on every push to `main` via `.github/workflows/deploy-sandbox.yml`. Same template covers a future production environment via `-EnvironmentName production`, not a separate file.

## Deliberately not in these templates

- The 9 EventBridge-scheduled cron jobs (`docs/aws-cloudformation-ecs-deployment-plan.md` §1/§5) — outside the first E2E critical path.
- Route 53 records — open question whether DNS is already there.
- Secret **values**, anywhere — `htc-ecs-stack.json` creates the Secrets Manager resources by name only; `htc-github-oidc.json`'s CloudFormation execution role can create/tag/delete those secret resources but has no `PutSecretValue`/`GetSecretValue` permission at all. Populating real values is always a manual step, never something a template or a workflow does.
- Any production GitHub Environment, workflow, or IAM role — only Sandbox exists anywhere in this pipeline so far.
- Any change to the already-approved, already-verified account-provisioning bridge itself.

## How this actually deploys, once bootstrapped

Nothing manual, after the one-time bootstrap in `docs/github-actions-deployment-implementation.md`: push to `main` triggers `.github/workflows/deploy-sandbox.yml`, which builds all three apps (SHA-tagged images — see the Dockerfiles at the repo root, `marketing/Dockerfile`, `workspace/Dockerfile`, all three built and smoke-tested locally, including two real pre-existing build blockers found and fixed along the way: a corrupt `patches/next-themes+0.4.6.patch` and a maintenance script with a hard dependency on `marketing/`'s local `node_modules` — see `docs/aws-ecs-deployment-implementation.md`), pushes them to ECR, deploys the compute stack via CloudFormation, waits for the three ECS services to stabilize, and verifies all three apps respond correctly through the ALB before declaring success.
