# Facebook Lead Ads scheduled sync/reconciliation — restoration plan

**Status:** Prepared for review. **Do not deploy** during active sandbox product testing on `origin/main` / `5b246b4`.

## Background

Commit `82f83fd` removed six CloudFormation resources that scheduled:

| Rule | Schedule | Endpoint |
|------|----------|----------|
| `FacebookLeadSyncRule` | `rate(2 minutes)` | `GET /api/facebook/sync/process` |
| `FacebookLeadReconcileRule` | `rate(1 hour)` | `GET /api/facebook/reconcile/process` |

Both authenticate with `Authorization: Bearer ${CronSecret}` (same value as the venue-app `CRON_SECRET` env var).

**Why removed:** Two deploy attempts failed creating `FacebookLeadCronRole` and `FacebookLeadCronConnection`, putting `htc-sandbox` into `UPDATE_ROLLBACK_FAILED`. Webhook `after()` processing remains the fast path; the cron is a **backstop** for missed webhooks and queue retries.

## Root cause of prior failure

1. **`iam:GetRolePolicy` missing** on `htc-sandbox-cfn-execution` — CloudFormation could `PutRolePolicy` on `FacebookLeadCronRole` but could not read existing inline policies during update (classic CFN IAM drift check failure).
2. **EventBridge Connection API** — `AWS::Events::Connection` creation failed on a separate service exception (likely missing `events:CreateConnection` / related permissions on the CFN execution role, or a transient API error — permissions were not fully scoped before removal).
3. **`iam:PassRole` to `events.amazonaws.com`** — not explicitly granted for `htc-sandbox-*` roles; required for EventBridge Rules targeting ApiDestinations.

## Hardened implementation (branch `infra/facebook-lead-cron-restore`)

### Template (`infra/htc-ecs-stack.json`)

- Restores all six `FacebookLead*` resources behind existing `HasCronSecret` condition (`CronSecret` parameter non-empty).
- **No change** to Facebook credentials secret management (still external to CFN).
- **No change** to `CronSecret` parameter semantics.

### IAM (`infra/htc-github-oidc.json`)

Adds to `htc-sandbox-cfn-execution`:

- `iam:GetRolePolicy`, `iam:ListRolePolicies` on `htc-sandbox-*` roles
- `iam:PassRole` → `events.amazonaws.com` for `htc-sandbox-*` roles
- EventBridge connection / api-destination / rule management on `htc-sandbox-*` ARNs

**Deploy order:** Update OIDC/IAM stack **first**, then ECS stack (CFN execution role must have permissions before ECS stack creates EventBridge resources).

## Preflight checks (mandatory before deploy window)

Run in order; **abort** if any check fails.

1. **Stack health**
   ```bash
   aws cloudformation describe-stacks --stack-name htc-sandbox \
     --query 'Stacks[0].StackStatus' --output text
   ```
   Must be `UPDATE_COMPLETE` (not `UPDATE_ROLLBACK_*`).

2. **CronSecret populated**
   ```bash
   aws cloudformation describe-stacks --stack-name htc-sandbox \
     --query 'Stacks[0].Parameters[?ParameterKey==`CronSecret`].ParameterValue' --output text
   ```
   Must be non-empty. If empty, EventBridge resources are skipped (`HasCronSecret=false`) — no harm, but cron will not exist.

3. **Manual HTTP probe (app already running)**
   ```bash
   curl -sS -o /dev/null -w '%{http_code}\n' \
     -H "Authorization: Bearer $CRON_SECRET" \
     "https://app.sandbox.hellotocheers.com/api/facebook/sync/process"
   ```
   Expect `200` with JSON body (not `401` / `307` to login).

4. **CFN execution role permissions** (after OIDC stack update)
   ```bash
   aws iam simulate-principal-policy \
     --policy-source-arn arn:aws:iam::405254329873:role/htc-sandbox-cfn-execution \
     --action-names events:CreateConnection iam:GetRolePolicy iam:PassRole \
     --resource-arns '*'
   ```

5. **Change-set review**
   - Confirm **Add** only for `FacebookLead*` resources (six resources).
   - Confirm **no Remove** on HTTPS listener, `FacebookSecrets`, or certificate-related resources.
   - Confirm **no Modify** on `StripeConnectSecrets` / `QuickBooksSecrets` `SecretString` (credential wipe risk).

## Deployment steps (intentional infra window only)

1. Merge `infra/facebook-lead-cron-restore` to `main` (after review — not during Jennifer's test pass unless explicitly scheduled).
2. Deploy **OIDC/IAM** template update (`infra/htc-github-oidc.json`) manually or via documented bootstrap command.
3. Run `deploy-sandbox.yml` (or manual CFN change set) for `htc-sandbox`.
4. **Post-deploy verification**
   ```bash
   aws events list-rules --name-prefix htc-sandbox-facebook-lead --query 'Rules[].{Name:Name,State:State}' --output table
   aws events list-api-destinations --name-prefix htc-sandbox-facebook --output table
   ```
5. Wait 2–3 minutes; confirm app logs show `[cron] facebook lead queue processed` or reconcile output.
6. Optionally inject a test queue item and confirm cron processes it without manual `POST`.

## Rollback / failure handling

| Failure | Action |
|---------|--------|
| ECS stack update fails on `FacebookLead*` only | `continue-update-rollback --resources-to-skip FacebookLeadCronRole FacebookLeadCronConnection FacebookLeadSyncApiDestination FacebookLeadReconcileApiDestination FacebookLeadSyncRule FacebookLeadReconcileRule` — same pattern used for `FacebookSecrets` recovery |
| Stack stuck `UPDATE_ROLLBACK_FAILED` | Skip all six FacebookLead resources; restore stack to `UPDATE_COMPLETE`; investigate IAM in isolation |
| Rules created but 401 from app | Verify `CronSecret` stack parameter matches venue-app `CRON_SECRET` env; verify ApiDestination Connection bearer header |
| Rules created but 307 to login | Proxy allowlist regression — confirm `/api/facebook/sync/process` and `/api/facebook/reconcile/process` remain public in `integrations/supabase/proxy.ts` |

**Never** combine this deploy with product feature merges or secret `SecretString` template changes.

## What stays unchanged on sandbox during this work

- No deploy from this branch until approved.
- Webhook fast path continues to work without cron.
- Manual sync remains available: `POST /api/facebook/sync/process` with `x-facebook-sync-secret`.
