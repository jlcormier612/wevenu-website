# Event Order commercial lifecycle closure — STATUS

**Workstream verdict: OPEN / NOT GREEN** (complete venue↔couple journey not yet live-accepted on serving tip)

**Code tip:** `fb8bd1779f532a20ddd90f0bbab6f1591b8b7f4b`  
**Sandbox deploy:** https://github.com/jlcormier612/wevenu-website/actions/runs/40621438699 (dispatched for `fb8bd177`)

## What shipped in `fb8bd177`

| Stage | Change |
|-------|--------|
| 1 Share/invoice authority | Fingerprint live EO vs last share snapshot; block **original** EO invoice create/send when stale; amend/incremental exempt |
| 2 Journey | Stale → Re-share; open+invoiced → not “needs finalize”; unbilled → Invoice new charges |
| 3 Accept vs Contracts | Documented + portal/journey copy: Accept = delivery-list acknowledgment, not e-sign; invoicing not gated on Accept |
| 4 Payments | Hide `choices:uuid`; per-invoice labels; Additional charges; combined outstanding clarity; bare-invoice next step |
| Tests | `share-consistency`, journey stage0 extensions, payment-obligations, incremental 22 suite still green |

## Automated evidence (pre-deploy)

```
npx tsx --test lib/event-orders/share-consistency.test.ts \
  lib/events/event-order-journey-stage0.test.ts \
  lib/portal/payment-obligations.test.ts \
  lib/invoices/incremental-eo-invoice.test.ts
→ 50/50 pass
```

## Live greenfield E2E

Harness: `verify-greenfield.mts` (fresh Fancy client/event, not B2P).  
**Pending** serving SHA `fb8bd177` on ECS, then:

`EXPECTED_SHA=fb8bd1779f532a20ddd90f0bbab6f1591b8b7f4b npx tsx docs/qa/event-order-commercial-lifecycle-closure/verify-greenfield.mts`

## Product decisions

See `ACCEPT-VS-CONTRACTS.md`. No new legal semantics invented.

## Boundaries

- Production untouched
- Incremental invoicing prior GREEN 22/22 preserved (suite still passes)
- Offerings hierarchy / Floor Plans 1–5 not reopened
- QuickBooks: expect explicit UNVERIFIED BOUNDARY unless Sandbox connection permits safe sync
- Unrelated dirty/untracked tree preserved

## Remaining for GREEN

1. Deploy `fb8bd177` finishes + serving image verified  
2. Greenfield harness 1–20 applicable checks pass with persisted-state evidence  
3. Update this STATUS with browser-results + final journey verdict  
