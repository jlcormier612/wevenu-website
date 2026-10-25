# Five financial harness failures — root cause

**Fixture:** Fancy event `ebf74f77-…` · EO `624eceef-5096-4288-b104-62daa3a82d11` · Invoice `INV-2026-4489C8` (`4489c869-…`)

## The five assertions (all same mismatch chain)

| # | Assertion | Expected | Actual |
|---|-----------|----------|--------|
| 1 | `payment-plan-reconciles-to-expected-payable` | schedule = EO payable **$2351.31** | schedule **$2266.31** |
| 2 | `invoice-frozen-eo-line-count` | frozen EO lines = billable count **11** | frozen **10** |
| 3 | `invoice-total-matches-expected-payable` | invoice total **$2351.31** | stored **$2266.31** |
| 4 | `portal-shows-expected-payable` | portal shows **$2,351.31** | shows **$2,266.31** |
| 5 | `portal-rpc-total-matches-payable` | RPC total **$2351.31** | **$2266.31** |

Passing sibling checks correctly computed live EO payable as **$2351.31** (billable $2218 + tax $133.31) and confirmed invoice status `sent` at freeze revision **17**.

## Proven cause (not hypothesis)

1. **Legacy EO dinner lines** (Oct 22): billable `Plated Dinner` `f05489a7-…` ($85) and `Buffet Dinner` ($72) remained from older package/flat apply — both `provenance: custom`.
2. **Choices finalize** (Oct 25 harness): applied a **second** `Plated Dinner` `4ae601f1-…` ($85). `applied_line_ids` only tracks packet lines, so the legacy Plated/Buffet were not removed.
3. **Delta = exactly $85** = the new plated line not on the frozen invoice. Invoice freeze revision **17**; EO revision **21**.
4. **Product contract:** sent invoices are immutable snapshots. Harness skipped publish when status was already `sent`, then compared **live EO** to **frozen invoice** — wrong lifecycle comparison, not a portal bug.
5. **Not guest-count math:** plated unit price $85 × qty 1; tax unchanged at $133.31 on both sides.

See `persisted-financial-baseline.json`.

## Corrections

| Layer | Change |
|-------|--------|
| Product | Finalize clears EO lines matching **answered single-select** group option labels before adding selections (no Plated+Buffet / duplicate Plated). |
| Product | Revert-to-draft and freeze-on-send sync payment plan to commitment total. |
| Harness | When EO revision > invoice freeze revision, use **Update Draft Invoice** then **Mark as issued** (Send gated after first email). |

Template included/choice-group semantics unchanged. Historical invoice rows not silently rewritten except via explicit reopen→freeze.
