# Commercial system — locked implementation plan

**Status:** PLAN LOCKED — commercial implementation **must not** be reported complete until navigation reliability is GREEN **and** the gates below are proven.  
**Production:** untouched.  
**Sandbox data:** mock/test only — no legacy customer-data preservation required.

### Gate reminder (before reporting commercial complete)

- Do **not** carry forward “legacy migration” framing. Build the correct product now.
- Keep/reuse useful runtime selection infrastructure; clean out obsolete mock Choices product/data as appropriate.
- Verify **Packages** and **Inventory** participate in the broader customer-facing commercial lifecycle **without** assuming everything is a new venue booking.

This plan incorporates the 2026-09-29 product corrections. It supersedes any prior audit framing that treated mock Choices rows as customer-history constraints.

---

## Product model (locked)

| Asset | Meaning | Not |
| --- | --- | --- |
| **Offerings** | Things the venue sells | — |
| **Packages** | Priced commercial bundles (any commercial purpose; space eligibility is optional constraint) | Event Order Templates; “new booking only” |
| **Event Order Templates** | Reusable commercial build sheet: fixed lines **and** selectable groups | “Just a list of Offerings”; separate Choices product |
| **Inventory Templates** | Physical/operational setups (may also be client-facing when the venue chooses) | Forced commercial lines |
| **Contracts** | Canonical agreement system | Per-source contract types |
| **Invoice + Payment Plan + Payments + Documents** | Canonical money/record system | Per-source billing systems |
| **Proposal / selection presentation** | Reusable customer-facing presentation + token access + accept/review patterns | Automatic “new venue booking” semantics for every send |

**Customer journey (one pattern, multiple sources):**

Create → Edit → Duplicate → Preview → **Use** (internal) and/or **Send** (client) → Client selects/accepts → Venue finalizes → **Contract** → **Invoice / Payment Plan** → **Payment** → **Documents / Payments**.

---

## Correction incorporation checklist

| # | Correction | Plan implication |
| --- | --- | --- |
| 1 | No real customer / Choices history | Delete mock Choices UI/routes/data; drop obsolete schema when unused; **do not** design migrations around preserving Choices templates |
| 1b | Preserve useful runtime | Keep/adapt `client_choices` instance machinery (definition freeze, answers, submit/resubmit, finalize → EO lines, portal access) under EO Template ownership |
| 2 | EO Template = commercial build sheet | Extend EO template model with groups/options/rules; absorb Choices authoring into EO editor |
| 3 | Use works for selectable templates | Venue-side fill of selections then EO create — reuse selection/finalize engines, no second system |
| 4 | Send is client path | Freeze → present → select → venue finalize → EO; reuse Proposal/Choices presentation where fit |
| 5 | Packages stay Packages | Keep Package entity; fix add-on path so accept ≠ new booking; do not fold Packages into EO Templates |
| 6 | Inventory Templates: Use + Send | Mirror action set; Send optional/client-facing when venue wants selection |
| 7 | No inventory-only billing | Billable inventory → existing EO/invoice lines; non-billable stays operational |
| 8–11 | One downstream pattern | Contract / Invoice / Payment Plan / Documents / Payments only |
| 12 | Remove Choices product | Library card, nav, routes, help, IA tests, mock data, obsolete editor — gone |
| 13–15 | Order + journeys + GREEN | See phases and gates below |

---

## Current codebase baseline (facts for the plan)

**Event Order Templates today** (`event_order_templates` + sections + lines): structure-only lines (description/qty/price). **No** groups, selection modes, Offering FKs, or Send. Use ≈ copy structure into event order.

**Choices Templates today** (`client_choices_templates` + sections/groups/options): full selectable model (single/multi, min/max, quantity, offering_id, included/price). **Runtime** (`client_choices` + submissions + portal + finalize → EO lines) is the useful layer to **reuse**.

**Packages today:** own catalog + proposal/selection path; `eligible_space_ids` is eligibility, not identity. Existing tests assert commercial accept paths must not call `book_relationship` — verify and extend for **existing-client add-on** (Premium Bar Package → accept → agreement → invoice → pay without booking).

**Inventory Templates today:** apply-to-event Use exists; Send/client selection is incomplete vs the locked product.

**Sandbox:** mock data only → safe to wipe Choices template rows and remove product surface.

---

## Architecture decision (locked)

### Authoring
- **Single library product:** Event Order Templates.
- Template definition holds: sections, **fixed lines**, **choice groups** (mode, min/max, quantity, instructions), **options** (Offering ref and/or custom label, included/default, unit price), custom commercial lines.
- Snapshot/provenance on apply/send/finalize (definition frozen at send; EO lines carry source provenance).

### Runtime (reuse, do not fork)
- Adapt `client_choices` (or rename conceptually to “event order selection instance”) so its `template_id` / definition source is an **Event Order Template**, not a Choices Template.
- Keep: access_key/portal, answers JSON, append-only submissions, status machine, finalize → EO lines via existing event-order insert APIs.
- **Use (selectable):** venue completes answers (or defaults) and finalizes without client send — same finalize → EO path.
- **Use (fixed-only):** direct apply of fixed lines (today’s Use), optionally still creating an EO with provenance.

### Presentation
- Reuse Proposal/Choices **presentation** (brand, tokenized open, selection UI) for Send.
- Do **not** force Package or EO Send through “new lead → book venue” semantics.

### Packages
- Remain separate.
- Required investigation/fix: Proposal → accept → booking coupling; add-on Package on **existing** client/event must land in Contract → Invoice/Payment Plan → Payment → Documents without `book_relationship`.

### Inventory
- Remain separate.
- Use = apply to event inventory.
- Send = optional client review/selection; finalize into event inventory and, **only if billable**, into commercial lines via EO/invoice — never a parallel payment stack.

### Remove
- Customer-facing Choices Templates product (Library card, routes, editors, help, IA assertions, mock templates).
- After EO owns groups/options: obsolete `client_choices_templates*` authoring tables/code (or migrate once then drop). Keep instance/runtime tables until renamed/adapted.

---

## Implementation phases (dependency order)

### Phase 0 — Plan lock & spike (this document)
- [x] Corrections incorporated
- [x] Explicit sign-off that implementation may begin (2026-09-29: APPROVED / LOCKED / PROCEED)
- Spike only (no product ship): map Package accept → booking vs add-on; map inventory billable vs operational flags; name mapping for `client_choices` → EO-owned selection instances

### Phase 1 — Event Order Template data model
- [x] Migration: `event_order_template_groups` / `event_order_template_options` + `client_choices.event_order_template_id`
- [x] Types, repository CRUD, duplicate, soft-fail pre-migration
- [x] Freeze helpers: `selectionDefinitionFromEventOrderTemplate` / defaults
- [x] Runtime create path: `createClientChoicesFromEventOrderTemplate`
- [ ] Sandbox migration applied (Phase 11 deploy gate)
- Prefer absorbing Choices group/option shape into `event_order_template_*` (done)
- Provenance fields for apply/send/finalize (event_order_template_id on instances)
- Migration strategy: **no** obligation to preserve mock Choices template rows

### Phase 2 — One EO Template editor
- [x] Add Choice Group / Add Option (catalog + custom) on EO Template detail
- [x] Preview shows choice groups
- [ ] Edit / Reorder groups & options polish
- [ ] Copy: Premium Wedding Dinner (Bar / Entrée / Included / Optional add-ons)
- Add Offering / Add Custom / Add Choice Group / Add Option — partially done (offerings already; groups/options added)

### Phase 3 — USE
- [x] Fixed-only → event order (existing path via useEventOrderTemplate)
- [x] Selectable → venue configures selections → finalize → event order (`useEventOrderTemplate`)
- [x] Must not require client round-trip
- [ ] Sandbox browser proof (Phase 11)

### Phase 4 — SEND
- [x] Freeze definition → sendClientChoices (`sendEventOrderTemplate`)
- [x] Library Send to client action
- [ ] Client presentation → select/submit → venue review → finalize (reuse existing portal; browser Phase 11)
- [ ] Wire EO result into Contract / Invoice / Payment Plan (verify Phase 8/11)

### Phase 5 — Remove Choices product
- [x] Library card removed; routes redirect to Event Order Templates
- [x] Offerings / hub / event panel copy no longer point at Choices Templates
- [x] Runtime panel creates selections from Event Order Templates
- [x] IA tests assert Choices product absence
- [ ] Delete mock Choices template data (Sandbox / Phase 11)
- [ ] Remove obsolete authoring components after Sandbox proof (keep option-catalog + residual service for now)
- No zombie “Choices Templates” surface on Library hub

### Phase 6 — Inventory Templates Use + Send
- [x] Confirm Use (existing ensureEventInventory)
- [x] Library Send = apply + share for client portal review
- [x] Billable → existing EO/invoice path (no parallel stack); copy updated
- [ ] Sandbox browser proof (Phase 11)

### Phase 7 — Packages add-on commercial path
- [x] Automated: accept/offer/payment paths do not call bookClient (existing + reinforced tests)
- [ ] Internal use + presentation/send polish as needed
- [ ] **Existing client/event** Premium Bar Package browser journey (Phase 11)
- [ ] Agreement → Invoice/Payment Plan → Payment → Documents (Phase 11)
- [ ] Prove accept does not book a new venue relationship (browser + DB)

### Phase 8 — Downstream wiring verification
- [x] Code review: EO finalize → existing Event Order lines; invoice/payment plan via existing EO invoice link
- [x] Package/proposal accept does not invent parallel billing (commercial-paths-do-not-book)
- [ ] Sandbox proof: Contract → Invoice → Payment Plan → Payment → Documents after EO/Package journeys (Phase 11)

### Phase 9 — IA / help / mock cleanup
- [x] Library hub + EO page copy: fixed + selectable
- [x] Choices Templates card gone; routes redirect
- [ ] Delete mock Choices template rows in Sandbox DB (Phase 11)
- [ ] Help articles that still say “Choices Templates” (sweep Phase 11)

### Phase 10 — Automated tests
- [x] Model freeze, Use/Send wiring, Choices product absence IA, Package no-book, Inventory Send
- [ ] Expand editor/Use/Send integration coverage as journeys harden

### Phase 11 — Sandbox browser journeys + exact image verification
- [x] Exact running image verified (see Proof log below) — contains `c7f02950` via ancestry of `04794c77`
- [x] Journey C — selectable EO **Use** (venueUse, `submitted_at` null) on LuvCtx event `c43ca64a` → EO `ca92507b` with fixed + selectable lines
- [x] Journey B — selectable EO **Send** on SelUse: client submit (`submitted_at` set) → venue finalize → EO lines include Bartender selection
- [x] Journey A — Package add-on on **existing** SelUse client/event (no second client/event): Essential+$Bar → $17,500 selection → contract Fully Executed → invoice/plan → recorded initial payment → Documents
- [x] Journey E — Library IA: no Choices Templates card; EO Templates describe fixed + selectable
- [ ] Journey D — Inventory Use + Send still needs an explicit browser pass on this image
- Production untouched

**Implementation status:** Phases 1–8 + most of 11 proven on Sandbox image `04794c77` (contains `c7f02950`). **NOT GREEN** until Inventory Use/Send browser proof completes and planning-capabilities Settings move is deployed+proven (separate workstream on this branch).

---

## Proof log (2026-09-30)

| Item | Value |
| --- | --- |
| ECS task | `88e1c7a6c3c94991b47e8a79417d3d43` |
| Task definition | `htc-sandbox-venue-app:467` |
| Image tag | `04794c77f253672b012c0e9c35ddb2735baa3286` |
| Image digest | `sha256:e3f8bf40c8c578f1c653d022e124e97ff6c0b284d28480afd44c54382a9979af` |
| Health | `200` |
| `c7f02950` in ancestry | yes |
| Venue Use choices | `e17d5082` — finalized, **`submitted_at` null** |
| Send choices | `8a2ac147` — finalized, **`submitted_at` set** |
| SelUse client / event | `ceb551d5` / `2d2d9293` (single client, single event after package) |
| Contract | `c1c1b338` — Fully Executed (client + venue signed) |
| Invoice | `77f2f506` `INV-2026-77F2F5` — sent, balance $13,125 after $4,375 check recorded |
| Schedule | `a6b0c946` Essential Wedding payments |
| Documents | Invoice + Venue Rental Agreement + Event Order visible on booking Documents tab |

**USE vs SEND (distinct):** Use finalizes without client submission; Send requires client submit before venue finalize.

**Package add-on:** did **not** create a new booking/client/event — same `ceb551d5` / `2d2d9293`.

---

## Required browser journeys (GREEN)

### A. Existing client — Package add-on (locked requirement)
Existing client/event → Send Premium Bar Package → Client reviews → Accepts → Agreement created → Client signs → Venue signs → Invoice/Payment Plan → Client pays → Documents + Payments  
**Must not** create a new venue booking.

### B. Existing event — Event Order Send
Existing event → Send Event Order (selectable) → Client selects Bar + Entrée → Venue finalizes → Agreement → Invoice/Payment → Documents/Payments

### C. EO Use (no client)
Fixed template Use; selectable template Use with venue-filled selections → Event Order

### D. Inventory Use + Send (as applicable)
Internal apply; optional client Send/select/finalize → event result (+ commercial only if billable)

### E. IA
No Choices Templates card/routes; EO Templates describe fixed + selectable

---

## GREEN criteria (summary)

Do not report GREEN until Phase 1–11 proven against the locked product checklist in the correction brief (EO selectable model + Use + Send; Inventory Use + Send; Packages add-on; canonical Contract/Invoice/Payment Plan/Documents/Payments; Choices product gone; mock data disposable; production untouched).

---

## Explicit non-goals

- Preserving mock Choices Template rows or IA
- Replacing Packages with Event Order Templates
- Building inventory-specific or source-specific payment/contract systems
- Requiring client send for every Use
- Treating every Package send as a new venue booking
- Production deploys / production data changes

---

## Relationship to other workstreams

- **Navigation reliability / escape paths** (`7759394c` and follow-ups): orthogonal customer UX; may continue independently.
- **This commercial plan:** no implementation until Phase 0 sign-off.

---

## Ask to proceed

Implementation begins only after confirmation that this plan is the working brief (any remaining naming questions — e.g. whether runtime tables stay named `client_choices` vs rename — may be decided in Phase 1 without changing the product model).
