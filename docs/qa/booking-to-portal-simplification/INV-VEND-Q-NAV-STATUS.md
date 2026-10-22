# Corrective — Inventory Included, Vendor Network inheritance, Questionnaires nav

**Verdict: NOT GREEN** — product committed; Sandbox deploy + SHA-matched browser/DB proof pending.

Production untouched. Unrelated dirty tree preserved.

## Product commit

(pending commit)

## Changes

1. **Inventory Overview badge** — `setupStatusBadgeLabel` maps Inventory `set_up` + `draft|included` → **Included** (same inclusion language as Planning).
2. **Vendor recommendations** — seed-once from Vendor Network (preferred/recommended/standard + active/invited) into `event_vendor_recommendations` at booking inherit, page load (`getOrEnsure`), and Change editor open. Exclude deletes event row only; does not re-seed when rows exist. Event-only note edit. Assignments unchanged.
3. **Questionnaires** — removed from Overview Event Setup cards via `overviewSetupSteps`; top-level tab remains; nav order is Inventory → Event Order → **Questionnaires** → Documents.

## Local tests

```text
npx tsx --test \
  lib/event-setup/outstanding-follow-ups.test.ts \
  lib/event-setup/state.test.ts \
  lib/event-setup/vendors-setup-editor.test.ts \
  lib/event-setup/booking-to-portal-simplification.test.ts \
  lib/vendor-recommendations/network-inheritance.test.ts \
  …
→ 103 pass / 0 fail (focused suite)
```

## Browser / DB

```text
EXPECTED_SHA=<product> npx tsx scripts/qa/inventory-vendors-q-nav-acceptance.mts
```

Do not claim GREEN until SHA-matched proof lands.
