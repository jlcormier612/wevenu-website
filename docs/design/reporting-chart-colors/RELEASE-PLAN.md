# Controlled Sandbox release plan — Reporting chart colors

**Do not merge or deploy until explicitly approved.**

## Git state (verified)

| Item | Value |
| --- | --- |
| Merge base | `origin/main` @ `cb06cf1660f2fe7339217b4cd2ae942acef33800` |
| Feature tip | `fix/reporting-chart-colors-scalability` @ `098a9232` (+ acceptance commits) |
| PR #34 / C1 | **Not included** — keep separate |
| Current serving Sandbox | `cb06cf16…` (PR #33) |

## Files / scope (feature commit)

- `lib/reporting/composition-display.ts` (+ tests)
- `components/reporting/source-composition-chart.tsx`
- `components/reporting/source-composition-colors.test.ts`
- `docs/design/reporting-chart-colors/*` (report + screenshots)

No Stripe, migrations, permissions, or aggregation changes.

## Sequence (after approval)

1. Open/refresh PR from `fix/reporting-chart-colors-scalability` → `main` (this branch only).  
2. Require CI: Production-style venue-app build; Hospitality source guards; Screenshot vs approved baseline compare.  
   - If screenshot compare fails solely on reporting doughnut colors, **do not auto-overwrite** — request baseline authorization for reporting-overview only.  
3. Merge to `main` → note merge SHA `M`.  
4. Deploy Sandbox **from `main` only** (workflow deploy-sandbox).  
5. Identity verification:  
   - Prefer GHA Wait&verify after IAM `DescribeTaskDefinition` + `DescribeImages` fix.  
   - If verify job still IAM-fails, gather **independent** evidence: ECS task def image tag == `M`, ECR digest, serving `dpl=M`. Do **not** call the workflow GREEN without that evidence.  
6. Live Reporting acceptance on Sandbox: Lead Sources + Bookings/Sales charts; Website≠Instagram; expand Other; period switch; Saved Reports nav smoke.  
7. Optional: authorize reporting-overview baseline refresh from live capture.  
8. Stop. Do **not** merge #34 or C1 in this release.

## Rollback

Revert the chart-colors merge commit on `main` and redeploy Sandbox to prior known-good `cb06cf16` (or the pre-merge tip). Presentation-only rollback — no data migration.

## Approvals required

1. Merge this PR to `main`.  
2. Sandbox deploy of resulting `main`.  
3. (Optional) Reporting overview baseline promotion if CI pixel compare requires it.  
4. IAM Wait&verify policy (from PR #33 closure) — recommended before relying on GHA verify alone.
