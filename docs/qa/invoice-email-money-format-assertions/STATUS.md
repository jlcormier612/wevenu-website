# Invoice email money-format assertions — STATUS

**Environment:** local test correction (no Sandbox deploy)  
**Production:** untouched  
**Status:** GREEN (Case A — stale assertions)

## Verdict

The two failures in `invoice-payment-plan-customer-journey.test.ts` were **stale expectations**, not an application regression.

| Field | Value |
|---|---|
| Actual email body | `Initial Payment: $8,000` |
| Stale expectation | `$8,000.00` |
| Approved convention | `lib/money/format.ts` → `formatMoneyDisplay` (whole dollars omit `.00`) |
| Intentional change | `b6bd64e2` (unify phone/money display) |
| Sibling suite already updated | `payment-workflow-regression.test.ts` in `462e5a9e` → `\$2,500(?:\.00)?` |

## Correction

Test-only: align the two HTML/text `Initial Payment` assertions (and the related Pay-now absence check) with the same optional-decimals pattern already used by the protected payment-workflow regression suite.

No application code, financial calculations, email-send semantics, or closed workstreams were changed.

## Verification

- Two previously failing tests: PASS
- Full `invoice-payment-plan-customer-journey.test.ts`: 9/9 PASS
- `payment-workflow-regression.test.ts`: 25/25 PASS
- `lib/money/format.test.ts`: 4/4 PASS
- `lib/payments/adjust-remaining-plan.test.ts`: 4/4 PASS
- Deploy: not required (test-only)
