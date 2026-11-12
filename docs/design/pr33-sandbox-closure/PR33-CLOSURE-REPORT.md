# PR #33 Sandbox closure report

**Date:** 2026-11-12  
**Serving SHA:** `cb06cf1660f2fe7339217b4cd2ae942acef33800`  
**ECS:** `htc-sandbox-venue-app:1173` · digest `sha256:25d7d3888bcb1440d98188ef78e7613704f2276a4242cddb760cd19ad5eb38cc`  
**Deploy run:** [43151830145](https://github.com/jlcormier612/wevenu-website/actions/runs/43151830145)

## Deployment workflow root cause

Wait & verify failed only on **Record and verify venue-app image SHA + digest**.

Live role `htc-sandbox-github-actions-deploy` / policy `HtcSandboxDeploy` lacks:

1. `ecs:DescribeTaskDefinition` (immediate failure — confirmed AccessDenied)
2. Likely also `ecr:DescribeImages` on `htc-sandbox-venue-app` (next line after #1)

Email-mode verification earlier in the job **passed**. App deploy + ECS rollout **passed**.

**Proposed IAM correction:** see `IAM-VERIFY-POLICY-PROPOSAL.md` — **not applied** (awaiting approval).

## Completed verification checks (manual / product)

| Check | Result |
| --- | --- |
| ECS service stable / rollout COMPLETED | PASS |
| Task definition `:1173` | PASS |
| Image tag == `cb06cf16…` | PASS |
| Image digest `sha256:25d7d388…` | PASS |
| Serving `dpl=` | PASS |
| Product acceptance harness 8/8 | PASS |
| Floor Plan toggles / races / abort rollback | PASS |
| Reporting Period net math | PASS |

## Skipped / incomplete GHA verification (blocked on IAM)

Until the proposed policy is applied and Wait&verify is re-run:

- GHA DEPLOY_IDENTITY summary line
- GHA ALB Host checks (venue/marketing/workspace + `/api/health`)
- GHA Secrets Manager CHANGE_ME scan

**Do not mark the deployment workflow fully GREEN** while these remain unexecuted in CI.

## Reporting visual baselines

| Asset | SHA16 | Notes |
| --- | --- | --- |
| Approved `reporting-overview__desktop` | `20ef9baea2109b11` | Matches `current/` capture from last-compare |
| Post-#33 acceptance `pr33-sandbox/reporting-desktop.png` | `c3c6efd247cc43e3` | **Different** — intentional Period net / doughnut / cohort UI on serving tip |
| `last-compare.json` | all ok | Compared approved ↔ current (same bytes) — **not** a fresh live Sandbox re-capture after #33 |

**Recommendation:** Authorize a **targeted** baseline refresh for reporting-overview (desktop+mobile) from live Sandbox `cb06cf16`, after confirming UI correctness. Do **not** regenerate the full hospitality set blindly.

## Claire fixture cleanup

| Item | Finding |
| --- | --- |
| UUID `52173016-…` | **Absent** in Sandbox DB (`null`); harness paths 404 |
| Replacement lead workspace | Ellie St. James `f66059c9-5d2b-4a58-92df-567ff3ed924b` |
| Proposal-start fixture | Avery Blake Final `24b2d6d7-c2df-40ae-8bd4-dacd670649a1` (`proposal_sent` + `commercial_proposals.status=sent`) |

Updated `docs/qa/launch-performance/measure-sandbox-performance.mts` on branch `fix/pr33-closure-fixtures` (this harness was not previously on `main`). Historical Phase-2 docs that reference Claire remain archival; not rewritten as live fixtures.

## Final PR #33 Sandbox verdict

**YELLOW** — product acceptance GREEN; process verification YELLOW pending IAM approval + CI Wait&verify completion; reporting baseline refresh authorization pending; Claire harness fixed on closure branch (not yet on main until this branch merges).

### Approvals required before closing YELLOW items

1. Apply IAM policy proposal (DescribeTaskDefinition + DescribeImages).  
2. Re-run failed Wait&verify (no app redeploy).  
3. Authorize reporting-overview baseline promotion from live Sandbox.  
4. Merge `fix/pr33-closure-fixtures` (docs + harness) when ready.
