# STATUS — Guided Event Order Template setup

**Verdict: IN PROGRESS — code landed; Sandbox deploy queued**

| Item | Value |
|------|-------|
| Commit | `20a5d08c` (full: see `git rev-parse`) |
| Deploy | https://github.com/jlcormier612/wevenu-website/actions/runs/40245915864 (`queued` at dispatch) |
| Production | Untouched |

## Done locally

- Guided wizard UI + helpers
- Offering preferred filter no longer silent-all
- Unit suites green (guided-setup, section-workspace, builder-ux, choice-tree samples)

## Remaining for GREEN

1. Deploy `20a5d08c` to Sandbox succeeds; live `dpl=` matches.
2. `EXPECTED_SHA=20a5d08c… npx tsx docs/qa/event-order-template-guided-setup/verify-guided-setup.mts` GREEN.
3. Re-run conditional choices + financial fixture on tip.
4. Fill PERSISTED-STATE-VERIFICATION + FINANCIAL-RECONCILIATION + matrix PASS rows.

## Intentional limitations

- Soft-disable without delete is not a separate DB flag — deselection with content requires confirm + remove.
- Starter empty dependents remain until the venue fills or removes them in the branch step.
- Advanced editor remains available for edge cases.
