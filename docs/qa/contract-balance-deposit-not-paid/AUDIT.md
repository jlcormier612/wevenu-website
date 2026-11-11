# Audit — Contract balance treats configured deposit as paid

**Date:** 2026-10-12  
**Environment:** Sandbox

## Symptom

Contract document at send stage:

| Field | Shown | Correct (no payments) |
|---|---|---|
| Total contracted amount | $35,000 | $35,000 |
| Balance remaining | $26,250 | $35,000 |
| Recorded payments | none | none |

Difference = $8,750 = 25% of $35,000 = default `suggestDepositAmount` / selection `depositAmount`.

## Root cause

`buildContractMergeData` in `lib/contracts/service.ts` seeded `balance_remaining` with:

```ts
remainingAmount(selection.totalAmount, selection.depositAmount ?? 0)
```

That subtracts the **configured** deposit (payment-plan allocation) as if it were money received. Package section language ("Remaining after deposit") is allocation copy and is distinct; the merge field `balance_remaining` must use actual qualifying collections.

## Fix

Authoritative helper `contractDocumentBalanceRemaining({ contractedTotal, paymentsReceived })`.

- No schedule / no payments → balance = contracted total.
- Schedule present → balance = contracted total − `computePortalScheduleTotals(...).paid`.
- Never subtract unpaid `depositAmount`.
