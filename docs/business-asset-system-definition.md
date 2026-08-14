# Work Package BA1 — Business Asset System Definition

**Date:** 2026-08-08
**Scope:** Product definition only. No code, no migrations, nothing implemented. Every claim below was traced to an actual table, type, service function, RLS policy, or component — not assumed from a name. Where something in the brief's own example list turned out not to exist, that's stated plainly rather than built around.

---

## 1. Complete Business Asset Catalog

Traced across the whole product. 29 real, distinct assets found (plus 5 named in the brief that turned out **not** to exist as their own thing — see §9).

| # | Asset | Table(s) | Real? |
|---|---|---|---|
| 1 | Message Templates (Email + SMS, unified) | `message_templates`, `message_template_attachments` | Yes |
| 2 | Packages | `packages`, `package_items` | Yes |
| 3 | Contract Templates | `contract_templates` | Yes |
| 4 | Planning Playbooks (Task Templates) | `playbook_templates`, `playbook_milestones`, `playbook_tasks` | Yes |
| 5 | Timeline Templates | `timeline_templates`, `timeline_template_items` | Yes |
| 6 | Floor Plan Templates | `floor_plan_templates`, `floor_plan_template_objects` | Yes |
| 7 | Inventory Items (the catalog itself) | `inventory_items`, `inventory_categories` | Yes — this *is* the reusable library; no separate template layer |
| 8 | FAQs | `venue_operational_info.faqs` (jsonb array) | Yes, but informally — no per-item id/CRUD |
| 9 | Vendor Task Templates | `vendor_task_templates` | Yes — but **vendor-owned**, not a venue asset (see §9) |
| 10 | Vendor Library Documents | `vendor_library_documents` | Yes — vendor-owned |
| 11 | Contracts (instance) | `contracts` | Yes |
| 12 | Questionnaires | `event_questionnaires` | Yes |
| 13 | Event Orders (BEOs) | `event_orders`, `event_order_sections`, `event_order_lines`, `event_order_activities` | Yes — this *is* the BEO, under a different name (see §9) |
| 14 | Floor Plans (instance) | `floor_plans`, floor plan objects | Yes |
| 15 | Payment Plans (Payment Schedules) | `payment_schedules`, `payment_line_items`, `payment_activities` | Yes |
| 16 | Event Task Lists | `event_tasks`, `event_playbook_applications` | Yes — this *is* the Checklist (see §9) |
| 17 | Invoices | `invoices`, `invoice_line_items` | Yes |
| 18 | Generic uploaded Documents | `documents` | Yes |
| 19 | Signed Contracts | `contracts` (`status='signed'`) | Yes, as a state, not a separate table |
| 20 | Paid/Void Invoices | `invoices` (`status='paid'/'void'`) | Yes, as a state |
| 21 | Finalized Event Orders | `event_orders` (`status='finalized'`) | Yes, and genuinely enforced (see §2) |
| 22 | "Finalized" Floor Plans | `floor_plans.finalizedAt` | Exists, but does **not** lock anything (see §2) |
| 23 | Legal Documents (HQ Terms/Policies) | `legal_documents` | Yes — not in the brief's list, but the *only* entity with real DB-enforced immutability |
| 24 | Vendor Documents (shared to an event) | `documents` (`uploaded_by_type='vendor'`) | Yes — a hybrid: owned in `vendor_library_documents`, shared copies land in the generic table |
| 25 | Luv Drafts (AI-generated) | `luv_drafts` | Yes — **persisted**, not ephemeral (a real finding, see §9) |
| 26 | Live Dashboards ("Reports") | none (computed on read) | No stored entity — see §9 |
| 27 | Wedding Website (published site) | `wedding_website`/venue design fields | Yes, as a live page — no export artifact |
| 28 | Venue Guide (couple/vendor operational info) | `venue_operational_info` | Yes — closest thing to venue-facing procedural content, but not staff SOPs |
| 29 | Success Library (Luv best-practice articles) | static/keyed content, not venue-editable | Yes — staff-facing, not a venue business asset the venue authors |

**Not found as real, distinct assets** (named in the brief, don't exist): Brochures, Pricing Sheets, Contract Amendments, Questionnaire Templates, per-event Inventory Lists, Receipts-as-a-stored-record, Internal SOPs, Timeline/Wedding-Website *exports* as artifacts. Each is addressed in §9.

---

## 2. Lifecycle Matrix

Per Step 2's rule — exactly one lifecycle each, no asset in two at once.

| Asset | Lifecycle | Notes |
|---|---|---|
| Message Templates | Template | |
| Packages | Template | |
| Contract Templates | Template | |
| Planning Playbooks | Template | |
| Timeline Templates | Template | |
| Floor Plan Templates | Template | |
| Inventory Items | Template | the catalog itself is the reusable asset |
| FAQs | Template | informal (whole-array rewrite, no per-item lifecycle) |
| Vendor Task Templates | Template | vendor-tenant, not venue-tenant |
| Vendor Library Documents | Template | vendor-tenant |
| Contracts (draft/sent) | Working Asset | becomes Locked Record at `signed` |
| Questionnaires | Working Asset | **never actually reaches Locked** — see below |
| Event Orders (open) | Working Asset | becomes Locked Record at `finalized` |
| Floor Plans | Working Asset | **stays Working Asset even after "Finalized"** — the flag doesn't lock it (see below) |
| Payment Plans | Working Asset | individual line items lock on payment; the schedule itself never does |
| Event Task Lists | Working Asset | Draft/Released gates client visibility only, never editability |
| Invoices (draft/sent) | Working Asset | becomes Locked Record at `paid`/`void`, weakly enforced (see below) |
| Signed Contracts | Locked Record | app-layer only, not DB-enforced |
| Paid/Void Invoices | Locked Record | app-layer only, and the *weakest* one — line-item edit functions have no status guard at all (a confirmed, already-known gap, not new) |
| Finalized Event Orders | Locked Record | the **only** one with real, consistent enforcement — every mutation routes through one `assertOpen()` guard |
| Legal Documents | Locked Record | the **only** one with true DB-enforced immutability (a `BEFORE UPDATE` trigger that raises an exception) |
| Luv Drafts | *Doesn't fit cleanly* | see §9 — closer to a disposable Working Asset that produces a different asset (a sent message) than something that locks itself |

**A genuine inconsistency, not a modeling choice:** "Finalized" is used for three assets with three incompatible real behaviors — Event Orders (hard lock, enforced), Floor Plans (a checkpoint stamp that a code comment explicitly says "never gates editing"), and Questionnaires (`reviewed` exists in the status enum and is read by three consumers, but **no code path ever sets it** — it's dead). The same word currently means "locked," "not locked, just marked," and "unreachable," depending on which asset you're looking at.

---

## 3. Behavior Matrix

Only verbs the brief allows; **bold** = confirmed as a real function/action in code this round, plain = confirmed absent.

| Asset | Create | Clone | Edit | Collaborate | Share | Generate | Lock | Unlock | Archive | Restore | Export/Print | Sign | Version/Supersede | Delete |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Message Templates | **✓** | **✓** | **✓** | — | — | — | — | — | **✓** | **✓** | — | — | — | **✓**(blocked if in use) |
| Packages | **✓** | **✓** | **✓** | — | — | — | — | — | — (`is_active` toggle instead) | — | — | — | — | **✓** |
| Contract Templates | **✓** | **✓** | **✓** | — | — | — | — | — | **✓** | **✓** | — | — | — | **✓** |
| Playbooks | **✓** | **✓** | **✓** | — | — | **✓**(apply to event) | — | — | **✓** | **✓** | — | — | — | **✓** |
| Timeline Templates | **✓** | **✓** | **✓** | — | — | **✓**(apply) | — | — | **✓** | **✓** | — | — | — | **✓** |
| Floor Plan Templates | **✓** | **✓** | **✓** | — | — | **✓**(apply) | — | — | **✓** | **✓** | — | — | — | **✓** |
| Inventory Items | **✓** | *(no clone verb exists)* | **✓** | — | — | — | — | — | **✓** | **✓** | — | — | — | — |
| Contracts | **✓**(from template) | — | **✓**(draft only) | — | **✓**(send) | — | **✓**(app-layer, at `sent`/`signed`) | — | — | — | *(none — no print/export route at all)* | **✓** | — | **✓**(draft only) |
| Questionnaires | **✓** | — | **✓**(both parties, unguarded by status) | **✓** | **✓**(send) | — | *(never — dead `reviewed` status)* | — | — | — | — | — | — | — |
| Event Orders | **✓** | — | **✓**(while open) | — | — | **✓**(from Package/Inventory/custom lines) | **✓**(enforced, `assertOpen()`) | **✓**(`reopenEventOrder`) | — | — | *(none — no print/export route)* | — | **✓**(`revision` counter) | — |
| Floor Plans | **✓** | **✓** | **✓**(always, even after "Finalized") | — | **✓**(vendor/couple view) | — | *(cosmetic only — `finalizedAt` doesn't gate anything)* | — | — | — | **✓** | — | — | **✓** |
| Payment Plans | **✓** | — | **✓**(while unpaid) | — | *(couple: view-only)* | — | **✓**(per line item, on payment) | — | — | — | — | — | — | **✓**(line items) |
| Event Task Lists | **✓**(apply) | — | **✓** | **✓**(client/vendor-owned tasks) | **✓**(`releasePlaybookApplication`) | — | — | — | — | — | — | — | — | — |
| Invoices | **✓** | — | **✓**(line items — **no guard even post-send**, a known gap) | — | — | — | *(status-only, weakly)* | — | — | — | **✓**(HTML+print, no PDF) | — | **✓**(`createAmendedInvoice`) | — |
| Legal Documents | **✓** | — | *(blocked by DB trigger once inserted)* | — | — | — | **✓**(DB-enforced) | — | — | — | — | — | **✓**(new version required) | — |
| Luv Drafts | **✓**(AI-generated) | — | — | — | — | **✓** | — | — | — | — | — | — | — | *(implicitly, via discard)* |

No asset anywhere uses: Comment, Review, Approve, Reject, Attach (as a first-class verb — attachment exists only as a side-table on Message Templates and Playbook Tasks), Embed, Convert, Initial, Text (as a distinct send-channel verb — SMS is folded into "share/send"), Populate, Calculate (Calculate is real but internal — e.g. `balance_due` recompute — not a user-facing verb), Assign (real for Event Tasks, not modeled above since it's assignment-of-a-task, not of the document itself), Complete (same). These aren't gaps to fill by default — see §10.

---

## 4. Workflow Matrix (Step 4)

Five workflow-driving assets, traced to their real inputs/outputs/side effects. **Inventory was in the brief's example list as a workflow asset but isn't one** — there's no stored per-event inventory list to drive a workflow; it corrected to "Inventory → Floor Plan placement" below.

| Asset | Inputs | Outputs | System state changed | Automations that fire | Relationships updated | Financials updated | Notifications | Decision Engine observations |
|---|---|---|---|---|---|---|---|---|
| **Contracts** | Template + merge fields (client/event data) | Sent link, signed record | `status` draft→sent→signed | Task auto-complete on send/sign (same `triggerAutoComplete` pattern documents use) | Client status can advance on signature | None directly | Sign-link email | Today's Attention / Event Readiness (via the existing Daily Briefing engine) |
| **Payment Plans** | An Invoice total, a due-date cadence | Payment line items, activity log | Line item `pending→processing→paid/overdue/refunded` | `markLineItemPaid` recomputes `invoices.balance_due` via a DB trigger (real, DB-enforced — the one hard-enforced financial rule found in this audit) | None directly | **Yes — invoice balance_due, real-time** | Payment reminders (existing) | Overdue-payment items already surfaced via `data.briefing.needsAttentionNow` (confirmed in the Venue Dashboard Reconstruction phase) |
| **Inventory → Floor Plan placement** | Inventory Item catalog | `InventoryUsage` (computed, not stored) | None — read-only join | None | None | None | None | None — explicitly "reporting only" per its own type comment |
| **Questionnaires** | A sent link, couple's answers | Populated event fields (guest count, timeline anchors, songs) | `status` draft→sent→submitted (never further — `reviewed` is dead) | None found this round tied to submission | Final guest count feeds seating/catering elsewhere in the app (not re-verified this round) | None directly | Submission notification (existing) | Read by `lib/luv/observations.ts` (confirmed a consumer exists, even though the status value it's watching for is unreachable — a real, latent bug) |
| **Event Task Lists** | An applied Playbook | Per-event tasks with due dates | `pending→blocked→complete→overdue→waived`; `dueDateLocked` freezes one task's date against recalculation | `recalculateEventTaskDueDates` on event-date change | Task completion feeds `readinessByKind` (Booking readiness) | None directly | Overdue-task notifications (existing) | Overdue tasks already surfaced via `classifyDashboardItems` (confirmed, Venue Dashboard Reconstruction) |

---

## 5. Template → Working Asset → Locked Record Transitions (Steps 5 & 6)

### Instantiation (Template → Working Asset)

| Template | When instantiated | Who | Multiple instances? | Re-apply? | Replace? | Detach? | Return to template? | Merge updates? |
|---|---|---|---|---|---|---|---|---|
| Contract Template | Coordinator creates a new Contract | Venue staff | Yes (many contracts per template) | N/A (each application is independent) | N/A | N/A (a Contract never references its template after creation — content is copied, not linked) | No | No — template edits never propagate to already-created Contracts |
| Playbook | `applyPlaybookToEvent` | Venue staff | Yes, but in practice one active application per event | Yes (can re-apply) | — | — | No | No |
| Timeline Template | Apply-to-event | Venue staff | One per event in practice | Yes | — | — | No | No |
| Floor Plan Template | Apply-to-event (`applyTemplate`) | Venue staff | One live plan per event (`floor_plans.event_id` is unique) | Yes (overwrites) | — | — | No | No |
| Packages | Added as an Event Order line (`addLineFromPackage`) | Venue staff | Many | Yes | — | — | — | No — line item is a snapshot, not a live reference |
| Message Templates | Selected when composing a message | Venue staff (or an Automation) | N/A — used, not instantiated into a stored copy | — | — | — | — | — |

**Cross-cutting finding:** every Template→Working Asset transition in this product is a **copy**, never a live reference. Editing a template after the fact never changes anything already created from it. This is consistent and simple, but it is a real, load-bearing product decision worth stating explicitly before any "merge template updates into existing instances" feature is ever proposed — none of the underlying data model supports it today.

### Finalization (Working Asset → Locked Record)

| Working Asset | Becomes locked | Who can finalize | What changes after | Amendments allowed? | Cloning allowed? | PDF Representation? | Relationship references |
|---|---|---|---|---|---|---|---|
| Contract | Couple signs (`sign_contract` RPC) | The couple, via the one-time public token | `status→signed`; further edits blocked **at the app layer only** | No — cancel-and-recreate is the only path | Not applicable post-sign | **No — no PDF exists for a Contract anywhere in the app** | The latest/only Contract (there's never more than one live version) |
| Invoice | Marked `paid` or `void` | Venue staff | Line-item edit functions have **no enforced guard even after this** (a real, already-flagged gap) | Yes — `createAmendedInvoice` spins off a new linked draft | Not modeled | No — print is HTML+browser-dialog, not a generated PDF file | The Relationship shows both the original and its amendment, linked by `amendsInvoiceId` |
| Event Order | Coordinator finalizes (`finalizeEventOrder`) | Venue staff | Every mutation blocked by `assertOpen()` until `reopenEventOrder` | Reopen-and-edit is the amendment mechanism (tracked via `revision`) | Not modeled | No — no print/export route exists at all | Latest state only; `revision` history isn't separately browsable |
| Floor Plan | "Finalized" button sets `finalizedAt` | Venue staff | **Nothing — editing stays fully open**, explicitly by design (a checkpoint, not a lock) | N/A — nothing to amend since nothing locked | Yes (`duplicateFloorPlan`) | Yes — a real print/export route exists | Relationship always shows the current live plan; there is no separate "locked version" to reference |

---

## 6. Relationship Integration Map (Step 7)

Where each asset actually surfaces today — confirmed against real routes/components, not assumed.

| Asset | Global Library | Relationship Workspace | Vendor Workspace | Client Portal | Dashboard | Luv | Reporting | Calendar |
|---|---|---|---|---|---|---|---|---|
| Message Templates | `/communication/templates` | used when composing | — | — | — | drafts generated from Luv reuse the same send path | — | — |
| Packages | `/packages`, `/library/packages` | added to Event Order | — | shown read-only where selected | — | — | — | — |
| Contract Templates | `/contracts/templates`, `/library/contracts` | — | — | — | — | — | — | — |
| Playbooks | `/library/playbooks` | applied task list on the booking | — | client-owned tasks, once released | overdue tasks surfaced | overdue-follow-up observations | — | task due dates |
| Timeline Templates | `/library/timeline-templates` | applied timeline | — | shown (read pattern not re-verified this round) | — | — | — | timeline entries |
| Floor Plan Templates | `/library/floor-plan-templates` | applied floor plan | shared, view-only | shared, view-only (edit is a reserved-but-unused flag) | — | — | — | — |
| Inventory Items | `/library/inventory` | placed on a Floor Plan | — | — | — | — | usage reporting (read-only) | — |
| Contracts | — | `/contracts/[id]`, Booking workspace | — | signing link (`/sign/[token]`), read via portal aggregation | — | — | — | — |
| Questionnaires | — | Booking workspace (`final-details-form.tsx`) | — | `/questionnaire/[key]` | — | (dead `reviewed` consumer) | — | feeds ceremony/reception time fields |
| Event Orders | — | Booking workspace | — | not exposed to couple | — | — | — | — |
| Floor Plans | — | Booking workspace | Documents tab (view) | Seating section (view) | — | — | — | — |
| Payment Plans | — | Booking workspace, Payments | — | Payments tab (view-only) | overdue payments surfaced | — | — | due dates |
| Event Task Lists | — | Booking workspace | vendor-owned tasks, own portal | client-owned tasks, once released | Today's Attention | overdue observations | — | due dates |
| Invoices | — | `/invoices/[id]`, Booking workspace | — | Documents/portal aggregation | outstanding-balance metric | — | canonical Revenue metrics | — |
| Vendor Documents | vendor's own library (`/vendor/documents`) | shared into event Documents | vendor Documents tab | shared docs, if flagged couple-visible | — | — | — | — |
| Luv Drafts | — | per-lead/client, via `getDraftsForLead` | — | not exposed | Luv entry point (top-1 only, per Venue Dashboard Reconstruction) | native | — | — |
| FAQs | `/guide` | — | vendor-specific answer override | Venue Guide | — | — | — | — |
| Legal Documents | HQ admin only | — | `/vendor-terms` | portal acceptance flow | — | — | — | — |

**No duplicate ownership found in this map** — every asset has exactly one authoring surface; everywhere else is confirmed to be a filtered read (or, for Floor Plans specifically, a *reserved-but-unused* edit flag that nothing in the UI currently exercises — worth closing formally rather than leaving as dead optionality).

---

## 7. White-Label Requirements Matrix (Step 8)

**Venue branding fields that exist today:** `logoUrl`, `heroImageUrl`, `story`, `primaryColor`, `secondaryColor`, `accentColor`, `neutralColor`, plus business name/contact/legal-address fields. **No typography/font field exists anywhere on the venue record** — confirmed absent from `lib/venue/types.ts` and `lib/venue-brand/`.

| Client-facing output | Logo | Colors | Typography | Footer/contact/legal | PDF? | Print-ready? |
|---|---|---|---|---|---|---|
| Invoice print | ✓ | ✓ (primary, w/ default fallback) | ✗ (no field exists) | ✓ (full address/email/phone/site) | ✗ (HTML+browser print) | ✓ |
| Floor plan print | ✓ | ✓ (primary) | ✗ | ✓ (name only) | ✗ | ✓ |
| Contract signing page | ✓ | ✓ (primary/secondary/accent/neutral — the most complete of any surface) | ✗ | partial (name only) | ✗ (no print/export route at all) | — |
| Inquiry form | ✓ | ✓ (primary/secondary) | ✗ | partial | — | — |
| Tour booking | ✓ | ✓ (primary) | ✗ | partial | — | — |
| Questionnaire (couple-facing) | ✓ | ✓ (primary) | ✗ | partial | — | — |
| Client portal shell | ✓ | ✓ (primary) | ✗ | — | — | — |
| Wedding Website | *(deliberately not venue-branded — the couple's own aesthetic system; not a gap)* | | | | | |
| Timeline / Day Sheet print | not re-verified this round, but confirmed same HTML+browser-print mechanism as Invoice/Floor Plan | | | | ✗ | ✓ |
| Event Order | **No print/export surface exists at all** — not applicable | | | | | |

**Two clean, well-scoped findings, not a sprawling gap:**
1. Every branded surface already threads logo + primary color (often more) consistently, with the same fallback default — this is a real strength, already built correctly, not something to redo.
2. Typography is 0-for-9 not because any surface is doing it wrong, but because **the field doesn't exist yet, anywhere**. Adding one venue-level typography field and threading it through the ~7 already-branded surfaces is a small, additive, well-understood piece of work — not a redesign.
3. **No PDF generation exists in this codebase, period.** Every "print"/"export" is a server-rendered HTML page plus the browser's native print dialog (explicitly stated in the Timeline print page's own docstring: "No new print engine, no PDF library"). If Step 6's "PDF Representation" requirement for Locked Records is meant literally, that's a foundational capability the whole Locked Record concept currently has zero infrastructure for — not a per-asset gap.

---

## 8. Trust & Permission Matrix (Step 9)

| Asset | Owner | May edit | May collaborate | May approve/sign | May view | May download | May archive | Audit trail |
|---|---|---|---|---|---|---|---|---|
| Templates (all 6 venue ones) | Venue | Venue staff only | — | — | Venue staff only | — | Venue staff (`is_archived`) | `updated_at` only — no change history |
| Contracts | Venue | Venue staff (draft only) | — | Couple (signs) | Venue + couple (post-send) | Not possible — no file exists | Not modeled (no archive state) | `sent_at`/`signed_at`/`signer_name` only |
| Questionnaires | Venue/Couple jointly | Both, at any status (no gate) | Both | Nobody — `reviewed` never fires | Venue + couple | — | — | `sent_at`/`opened_at`/`submitted_at` |
| Event Orders | Venue | Venue staff (while open) | — | Venue staff (finalizes) | Venue staff only — **not exposed to the couple at all** | — | — | `event_order_activities` — the most complete audit log found in this system |
| Floor Plans | Venue | Venue staff (always) | Vendors/couple: view-only (edit flag exists, unused) | Nobody — "Finalized" doesn't require approval, it's self-serve | Venue, couple (if shared), vendors (if shared) | — | — | Not modeled |
| Payment Plans | Venue | Venue staff (while unpaid) | — | — | Venue + couple (view-only) | — | — | `payment_activities` |
| Event Task Lists | Venue | Venue + client/vendor for their own tasks | Yes, once released | — | Filtered by `TaskVisibility` | — | — | Not modeled beyond status |
| Invoices | Venue | Venue staff (**unguarded even post-send** — a real trust gap) | — | — | Venue + couple | — | — | `invoice` amendment chain (`amendsInvoiceId`) |
| Legal Documents | HQ (platform-level, above the venue) | HQ admins only | — | — | Venue + vendor + couple (acceptance flow) | — | — | DB-enforced version history (the one real one) |
| Luv Drafts | Venue (system-generated, per relationship) | Venue can edit before sending (not re-verified this round) | — | Venue accepts/discards | Venue only | — | — | `status` transition only |

**The one real trust gap worth naming plainly:** Invoices are the financial record most likely to be treated as authoritative by a venue owner, and they're also the *least* enforced — line-item edits have no status guard even after the invoice has been sent to a client, a gap the code's own comments already acknowledge. Every other "locked" asset in this system is at least app-layer-guarded; Invoices currently aren't, for the one operation (editing amounts) that matters most.

---

## 9. Duplicate Concepts & Phantom Assets Discovered

| Brief's term | Reality |
|---|---|
| "Email Templates" + "SMS Templates" (2 assets) | **One** asset — `message_templates`, each row optionally carrying an email variant and/or an SMS variant |
| "Brochures" | Doesn't exist. Only appears as placeholder copy suggesting what a generic attached Document *could* be |
| "Pricing Sheets" | Doesn't exist separately — pricing lives inside Packages (`base_price`) |
| "Contract Amendments" | Doesn't exist for Contracts (sent = frozen, cancel-and-recreate only). **Invoices** have the only real amendment pattern in the app — a naming mismatch against the brief's assumption |
| "Questionnaire Templates" | Doesn't exist — one hardcoded global structure per event, no venue-level customization or reuse |
| "Inventory Templates" | Doesn't exist as a separate layer — `inventory_items` (the venue-wide catalog) *is* the reusable asset |
| "Checklists" (as distinct from Task Lists) | Same system — "checklist" is UX/marketing language for Event Task Lists, confirmed via the "Bring Your Existing Checklist" importer, which parses into the same `PlaybookTask` rows |
| "BEOs" | Real, under the name **Event Order** — same concept, Booking-Financial-Architecture-era naming |
| "Receipts" as a Locked Record | Doesn't exist as a stored entity at all — computed live from paid payment line items for display. The brief's own Step 2 lists it as an example Locked Record; it isn't one |
| "Timeline Exports" / "Wedding Website Exports" as artifacts | Neither produces a stored file. Both are live, render-on-request views (Timeline: HTML+print dialog; Wedding Website: the published page itself) |
| "Internal SOPs" | Doesn't exist as a venue-facing feature. Two adjacent things exist under different framing: the Success Library (staff-facing best practices, not venue-authored) and the Venue Guide (couple/vendor operational info, not staff procedure) |
| "Vendor Task Templates" | Real, but **vendor-tenant**, not venue-tenant — a naming collision risk against venue Task Templates (Playbooks) if a unified Global Library UI is ever built without keeping the tenant boundary explicit |
| Luv Drafts | Not in the brief's list at all, but a real, persisted asset (`luv_drafts` table, `pending_review → accepted/discarded`) — the opposite of the "ephemeral AI suggestion" this research initially assumed |
| Legal Documents | Not in the brief's list, but the *only* asset in the entire product with true, DB-enforced immutability — the reference pattern for what a real Locked Record should look like |

---

## 10. Product Recommendations Before Implementation

Stated as recommendations only — nothing below has been built or scheduled.

1. **Fix the Invoice editability gap before building anything else on top of it.** It's the one place a "Locked Record" is weaker than its Working Asset state should even allow, and it's already been identified once in the code's own comments without being resolved. This is a bug-fix-shaped item, not new product design.

2. **Resolve "Finalized" before using it as a unifying concept.** It currently means three different things (real lock / cosmetic checkpoint / dead code). Any future Business Asset System that treats "Locked Record" as one coherent state across assets needs these reconciled first — at minimum, decide whether Floor Plans' "Finalized" should become a real lock (matching Event Orders) or be renamed to stop implying one it isn't.

3. **Decide, per phantom asset in §9, whether it's needed at all** before scaffolding data model or UI for it. Brochures, Pricing Sheets, Questionnaire Templates, and per-event Inventory Lists were all named in the original brief as if they already exist or obviously should. Some may genuinely be needed (a real Questionnaire Template system would let venues customize their own final-details form, which today they can't at all); others may already be adequately served by an existing asset under different framing (Pricing Sheets ≈ Packages). This is a product call, not a research finding — flagging that it hasn't been made yet.

4. **`legal_documents`'s immutability trigger is the template to reuse, not reinvent**, for any future "true Locked Record" work — it's the one place in this codebase that already does what Step 6 describes correctly (DB-enforced, not app-layer convention).

5. **PDF generation is a shared foundation, not a per-asset feature.** Before promising "PDF Representation" on any Locked Record (Step 6) or "PDF generation where applicable" (Step 8), the product needs to decide whether that's still the right bar — nothing in this codebase generates a real PDF today, and retrofitting one engine under N different print pages is a materially different (and larger) piece of work than it would look like from any single asset's perspective.

6. **Add venue typography as one small, additive field**, then thread it through the ~7 surfaces that already handle logo/color correctly. Cheap, well-scoped, and the last piece needed to make Step 8's "brand consistency" requirement literally true anywhere.

7. **Wire the already-computed insurance/permit expiry status into an actual alert**, most naturally through the existing Decision Engine (`lib/dashboard-system/decision-engine.ts`) the same way overdue payments and tasks are already surfaced — the computation (`expiryStatus()`) already exists and is unused; this is a "connect two already-built things" gap, not new logic, and was already flagged once before in an earlier Document Domain audit without being closed.

8. **Keep the vendor/venue Task Template tenant boundary explicit** in any future unified Global Library UI (Step 7) — `vendor_task_templates` and `playbook_templates` share a naming pattern but must never appear in each other's library view.

9. **Luv Drafts need their own small lifecycle note, not a forced fit into Template/Working/Locked.** They're relationship-scoped like a Working Asset, but they don't collaborate, don't lock, and their "success" state is being consumed into a different asset (a sent message) rather than becoming evidence of themselves. Worth naming as its own minor pattern — "Draft → Consumed-or-Discarded" — rather than stretching one of the three existing lifecycles to cover it.

**Stopping here, as instructed.** No schema, no components, no migrations were written for this phase.
