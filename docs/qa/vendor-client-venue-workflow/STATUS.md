# Client ↔ Vendor ↔ Venue Workflow — STATUS

**Verdict: GREEN** for count integrity, private pick when availability is unconfirmed, claimed-vendor inquiry persistence, submit → assignment (idempotent), and venue visibility of submitted selections.

Production untouched. Unrelated dirty tree preserved.

## Serving product

| Item | Value |
| --- | --- |
| Original product SHA | `0cbc2df7b5cd1f9cd3375e9eb23ccfa42ff59393` |
| Original deploy | [39851502751](https://github.com/jlcormier612/wevenu-website/actions/runs/39851502751) success |
| Re-verified serving `dpl=` (2026-10-22) | `3dbc2a45fbcc0fd9fa430884a3c9cc82d46d52d0` (includes `0cbc2df7`) |

## Root causes fixed

1. **Tab counts (4 vs 3 cards):** Tab labels used `recommendations.length` / `directory.length` including required vendors, while cards rendered `filter(!isRequired)`. Cuppity was the “fourth” — correctly in Required section. Counts now use optional lists only.
2. **Could not pick when “Availability not confirmed”:** UI hid Pick/Select for `not_confirmed` (default when vendor has no calendar history). Server never blocked. Pick allowed again; Ask about availability remains a separate action.
3. **Meadowbrook in-app Ask:** All four network vendors are `is_claimed=false` → `start_portal_vendor_inquiry` returns `vendor_unclaimed` by design. Contact falls back to phone/email. Fancy claimed vendors used for inquiry E2E.

## Browser proof

```text
EXPECTED_SHA=0cbc2df7… npx tsx scripts/qa/vendor-client-venue-workflow.mts
→ GREEN passed=17 failed=0
```

## Unit

`lib/vendors/required-vendors.test.ts` + `lib/portal/vendor-pick-availability-gate.test.ts` → 15/15
