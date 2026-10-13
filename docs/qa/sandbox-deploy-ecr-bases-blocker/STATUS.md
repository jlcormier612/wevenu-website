# Sandbox deploy ECR bases IAM remediation

**Status: GREEN**

## Stack / IAM

| Item | Value |
|------|--------|
| Stack | `htc-github-oidc` |
| Status | `UPDATE_COMPLETE` (2026-10-13T22:29:52Z) |
| Role | `htc-sandbox-github-actions-deploy` |
| Policy | `HtcSandboxDeploy` Sid `EcrCiBasesMirror` |
| Resource | `arn:aws:ecr:us-east-1:405254329873:repository/htc-ci-bases` **only** |
| Template commit | `ffbe34c7` |

Actions: `BatchGetImage`, `GetDownloadUrlForLayer`, `BatchCheckLayerAvailability`, `InitiateLayerUpload`, `UploadLayerPart`, `CompleteLayerUpload`, `PutImage`

Live policy verified after apply. No `ecr:*`, no Production, app-repo statement unchanged.

## Deploy proof (private mirror works)

Run [38478298669](https://github.com/jlcormier612/wevenu-website/actions/runs/38478298669) **success** on `ffbe34c7`.

All four matrix jobs logged `Using private ECR base node-22-alpine` and `alpine-3.20` — **zero** `toomanyrequests`.

Serving: `htc-sandbox-venue-app:ffbe34c7f1475f18f9f3fc66b757ec5e8e109ab3` (PRIMARY COMPLETED).

Production untouched.
