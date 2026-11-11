# HTC Commercial Workflow Consolidation — Phase 1 Forensic Audit

**Status:** AUDIT ONLY — no implementation, schema changes, UI moves, or deploys in this phase.  
**Date:** 2026-10-22  
**Branch:** `feat/spaces-booking-e1-smart-fields`  
**HEAD inspected:** `ad3afd3f9b1f4b8c63d6e0d57d64f8b46de95a92`  
**Sandbox serving (ECS at inspection):** `htc-sandbox-venue-app:10caa16bb8d1f935b020f3dca8b9524d917e8af7`  
*(HEAD is ahead of serving; inventory price-display commit `ad3afd3f` was not yet the live image.)*  
**Working tree:** ~1003 dirty/untracked paths (mostly `docs/qa/**` evidence + unrelated component edits). **Not reset/cleaned/stashed.**  
**Production:** untouched. **Code/schema/data:** no changes made for this audit.

Evidence basis: current source under `app/`, `components/`, `lib/`, key migrations, existing QA STATUS/FORENSIC docs, and prior Sandbox probes from related commercial work. Where behavior is inferred from code structure without a live browser re-run in this phase, it is labeled **inferred**.

---

## 1. Executive summary

### What exists today

Commercial capability is **already implemented as several domain systems** that mostly talk to each other correctly at the data layer, but are **navigationally fragmented**:

| Layer | Home today | Role |
| --- | --- | --- |
| Reusable catalogs | Library + `/packages` | Available Inventory, Offerings, Packages |
| Reusable templates | Library | Inventory Templates, Event Order Templates (choice groups live here) |
| Venue defaults | Settings → Setup Profiles | Which portal/setup areas are Included + starting template refs |
| Event preparation | Event Overview → Setup panel | Readiness for portal release; draft inventory/EO from profile |
| Event commercial execution | Event tabs **Inventory** / **Event Order** | Share, client selection, finalize, share EO, invoice link |
| Couple experience | Portal sections Inventory / Event Order / Your Choices | View or select when venue shared |
| Finance | Event Payments + `/invoices` | Invoice from EO (freeze-on-send), payment plan on invoice |

### Key duplication / confusion (product, not missing backend)

1. **Setup checklist ≠ commercial workflow.** Inventory and Event Order appear as Setup Profile / Overview “Included” steps for portal-release readiness, while the real lifecycle (share, select, finalize, invoice) lives on event tabs. Venues look for “send inventory / send order” in setup and Library Send buttons.
2. **Two client-selection runtimes.** (a) Event Inventory collaboration mode `select` + portal Inventory; (b) Event Order Template choice groups → `client_choices` + portal “Your Choices”. Both can hand into Event Order. Overlap is real; they are not the same table.
3. **Three “commercial package” concepts.** Packages (`/packages`, booking/sales), Event Order Templates (delivery build sheets), Offerings (line catalog for EO templates). Names cross in UI copy (“starting package”, “starting offering”).
4. **Choices Templates Library product removed** (tombstone pages redirect narrative to EO Templates) while `client_choices` runtime and panel remain — correct consolidation direction already started for *authoring*, incomplete for *navigation narrative*.
5. **Library “Send to client” on EO Templates** is Path B (selections), not Path A (share fixed EO). Fixed EO sharing is Finalize → Share on the event Event Order tab (recent routing fix `10caa16b`).

### Target direction (aligned with locked product rules)

Keep **Library/Settings for reusable configuration**; make **one persistent event-level commercial workspace** (Event Order tab + clearly linked Inventory / Choices / Invoice steps) the place venues *run* the workflow; treat Setup Profile/Overview as **defaults + portal readiness**, not the only launch pad; preserve invoice/payment-plan boundaries.

**This target is not implemented as a single consolidated UX today** — domains exist; the unified navigation/lifecycle home does not.

---

## 2. Source map — entry points

### 2.A Client portal & venue task surfaces

| Surface | Route / component | Type | Creates / updates | Mandatory? | If UI entry removed |
| --- | --- | --- | --- | --- | --- |
| Portal Inventory | `portal-shell` section `inventory` → `InventoryPortalSection` / `inventory-view` | Couple UI | Reads `get_event_inventory_for_portal`; save/submit selection RPCs | Capability `planning_inventory_enabled` | Couple cannot open inventory; API/share still exist |
| Portal Event Order | section `event-order` → `EventOrderPortalView` | Couple UI (read-only shared snapshot) | Share snapshot via `shareEventOrderWithClient` | Capability `event_order` | Couple cannot view EO; share still writes docs/email |
| Portal Your Choices | section `choices` → choices UI | Couple selection | `client_choices` draft/submit | When choices instance sent | Breaks selection UX; deep links/tasks orphan |
| Portal home cards | Inventory + Event Order entries | Shortcuts | None | When capabilities on | Discoverability only |
| Unified tasks | `lib/portal/unified-tasks.ts` | Task CTAs | Triggers: `inventory_finalized`, `event_order_shared`, `client_choices_*` | Configured playbooks | Tasks mis-route if sections removed |
| Venue playbook related context | `lib/playbooks/constants.ts` (`client_choices`, `event_order`, …) | Task deep-links | Completions on lifecycle events | Optional | Task hashes break |

**Setup vs real task (verified):** Overview Setup steps for inventory/EO are **venue readiness / draft preparation** (`lib/event-setup/readiness-detail.ts`). They are **not** couple tasks. Couple tasks appear when inventory/choices/EO are shared or submitted.

**Already duplicated:** Inventory “share for selection” messaging vs EO Template “Send to client”; both create client-facing work but different records.

### 2.B Venue Settings & Profile Setup

| Location | Purpose | Reusable vs event | Consumers |
| --- | --- | --- | --- |
| `/settings/leads/setup-profiles` | Venue Setup Profiles: step Included/Skipped + template refs (incl. `inventoryTemplateId`, `eventOrderTemplateId`) | Reusable venue defaults | Booking inherit → `event_setup` snapshot; Overview Setup panel |
| `/settings/leads` | Planning capabilities toggles (inventory, event_order, …) | Venue-wide | Portal sections + applicable setup steps |
| `/settings/import?type=inventory` | Bulk import Available Inventory | Catalog | `/library/inventory` |
| `/settings/team` links | Import inventory/packages shortcuts | Nav only | Same |
| Setup Hub `/setup-hub`, `/setup-hub/financials` | Onboarding stages (business readiness) | Onboarding | Not the booked-event commercial runner |
| Venue Profile (business settings) | Branding/identity — **no** inventory/EO template authoring found as primary home | N/A | — |

**Duplicate configuration:** Starting inventory/EO templates chosen in Setup Profiles **and** can be applied again from event Inventory/EO panels / Library Use. Profile refs are book-time snapshots (`inheritedTemplateRefs` immutable on event); Library apply is later operational — **verified** by setup-profile model tests.

### 2.C Inventory & Available Inventory

| Entity | Table / module | Lifecycle owner |
| --- | --- | --- |
| Available Inventory (catalog) | `inventory_items` (`quantity_available`, dimensions) — `lib/inventory/*`, `/library/inventory` | Venue catalog |
| Inventory Templates | `inventory_templates` + items — `/library/inventory-templates` | Reusable packing lists |
| Event Inventory | `event_inventory` + `event_inventory_items` — `lib/event-inventory/*`, event tab | Event snapshot |
| Collaboration | `collaboration_mode` view\|select; statuses draft→shared→submitted→…→finalized | Venue + couple |
| Portal share | `shareEventInventory` + RPC `get_event_inventory_for_portal` | Venue |
| EO handoff | `addToEventOrder` / `handoff.ts` (`isInventoryItemBillableForInvoice`) | Venue deliberate action |
| Floor plan usage | Catalog qty / placement — **not** the commercial EO path | Ops |

**Verified:** Catalog has **no price**; event/template items carry `unit_price` + `is_included` (see `item-sheet` comment + recent price-display audit).  
**Inferred / not fully re-verified here:** Strong stock *reservation* across overlapping events — usage helpers exist (`getUsageForEvent`); do not assume automatic hold/reservation without dedicated QA.  
**Gap (known product):** Included + configured price display was conflated in list UI (fix `ad3afd3f`, not necessarily serving yet).

### 2.D Offerings & selection templates

| Piece | Location | Notes |
| --- | --- | --- |
| Offerings catalog | `/library/offerings`, `lib/offerings/*` | EO template lines/options reference offerings |
| EO Template choice groups | `/library/event-order-templates/[id]` | Authoring of selectable groups |
| Choices Templates Library | `/library/choices-templates*` | **Product removed** — pages are tombstones; authoring moved to EO Templates |
| Runtime `client_choices` | `lib/client-choices/*`, event Event Order area `ClientChoicesPanel` | Created from EO template Send / Use finalize |
| Portal Your Choices | portal section `choices` | Couple UI |

**Overlap with inventory selection:** Both produce client decisions that can become EO lines. Inventory selection is quantity-oriented on event inventory items; EO choices are option/group oriented on offerings. **Recommendation:** share *lifecycle vocabulary* (send → submit → review → finalize → handoff) in UX; **do not** merge tables.

### 2.E Event Order & templates

| Piece | Location |
| --- | --- |
| Templates | `/library/event-order-templates`, `lib/event-order-templates/*` |
| Use / Send | `use-send.ts` — Use = apply (+ venue finalize choices); Send = apply + `sendClientChoices` (requires groups) |
| Event workspace | `EventOrderPanel` + `ClientChoicesPanel` on event `event-order` tab |
| Setup editor | `event-order-setup-editor` — draft/customize without share/invoice |
| Finalize / Share | `finalizeEventOrder`, `shareEventOrderWithClient` (requires finalized) |
| Invoice | `event-order-invoice-link` → `createInvoiceFromEventOrder` / link; freeze-on-send in `lib/invoices/service.ts` |
| Payment plan | Attaches to **invoice**, not EO (`eo-create-payment-plan` copy) |

**CTAs that start/continue commercial work (verified in source):**

- Library EO Template: Use, Send to client (gated when no groups).
- Event Inventory panel: Share / Share for selection, Confirm, Finalize, Add to Event Order.
- Event Order panel: Apply template, Finalize, Share, Create/Link Invoice, payment plan.
- Client Choices panel: Send, request changes, finalize, invoice helpers.
- Setup Profile / Overview: configure defaults + prepare drafts / portal release — **not** invoice.

### 2.F Cross-portal & communications

| Action | Communication |
| --- | --- |
| Inventory share | Email/conversation `event_inventory_shared` (service) |
| EO share | Email + conversation `event_order_shared`; portal deep link `#event-order` |
| Client choices send | Choices send path + portal section |
| Invoice send | Separate invoice email / freeze |

**Risk if UI moves without redirects:** portal section IDs, playbook `tabHash` values, and email deep links must stay stable or gain aliases.

### 2.G Domain / entity map

| Entity | Authoritative source | Snapshot? | Downstream |
| --- | --- | --- | --- |
| `inventory_items` | Catalog | N/A | Templates, floor plans, event item `inventory_item_id` ref |
| `inventory_templates` (+ items) | Library | Copy-on-apply to event inventory | Event inventory |
| `event_inventory` / items | Event | Yes — event-owned rows | Portal, EO handoff |
| `offerings` | Catalog | Copied into EO template lines/options | EO templates, choices definition freeze |
| `event_order_templates` (+ lines/groups/options) | Library | Apply snapshots into `event_orders` / freezes into `client_choices.definition` | Event EO, choices |
| `client_choices` | Event runtime | Definition frozen at create | Portal choices, finalize → EO lines |
| `event_orders` / lines | Event | Share snapshot table; revision | Portal EO, invoice freeze |
| `invoices` / lines | Finance | EO lines frozen on first send | Payment plans, couple pay |
| Payment plan / installments | Finance | On invoice | Checkout |
| Setup profile + event setup state | Venue / event | Profile refs snapshotted at book | Overview readiness |
| Conversations / outbound | Messaging | Append-only | History |
| Portal tasks | Playbooks + unified-tasks | Trigger-driven | Couple to-dos |

**Ambiguous ownership (UX):** “Package” in Setup Profile EO copy vs Packages product vs EO Template name. **No schema merge required** for navigation consolidation.

---

## 3. Verified current behavior vs intended target

| Topic | Current (verified/inferred) | Target (locked product) |
| --- | --- | --- |
| Fixed EO without choices | Use/Apply → edit → Finalize → Share; Library Send blocked without groups | Same; clear Path A home on event |
| Client selection | Inventory select **or** EO choices | Venue chooses path; one review/confirm story |
| Setup checklist | Includes inventory/EO as Included readiness | Defaults + readiness only; not sole launch |
| Invoice | Explicit create/link from EO; freeze-on-send | Unchanged |
| Payment plan | From invoice | Unchanged |
| Proposal/contract | Separate modules | Remain distinct |
| Template edit → events | Copy-on-apply / frozen definitions | Must not silent-overwrite snapshots |

---

## 4. Current-to-target navigation table

| Existing surface | Current responsibility | Target responsibility | Proposed action | Dependencies / risks |
| --- | --- | --- | --- | --- |
| `/library/inventory` Available Inventory | Physical catalog + qty | Same — reusable catalog | **Keep** | Floor plans, inv templates |
| `/library/inventory-templates` | Reusable event inventory setups | Same | **Keep**; clarify naming vs Available Inventory | Setup Profile refs |
| `/library/offerings` | Commercial offering catalog | Same | **Keep** | EO templates |
| `/packages` | Sellable packages | Same (sales/booking) | **Keep**; clarify ≠ Event Order | Booking payments setup |
| `/library/event-order-templates` | Fixed + selectable commercial sheets | Same | **Keep**; Path A/B labels already improving | Use/Send routing |
| `/library/choices-templates` | Tombstone | None | **Keep redirect**; eventually remove routes after link audit | Old bookmarks |
| `/library/payment-schedules` | Payment schedule templates | Reusable finance templates | **Keep** under finance/library | Invoice plans |
| Settings Setup Profiles | Included steps + starting templates | Venue defaults only | **Keep**; rename copy to “starting templates / portal areas” | Booking inherit |
| Settings planning capabilities | Feature gates | Same | **Keep** | Portal nav |
| Event Overview Setup (inventory/EO rows) | Draft readiness for portal release | Readiness + deep link into commercial workspace | **Nav change**: Change/Open → event Inventory/EO tabs; do **not** delete readiness | Release-to-portal |
| Event tab Inventory | Full inventory lifecycle | Event commercial step “Inventory” | **Keep as primary runner** | Portal share |
| Event tab Event Order | EO + embedded Client Choices + invoice link | **Canonical commercial workspace** | **Elevate** IA (sub-nav: Order / Choices / Invoice) | Deep links |
| Event Payments tab | Invoices list + setup payments | Finance handoff | **Keep**; link from EO invoice CTA | Packages for some payment setup paths |
| Portal Inventory / EO / Choices | Couple views | Same | **Keep** section ids | Emails/tasks |
| Library EO Send | Client selection send | Path B only | **Keep** gated | Fixed templates |
| Setup Hub financials | Onboarding | Onboarding only | **Keep out of** booked commercial runner | — |

---

## 5. Proposed target lifecycle (diagram)

```
[Library: Available Inventory / Offerings / Packages / Inv Templates / EO Templates]
        │
        ▼
[Setup Profile: which areas Included + starting template refs]  ← optional defaults
        │
        ▼ (booking / ensure)
[Event drafts: event_inventory, event_orders]  ← Overview readiness can show Included/Draft
        │
        ├─ Path A — Fixed Event Order ─────────────────────────────┐
        │  Edit EO (and/or apply template Use)                     │
        │  Finalize → Share → Portal Event Order                   │
        │                                                          │
        ├─ Path B1 — Inventory client selection ───────────────────┤
        │  Share for selection → Couple Inventory → Submit         │
        │  Venue confirm → Finalize inventory → Add to Event Order │
        │                                                          │
        └─ Path B2 — EO Template choices ──────────────────────────┤
           Send choices → Couple Your Choices → Submit               │
           Venue finalize choices → EO lines                         │
                                                                     ▼
                              [Authoritative Event Order]
                                     │
                                     ▼ (deliberate)
                              [Create/Link Invoice] → freeze on send
                                     │
                                     ▼ (deliberate)
                              [Payment plan on invoice]

Later changes: reopen inventory/EO per gates; amend invoice / new charge = explicit finance actions.
```

**Optional steps:** Path B1/B2; invoice; payment plan.  
**Timing:** May run pre-booking (rare), at booking (drafts), or later — capabilities and venue process decide; Setup Profile must not force timing.

---

## 6. Risk assessment & safety analysis

| Risk | Assessment |
| --- | --- |
| Existing events lose templates | Low if Library routes stay; Setup Profile refs are IDs |
| EO snapshots overwritten by template move | Low if only nav moves; apply remains copy-on-write |
| Client selection links break | Medium if portal section ids or tokens change — **freeze ids** |
| Orphan client tasks | Medium if unified-tasks section map changes without aliases |
| Couple access to sent artifacts | Low if share/finalize paths untouched |
| Auth / tenant isolation | Low for nav-only; high if new shared APIs |
| Invoice freeze / payment totals | Must not touch in early phases |
| Duplicate/suppress email | High if share CTAs duplicated in new hub without idempotency |
| Venue setup workflows break | Medium if Setup Profile Included meaning changes |
| Rollback | Prefer feature flags / dual nav; avoid schema drops |

**Schema migration:** **Not required** for consolidation of navigation/workflow home. Only consider later if product forces merging inventory-selection and client_choices (not recommended).

---

## 7. Migration / rollout plan (phased)

Safer order than “move everything then delete”:

### Phase C1 — Canonical narrative & deep links (nav/copy only)
- Document single “Commercial” story on event Event Order tab (Order / Choices / Invoice anchors).
- Overview Setup inventory/EO rows: primary CTA opens event tabs; clarify “readiness, not send.”
- Prerequisites: none. Risk: low.  
- Tests: setup readiness copy tests; browser Overview → tab deep link.  
- Accept: venue finds EO/Inventory from Overview without using Library Send for fixed EO.

### Phase C2 — Library ownership clarity
- Keep catalogs/templates in Library; improve labels (Available Inventory vs Inventory Templates; Packages ≠ Event Order).
- Confirm Choices Templates tombstones + search for remaining inbound links.
- Tests: `library-templates-ia`; link crawl.  
- Accept: no authoring in Settings except Setup Profile refs.

### Phase C3 — Event commercial workspace shell
- UI composition only: sub-navigation wrapping existing `EventOrderPanel`, `ClientChoicesPanel`, invoice link, and cross-link to Inventory tab.
- No schema. Preserve all actions.  
- Tests: event detail tab tests; browser Path A + B2 smoke.  
- Accept: one persistent home; Setup not required to run Path A.

### Phase C4 — Connect fixed EO + selection paths in UX
- Reuse existing Use/Send/share/finalize; add checklist-style progress (draft → shared/selections → finalized → invoiced) **read from existing statuses**.
- Tests: `use-send`, EO share gates, client-choices lifecycle, inventory selection.  
- Browser: Path A fixed; Path B1 inventory; Path B2 choices (existing harnesses under `docs/qa/eo-*`, `inventory-client-selection`).

### Phase C5 — Finance handoff verification (no redesign)
- Re-run EO→invoice freeze-on-send + payment plan browser (`eo-invoice-payment-plan`, payment workflow tests).
- Accept: finalize/share EO does not create invoice; invoice send freezes lines.

### Phase C6 — Remove obsolete setup *duplication* only
- After C3–C5 green: remove misleading Setup CTAs that imply send/invoice; **do not** remove Included readiness or profile template refs.
- Accept: checklist still drives portal release; commercial runner is event workspace.

### Phase C7 — Portal/tasks/messaging regression
- Portal sections, emails, unified-tasks, conversations counts.  
- Harnesses: portal discoverability, meadowbrook EO share, inventory share messaging.

---

## 8. Tests & browser harnesses by phase

| Phase | Unit / integration | Browser |
| --- | --- | --- |
| C1 | `readiness-detail`, setup badge tests | Overview deep link to Inventory/EO |
| C2 | `library-templates-ia`, offerings provision | Library card copy |
| C3 | event-detail composition tests (add) | Event commercial shell 1280/390 |
| C4 | `use-send`, `client-selection`, `client-choices` lifecycle, handoff | `eo-fixed-vs-selection-routing`, `inventory-client-selection`, `eo-offerings-inventory-closure` |
| C5 | invoice freeze / payment-plan tests | `eo-invoice-payment-plan` |
| C6 | setup panel CTA tests | Setup no longer shows Send-as-EO |
| C7 | portal capabilities, unified-tasks | Couple portal Inventory/EO/Choices + messages |

---

## 9. Genuine product decisions needed

Only items **not** fully resolved by the locked prompt:

1. **Single vs dual selection UX on the event.**  
   - *Default recommendation:* Keep both Inventory selection and EO Choices as capabilities, but present them as optional steps under one Commercial workspace with clear “use one path per need.”  
   - *Trade-off:* Merging into one runtime reduces confusion but is a large schema/UX rewrite and conflicts with “do not parallel-system / forced abstraction.”

2. **Whether Overview Setup should retain Inventory/EO rows long-term.**  
   - *Default:* Retain as **readiness + deep links** (portal release), not delete — inventory timing is optional/variable.  
   - *Trade-off:* Deleting rows simplifies IA but weakens Setup Profile → booking draft story.

3. **Packages vs Event Order Templates naming in Setup Profile (“starting package”).**  
   - *Default:* Rename copy to “starting Event Order template” everywhere profile UI refers to EO; keep Packages product for sales.  
   - *Trade-off:* Copy-only vs teaching cost.

No approval needed to proceed with **C1–C2** under these defaults once implementation is authorized.

---

## 10. Inspection metadata

| Item | Value |
| --- | --- |
| Branch | `feat/spaces-booking-e1-smart-fields` |
| HEAD | `ad3afd3f9b1f4b8c63d6e0d57d64f8b46de95a92` |
| Serving SHA | `10caa16bb8d1f935b020f3dca8b9524d917e8af7` |
| Dirty tree | Preserved (~1003 paths); not modified for this audit |
| Production | Untouched |
| Implementation in this phase | **None** |

---

## 11. Confirmation

- No code, schema, data, Sandbox deploy, or Production changes were made for this Phase 1 audit.  
- Success criterion for this phase: complete evidence-based map, target architecture, and phased plan — **delivered above**.  
- Implementation must wait for explicit authorization after review of this plan.
