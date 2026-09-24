# Simplify commercial booking settings — NOT FULLY GREEN

**Note (2026-09-23):** Custom payment plan was a missed requirement. Commercial-settings workstream must not remain GREEN until Custom is implemented and verified. See `docs/qa/custom-payment-plan-settings/STATUS.md`.

Prior simplify deploy remains useful ancestry but is **superseded** for the commercial-settings GREEN bar.

- Prior commit: `97c1027f0a8ce1bbe2a64ae4a44439486ea93746`
- Prior deploy: https://github.com/jlcormier612/wevenu-website/actions/runs/35938439148
- Production: untouched

## Unit tests (prior)
`npx tsx --test lib/booking-journey/*.test.ts lib/commercial-selections/*.test.ts` → 141 pass / 0 fail

## Verdict
**NOT GREEN** until Custom payment plan Settings + booking application pass on Sandbox runtime.
