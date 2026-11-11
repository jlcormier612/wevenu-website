# Contract balance deposit-not-paid — STATUS

**Environment:** Sandbox only  
**Overall:** IN PROGRESS (fix committed next; deploy + browser pending)

## Root cause

`buildContractMergeData` set `balance_remaining` via `remainingAmount(total, depositAmount)`, treating the configured 25% initial payment as already received. For $35,000 / $8,750 deposit with no payments, the document showed Balance remaining $26,250.

## Fix

- `contractDocumentBalanceRemaining({ contractedTotal, paymentsReceived })`
- Selection path: `paymentsReceived: 0` (deposit ignored)
- Schedule path: `paymentsReceived: computePortalScheduleTotals(...).paid`
- Portal totals also count `partially_paid` (aligned with invoice net paid)

## Deploy / tip

| Item | Value |
|---|---|
| Tip | _pending_ |
| Deploy | _pending_ |
