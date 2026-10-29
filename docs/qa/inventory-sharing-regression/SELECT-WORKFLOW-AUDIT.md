# Inventory Select → Share workflow — forensic audit

**Date:** 2026-10-28  
**Status:** Root cause confirmed — fix follows  
**Fixture:** Ursula Meadows (`971849b2-…`) / Meadowbrook (`05f16a15-…`)  
**Inventory:** `448d4f3a-…` — Dance Floor `$150`, DJ / Band Table `$200` (`is_included=false`, `client_selectable=false` before click)  
**Production:** untouched

---

## Reproduction (real browser UI)

Staff: Meadowbrook owner `jlcormier612@gmail.com`  
URL after `/events/{id}` redirect: `/clients/24f1a470-…` (booking workspace)

| Step | Result |
|---|---|
| Share for selection before click | **Disabled**; amber reason visible |
| Select visible on Dance Floor / DJ | **Yes** (`inventory-item-select-toggle-{id}`) |
| Click Select on Dance Floor | Click accepted; **no console/network errors** |
| Persisted `client_selectable` after click | **`true`** (admin read of row `f1c2c39c-…`) |
| Toggle label after click | Still **“Select”** (stale props) |
| Share for selection after click | Still **disabled** |
| Disabled reason after click | Still shown |

Evidence: `shots/reproduce-before-select.png`, `shots/reproduce-after-select.png`, `reproduce-select.log`.

---

## Root cause

**Select mutation succeeds. UI enablement does not refresh.**

1. Event Inventory UI lives on **`/clients/{clientId}`** (EventDetail). `/events/{id}` only redirects there.
2. `app/(app)/events/[id]/event-inventory-actions.ts` calls:

   ```ts
   revalidatePath(`/events/${eventId}`);
   ```

   That path is the **redirect stub**, not the page that loads `getEventInventory` and passes `eventInventory` into `EventInventoryPanel`.

3. Panel `selectableCount` and Share button `disabled={selectableCount === 0}` are derived from **props**. After Select, `router.refresh()` re-renders `/clients/…` from a cache that was **never revalidated**, so props stay `clientSelectable: false`.

4. Prior harness `verify-browser.mts` **DB-fallbacked** when UI Select did not appear to enable Share, then declared GREEN — that is not proof the venue-owner workflow works.

Eligibility rule itself is correct: Share for selection requires ≥1 Additional item with `client_selectable=true`. Do not permanently enable the button.

---

## Intended fix (smallest complete)

1. Revalidate **`/clients/{clientId}`** (and keep `/events/{id}` for deep links) after inventory mutations. Resolve `clientId` from the event inside the action helper.
2. Optimistic local state in `EventInventoryPanel` for Select toggles so Share enables immediately when the mutation returns `ok`, even if RSC refresh is slow.
3. Fail loud if `setItemClientSelectable` updates 0 rows (silent RLS no-op).
4. New harness `verify-select-workflow.mts` on Ursula (or equivalent) — **no DB fallback** for Select; prove Share enables from the UI click alone.
5. Fix unrelated ceremony `SuggestedCategoryKey` type error blocking Sandbox deploy of prior tip.

---

## Non-goals

- Do not change the Additional-only eligibility rule.
- Do not force-enable Share for selection.
- Production untouched.
