# Inventory sharing / Select → Share — STATUS

**Verdict: OPEN / NOT ACCEPTED**  
**Date:** 2026-10-28  
**Production:** untouched  
**Unrelated dirty work:** preserved

---

## Actual root cause (Select → Share still blocked)

Select on Additional rows **did persist** `client_selectable=true`.

Share for selection stayed disabled because inventory actions only called:

`revalidatePath(/events/{eventId})`

The Event workspace UI lives on **`/clients/{clientId}`** (`/events/{id}` is a redirect stub). After Select, `router.refresh()` re-rendered the clients page from **stale RSC props**, so `selectableCount` stayed 0.

Prior harness GREEN was invalid: it **DB-fallbacked** when UI Select did not enable Share.

Full write-up: [`SELECT-WORKFLOW-AUDIT.md`](./SELECT-WORKFLOW-AUDIT.md).

---

## Fix (pending Sandbox verify)

| Change | Purpose |
|---|---|
| `event-inventory-actions.ts` | Revalidate `/clients/{clientId}` (+ `/events/{id}`, `/clients`) after inventory mutations |
| `event-inventory-panel.tsx` | Optimistic Select overrides so Share enables immediately on successful mutation |
| `repository.ts` / `service.ts` | Fail when Select update affects 0 rows (silent RLS no-op) |
| `guided-setup.ts` | Add `ceremony` to `SuggestedCategoryKey` (unblocks prior deploy tip) |
| `verify-select-workflow.mts` | Real Ursula UI workflow — **no DB fallback** for Select |

---

## Remaining for GREEN

1. Commit + deploy Sandbox (do not start competing deploys).
2. Verify serving SHA.
3. Run `EXPECTED_SHA=… npx tsx docs/qa/inventory-sharing-regression/verify-select-workflow.mts`.
4. Confirm Select persists, Share enables from UI alone, couple link is inventory (not invoice), reload keeps state.
5. Update this STATUS with SHA + evidence only when that harness is GREEN.

Production untouched.
