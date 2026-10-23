# HTC Commercial Workflow Consolidation — C5 Status

**Phase:** C5 — Finance handoff verification (no redesign)  
**Status:** **GREEN / CLOSED**  
**Date:** 2026-10-23  
**Branch:** `feat/spaces-booking-e1-smart-fields`

---

## 1. Exact C5 scope (from AUDIT.md)

> **Phase C5 — Finance handoff verification (no redesign)**  
> - Re-run EO→invoice freeze-on-send + payment plan browser (`eo-invoice-payment-plan`, payment workflow tests).  
> - Accept: finalize/share EO does not create invoice; invoice send freezes lines.

| Authorized | Not authorized |
| --- | --- |
| Verify EO → Invoice create/link | Invoice/payment UI redesign |
| Verify freeze-on-send invariant | New billing concepts |
| Verify Invoice → Payment Plan | Parallel invoice/plan paths |
| Checklist finance status accuracy | Inventory/`client_choices` merge |
| Fix only demonstrated finance defects | C6/C7, Production |

**Product code:** no finance behavior changes were required. Serving remained C4 SHA `c1b210d3` (verification-only).

---

## 2. Repository / deployment state

| Item | Value |
| --- | --- |
| Initial HEAD | `f8f0adbd` (C4 evidence) |
| Initial / final serving | **`c1b210d3fb4155d6dc68b1853f1581d244e03cba`** |
| Health | `{"ok":true,"checks":{"env":"ok","supabase":"ok"}}` |
| New Sandbox deploy for C5 | **Not required** (no product commit) |
| Dirty paths | ~1000+ unrelated preserved |
| Production | untouched |

---

## 3. Finance path inspection (source of truth)

| Concern | Implementation | Behavior |
| --- | --- | --- |
| **Create Invoice** | `createInvoiceFromEventOrderAction` → `createInvoice({ eventOrderId })` | Creates draft EO-linked invoice; **returns existing** if one already open (`invoiceToOpenForEventOrder`) |
| **Link Invoice** | `linkEventOrderToInvoiceAction` → `linkInvoiceToEventOrder` | Attaches an unlinked **draft** invoice to the EO (not booking-commitment) |
| **UI** | `EventOrderInvoiceLink` | Linked → Open Invoice + Create/Open Payment Plan; unlinked → Create or Link draft |
| **Freeze-on-send** | `updateInvoiceStatus(..., "sent")` when draft + `eventOrderId` | `billableEventOrderLinesForInvoice` → `insertFrozenLinesFromEventOrder`; stores `event_order_revision_at_freeze` |
| **Edit after send** | `assertInvoiceEditable` | Blocks line mutations unless reverted to draft |
| **Payment plan** | `/payments/new?invoiceId=` from invoice / EO link | Plan always invoice-scoped; never EO-native |
| **Checklist / chips** | `buildCommercialProgressSteps` / `buildCommercialStatusChips` / `buildCommercialNextAction` | Invoiced = EO-linked invoice exists; plan chip only with schedule id or linked invoice; never invent from share |

### Create vs Link (precise difference)

- **Create:** insert new draft invoice row with `event_order_id` set (idempotent open-existing).  
- **Link:** set `event_order_id` on an existing unlinked draft (non–booking-commitment).  
Neither path is triggered by Finalize or Share.

---

## 4. Commercial progress ↔ persistence mapping

| UI | Source of truth |
| --- | --- |
| Invoice chip “Not created” | No non-void EO-linked invoice |
| Invoice chip Draft/Sent/Paid/… | `invoices.status` for preferred EO-linked row |
| Checklist “Invoiced” complete | EO-linked invoice exists (draft counts as created, not sent) |
| Payment plan “Not created” | Linked invoice present, `linkedScheduleId` null |
| Payment plan “Created” | `linkedScheduleId` from event load |
| Next: “Open invoice — send freezes…” | Draft linked invoice, deep-link only |
| Never inferred | Share → invoice; invoice exists → sent; invoice → plan; plan → paid |

---

## 5. Files changed (verification pack)

| File | Reason |
| --- | --- |
| `lib/event-orders/commercial-status.test.ts` | C5 finance status mapping / no-inference tests |
| `docs/qa/.../verify-browser-c5.mts` | Fancy EO→invoice→plan + freeze DB evidence (no outbound send) |
| `docs/qa/eo-invoice-payment-plan/verify-browser.mts` | Retarget to Fancy + ECS SHA (AUDIT harness; Meadowbrook fixture had drifted) |
| `docs/qa/.../C5-STATUS.md` | This report |

---

## 6. Tests

```text
npx tsx --test \
  lib/event-orders/commercial-status.test.ts \
  lib/invoices/eo-freeze-billable.test.ts \
  lib/invoices/sent-invoice-edit-safety.test.ts \
  lib/invoices/payment-workflow-regression.test.ts \
  lib/invoices/invoice-payment-plan-customer-journey.test.ts \
  lib/event-setup/commercial-c1-terminology.test.ts \
  lib/library/commercial-c2-library-clarity.test.ts
```

**Result:** **79/79 pass**

---

## 7. Browser (pinned `EXPECTED_SHA=c1b210d3…`)

| Harness | Result |
| --- | --- |
| C5 `verify-browser-c5.mts` | **20/20 PASS** |
| AUDIT `eo-invoice-payment-plan/verify-browser.mts` | **11/11 GREEN** |
| C4 regression | **23/23** |
| C3 regression | **26/26** |
| C1 regression | **22/22** |
| C2 regression | **20/20** |

Evidence: `browser-results-c5.json`, `shots-c5/`, `docs/qa/eo-invoice-payment-plan/browser-results.json` + shots.

### Freeze-on-send (how proven without customer email)

1. **Unit/integration:** `eo-freeze-billable` (billable filter on freeze path); `sent-invoice-edit-safety` (`assertInvoiceEditable` blocks sent line edits).  
2. **Persisted Sandbox evidence:** Fancy sent EO invoice `56f8ea63-…` has `status=sent`, `event_order_revision_at_freeze=1`, and frozen `invoice_line_items` (e.g. “Plated dinner service”); browser opened that invoice read-only.  
3. **Not executed:** live `sendInvoiceAndPaymentPlanAction` (would email client). Freeze code path on first `status→sent` was not re-fired in this session.

### Duplicate / relationship checks

| Check | Result |
| --- | --- |
| C5 navigation | invoices `1→1`, schedules `1→1` (after plan create), frozen lines `1→1` |
| eo-invoice-payment-plan | schedules `0→1` once (create), then no duplicate on re-run path |
| Create Invoice idempotency | code returns existing open EO invoice (not re-tested by creating a second in browser) |

### Accept criteria

| Criterion | Evidence |
| --- | --- |
| Finalize/share EO does not create invoice | Distinct EO + invoice rows; Share/Finalize not on strip; create/link only via `EventOrderInvoiceLink` |
| Invoice send freezes lines | Service freeze path + sent fixture frozen lines + edit guard tests |

---

## 8. Confirmations

- C1–C4 intact on serving `c1b210d3`
- Production untouched
- Unrelated dirty work preserved
- No finance redesign; no parallel paths
- C6/C7 not started

**Deferred / limitations:** Did not re-send an invoice email to prove freeze live; relied on code path + already-sent fixture. Meadowbrook historical fixture (`INV-2026-08500C`) had drifted (non-zero draft total); AUDIT harness retargeted to Fancy EO draft `INV-2026-4489C8`.

**Definition of done:** GREEN / CLOSED.
