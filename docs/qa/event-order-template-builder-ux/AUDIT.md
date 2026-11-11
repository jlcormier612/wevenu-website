# Event Order Template Builder — UX forensic audit

**Date:** 2026-10-28  
**Scope:** Guided setup on Sandbox serving tip (read-only diagnosis before UX fix).  
**Status:** Audit complete — implementation follows.

---

## Data model (evidence)

| Concept | Storage | Couple-facing? |
|---|---|---|
| Package category | `event_order_template_sections` | Section headings |
| Direct package item | `event_order_template_lines` (`included_by_default`, `unit_price`, `offering_id`) | Fixed lines / apply snapshot — **not** a couple choice |
| Primary / follow-up question | `event_order_template_groups` (`depends_on_option_ids`) | Choice groups |
| Answer / option | `event_order_template_options` (`is_included`, `unit_price`, `offering_id`) | Selectable options |
| Catalog vs template-only | `offering_id` set vs null on line or option | Label only |

Pricing for **lines**: `pricing_model` + `unit_price` + `included_by_default` (apply pre-select / “in package price” treatment in review).  
Pricing for **options**: `is_included` ($0) vs `unit_price` additional.

Multi-parent Offerings and category-integrity are orthogonal (catalog association / section ensure). Not changed by this UX pass.

---

## Answers to required questions

### 1. Does “Included” describe pricing, placement, or both?
**Both are conflated today — incorrectly.**  
Section title **“Included in Catering”** and button **“Add included item”** imply “free / in package price.”  
The model allows lines with prices and `included_by_default = false` (optional at apply). Review already distinguishes `included (not an extra charge)` vs price — the workspace heading does not.

### 2. Can an item attach to a package without being in the package price?
**Yes.** Fixed line with price and/or `included_by_default = false`. Couple does not select it; venue apply / package materialization uses `includedByDefault`. UI under-labels this as “Included.”

### 3. Where does the venue create Buffet vs Plated?
**Choices section → “Add a primary question” → then add options** on that group (catalog picker or template-only).  
Not under “Included in Catering.” Not via Offerings parent/child hierarchy.

### 4. Follow-ups under each option?
**“Add choices for couples who select {option}”** / dependent groups with `depends_on_option_ids`. Nesting UI exists; workspace copy still says “major choices from your Offerings catalog,” which misdirects owners toward catalog hierarchy.

### 5. Catalog-backed vs template-only?
**`offering_id` present vs null.** Supported on both lines and options. Explained in **three** places (fixed help box, line sheet, choice option add) with Inventory digressions — redundant and pulls focus from the A/B/C workflow.

### 6. Necessary vs redundant controls
**Necessary:** package categories → per-category fixed lines → primary question → options → under-option follow-ups → review → preview; Change package categories; specialist rules for advanced deps.  
**Misleading / redundant:** “Included in…” framing; “major choices from Offerings catalog”; duplicate Offerings/Inventory essays on the workspace; empty “No choice groups” dashed box while the primary-question form is already the next action; intro paragraphs that restate the same flow three times.

### 7. Does Preview match couple experience?
**Largely yes** for choice structure — uses `validateChoicesAnswers` / conditional visibility from the frozen definition path. Fixed-line pricing nuance is weaker in workspace list than in review. Preview does not send/finalize (correct).

---

## Root cause (UX, not data)

The builder **has** the right three concepts (fixed lines, root choice groups, dependent groups) but **labels and empty states collapse them into “Included” + “catalog majors,”** so owners cannot map Buffet/Plated/follow-ups onto the real actions.

---

## Design target (Phase 2) — labels only; no schema change

| Zone | Venue-facing name | Action |
|---|---|---|
| A | **Items always on this package** | Add package item (catalog or template-only); show price treatment truthfully |
| B | **Choices couples make** | Add primary question → add answers (Buffet / Plated) |
| C | **Follow-ups under each answer** | Existing nest UI; plain language, no “major choice” jargon |
| D | Catalog vs template-only | Short line at point of add; detail remains in editors |

Specialist selection rules stay collapsed for advanced cases.
