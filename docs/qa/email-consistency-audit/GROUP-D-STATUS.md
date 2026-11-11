# Email consistency — Group D (closeout `$500.00` test)

**Status: GREEN / CLOSED**

| Field | Value |
|-------|--------|
| Item | Stale `$500.00` assertion in `customer-facing-branding.closeout.test.ts` |
| Root cause | Test expected `Pay $500.00`; product renders `Pay $500` via `formatMoneyDisplay` / `formatCurrency` (whole dollars omit `.00`) |
| Classification | **Stale fixture/expectation** — not a financial defect |
| Evidence | Live render in failing assertion showed `Pay $500` and `Deposit: $500`; same convention as `invoice-email-money-format-assertions` Case A and `lib/money/format.test.ts` |
| Correction | Assertion → `/Pay \$500(?:\.00)?/` (+ deposit line) — **test-only** |
| App/financial logic | Unchanged |
| Deploy | Not required for Group D alone |

## Verification

- `lib/email/customer-facing-branding.closeout.test.ts` PASS
- `lib/money/format.test.ts` already encodes whole-dollar omission
