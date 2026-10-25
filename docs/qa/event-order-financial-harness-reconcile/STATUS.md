# Event Order financial harness reconcile — STATUS

**Verdict: NOT GREEN** — code committed and Sandbox deploy started; browser re-verify on serving image still required.

| Field | Value |
|-------|-------|
| Fix commit | `e8f621bfcd68cb6891f2ad09d13b3c1014fe473d` |
| Prior serving | `7c01e917` / `sha256:4f323e4d…0f6bc0` |
| Deploy run | https://github.com/jlcormier612/wevenu-website/actions/runs/40221984653 |
| Production | Untouched |
| Unrelated dirty tree | Preserved |

## Root cause (proven)

All five failures compare **live EO payable $2351.31** to **frozen invoice/plan $2266.31**. Delta **$85** = second `Plated Dinner` line from choices finalize atop legacy package dinner lines. Invoice freeze rev 17 vs EO rev 21. Published invoice correctly immutable; harness skipped republish when already `sent`.

## Changes

- `conflictingSingleSelectLineIds` + finalize cleanup for answered single-select groups
- Payment plan sync on invoice revert-to-draft and freeze-on-send
- Workflow harness: reopen drifted sent invoice via Update Draft Invoice → Mark as issued
- Unit tests: **33/33 PASS** (apply-to-event-order, p2b CTA, EO reconciliation, starter semantics)

## Remaining to declare GREEN

1. Wait for deploy `40221984653` COMPLETED.
2. Confirm ECS image tag `e8f621bf…` and digest.
3. `EXPECTED_SHA=e8f621bf… npx tsx docs/qa/event-order-default-template-correction/verify-browser.mts`
4. `EXPECTED_SHA=e8f621bf… npx tsx docs/qa/event-order-workflow-correction/verify-browser.mts` → **all checks PASS** (was 56/61).
5. Persist post-run EO dinner lines + invoice freeze evidence.
