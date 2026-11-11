# Client Choices — Implementation Plan (no code)

**Status:** Plan only. **IMPLEMENTATION STATUS: NOT READY** until this plan is approved.  
**Do not:** implement, migrate, deploy, commit, seed, or alter Sandbox/Production.

**Approved architecture:** `UX-ARCHITECTURE-DECISION.md`  
**Locked mental model:**

```
Choices Template / Library
  → Create Client Choices
  → Send to Client
  → Client completes / submits
  → Venue reviews
  → Venue finalizes
  → Event Order
  → existing Invoice / Payment Plan machinery
```

---

## 0. Code inspection findings (A–J)

### A. Template / library architecture that can be reused

| Existing library | What it is | Reuse for Choices? |
|---|---|---|
| **Event Order templates** (`event_order_templates` + sections/lines; `lib/event-order-templates/*`; Library → Event Order Templates) | Venue-authored delivery structure; apply copies offering snapshots **directly into Event Order** | **Reference pattern only** for library UX + offering-backed lines. **Do not** use EO template apply as the collaborative path (that skips client Submit / venue Finalize). |
| **Questionnaire templates** (`lib/questionnaire-templates/*`; Library → Questionnaire) | Free-text / family field authoring; instance = `event_questionnaires` | **Lifecycle + library UX pattern only.** Wrong payload (answers ≠ priced offering selections). Must not become Choices. |
| **Packages** | Booking catalog → L1/L2 | **Do not use** for post-contract Choices (wrong commercial SoT). |
| **Offerings catalog** (`offerings`, `offering_categories`; `lib/offerings/*`) | Reusable “things we can provide” with optional `inventory_item_id` + `default_unit_price` | **Reuse directly** as the option identity / default price source for Choices options and EO lines. |
| **Inventory catalog / event inventory** | Physical stock + event allocation → optional add-to-EO | **Reference** for allocation after finalize when option is inventory-linked. Not the collaborative picker. |

**Minimum new library object:** **Choices templates** (venue-scoped), structurally similar to EO templates (sections + option rows referencing offerings) but with selection semantics (required/optional, single/multi, included vs additional-cost) that EO templates do not model as client choices.

### B. Event Order creation / update APIs and data model

**Tables / types:** `event_orders` (`open` \| `finalized`, `revision`, `shared_at`), `event_order_sections`, `event_order_lines` (provenance: `package` \| `inventory` \| `custom` \| `offering`; optional price; `is_included`), `event_order_activities`, `event_order_share_snapshots`.

**Service surface (`lib/event-orders/service.ts`):**

- `ensureEventOrder` / `ensureEventOrderForClient`
- `applyTemplateToEventOrder` / `startOrApplyEventOrderTemplate`
- `addLineFromOffering` / `addLineFromInventory` / `addCustomLine` / `updateLine` / `removeLine`
- `finalizeEventOrder` / `reopenEventOrder`
- Share path: `shareEventOrderWithClient` → document-domain + share snapshot (`lib/event-orders/representation.ts`, `document-integration.ts`)

**Lifecycle gates:** mutations blocked when `finalized`; share requires finalized; reopen clears edit lock but client still sees last share until re-share.

**Implication for Choices Finalize:** Apply accepted selections by calling **existing** EO line APIs (primarily `addLineFromOffering` / `updateLine` / `removeLine`) after ensuring EO is **open** (reopen if needed). Do **not** invent parallel EO tables or make EO client-editable.

### C. Documents architecture (both portals)

**Workspace union:** `WorkspaceDocType` = `document` \| `contract` \| `invoice` \| `floor_plan` \| `questionnaire` \| `event_order` (`lib/document-workspace/types.ts`). Surfaced via `get_venue_documents` SQL + `describeExperience` (`experience.ts`). Questionnaire already maps statuses → “who acts next”; Event Order maps finalize/share.

**Canonical document domain:** EO uses `behavior: 'venue_authored'` on share — freeze PDF/version; **business object remains authoritative** (`document-integration.ts` comment: no client editing). Questionnaire appears as a **working_record** in the union, not as a full negotiated document framework.

**Implication:** Finalized Client Choices should:

1. Remain a first-class business object (like questionnaire / EO).
2. Appear in Documents via **extending** `WorkspaceDocType` + `get_venue_documents` + experience matrix (same pattern as `questionnaire` / `event_order`).
3. Optionally publish a **venue_authored** (or shared finalized) PDF via document-domain **at Finalize / Share**, mirroring EO — **not** by building a generic document/workflow engine.

Do **not** store Choices only as a loose `documents` row of category `menu` — that loses status, collaboration, and EO linkage.

### D. Tasks / Next Steps / notifications

| Mechanism | Location | Reuse |
|---|---|---|
| Playbook / `event_tasks` | `lib/playbooks/*` | Create or complete client-owned tasks; `action_type` routes portal; `auto_complete_trigger` + `triggerAutoComplete()` |
| Portal Next Steps | `lib/portal/next-steps.ts`, `unified-tasks.ts`, Home `#your-next-steps` | Wire new trigger → section `choices` + CTA |
| Questionnaire / EO precedents | `questionnaire_submitted`, `event_order_shared` | Same pattern for `client_choices_sent` / `client_choices_submitted` / `client_choices_finalized` |
| Notifications | `lib/notifications/*` (task reminder/overdue email) | Prefer task-backed reminders; avoid calendar events |
| Calendar | Explicitly **out** | Do not create calendar events for Choices statuses |

**Implication:** On Send → ensure a client-owned event task (or auto-complete path) targeting portal Choices. On Submit → complete that task + notify venue (task complete / in-app or email). On Finalize → optional venue task for “review invoice / payment plan” only when $ changed — reuse existing invoice drift + payment-plan review UX, not a new calendar item.

### E. Client portal routing / navigation

- Sections registered in `portal-shell.tsx` (e.g. `questionnaire`, `event-order`).
- APIs: `/api/portal/questionnaire`, `/api/portal/event-order`.
- Tasks map via `TRIGGER_WORKSPACE` / `ACTION_TYPE_WORKSPACE` in `lib/portal/unified-tasks.ts`.
- Documents: `CoupleDocumentsPortalSection`.

**Implication:** Add portal section **`choices`** (“Your Choices”), deep-linkable from Next Steps. Active while status is client-actionable; after finalize, still readable + Documents entry.

### F. Venue event workspace surface

`components/events/event-detail.tsx` tabs include **Event Order** (`EventOrderPanel`), Inventory, Documents, Invoice/Payments, etc. Questionnaire lives under Overview / family panel, not as EO sibling.

**Implication:** Primary home = **new card/panel on the Event Order tab** (sibling above/beside `EventOrderPanel`), CTA “Create Choices” / “Review Choices”. Optional secondary deep-link from client workspace. Library authoring under **Library → Choices templates** (parallel to Event Order Templates / Questionnaire templates). Prefer **not** a brand-new top-level event tab unless UX review insists — tab sprawl is a risk; sibling on EO tab matches approved entry point.

### G. Offerings / inventory models

- **Offering** = catalog identity + default price + optional `inventory_item_id`.
- **EO line** = event delivery snapshot (`offering_id`, qty, unit price, `is_included`).
- **Event inventory item** = allocation; `markAddedToEventOrder` after handoff.

**Authoritative state by stage (must not collapse):**

| Stage | Authoritative |
|---|---|
| Catalog | `offerings` / `inventory_items` |
| Template option | Choices template option → `offering_id` (+ selection rules) |
| Working / submitted | Client Choices instance answers + **price snapshot at send** |
| Finalized delivery | **Event Order lines** |
| Physical allocation | Event inventory (if inventory-linked), updated on finalize where product already does EO handoff |
| Money owed | **Invoice** (projected/frozen/amended from EO) |
| Installments | **Payment schedule** vs commitment reconcile |

### H. Invoice projection / amendment path after finalization

Exact existing path (`lib/invoices/service.ts`, `repository.ts`, UI `EventOrderDriftBanner`):

1. Draft invoice linked to EO → **live projection** of EO lines (`projectEventOrderLines` in `getInvoice`).
2. Send → **freeze** EO lines onto `invoice_line_items` (`insertFrozenLinesFromEventOrder`) + `event_order_revision_at_freeze`.
3. Later EO change → `getEventOrderDrift` compares frozen vs current EO lines.
4. Coordinator: **Revert to draft** (if unpaid) **or** `createAmendedInvoice` (sent/paid; original untouched until amendment sent).

**Implication:** Choices Finalize must **only** mutate Event Order (when needed). Then surface existing drift / draft projection — **do not** write invoice lines directly from Choices.

### I. Payment-plan reconciliation (additions / removals)

`lib/payments/reconcile-commitment.ts`: when commitment/invoice total ≠ schedule total → `current` \| `auto_recalc` \| `needs_review` \| `locked` (activity). UI already blocks request payment with “Payment plan needs review.”

**Implication:** After financially consequential EO → invoice update, run/reuse the same reconcile classification; do not invent a Choices-specific payment ledger. Removals after money collected → locked / amendment / credit path already owned by invoice+payments.

### J. Version / history patterns (client submit vs venue finalize)

| Precedent | Mechanism |
|---|---|
| Questionnaire | Append-only `questionnaire_submissions` snapshots; status `changes_requested` keeps prior submissions; activities table |
| Event Order share | `event_order_share_snapshots` + canonical document versions on share; reopen does not erase last client-visible share |
| L2 | Snapshot at accept |

**Implication:** Mirror **questionnaire_submissions** for Client Choices: every client Submit/Resubmit appends a snapshot. Venue Finalize stores a **finalized snapshot** (and optionally document version) without overwriting submission history. Working row may advance; history is append-only.

---

## 1. Can working Client Choices reuse document/template/version infrastructure?

**Short answer: reuse patterns and document *representation*; do not reuse questionnaire/EO/L2/document-domain as the working editor.**

| Approach | Verdict | Why |
|---|---|---|
| Store Choices only as `canonical_documents` + versions | **Reject** | Document domain is representation/share for venue-authored or signed artifacts; not a collaborative selection state machine with offerings, quantities, and EO apply. EO itself keeps business tables + uses documents only at share. |
| Reuse `event_questionnaires` | **Reject** | Text/family fields; no offering/price/EO apply; vocabulary collision; would corrupt questionnaire product. |
| Reuse `event_orders` as collab surface | **Reject** | Locked decision; venue-authored delivery SoT; share is read-only for client. |
| Reuse L1/L2 | **Reject** | Booking commitment SoT. |
| New **Client Choices** domain tables + lifecycle patterned on questionnaire + apply into EO + Documents union + optional PDF at finalize | **Accept (minimum)** | Smallest real object that preserves collaboration, history, and financial integrity. |

**What to reuse without new frameworks:**

- Questionnaire **status / who-acts / submission snapshot / request-changes** pattern  
- EO template **library authoring UX** + offering snapshotting helpers (`lib/event-order-templates/offerings.ts`)  
- EO **line mutation APIs** on finalize  
- Invoice drift / amend / payment reconcile **as-is**  
- Document workspace **union extension** + optional document-domain share like EO  
- Playbook tasks + portal Next Steps routing  

---

## 2. Minimum lifecycle / status model

Mirror questionnaire’s “who needs to act” discipline; replace terminal `complete` with **`finalized`** (EO apply boundary).

| Status | Who acts next | Client editable? | Mutates EO / Invoice? |
|---|---|---|---|
| `draft` | Venue | No | No |
| `sent` | Client | Yes | No |
| `in_progress` | Client | Yes | No |
| `submitted` | Venue | No | No |
| `changes_requested` | Client | Yes | No |
| `resubmitted` | Venue | No | No |
| `finalized` | — | No | **Already applied** at transition |

**Collapse rule:** `sent` and `in_progress` are both “client’s turn” (same as questionnaire). `submitted` and `resubmitted` are both “venue review.” Do **not** add `ready_to_finalize` as a separate stored status — that is `submitted`/`resubmitted`.

**Critical invariants:**

- Client Submit / Resubmit → append submission snapshot; **never** EO/invoice.  
- Venue Finalize → apply to EO → then existing financial path if amounts changed.  
- Venue Request changes → unlock client; **never** delete prior submissions.

---

## 3. Minimum new architecture (and why existing objects cannot substitute)

### New tables (proposed — plan only)

1. **`client_choices_templates`** (+ sections, choice_groups, options)  
   - Why new: EO templates apply to EO without client loop; questionnaire templates are wrong payload.  
2. **`client_choices`** (instance: event_id, venue_id, template_id, status, access/key or portal auth, sent/submitted/finalized timestamps, changes_requested_note, event_order_id applied, finalized_revision)  
   - Why new: no existing event-scoped collab object with offering selections + finalize→EO.  
3. **`client_choices_items` / answers** (working selection state: group, selected option ids, qty, notes, included/additional flags, price snapshot)  
4. **`client_choices_submissions`** (append-only jsonb snapshots — copy questionnaire pattern)  
5. **`client_choices_activities`** (sent, submitted, changes_requested, finalized, applied_to_event_order, …)

### Optional thin extensions (not new systems)

- `WorkspaceDocType` + `get_venue_documents` + experience matrix: add `client_choices`  
- Playbook: `TaskActionType` `client_choices`; triggers `client_choices_submitted`, `client_choices_finalized` (and optionally sent reminder via task due dates)  
- Portal section `choices`  
- Document-domain type `client_choices` at finalize/share only  
- EO line metadata (optional): `source_client_choices_id` / submission id for audit — prefer activity + submission snapshot if column sprawl is undesirable; only add FK if needed for idempotent re-apply  

### Explicitly not new

Second invoice/payment system · collaborative EO · generic workflow engine · generic document framework · new commercial_selections · calendar workflow · mutating FE contracts

---

## 4. Implementation phases (dependency order)

### Phase 0 — Schema + domain constants (no UI)

- Migrations for templates + instance + submissions + activities + RLS  
- Types, status helpers (who-acts), lifecycle gates (client editable / venue finalize only)  
- Unit tests for status transitions  

### Phase 1 — Library: Choices templates

- CRUD under `/library/choices-templates` (mirror EO template / questionnaire library patterns)  
- Options bind to **offerings**; capture selection rules (required, single/multi, included vs additional, qty allowed)  
- Starter templates optional (Wedding Dinner, Bar, …) — can defer to Phase 1b  

### Phase 2 — Venue event surface: create / customize / send / review

- Sibling panel on Event Order tab  
- Create from template → event instance  
- Customize instance (without mutating template)  
- Send → status `sent`; create/route client task; email via existing messaging/notification patterns used by questionnaire send  
- Review UI: show latest submission vs working; Request changes; **Finalize** gated  

### Phase 3 — Client portal: Your Choices

- Portal section + API  
- Guided form (select / qty / notes)  
- Save draft (`in_progress`); Submit (`submitted` + snapshot)  
- Next Steps CTA  
- Read-only after submit until changes_requested  

### Phase 4 — Finalize → Event Order apply

- Ensure EO exists; reopen if finalized  
- Diff accepted selections vs current EO lines; add/update/remove offering lines via **existing** service APIs  
- Idempotent apply (re-finalize / revision)  
- Activity on both Choices and EO  
- Price-neutral changes still update EO descriptions/lines  
- Share EO remains a separate venue action (or prompt “Share updated Event Order?”) — do not auto-spam  

### Phase 5 — Financial consequence surface (reuse only)

- After apply: if linked draft invoice → already projects  
- If sent/paid invoice → compute drift; deep-link to existing `EventOrderDriftBanner` / amend / revert flows  
- If schedule mismatch → existing payment-plan needs review  
- Venue toast/banner: “Event Order updated. Review invoice / payment plan if totals changed.”  
- **No** auto-charge, **no** silent schedule rewrite when `needs_review`/`locked`  

### Phase 6 — Documents + permanence

- Include Client Choices in venue Documents union + client Documents  
- Finalize snapshot PDF optional but recommended for permanent record  
- Link summary: Choices ↔ EO ↔ invoice impact  

### Phase 7 — Post-finalize revision

- “Revise Choices” → new working cycle (new version or reopen with clear prior finalized snapshot retained)  
- Second Finalize re-applies EO + financial path again  
- Never mutate FE contract  

### Phase 8 — Hardening

- Inventory-linked allocation handoff where product already connects offerings→inventory→EO  
- Permissions/RLS portal probes  
- Browser E2E + financial integrity scenarios below  

---

## 5. Exact files / modules likely to change

### New (expected)

- `supabase/migrations/*_client_choices*.sql`  
- `lib/client-choices/{types,constants,lifecycle-gates,repository,service,apply-to-event-order}.ts`  
- `lib/client-choices-templates/{types,repository,service}.ts`  
- `app/(app)/library/choices-templates/**`  
- `app/(app)/events/[id]/client-choices-actions.ts`  
- `components/client-choices/**` (venue panel, review, finalize confirm)  
- `components/portal/choices-section.tsx`  
- `app/api/portal/choices/route.ts` (+ submit/save endpoints as needed)  
- Tests under `lib/client-choices/*.test.ts`, portal routing tests  

### Extend (existing)

- `components/events/event-detail.tsx` — mount Choices panel on EO tab  
- `components/event-orders/event-order-panel.tsx` — optional cross-link only  
- `lib/document-workspace/{types,experience,normalize,configuration-matrix,permission-matrix}.ts`  
- `supabase/migrations` replacing `get_venue_documents` (add `client_choices` union arm)  
- `lib/playbooks/{types,constants}.ts` + seed/docs if needed  
- `lib/portal/{unified-tasks,next-steps,workspace-routing}.ts`  
- `components/portal/portal-shell.tsx`  
- `lib/event-orders/service.ts` — **only** if apply needs a batched helper; prefer calling existing add/update/remove  
- `lib/notifications/templates.ts` / obligation prefs — only if new email templates required  
- Couple documents portal filter if doc types are enumerated  

### Likely untouched (see §11)

- Contract FE mutation paths  
- L1/L2 commercial proposal core  
- Invoice freeze/amend algorithms (call, don’t rewrite)  
- Payment reconcile math (call, don’t rewrite)  
- Calendar domain  

---

## 6. Data-model changes (summary)

**Add:** Choices template tree; Choices instance; working answers; append-only submissions; activities; RLS; indexes on `(venue_id, event_id)`, status.

**Extend:** Documents workspace doc_type checks; playbook action_type / auto_complete_trigger enums if DB-constrained; portal capabilities if Choices is capability-gated (default: available when instance exists / shared).

**Do not change:** `invoices` / `payment_schedules` schema for Choices; `contracts`; `commercial_selections` as Choices store.

**Optional FK:** `client_choices.event_order_id` set on finalize; EO activity referencing choices id.

---

## 7. Existing services / actions to reuse

| Need | Reuse |
|---|---|
| Offering catalog | `lib/offerings/service.ts` |
| EO ensure / line CRUD / reopen / finalize EO | `lib/event-orders/service.ts` |
| EO share / PDF | `representation.ts`, `pdf.ts`, `document-integration.ts` |
| Invoice create/link/project/drift/amend/revert | `lib/invoices/service.ts` + invoice actions + `EventOrderDriftBanner` |
| Payment plan mismatch | `lib/payments/reconcile-commitment.ts` + existing payment UI |
| Task complete on milestone | `triggerAutoComplete` |
| Portal Next Steps | `unified-tasks` + `next-steps` |
| Documents union experience | `describeExperience` pattern |
| Email send patterns | Questionnaire send / share messaging (same transport) |

---

## 8. New services / actions genuinely required

| Action | Responsibility |
|---|---|
| Template CRUD | Library authoring |
| `createClientChoicesFromTemplate(eventId, templateId)` | Instance + snapshot option definitions |
| `sendClientChoices` | Status + task + notify client |
| `saveClientChoicesAnswers` (portal) | Working state; `in_progress` |
| `submitClientChoices` | Lock client; append submission; notify venue |
| `requestClientChoicesChanges` | Unlock; note; preserve history |
| `finalizeClientChoices` | Venue-only; append finalized snapshot; **applyToEventOrder**; return financial follow-up flags |
| `applyClientChoicesToEventOrder` | Pure mapping + EO API calls; price-neutral vs consequential detection |
| `getClientChoicesForPortal` / venue getters | Read models |
| Document union + optional PDF publish on finalize | Representation only |

---

## 9. Portal / UI surfaces affected

**Venue**

- Library → Choices templates  
- Event → Event Order tab → Client Choices panel  
- Documents workspace list (new doc type)  
- Invoice page (existing drift banner after EO change)  
- Payments (existing needs review)  
- Tasks (venue review task optional)  

**Client**

- Your Next Steps  
- Nav: Your Choices  
- Documents (finalized record)  
- Event Order (after venue shares updated EO)  
- Payments (if new obligation appears via existing invoice flow)  

---

## 10. Test strategy

1. **Unit:** status gates; who-acts; submit ≠ finalize; finalize blocked for client; apply mapping (included $0, add-on $, multi add-on, remove, price-neutral rename); reconcile classification inputs after totals change.  
2. **Service/integration (DB tests where repo pattern exists):** create→send→submit→changes→resubmit→finalize; submission history length; EO line counts/amounts; draft invoice projection; drift after sent invoice.  
3. **Portal routing tests:** Next Steps → `#choices`; action_type mapping.  
4. **Document workspace tests:** experience status for each Choices status; union includes finalized.  
5. **Regression:** EO venue-authored unchanged; questionnaire untouched; FE contract immutable.  

---

## 11. Browser E2E scenarios

1. Venue creates Dinner Choices from template on booked event EO tab → Send.  
2. Client sees Next Steps “Complete dinner choices” → selects included entrée → Submit → **no** invoice change.  
3. Venue finalizes → EO shows Salmon (or equivalent) → client Documents shows finalized Choices; Event Order share still separate.  
4. Client add-on $750 path: submit → finalize → draft invoice projects / sent invoice shows drift → venue amends or reverts per existing UI → payment plan review if mismatch.  
5. Multiple add-ons $1,650 same path.  
6. Request changes → client revises → resubmit → prior submission still visible to venue.  
7. Post-finalize revise + re-finalize.  
8. Mobile 390: client form + venue review.  

---

## 12. Financial integrity scenarios

| Case | Expected |
|---|---|
| A Included / $0 | EO line update only; no amend; no schedule churn |
| B Add-on $750 | EO priced line; draft projects or sent→drift→amend/revert; schedule reconcile |
| C Multi $1,650 | Same as B, summed |
| D Removal after finalize | EO remove/update; drift; if paid → amend/credit path, not silent rewrite; history retained |
| E Price-neutral swap | EO description/offering update; fingerprint may change; **no** payment noise if totals unchanged (drift summary may note non-price line change — dismissible) |
| Submit without finalize | Invoice/EO unchanged |
| FE contract | Untouched in all cases |

---

## 13. Version / history scenarios

1. Submit #1 snapshot preserved after Request changes.  
2. Resubmit #2 appends; #1 readable.  
3. Venue edits working copy before finalize **must not** erase #2; finalize records finalized snapshot distinctly (venue acceptance of #2 ± venue adjustments — product rule: prefer finalize = accept latest submission; venue line tweaks happen on EO after apply or explicitly before finalize with audit).  
4. Re-finalize revision keeps prior finalized snapshots.  
5. Client always sees which version is authoritative (Finalized vs Submitted awaiting review).  

**Recommended finalize rule (plan lock):** Finalize applies the **latest client submission** (plus any venue-approved adjustments captured as an explicit pre-finalize edit with activity). Do not silently overwrite submission rows.

---

## 14. What must remain untouched

- Fully Executed contracts (no silent rewrite)  
- L1/L2 as booking commitment SoT  
- Invoice freeze/amend/drift algorithms (invoke only)  
- Payment schedule reconcile rules (invoke only)  
- Event Order as non-collaborative client editor  
- Calendar as Choices workflow engine  
- Production/Sandbox data in this plan phase  
- Credential rotation / shared login changes  

---

## 15. Minimum implementation surface (one screen)

| Layer | Minimum |
|---|---|
| Data | Templates + instance + answers + submissions + activities |
| Venue UI | Library templates + EO-tab Choices panel |
| Client UI | Portal Your Choices + Next Steps |
| Apply | `finalize` → EO line APIs |
| Money | Existing invoice + payment-plan UX only |
| Docs | Workspace union + optional finalize PDF |
| Tasks | action_type + 1–2 auto_complete triggers |

Anything beyond that (generic engines, second ledgers, collab EO) is out of scope.

---

## 16. Open points for approval (non-blocking to plan, decide before Phase 0)

1. Sibling card on EO tab vs dedicated event tab.  
2. Whether Finalize auto-prompts “Share Event Order” or leaves share manual.  
3. Whether venue may adjust selections before Finalize without a new client submission (recommend: yes, with activity; snapshot still keeps client submission).  
4. Phase 1 starters now vs later.  
5. Whether inventory allocation auto-runs on finalize for inventory-linked offerings in v1 or defers to existing Inventory → EO handoff.  

---

## IMPLEMENTATION STATUS: NOT READY

This document is the implementation plan only. **No code, migrations, deploys, or commits** until explicit approval of this plan.
