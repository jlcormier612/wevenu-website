# Inventory sharing regression — forensic audit

**Date:** 2026-10-28  
**Status:** Audit complete — implementation follows  
**Fixture event:** `Ursula Meadows & Brian Valley` (`971849b2-2223-40e8-bb38-f66fb7c57a2b`)  
**Venue:** Meadowbrook Valley Venue (`05f16a15-1752-4855-8a3b-aad5c593d8d9`)  
**Client:** Ursula Meadows (`24f1a470-0323-4bbc-905e-2b09c39420ef`)  
**Sandbox serving at audit:** `159e5a9d…`  
**Production:** untouched

---

## Persisted state (SoT)

| Record | Value |
|---|---|
| `event_inventory.id` | `448d4f3a-66a1-4c3c-8a78-a822a2bf3cea` |
| Status | `shared` |
| `collaboration_mode` | **`view`** (read-only share, not selection) |
| Activity | `Shared with client — visible in their portal (read-only)` at `2026-10-28T23:28:09Z` |
| Additional-priced items | Dance Floor `$150`, DJ / Band Table `$200` — both `is_included=false`, **`client_selectable=false`** |
| Portal sessions for client | **Only one:** `access_level=financial`, label `Payment`, token `ce3a75ea…1f280285`, `event_id=null` |
| Matching invoice | `INV-2026-4DEF6E` total **$15,937.50**, balance **$11,953.12** (matches reported UI) |

---

## Answers to required questions

### 1. What exact URL was generated and emailed?

Code path `notifyInventoryShared` in `lib/event-inventory/service.ts` builds:

```text
${publicAppOrigin()}/p/${session.accessToken}#inventory
```

Session selection today:

```ts
sessions.find((s) => s.accessLevel !== "financial")
  ?? sessions[0]
  ?? createPortalSession(…, "couple")
```

For Ursula, the only session is **financial**, so `sessions[0]` is used. The emailed URL is therefore:

```text
https://app.sandbox.hellotocheers.com/p/ce3a75ea9783db78968977332b6c773cee5fbf043960407128f4ea7c1f280285#inventory
```

Subject matches the report: `{venue}: Inventory for {event.name}`.

### 2. What does that URL render in a fresh browser session?

Runtime fetch of `/p/ce3a75ea…` returns HTML title:

**`Invoice & Payment Plan — Meadowbrook Valley Venue`**

`app/(portal)/p/[token]/page.tsx` short-circuits when `accessLevel === "financial"` into `PaymentAccessShell`. The `#inventory` fragment is **never consulted**. Screenshot/HTML show Total contracted / Paid to date / Balance remaining matching the invoice SoT.

### 3. Why does inventory-sharing show an invoice/payment-plan experience?

Because the inventory-share email reused the client’s **financial payment token**. Financial tokens are purpose-built for Invoice & Payment Plan (`PaymentAccessShell`), including the copy “Your venue is completing your booking setup…”.

This is the same class of defect already documented for Choices in `lib/client-choices/choices-portal-link.ts` (“Financial tokens always render Invoice & Payment Plan and ignore #choices”). Inventory share never adopted that guard.

### 4. Wrong page: URL, token, routing, auth, or event state?

| Layer | Verdict |
|---|---|
| Generated URL / token choice | **Primary defect** — financial token selected |
| Token resolution / routing | Correct for financial tokens (by design) |
| Authorization | Token is valid; wrong purpose |
| Event / booking state | Not required to explain the wrong shell — financial path always shows pay UI |
| Secondary risk | Even with a couple token, link is `#inventory` only — email click-tracking can drop fragments; Choices already uses `?view=choices#choices` for this |

### 5. Why is “Share for selection” disabled for the two priced items?

UI (`event-inventory-panel.tsx`):

```ts
disabled={lifecyclePending || selectableCount === 0}
title={selectableCount === 0 ? "Mark additional items as Select first" : undefined}
```

Both Dance Floor and DJ / Band Table are **Additional** (`is_included=false`) but `client_selectable=false`. No item has Select enabled → `selectableCount === 0` → button disabled.

Product rule (service): only **additional** items may be marked selectable; included items cannot. A price alone does **not** auto-enable selection — the venue must click per-row **Select**. That control is easy to miss (`text-[10px]`), and the disabled Share CTA only surfaces the reason via `title` hover.

### 6. What does each sharing action do today?

| Control (current label) | Backend | Email | Couple outcome (when token is correct) |
|---|---|---|---|
| **Share to view** | `shareEventInventory(…, "view")` → `collaboration_mode=view`, status `shared` | Inventory subject + `/p/{token}#inventory` | Read-only inventory in couple portal |
| **Share for selection** | `shareEventInventory(…, "select")` → requires ≥1 `client_selectable` additional item; `collaboration_mode=select` | Same URL pattern; body asks for selections | Portal select/save/submit flow |

They are **distinct** operations. The reported share used **view** mode (activity title + `collaboration_mode=view`). Selection was never offered because Select was never enabled on the $150/$200 rows.

### 7. Earlier promise vs current divergence

Prior QA (`docs/qa/inventory-client-selection/STATUS.md`, commit `265f560c`) proved select-share → portal submit → venue confirm on a **couple** portal session. It did not cover the case where the client only has a **financial** session.

Choices later gained `pickChoicesPortalSession` + `?view=choices` specifically to avoid financial tokens and hash stripping. **Inventory notify still falls back to `sessions[0]` and hash-only deep links** — that is the divergence.

---

## Intended semantics (for fix)

1. Inventory share emails must use a **couple** (or planning) portal session — never financial. Create a couple session if missing.
2. Destination URL must survive email click-tracking: `?view=inventory#inventory` (mirror Choices).
3. Portal page must honor `view=inventory` for non-financial tokens.
4. Keep **Share to view** vs **Share for selection** as two actions; clarify copy and the disabled reason in visible UI (not only `title`).
5. Preserve: Additional ≠ auto-selectable; venue must mark Select; included items stay informational; financial invoice links stay on PaymentAccessShell.

---

## Root cause summary

1. **Wrong token in inventory share email** when only a financial portal session exists → Invoice & Payment Plan UI.  
2. **Hash-only inventory deep link** (secondary) vs Choices’ query+hash pattern.  
3. **Share for selection disabled** because Additional items were not marked Select — correct gate, weak affordance/explanation.
