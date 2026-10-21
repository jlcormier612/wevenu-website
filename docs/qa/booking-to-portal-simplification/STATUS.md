# Booking-to-portal simplification

## Status

**IN PROGRESS** — code committed and Sandbox deploy dispatched; browser/DB acceptance pending serving SHA.

## Commit

- `b1c1f189e8fa4f2cc2990be0232ab1af103b450b` — Simplify booked-client setup to preset on book and one prepare/release.

## Deploy

- Workflow: Deploy Sandbox
- Run: https://github.com/jlcormier612/wevenu-website/actions/runs/39640243061
- Ref: `feat/spaces-booking-e1-smart-fields` @ `b1c1f189`

## Acceptance harness

```bash
EXPECTED_SHA=b1c1f189e8fa4f2cc2990be0232ab1af103b450b \
  npx tsx --env-file=.env.local scripts/qa/booking-to-portal-simplification-acceptance.mts
```

Evidence directory: `docs/qa/booking-to-portal-simplification/`
