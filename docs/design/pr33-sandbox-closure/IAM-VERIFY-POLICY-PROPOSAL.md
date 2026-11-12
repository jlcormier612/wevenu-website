# PR #33 — Sandbox deploy Wait&verify IAM proposal

**Status:** PROPOSED — **do not apply until approved**  
**Date:** 2026-11-12  
**Role:** `htc-sandbox-github-actions-deploy` (OIDC → GitHub Environment `sandbox` only)  
**Failed run:** [43151830145](https://github.com/jlcormier612/wevenu-website/actions/runs/43151830145) · job Wait & verify · step “Record and verify venue-app image SHA + digest”

## Root cause

Live inline policy `HtcSandboxDeploy` grants ECS read as:

- `ecs:DescribeServices`
- `ecs:DescribeTasks`
- `ecs:ListTasks`

scoped to the `htc-sandbox` cluster/service/task ARNs.

It does **not** grant `ecs:DescribeTaskDefinition`.

The verify step added for PR #30 identity checks calls:

```bash
aws ecs describe-task-definition --task-definition "$svc_td"
```

That fails with:

`AccessDeniedException` … `ecs:DescribeTaskDefinition` … no identity-based policy allows the action.

Email-mode verification earlier in the same job **succeeded** without `DescribeTaskDefinition` (uses CloudFormation + `DescribeServices`).

Application deploy / ECS rollout for `cb06cf16` **succeeded**; this is verification-only.

## Secondary gap (will fail next if only the first is fixed)

The same step then calls:

```bash
aws ecr describe-images --repository-name htc-sandbox-venue-app --image-ids imageTag="$EXPECTED_SHA"
```

Live policy has ECR push/`BatchGetImage` on sandbox repos but **not** `ecr:DescribeImages`. Expect AccessDenied on the next line after TaskDefinition is fixed.

`ecs:DescribeTaskDefinition` does not support resource-level permissions → `Resource: "*"`.

## Exact policy diff (narrowest)

Update **both**:

1. Live IAM role inline policy `HtcSandboxDeploy` (what GHA actually uses today).
2. Template `infra/htc-github-oidc.json` → `GithubActionsSandboxDeployRole` / `EcsReadOnlyForVerification` (+ ECR verify) so the next stack refresh does not regress.

### A. Add to `EcsReadOnlyForVerification` (or sibling Sid)

```json
{
  "Sid": "EcsDescribeTaskDefinitionForVerification",
  "Effect": "Allow",
  "Action": ["ecs:DescribeTaskDefinition"],
  "Resource": "*"
}
```

Rationale: AWS IAM requires `*` for this action; trust remains Environment-scoped OIDC.

### B. Add ECR digest read (Sandbox venue-app repo only)

```json
{
  "Sid": "EcrDescribeImagesForVerification",
  "Effect": "Allow",
  "Action": ["ecr:DescribeImages"],
  "Resource": "arn:aws:ecr:us-east-1:405254329873:repository/htc-sandbox-venue-app"
}
```

Optional: also allow the other three sandbox repos if marketing/workspace digest checks are added later — **not required for the current venue-app step**.

## Out of scope / not changing

- Production IAM roles
- Role trust policy (`repo:…:environment:sandbox`)
- Application task roles
- New deploy roles
- Redeploying venue-app merely to re-verify

## After approval — how to complete skipped checks without redeploy

1. Apply the policy statements above to `htc-sandbox-github-actions-deploy`.
2. Re-run **failed jobs only** on workflow `43151830145` (`gh run rerun 43151830145 --failed`) **or** add a verify-only `workflow_dispatch` later.
3. Confirm step summary prints `DEPLOY_IDENTITY sha=cb06cf16…`.
4. Confirm ALB + `/api/health` + secrets placeholder checks complete (they were skipped after the first failure).

Manual evidence already gathered (operator machine): ECS `:1173`, digest `sha256:25d7d388…`, serving `dpl=cb06cf16…`.
