# Event Order Template Builder — Offering-based redesign audit

**Date:** 2026-10-28  
**Status:** Audit complete — implementation follows this plan.  
**Prior question-builder acceptance:** NOT evidence for this product decision.

---

## Product decision (locked)

Build the package by selecting existing Offerings from dropdowns. The section determines behavior:

| Section | Behavior |
|---|---|
| **Always on the package** | Item is always part of the package (not a couple choice). Not labeled “Included.” Price may be none / covered / additional charge. |
| **Couple's choices** | Item is available for the couple to select, subject to configured rules. |

Venue owners must **not** create questions, answers, or follow-up questions to express catalog hierarchy.

---

## Current implementation (forensic)

### Storage (keep)

| Concept | Table | Maps to |
|---|---|---|
| Category | `event_order_template_sections` | Package category (Catering, Ceremony, …) |
| Always-on item | `event_order_template_lines` + `offering_id` | Section A |
| Choice set | `event_order_template_groups` | Root couple-choice group (hidden “question”) |
| Selectable Offering | `event_order_template_options` + `offering_id` | Parent / standalone choice |
| Conditional child group | `event_order_template_groups.depends_on_option_ids` | Children under a selected parent |
| Child Offering | `event_order_template_options` under dependent group | Selected children for that parent |
| Instructions / min / max | group `instructions`, `selection_mode`, `min_select`, `max_select` | Client-facing rules |

Portal validation (`validateChoicesAnswers`), conditional visibility, submission, and `finalizeClientChoices` already consume this model. **No schema change required.**

### Authoring UX (wrong — replace)

`GuidedSetupWizard` workspace Section B still mounts `EventOrderTemplateChoiceGroups` with `guidedOrdinary`, which forces:

1. “Add a primary question” (name the question first)
2. Add answers / options
3. “Add choices for couples who select {answer}” for follow-ups

That is the rejected questionnaire workflow. Section A (fixed lines + `CategorizedOfferingSelect`) is already Offering-based and stays.

### Catalog hierarchy (reuse)

`lib/offerings/hierarchy.ts`:

- `topLevelOfferings` / `childOfferings` / `majorOfferingIds` / `offeringRole`
- `filterOfferingsForAuthoringContext({ kind: "primary" | "underMajor" })`
- M:N parents via `offering_major_links` → `parentOfferingIds`

`CategorizedOfferingSelect` already supports primary vs under-major scoping.

### Sandbox Fancy catalog gap (harness concern)

As of audit, Fancy venue Catering has Caesar salad / Cheesecake / Chicken Marsala / Vegetarian entrée only — **no Buffet/Plated parents, no Ceremony Arbor/Arch/Runner, zero `offering_major_links`**. Acceptance harness must seed catalog Offerings + major links (non-destructive) before browser E2E. Do not invent template-only stand-ins for those identities.

---

## Root cause

The **data model already supports** Offering-backed packages. The builder UX requires constructing artificial questions before Offerings can be selected, so owners cannot build Buffet vs Plated or Ceremony standalones from the catalog naturally. Prior GREEN tests validated the wrong authoring model.

---

## Mapping: required UX → existing model (no new schema)

### Section A — Always on the package

Unchanged path: `event_order_template_lines` via existing Offering sheet / picker. Heading stays **“Always on the package”** (never “Included”).

### Section B — Couple's choices (new authoring surface)

| Venue action | Storage write |
|---|---|
| Add Offering from dropdown (parent or standalone) | Ensure one **root** group for the active **choice set** in the section (auto-create if missing; default name = section name + “ choices”). Add `event_order_template_option` with that `offering_id`, label/price from catalog. |
| Parent has catalog children | Show existing children under the parent option. Venue checks which belong in this package. |
| Toggle child on | Ensure one **dependent** group with `depends_on_option_ids = [parentOptionId]` (or add option into an existing named child group under that parent). Add option with child `offering_id`. |
| Toggle child off | Remove that template option (not the catalog Offering). |
| Configure instructions / choose N | Update root (and child) group `instructions` / `min_select` / `max_select` / `selection_mode`. |
| Second independent alternative set (e.g. Arbor/Arch vs Runner/Petals) | “Add another choice set” → second root group in the same section. |
| Additional child groups under one parent (entrées vs sides) | “Add selection group under {parent}” → extra dependent group on same `depends_on_option_ids`. |

**Never** expose “question / answer / follow-up” vocabulary in the ordinary path. Specialist selection rules stay collapsed for edge cases only.

### Client / finalize

Unchanged: `selectionDefinitionFromEventOrderTemplate` → portal Choices → `validateChoicesAnswers` → `finalizeClientChoices`. Preview continues to use the same definition. Snapshots remain immutable.

---

## Smallest safe implementation plan

1. **Lib** — `lib/event-order-templates/offering-package-builder.ts`  
   Pure helpers: ensure root choice set, add option from Offering, sync child options under parent, draft pricing from catalog, detect already-used offering ids (always-on vs choices de-dupe).

2. **Action** (optional thin wrappers on existing add/update/remove) — reuse `addEventOrderTemplateGroupAction` / `Option` / `updateGroup` / `removeOption`. Prefer one composite client flow over a new schema action unless atomicity requires it.

3. **UI** — `components/event-order-templates/package-choices-panel.tsx`  
   Replace `EventOrderTemplateChoiceGroups` in the guided workspace Section B only. Keep specialist rules collapse in the wizard for advanced deps. Do not delete the old choice-groups component (still used by specialist / legacy paths).

4. **Wizard copy** — Drop question-first instructions; point to Offering dropdown + child checklists + instructions/rules block.

5. **Tests** — Unit/source seams for Offering-first mapping; update `builder-ux.test.ts` expectations; extend browser harness for Catering Buffet/Plated + Ceremony standalones with seeded catalog; keep finalize integrity checks.

6. **Deploy** — Sandbox only; verify serving SHA; browser E2E at 1280 + ~390.

### Explicit non-goals

- No new tables / columns  
- No destructive migration of existing templates  
- No Production deploy  
- No change to finalize pricing semantics or snapshot immutability  
- Do not declare GREEN from prior question-builder evidence  

---

## Acceptance scenarios → verification

| Scenario | Proof |
|---|---|
| A Catering Buffet/Plated | Seed parents + children + links; add via Couple's choices dropdown; select subset of children; set counts + instructions; preview path switch; save/reopen |
| B Ceremony standalones | Seed Arbor/Arch/Runner/Petals; two choice sets; choose-1 rules |
| C Always-on vs choices / pricing / finalize | No duplicate always-on in choices; parent select does not finalize all children; valid finalize lines; invalid finalize no partial mutation; repeat finalize no dupes; catalog edit does not mutate snapshot |

---

## Risk notes

- Existing templates authored as questions remain loadable (same storage); they appear as choice sets with options in the new UI.  
- Fancy catalog is sparse — harness seeding is required for A/B; do not leave acceptance dependent on missing Offerings.  
- Multi-group under one parent is supported but optional for A if a single child group with min/max satisfies the seeded menu.
