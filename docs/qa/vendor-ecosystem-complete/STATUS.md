# Complete Vendor Ecosystem — STATUS

**Verdict: GREEN** for the in-scope three-party vendor ecosystem on Sandbox.

Production untouched. Unrelated dirty tree preserved. No product code changes required in this pass — existing architecture verified end-to-end against the current serving build.

## Serving runtime

| Item | Value |
| --- | --- |
| Serving `dpl=` | `3dbc2a45fbcc0fd9fa430884a3c9cc82d46d52d0` |
| Includes selection fix | ancestor `0cbc2df7` |
| Prior selection deploy | [39851502751](https://github.com/jlcormier612/wevenu-website/actions/runs/39851502751) (historical) |
| Floor-plan deploy still serving | [39853989296](https://github.com/jlcormier612/wevenu-website/actions/runs/39853989296) |

## Browser / RPC proof

```text
EXPECTED_SHA=3dbc2a45… npx tsx scripts/qa/vendor-ecosystem-complete.mts
→ GREEN passed=28 failed=0

EXPECTED_SHA=3dbc2a45… npx tsx scripts/qa/vendor-client-venue-workflow.mts
→ GREEN passed=17 failed=0  (selection regression)
```

## Unit regression

```text
npx tsx --test lib/vendors/required-vendors.test.ts \
  lib/portal/vendor-pick-availability-gate.test.ts \
  lib/vendors/directory-vs-assignment.test.ts \
  lib/vendors/vendor-workflow-clarity.test.ts
→ 30/30 pass
```

## Evidence files

- `browser-results.json` / `browser-run.log`
- `a-venue-vendors-1280.png` · `b-invite-accept-1280.png` · `c-vendor-profile-1280.png` · `g-client-vendors-1280.png`
- Capability matrix: `CAPABILITY-MATRIX.md`
- Lifecycle map: `LIFECYCLE.md`
