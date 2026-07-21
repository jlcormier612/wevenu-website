# QuickBooks Online Integration — Full Architecture

**Sprint 3, Item 6. Research and design only — no implementation. Waiting for approval.**

**Date:** 2026-07-21

This document designs the *complete* QuickBooks Online synchronization surface this sprint's prompt asks for: Customers, Invoices, Payments, Refunds, Products, Tax codes, Chart of Accounts mapping, OAuth, refresh tokens, disconnect/reconnect, webhooks, conflict handling, manual re-sync, and audit logging. **This is synchronization, not replacement** — Wevenu remains the source of truth for booking/event data; QuickBooks remains the source of truth for accounting. Where the two must agree, this document is explicit about which side wins and why.

**Important context this document must be read against:** a real, narrower QuickBooks integration already shipped earlier this same sprint cycle (`docs/quickbooks-integration-completion.md`) — one-directional push sync (Wevenu → QBO) for Customers/Invoices/Payments/Refunds, real OAuth + refresh-token handling, a retry queue with backoff/dead-letter, connection health, and append-only audit logging. That work was deliberately scoped down at the time, with Chart-of-Accounts mapping, tax codes, product sync, inbound webhooks, and conflict handling explicitly named as **not required for that launch**. This document is the design for closing that gap — the "true," fuller integration — not a from-scratch redesign of what already works. Every section below states plainly whether it's **already shipped**, **extends shipped code**, or **entirely new**.

---

## 1. What's already shipped (do not rebuild)

| Requirement | Status |
|---|---|
| OAuth connection | ✅ Shipped — `lib/quickbooks/service.ts`, `app/api/quickbooks/callback/route.ts` |
| Refresh tokens | ✅ Shipped — `lib/quickbooks/client.ts`'s `getValidAccessToken()`, proactive + lazy-on-401 |
| Disconnect / reconnect | ✅ Shipped — calls Intuit's revoke endpoint before clearing local state |
| Customer synchronization | ✅ Shipped — one-directional push, `DisplayName` query-before-create idempotency |
| Invoice synchronization | ✅ Shipped — one-directional push, `DocNumber` idempotency, placeholder "Wevenu Services" Item |
| Payment synchronization | ✅ Shipped — one-directional push, `PrivateNote`-embedded idempotency |
| Refund synchronization | ✅ Shipped — one-directional push, RefundReceipt, same idempotency mechanism |
| Audit logging | ✅ Shipped — `quickbooks_sync_log`, append-only, surfaced in Settings |
| Retry / error queue | ✅ Shipped — `quickbooks_sync_queue`, exponential backoff, 8-attempt dead-letter |
| Connection health | ✅ Shipped — surfaced from real sync attempts, not a separate poll |

**Not yet shipped — this document's actual subject:**

| Requirement | This document designs |
|---|---|
| Products | Real Product/Service Item sync, replacing the single placeholder Item |
| Tax codes | Tax rate/jurisdiction modeling and sync |
| Chart of Accounts mapping | A venue-facing settings UI to map Wevenu line-item types to real QBO accounts |
| Webhooks | Inbound change notifications from QuickBooks itself |
| Conflict handling | What happens when the same record changed on both sides |
| Manual re-sync | A venue/coordinator-triggered "sync this now" action |

---

## 2. Products — real Item sync, replacing the placeholder

**Current state (shipped):** every invoice line item pushes under one generic "Wevenu Services" Item (`lib/quickbooks/items.ts`), regardless of `invoice_line_items.type` (`package`/`addon`/`inventory`/`discount`/`fee`/`tax`/`deposit`/`item`). This was the explicit, correct choice for launch given Chart-of-Accounts mapping was out of scope — QBO assigns its own default income account to that one Item, and no venue-facing mapping decision was required.

**What "real" Product sync means:** each of this codebase's actual sellable things — `packages` (`lib/packages/types.ts`) and, more granularly, distinct `invoice_line_items.type` values — gets its **own** QBO Item, so a venue's QuickBooks Profit & Loss can actually break down revenue by package/category rather than everything landing in one generic bucket.

**Design:**
- New table `quickbooks_item_mappings` (venue_id, wevenu_package_id nullable, wevenu_line_item_type nullable — exactly one of the two set, quickbooks_item_id, created_at/updated_at). A row keyed by `wevenu_package_id` takes precedence over one keyed by `wevenu_line_item_type` (a specific package's own Item overrides its type's generic Item) — this lets a venue map their most important packages individually while falling back to type-level buckets for everything else, rather than requiring every single package to be mapped before sync can proceed.
- Sync-time resolution: `resolveQuickBooksItem(venueId, lineItem)` checks for a package-level mapping first, then a type-level mapping, then falls back to the existing placeholder Item — meaning this feature can ship incrementally (a venue maps what they care about; unmapped items keep working exactly as they do today) rather than being all-or-nothing.
- `ensureDefaultItem()` (shipped) becomes `ensureItem(mapping)` — same query-before-create idempotency, generalized to look up/create *any* named Item, not just the one placeholder.

---

## 3. Tax codes

**Current state:** no tax-rate or jurisdiction model exists anywhere in this codebase — `tax` is just one more free-text `invoice_line_items.type`, manually entered by a coordinator with no structured rate/jurisdiction behind it (confirmed in the original QuickBooks assessment, unchanged since).

**This is the single largest new domain-modeling gap in this whole document** — real tax-code sync requires something structured to sync *from*, and nothing structured exists today independent of QuickBooks. Two paths:

- **(a) Full tax modeling in Wevenu** (jurisdiction, rate, tax-exempt status per venue/client) mirrored to QBO's `TaxCode`/`TaxRate` objects — a genuinely large sub-initiative on its own, arguably bigger than the rest of this document combined, since it requires real product decisions about how Wevenu itself calculates and displays tax, not just how it syncs.
- **(b) QBO as the source of truth for tax, Wevenu as a thin pass-through** — a venue picks an existing QBO `TaxCode` (fetched via the Graph^H^H QBO API, not created by Wevenu) per invoice or per line-item type, and Wevenu simply tags the pushed invoice line with that code's ID, doing no tax calculation itself. This is far smaller to build and matches this document's "synchronization, not replacement" framing more literally — Wevenu doesn't need to *understand* tax, just needs to let a venue say "this line uses whichever tax code QuickBooks already has for it."

**Recommendation: (b) for this pass.** It's the only version of "tax code sync" that doesn't require Wevenu to build a tax engine (explicitly named as out of scope for the original launch integration, and not something this sprint's prompt asks for either — it asks for "tax codes," which (b) genuinely delivers, without silently expanding into "tax engine"). Flagging as an explicit decision, not assuming it.

---

## 4. Chart of Accounts mapping (venue-facing UI)

**Design:** a new Settings sub-section (or its own settings page, given its size), `components/settings/quickbooks-account-mapping-section.tsx`:
- Fetches the venue's real Chart of Accounts from QBO (`GET /query?query=select * from Account where AccountType = 'Income'`, cached similarly to how the placeholder Item's ID is cached on `quickbooks_connections`).
- For each of Wevenu's `invoice_line_items.type` values (package/addon/inventory/discount/fee/tax/deposit/item), a dropdown to pick the corresponding real QBO account — this is the type-level mapping that feeds §2's Item-resolution fallback (a "package" type Item is created under whatever account the venue picked here).
- For individually-mapped packages (§2), the same account picker, scoped per-package.
- Explicit unmapped-state handling: a type/package with no mapping continues using the existing placeholder-Item behavior — **this feature is additive, never a hard requirement to keep syncing working**, consistent with this integration's whole design philosophy of degrading gracefully rather than blocking.

---

## 5. Webhooks — inbound change notifications from QuickBooks

**This is the most architecturally significant new piece**, since the shipped integration is deliberately one-directional (an explicit decision made before that build started: "no inbound webhooks, no drift detection"). This document is where that decision gets revisited, per this sprint's explicit ask.

**What QBO's webhooks deliver:** a notification that an entity (Customer/Invoice/Payment/etc.) changed in QuickBooks, identified by realm ID and entity ID/operation — **not the changed data itself** (same "thin notification, fetch the real data separately" shape as Meta's Lead Ads webhook, designed elsewhere this sprint — `docs/facebook-lead-ads-architecture.md` §4.4). A received webhook triggers a `GET` on the specific entity to retrieve its current QBO-side state.

**New route:** `app/api/quickbooks/webhook/route.ts` — verifies Intuit's own signature scheme (`intuit-signature` header, HMAC-SHA256 over the raw body using the app's webhook verifier token — structurally the same "read raw body, HMAC-compare" shape as the Resend/Meta webhook verification already used elsewhere in this codebase), added to `integrations/supabase/proxy.ts`'s `PUBLIC_PATHS` (the same allowlist-omission bug class already found and fixed multiple times this engagement — the one thing to get right by design this time, not discover live).

**What happens on a genuine change:** enqueue a new "inbound reconciliation" job (a sibling queue to the existing `quickbooks_sync_queue`, or a new `entity_type` value within it — recommend a new dedicated `quickbooks_inbound_queue` table, since inbound and outbound jobs have different shapes and different failure semantics, rather than overloading the existing outbound-only table) — which fetches the changed entity from QBO and compares it against Wevenu's own record, feeding into conflict handling (§6).

---

## 6. Conflict handling

Once inbound awareness exists (§5), the two systems can disagree about a shared record's current state — this section is the actual design decision this whole document exists to make, since a wrong choice here silently corrupts financial data.

**Policy, by entity type, reasoning per type rather than one blanket rule:**

- **Customer (name/email/phone):** Wevenu wins, always. A venue's `clients` table is the canonical CRM record — if someone edits a customer's name directly in QuickBooks, that's almost always a bookkeeping correction that shouldn't silently rename the venue's own client record. **Design: an inbound Customer change is logged (for visibility) but never applied back to Wevenu.** A future push-sync (the next scheduled Wevenu-side edit) simply overwrites QBO's value again, same as it does today.
- **Invoice (line items, amounts):** **Wevenu wins for anything already frozen** (a sent invoice's line items are already meant to be immutable in spirit — see this sprint's own Tour Scheduling and prior TR-L1 precedent for "should X be editable after commitment" as a recurring platform question). An inbound edit to an already-synced Invoice's amounts in QBO is logged as a **conflict requiring manual review**, not silently auto-resolved either direction — this is real money, and a coordinator should see "QuickBooks shows a different amount than Wevenu for this invoice" and decide, rather than either system silently overwriting the other.
- **Payment / Refund status:** **QuickBooks can be the earlier signal.** If a payment is recorded directly in QuickBooks before Wevenu's own payment is marked (e.g. a venue's bookkeeper enters a bank deposit manually before the coordinator marks it paid in Wevenu), that's a legitimate case where QBO genuinely knows something first. **Design: an inbound Payment/Refund creation that doesn't match any known `stripe_payment_intent_id`/Wevenu-originated push is surfaced to the coordinator as "a payment was recorded in QuickBooks that doesn't have a matching Wevenu record — reconcile?"** rather than either auto-creating a phantom Wevenu payment or silently ignoring it.
- **General principle underneath all three:** **no inbound change is ever silently and automatically written into Wevenu's own operational tables** (`clients`, `invoices`, `payment_line_items`). Every inbound signal either (a) is logged and ignored (Customer), (b) becomes a flagged, human-reviewed conflict (Invoice), or (c) becomes a flagged, human-reviewed reconciliation prompt (Payment/Refund). This is a deliberately conservative policy — it means this integration never becomes a second, competing source of truth for booking data, which is exactly what "synchronization, not replacement" is supposed to guarantee.

**New table:** `quickbooks_conflicts` (venue_id, entity_type, entity_id, wevenu_snapshot jsonb, quickbooks_snapshot jsonb, status `open|resolved|dismissed`, resolved_by, resolved_at, created_at) — surfaced in Settings as a small worklist, not a scary error state; most venues should see this empty, always.

---

## 7. Manual re-sync

**Current state:** explicitly deferred at launch ("not in launch requirements, schema supports adding it trivially later" — `docs/quickbooks-integration-completion.md`). The schema already supports it exactly as predicted.

**Design:** a "Retry now" button on any `failed`/dead-lettered sync-status badge (invoice detail, payment row, Settings sync-activity list), calling a new server action that does exactly the reset above (`next_attempt_at = now(), status = 'pending'` — sufficient to force an immediate retry of a dead-lettered item), then optionally triggers an immediate (rather than next-cron-tick) processor run for just that item — small, low-risk, no new architecture needed beyond what already exists.

---

## 8. Audit logging

**Already shipped and sufficient as-is:** `quickbooks_sync_log` (append-only, venue_id/entity_type/entity_id/outcome/attempt_number/quickbooks_id/message/created_at), surfaced in Settings. The only extension this document's new scope requires: **inbound events (§5) and conflicts (§6) log to the same table** (or a clearly-labeled sibling with the same shape) so a venue's "what has QuickBooks been doing" view is one place, not scattered across outbound-only and inbound-only tables.

---

## 9. Sequencing (if approved)

This is a large initiative — recommend treating it as its own multi-phase build, not a single pass, mirroring how the original (already-shipped) integration was sequenced:

1. **Products + Chart of Accounts mapping** (§2, §4) — additive, no conflict-handling complexity, lowest risk, immediately useful (real P&L breakdown) even before anything inbound exists.
2. **Tax codes, path (b)** (§3) — small, contingent on confirming the scope decision in §3.
3. **Webhooks + conflict handling + manual re-sync** (§5, §6, §7) — the real architectural addition, should be built and verified together since conflict handling is meaningless without inbound awareness, and manual re-sync is a natural companion UI once conflicts can occur.
4. **Audit logging extension** (§8) — folds into phase 3, not a separate pass.

---

## 10. Open decisions needing approval before coding starts

1. **Tax codes: confirm path (b)** — QBO as source of truth, Wevenu as a thin pass-through picker, explicitly not a tax engine (§3).
2. **Conflict policy per entity type (§6)** — confirm Customer=Wevenu-always-wins, Invoice=flag-for-review, Payment/Refund=flag-for-reconciliation, as the right default policy, or specify different rules.
3. **Item-mapping precedence (§2)** — confirm package-level mapping overriding type-level mapping, with graceful fallback to the existing placeholder Item for anything unmapped, matches intent.
4. **Scope/sequencing (§9)** — confirm this should proceed as a phased initiative rather than one large build, and confirm the phase order.
5. **Whether this initiative should be scheduled now or explicitly deferred post-launch** — the original QuickBooks assessment recommended treating the full version of this integration as a large post-launch initiative; this document fulfills this sprint's ask to *design* it, but building it is a separate, larger commitment than anything else in Sprint 3's first four items. Recommend confirming whether implementation of this document starts immediately after Sprint 3's other items, or is explicitly scheduled later.
