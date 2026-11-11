# Meadowbrook Bindi & Jake — Event Order client visibility

**Verdict: GREEN** (lifecycle proven on serving `a11547be`)

Production untouched. Unrelated dirty tree preserved. **No product code change** — the client empty state was correct.

## Root cause

The venue Event Order and client portal reference the **same** canonical order on the **same** event. The client showed “Not shared yet” because:

- `event_orders.status` was `open`
- `shared_at` was **null**
- no `event_order_share_snapshots` rows existed

Portal RPC `get_event_order_for_portal` requires `eo.shared_at is not null`. That privacy gate worked as designed.

Venue must **Finalize**, then **Share with Client**. Share was never completed for this order before the screenshots.

## Record linkage (Sandbox)

| Record | ID |
| --- | --- |
| Venue | `05f16a15-…` Meadowbrook Valley Venue |
| Client | `0f554bb0-…` Bindi Lulu / Jake Paws |
| Event | `4ed4d7fb-…` |
| Event Order | `f0fa9108-…` delivery subtotal **$2,243** (7 custom lines) |
| Invoice | `INV-2026-08500C` / `08500c0c-…` linked via `event_order_id` |

Line provenance: all **custom** (not inventory/template clones for these lines). Invoice draft live-projects EO charges; delivery subtotal on EO vs invoice due amount are intentionally different scopes.

## Lifecycle proof

```text
EXPECTED_SHA=a11547be457ce5323e4d32fb2fda2d6ff7df0d53 \
  npx tsx scripts/qa/meadowbrook-eo-client-visibility.mts
→ GREEN passed=18 failed=0
```

Proven: portal empty while unshared → venue Finalize → Share with Client → snapshot (7 lines) + `shared_at` → portal RPC 7 rows → client Order shows Plated Dinner / Ceremony Coordination / Arbor / etc. → invoice linkage unchanged → template unchanged (7 lines) → cross-tenant empty → bogus token empty.

Evidence: `FORENSIC.md`, `browser-results.json`, `venue-*-1280.png`, `client-after-share-*.png`.

Serving SHA verified on Sandbox login HTML: `a11547be457ce5323e4d32fb2fda2d6ff7df0d53` (tax-fix deploy already live; no additional EO deploy required).

## Tests

```text
npx tsx --test lib/event-orders/meadowbrook-client-visibility.test.ts
→ 4/4 pass
```
