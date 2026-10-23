# HTC Commercial Workflow Consolidation — C3 Plan

**Phase:** C3 — Event Commercial Workspace (forensic audit + implementation plan only)  
**Status:** READ-ONLY PLAN — **not implemented**  
**Date:** 2026-10-23  
**Branch:** `feat/spaces-booking-e1-smart-fields`  
**HEAD inspected:** `76961c16507239d49d6932aae1ab85c26bac972a` (C2 evidence commit)  
**Product commits in chain:** C1 `c75bc0fa` · C2 `bc9db111`  
**Sandbox serving (ECS at inspection):** `htc-sandbox-venue-app:bc9db11165beff5856507278faa5f2f0fb57d7a4` (TD `:891`) · deployment `7270285510`  
**Working tree:** ~1003 dirty/untracked paths preserved. **No code, schema, commit, stash, reset, clean, or deploy in this phase.**  
**Production:** untouched.

Evidence basis: current source under `app/`, `components/`, `lib/`; C1/C2 STATUS + AUDIT.md; focused unit/browser harnesses already green for C1/C2. Behaviors labeled **verified** (code path read), **inferred** (structure without re-browser), or **unknown**.

---

## 1. Inspection scope and repository state

### Read

- `AUDIT.md`, `C1-STATUS.md`, `C2-STATUS.md`
- Event shell: `components/events/event-detail.tsx`
- Inventory: `lib/event-inventory/{service,types,handoff}.ts`, `event-inventory-panel.tsx`
- Event Order: `lib/event-orders/{service,types,representation}.ts`, `event-order-panel.tsx`, `event-order-invoice-link.tsx`
- Choices: `lib/client-choices/{service,constants,types}.ts`, `client-choices-panel.tsx`
- Templates Use/Send: `lib/event-order-templates/use-send.ts`
- Invoices: `lib/invoices/service.ts` (freeze-on-send)
- Setup readiness: `lib/event-setup/readiness-detail.ts`, `event-setup-panel.tsx`

### Discrepancies vs prior notes

| Prior note | Current evidence |
| --- | --- |
| Serving often lags HEAD | **Verified:** serving = C2 product `bc9db111`; HEAD = docs `76961c16` (evidence only) |
| Inventory statuses “draft→shared→…→finalized” | **Verified:** also `submitted`, `changes_requested`, `confirmed` (`lib/event-inventory/types.ts`) |
| C1 intro on Event Order tab | **Verified** in source + C1 browser; still on serving image |
| Library Use/Send clarified | **Verified** C2 serving; handlers unchanged |

---

## 2. Verified current behavior (with evidence)

### 2.A Event Inventory

| Topic | Verified behavior | Evidence |
| --- | --- | --- |
| Create / template apply | `ensureEventInventory(eventId, templateId)` copies template items into event-owned rows | `lib/event-inventory/service.ts` |
| Library Use vs Send | Use = ensure only; Send = ensure + `shareEventInventory` (+ notify) | `sendInventoryTemplate`, C2 STATUS |
| Snapshot / price | Items store `unitPrice`, `isIncluded` on event/template rows; catalog has no price | `types.ts`; handoff comments |
| Included vs chargeable | Included items can hand to EO as operational lines; **not** billable for invoice | `handoff.ts` `isInventoryItemBillableForInvoice`; `handoff.test.ts` |
| Client select | `collaborationMode` `view` \| `select`; `clientSelectable` / draft & submitted qty | types + panel CTAs Share to view / Share for selection |
| Submit / review | Statuses: draft → shared → submitted → changes_requested → confirmed → finalized | types; panel Confirm / Finalize |
| EO handoff | Explicit `addToEventOrder` only when **finalized**; pending = items with `addedToEventOrderAt == null`; marks per-item | `addToEventOrder`; blocks if EO finalized |
| Duplicate handoff | Per-item `addedToEventOrderAt`; “Everything here has already been added…” | service |
| Availability reservation | Usage helpers exist; **do not assume** cross-event holds | AUDIT + inventory usage (inferred) |

**Venue UI home today:** event tab `inventory` → `EventInventoryPanel` (`event-detail.tsx`).

### 2.B Event Order

| Topic | Verified behavior | Evidence |
| --- | --- | --- |
| Create / apply template | `ensureEventOrder` / `applyTemplateToEventOrder` / `startOrApplyEventOrderTemplate` | `lib/event-orders/service.ts` |
| Fixed Path A | Library Use without groups → apply only; Finalize → Share on event | `use-send.ts` `SEND_REQUIRES_SELECTABLE_GROUPS_MESSAGE`; EO panel |
| Status | `open` \| `finalized`; share tracked via `sharedAt` (separate from finalize) | `types.ts`; `shareEventOrderWithClient` requires finalized (**verified** in representation / prior QA) |
| Choices on Use | If groups exist, Use creates choices, venue-fills, `finalizeClientChoices({ venueUse: true })` → EO lines | `use-send.ts` |
| Inventory handoff | Adds lines; does not auto-invoice | `addToEventOrder` comments |
| Pre-booking | `planningClientId` + `ensureClientEventOrderAction`; limited share/invoice | `event-order-panel.tsx` `preBooking` |

**Venue UI home today:** tab `event-order` = C1 intro + `ClientChoicesPanel` + `EventOrderPanel`.

### 2.C Client choices (`client_choices`)

| Topic | Verified behavior | Evidence |
| --- | --- | --- |
| Create | Prefer `createClientChoicesFromEventOrderTemplate` (definition freeze) | `client-choices/service.ts` |
| Send | draft→sent; task via `ensureClientOwnedChoicesTask` | `sendClientChoices` |
| Statuses | draft, sent, in_progress, submitted, changes_requested, resubmitted, finalized | `constants.ts` |
| Finalize → EO | Writes EO lines; strips prior `appliedLineIds` (revision-safe); returns `financialDelta`; **never** invoice lines | `finalizeClientChoices` |
| Portal | section `choices` / `#choices` | portal shell (AUDIT + C1 browser) |
| Timing | Event-scoped instances; launch after event exists (Library Send / panel). Pre-booking EO exists separately; choices primarily post-event (**inferred** for edge cases) | panel + use-send |

**Do not merge with inventory selection** — locked product decision; no defect found requiring merge.

### 2.D Invoice and payment plan

| Topic | Verified behavior | Evidence |
| --- | --- | --- |
| Create from EO | `createInvoiceFromEventOrderAction` / Create Invoice CTA when priced | `event-order-invoice-link.tsx` |
| Link draft | `linkEventOrderToInvoiceAction` for unlinked draft (non–booking-commitment) | same |
| Freeze | First **send** freezes billable EO lines onto invoice | `lib/invoices/service.ts` `insertFrozenLinesFromEventOrder` |
| Billable filter | Excludes included / non-priced EO lines from freeze | `billableEventOrderLinesForInvoice` |
| Payment plan | From invoice (`/payments/new?invoiceId=`), never EO-native | invoice-link `eo-create-payment-plan` |
| Later EO changes | Reconciliation / amend paths exist for sent invoices | `compare` / amend in invoices service |

**Venue UI today:** EO tab invoice link + separate tab `invoice` (Payments list).

### 2.E Entry points after C1/C2

| Entry | Role | Keep? |
| --- | --- | --- |
| Library catalogs/templates | Configuration + accurate Use/Send shortcuts | Yes |
| Setup Profiles starting templates | Defaults | Yes |
| Overview Setup Inventory/EO rows | Readiness + Open deep links | Yes (C1) |
| Event Inventory tab | Canonical Path B1 runner | Yes |
| Event Order tab | Canonical Path A / B2 / EO / invoice CTA | Yes — **elevate as commercial home** |
| Payments tab | Invoice list + new invoice | Yes |
| Portal Inventory / Order / Choices | Client-facing | Yes |

---

## 3. Current navigation map

```
Library / Packages / Setup Profiles
        │ (Use/Send/apply / book-time refs)
        ▼
Event Overview Setup ──Open──► #inventory | #event-order   (readiness, not runner)
        │
        ├─ Tab Inventory ── Share / select / confirm / Finalize / Add to Event Order ──┐
        │                                                                              │
        └─ Tab Event Order                                                             │
              ├─ C1 intro (narrative only)                                             │
              ├─ Client selections (client_choices) ── finalize ──► EO lines ──────────┤
              ├─ EventOrderPanel ── Finalize / Share / Invoice link ───────────────────┤
              └─ (hash #event-order)                                                   │
                                                                                       ▼
                                                                         Authoritative Event Order
                                                                                       │
                                                              Create/Link Invoice ─────┤
                                                              Payments tab /invoice    │
                                                              Payment plan on invoice ─┘
```

**Fragmentation (product):** Status of inventory, choices, EO, and invoice live on **three tabs** with no shared progress strip. C1 intro narrates the story but does not surface live next actions from each domain.

---

## 4. Proposed target experience

### Recommendation (smallest coherent home)

**Keep existing tabs.** Make the **Event Order tab** the persistent **commercial workspace** via **UI composition only** (no new top-level nav, no schema):

1. Retain/enhance C1 intro as a **Commercial status strip** (read-only chips derived from existing records).
2. In-page anchors / sub-nav: **Choices · Event Order · Invoice** (scroll/focus within tab).
3. Prominent **cross-link** to Inventory tab (`#inventory`) when inventory capability is on — “Inventory selection & handoff”.
4. Do **not** embed full `EventInventoryPanel` inside Event Order (avoids duplicate mounts, double CTAs, mobile bloat).
5. Payments tab remains the invoice list home; EO invoice link remains the EO→invoice handoff.

### Answers to required questions

| # | Answer |
| --- | --- |
| 1. Start | Event **Event Order** tab (commercial home). Inventory work starts via strip link or Inventory tab. |
| 2. Inventory → client selection | Inventory tab: mark Select → **Share for selection**. |
| 3. Selection → venue review | Inventory: submitted → Confirm → Finalize → **Add to Event Order**. |
| 4. Offerings → client_choices | EO Template choice groups → Library Send or Event Order **Client selections** panel → portal Your Choices. |
| 5. Fixed EO | Apply/Use template → edit → Finalize → Share (**no** choice groups; Send gated). |
| 6. Create/finalize/share EO | Event Order panel (existing CTAs). |
| 7. Invoice / payment plan | EO invoice link → Open Invoice → Create/Open Payment Plan; Payments tab for list. |
| 8. Statuses | Strip shows **existing** statuses only; next action from domain rules (matrix below). Never invent “complete”. |
| 9. Timing | Pre-booking: limited client planning EO (`preBooking`); full commercial runner is **event-scoped**. Post-booking and later: same tabs anytime capabilities allow. |
| 10. Setup / Library | Defaults + readiness + Use/Send shortcuts; always land on event tabs for execution. |
| 11. Client | Portal Inventory / Event Order / Choices only; no new venue approval signatures. |
| 12. Avoid duplication | One panel instance per domain; strip is **read-only**; no second share/send buttons that call the same actions without guards. |

### Proposed navigation map

```
[Event tabs unchanged]
  Inventory  ←── strip “Open Inventory”
  Event Order (Commercial home)
     [Status strip: Inventory | Choices | Event Order | Invoice | Plan]
     [Sub-nav anchors: Choices | Order | Invoice]
     ClientChoicesPanel (unchanged handlers)
     EventOrderPanel (unchanged handlers)
  Payments
```

### Current vs target matrix

| Surface | Current | Target | Action type |
| --- | --- | --- | --- |
| Event Order tab | Intro + Choices + EO stacked | Same + status strip + anchors + Inventory deep link | UI composition / copy |
| Inventory tab | Full lifecycle | Unchanged runner | None (link only) |
| Overview Setup | Readiness + Open | Unchanged | None |
| Library | Use/Send | Unchanged | None |
| New “Commercial” top tab | Absent | **Do not add** | — |
| Schema | Separate domains | Separate domains | **No migration** |

### Desktop / mobile

- **Desktop:** strip + horizontal sub-nav; Choices then EO as today; invoice link in EO card.
- **Mobile (390):** strip collapses to compact next-action + “Open Inventory”; sub-nav as sticky chip row; no parallel panels.

### Proposed copy (illustrative; exact strings in implementation)

- Strip empty: “No Event Order yet — apply a template or start blank below.”
- Inventory shared select: “Client selecting inventory — Open Inventory to review.”
- Choices awaiting: “Client choices awaiting — send or review below.”
- EO open unshared: “Finalize & Share when the order is agreed.”
- Invoice draft: “Draft invoice linked — send from Invoice when ready (freeze on send).”

### Routes

- Prefer existing hashes: `#event-order`, `#inventory`, `#invoice`.
- Optional fragment anchors: `#event-order-choices`, `#event-order-invoice` (implement only if scroll targets added; alias-safe).

---

## 5. Workflow diagrams

### 5.A Inventory selection (Path B1)

```
[Inv Template Use | ensure | setup editor]
        → draft Event Inventory
        → (optional) mark clientSelectable
        → Share to view | Share for selection
        → Client portal Inventory (view or qty)
        → submit → submitted
        → Venue Confirm → confirmed
        → Finalize → finalized
        → Add to Event Order (pending items only)
        → EO lines (included = non-billable for invoice)
```

### 5.B Client-selectable offerings (`client_choices`, Path B2)

```
[EO Template with groups]
  Library Send | panel create+Send
        → client_choices draft → sent
        → Portal Your Choices → submit
        → Venue Request changes | Finalize
        → EO lines (appliedLineIds tracked)
        → financialDelta → review invoice if needed
```

### 5.C Fixed Event Order (Path A)

```
[EO Template no groups]
  Library Use / Apply | event Start/Apply
        → EO open (fixed lines)
        → edit
        → Finalize → Share (portal Event Order)
        → Create/Link Invoice (if priced)
        → Payment plan on invoice
```

### 5.D Event Order → Invoice → Payment Plan

```
Event Order (open or finalized; share optional for invoice create)
  → Create Invoice | Link draft invoice  (EO-linked)
  → Draft projects billable lines
  → Send invoice → freeze billable lines once
  → Create Payment Plan (invoiceId) | Open existing plan
```

### 5.E Status / next-action matrix (only states that exist)

| Domain | State | Next actor | Typical next action |
| --- | --- | --- | --- |
| Inventory | none / missing | Venue | Ensure / Open Inventory |
| Inventory | draft | Venue | Edit, Share to view/select |
| Inventory | shared | Client (or venue) | Portal interact / venue wait |
| Inventory | submitted | Venue | Confirm or request changes |
| Inventory | changes_requested | Client | Resubmit |
| Inventory | confirmed | Venue | Finalize |
| Inventory | finalized | Venue | Add to Event Order (if pending) |
| Choices | draft | Venue | Send to Client |
| Choices | sent / in_progress | Client | Portal choose |
| Choices | submitted / resubmitted | Venue | Finalize or request changes |
| Choices | changes_requested | Client | Update |
| Choices | finalized | — | Lines on EO; finance if delta |
| EO | none | Venue | Start blank / apply template |
| EO | open, unshared | Venue | Edit, Finalize |
| EO | finalized, unshared | Venue | Share |
| EO | shared | Client (read) | Venue may revise per gates |
| Invoice | none | Venue | Create/Link from EO (if priced) |
| Invoice | draft | Venue | Send (freeze) |
| Invoice | sent+ | Client/venue | Pay / plan |
| Plan | none | Venue | Create from invoice |
| Plan | exists | Venue/client | Open plan |

**Unknown / do not invent:** a single cross-domain “commercial_complete” flag — **not** in schema; strip must compose from the above.

---

## 6. Incremental implementation sequence (for later authorization)

### C3.1 — Commercial status strip + Inventory deep link (nav/UI only)

- **Outcome:** Event Order tab shows live chips + “Open Inventory”; no handler changes.
- **Likely files:** `event-detail.tsx`; small presentational component e.g. `event-commercial-status-strip.tsx`; optional pure helpers reading already-loaded props (`eventInventory`, `clientChoices`, `eventOrder`, `invoices`, `linkedScheduleId`).
- **Unchanged:** all share/finalize/invoice/selection services.
- **Tests:** unit tests on next-action derivation; extend C1 browser for strip testids.
- **Browser:** Event Order 1280/390; Open Inventory → `#inventory`; C1 intro still present or merged carefully.
- **Data checks:** none (read-only UI).
- **Risk:** false “done” chips — mitigate by mapping only verified statuses.
- **Type:** UI composition + copy.
- **Rollback:** remove strip component; keep tabs.

### C3.2 — In-tab anchors (Choices / Order / Invoice)

- **Outcome:** sub-nav scrolls/focuses existing panels; optional `#event-order-choices` aliases.
- **Files:** `event-detail.tsx`, maybe wrappers with `id=` on Choices / EO invoice block.
- **Unchanged:** panel internals.
- **Tests:** hash/anchor presence tests; playbook deep-link regression (`#event-order` still works).
- **Type:** Navigation only.
- **Depends on:** C3.1 optional but recommended together.

### C3.3 — Next-action copy alignment (no new CTAs)

- **Outcome:** Strip and empty states use shared vocabulary (Awaiting client / Venue to act) matching `clientChoicesNextActor` / inventory STATUS_LABEL.
- **Files:** strip + minimal panel CardDescription tweaks if contradictory.
- **Unchanged:** buttons and actions.
- **Type:** Copy.
- **Risk:** drift from C2 Library wording — keep glossary consistent.

### C3.4 — Verification pack (no product change)

- Re-run: `commercial-c1-terminology`, `use-send`, inventory `client-selection` / `handoff` tests, `eo-freeze-billable`, C1+C2 browser harnesses.
- Targeted browser: Path A fixed (no send email if possible — stop before Share), Choices panel visible, Inventory strip link, invoice link visible without send.
- **Do not** send invoices or couple emails in smoke unless dedicated sandbox fixtures.

### Explicitly **not** in C3 implementation

- Schema migrations; merging selection runtimes; embedding full Inventory panel; new top-level Commercial tab; changing freeze-on-send; Setup row deletion (C6); Library handler changes.

### Essential vs optional

| Essential | Optional |
| --- | --- |
| Status strip from existing props | Animated progress |
| Inventory deep link | Embedding inventory summary lines |
| Preserve all handlers | Renaming Payments tab |
| Anchor ids if sub-nav added | Full-page commercial redesign |

**Schema migration:** **Not required** — domains already support the workflows; C3 is composition.

---

## 7. Risk register

| Risk | Evidence | Impact | Mitigation | Pass criterion |
| --- | --- | --- | --- | --- |
| Fixed EO without groups | `use-send` Send gate | High if strip pushes Send | Strip Path A = Finalize/Share | Fixed template never requires choices |
| Included inventory charged | `isInventoryItemBillableForInvoice` | Financial | No change to handoff/invoice filters | Included lines not in freeze set |
| Duplicate EO lines | `addedToEventOrderAt`; choices `appliedLineIds` | Data integrity | No new auto-handoff | Re-run handoff / finalize tests |
| Duplicate tasks/emails | share/send create tasks/notify | Spam | Strip is display-only; no new share CTAs | Navigation-only session creates 0 new shares |
| Resubmission / re-apply | choices finalize removes prior lines | Correctness | Don’t alter finalize | Existing client-choices tests |
| EO after share | share/finalize gates | Ops confusion | Strip shows sharedAt | Prior EO share QA still green |
| Invoice freeze | freeze on first send | Money | Don’t touch invoices service | `eo-freeze-billable` tests |
| Auth / tenant scope | existing withVenue | Security | No new APIs | Same eventId props only |
| Setup readiness | C1 Open CTAs | Regression | Don’t change readiness-detail | C1 browser subset |
| Portal parity | portal sections | Client access | No portal removals | C1 portal checks |
| Pre- vs post-booking | `preBooking` EO | Wrong CTAs | Strip only when `eventId` present | No strip on client-only planning if unsupported |
| Mobile nav | many tabs | UX | Compact strip | 390 screenshot |
| Dirty tree deploy | ~1003 paths | Isolation risk | Commit only C3 files (when authorized) | Same C1/C2 procedure |

---

## 8. Unresolved product decisions

Only items **not** fully locked by the prompt / C1–C2 defaults:

1. **Strip density:** chips-only vs chips + one primary CTA that deep-links (still no new handlers)?  
   - *Default recommendation:* chips + deep-link buttons only (“Open Inventory”, “Review choices”, “Open Invoice”) — no second Share/Finalize.  
   - *Trade-off:* fewer clicks vs accidental duplicate actions if CTAs were duplicated.

2. **Rename Event Order tab to “Commercial”?**  
   - *Default:* **No** — keep tab id `event-order` for deep links; optional subtitle “Commercial workspace” in strip (C1 already).  
   - *Trade-off:* clearer IA vs broken hashes/playbooks.

3. **Show inventory pending-handoff count on strip?**  
   - *Default:* Yes if `eventInventory` already loaded (computed client-side from items).  
   - *Trade-off:* helpful vs empty when inventory capability off.

No decision is required to **reject** merging inventory selection with `client_choices`.

---

## 9. What is not implemented

- No C3 UI, routes, schema, tests added as product code in this phase (this file only).
- No Sandbox/Production deploy for C3.
- No claim that the unified status strip exists on serving (`bc9db111` has C1 intro only).
- Stock reservation across events not verified as complete product behavior.
- Full Path A Share / invoice Send not re-browsered in this read-only phase (rely on prior harnesses + code).

---

## 10. Legend

| Label | Meaning |
| --- | --- |
| **Verified current behavior** | Traced in current source (and/or prior green harness cited) |
| **Proposed target behavior** | Recommended C3 experience — **not built** |
| **Assumptions / unknowns** | Marked unknown/inferred above |

---

## Stop

**C3 plan complete.** Await explicit authorization before any C3.1+ implementation. Do not start C4 automatically.
