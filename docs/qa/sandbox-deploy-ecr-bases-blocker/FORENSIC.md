# Sandbox deploy blocker — `htc-ci-bases` IAM gap + Public ECR rate limit

**Generated:** 2026-10-13  
**Mode:** Read-only diagnosis. No IAM/infra applied. No deploy retry of the same failing path.  
**Production:** untouched.

## Runs

| Run | Commit | Marketing | Venue-app | Stack deploy |
|-----|--------|-----------|-----------|--------------|
| [38475580540](https://github.com/jlcormier612/wevenu-website/actions/runs/38475580540) | `d5e36593` (comms copy) | fail prefetch | cancelled | skipped |
| [38476334133](https://github.com/jlcormier612/wevenu-website/actions/runs/38476334133) | `841b2706` (availability copy) | fail prefetch | **success** | skipped |

No overlapping deploy currently required for diagnosis.

## Root cause (verified)

Prefetch step in `.github/workflows/deploy-sandbox.yml` (“Prefetch base images”):

1. Prefer private mirror `405254329873.dkr.ecr.us-east-1.amazonaws.com/htc-ci-bases:{node-22-alpine,alpine-3.20}`
2. Else pull `public.ecr.aws/docker/library/...` with backoff
3. Optionally push back into `htc-ci-bases` (`|| true`)

**Private path fails first for an IAM reason, not a missing image:**

| Check | Result |
|-------|--------|
| Repo `htc-ci-bases` exists | Yes (created 2026-10-12; not in `htc-ecr-repos.json`) |
| Tags `node-22-alpine`, `alpine-3.20` present | Yes (image readable with human AWS creds) |
| Live role `htc-sandbox-github-actions-deploy` policy `HtcSandboxDeploy` | `EcrPushScoped` only on `htc-sandbox-{venue-app,marketing,workspace,scheduler}` |
| Template `infra/htc-github-oidc.json` | Same — **no** `htc-ci-bases` resource ARN |
| Observed error | `not authorized to perform: ecr:BatchGetImage on resource: .../repository/htc-ci-bases` |

**Public path then fails under rate limit:**

`toomanyrequests: Data limit exceeded` on `public.ecr.aws/docker/library/node:22-alpine` (5 attempts). Matrix jobs race the same quota — some apps can succeed while marketing fails (seen on `38476334133`).

**Why retries alone will not clear this:** private pull remains denied; public ECR remains quota-limited; mirror refresh push also cannot succeed (`PutImage` not granted on `htc-ci-bases`; ignored via `|| true`).

## Narrowest durable remediation (requires authorization)

**Infrastructure / IAM change — do not apply until approved.**

Update `infra/htc-github-oidc.json` deploy-role policy to add a **narrow** statement for the existing CI base mirror only:

```json
{
  "Sid": "EcrCiBasesMirror",
  "Effect": "Allow",
  "Action": [
    "ecr:BatchGetImage",
    "ecr:GetDownloadUrlForLayer",
    "ecr:BatchCheckLayerAvailability",
    "ecr:InitiateLayerUpload",
    "ecr:UploadLayerPart",
    "ecr:CompleteLayerUpload",
    "ecr:PutImage"
  ],
  "Resource": {
    "Fn::Sub": "arn:aws:ecr:${AWS::Region}:${AWS::AccountId}:repository/htc-ci-bases"
  }
}
```

- Pull actions: make the already-seeded tags usable (avoids Public ECR).
- Push actions: allow the workflow’s existing “refresh mirror” path after a rare Public ECR success.
- Scope: **only** `repository/htc-ci-bases` — not Production, not broader `ecr:*`, not other repos.

Apply by updating the **already-deployed** OIDC/bootstrap stack that owns role `htc-sandbox-github-actions-deploy` (manual / authorized CloudFormation update of `htc-github-oidc` — same class as original bootstrap; GitHub Actions cannot self-expand this role).

**Optional follow-up (not required to unblock):** add `htc-ci-bases` to `infra/htc-ecr-repos.json` so the mirror repo is IaC-owned. Images already exist; this is bookkeeping.

**Not proposed:** broadening to `Resource: *`, Docker Hub tokens, Production changes, or repeated workflow_dispatch without the IAM fix.

## After IAM is applied

1. Confirm no active Deploy Sandbox run.
2. Single deploy of tip containing `841b2706` (+ later tip if only docs).
3. Verify serving image SHA.
4. Browser-verify Availability (“simple venue” gone) and Communication Readiness (channel-specific tests + Opened/Clicked definitions).

## Confirmation this pass

No IAM/infra applied. No Production access. No overlapping deploy started. Unrelated working tree preserved.
