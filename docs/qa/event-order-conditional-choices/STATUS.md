# Event Order conditional choices — STATUS

**Verdict: NOT GREEN** until Sandbox migration + deploy + browser harness pass on the serving image.

## Implementation (local)

| Area | State |
|------|-------|
| Schema `depends_on_option_ids` + RPC | Migration `20261423300000_event_order_conditional_choice_groups.sql` |
| TS model / freeze / validate / apply / reconcile | Done |
| Portal + definition view nesting | Done |
| Starters EO-D-01 / EO-D-02 empty dependents | Done |
| Additive `ensureConditionalChoiceScaffolding` | Done |
| Unit tests | `conditional-groups.test.ts` + starter/validate extensions — **48/48 pass** locally |
| Financial harness (prior workstream) | **GREEN** 61/61 on `b2377f57` — separate from conditional |

## Serving (pending this change)

| Field | Value |
|-------|-------|
| Pre-change serving | `b2377f578c48be0c226d5323c8a635cdd10c59b1` / `sha256:8902cc94…` |
| Conditional commit | _(pending commit + deploy)_ |
| Migration applied | Pending `apply-sandbox-migration.yml` |
| Browser harness | Pending `verify-browser.mts` |

## Financial closure (already evidenced)

See `docs/qa/event-order-financial-harness-reconcile/STATUS.md` — four closure checks GREEN; payable `$2189.81`; one Plated; Production untouched.

## Remaining for GREEN

1. Commit scoped conditional-choice changes.
2. Apply migration `20261423300000_event_order_conditional_choice_groups.sql` to Sandbox.
3. Deploy Sandbox; verify serving SHA/digest.
4. Run `docs/qa/event-order-conditional-choices/verify-browser.mts`.
5. Re-run default-template harness (21/21) and full EO (61/61) regression on the new image.
6. Save browser-results, shots, persisted-state; flip this STATUS to GREEN only when all pass.

Production remains untouched.
