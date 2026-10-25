# UX and implementation decisions

## Decision: Section = commercial category workspace

Reuse `event_order_template_sections` as the venue’s commercial categories. Do **not** introduce a parallel category table for templates.

## Decision: Category-first navigation

Sticky section nav switches a single workspace (fixed items + choice structure). Removes the need to scroll a full-page stack to assemble Catering / Bar / Rentals / Services.

## Decision: Nest dependent branches under parent options

Within a section, root choice groups list options; each option shows its dependent groups indented underneath. Plated and Buffet branches stay visually separate. Incomplete empty dependents get an amber incomplete callout.

## Decision: Soft category filter for Offering discovery

`CategorizedOfferingSelect` defaults to Offerings whose `categoryName` soft-matches the section name (aliases for Bar/Catering/etc.). Escape hatches: All categories, or a specific catalog category. Linking still uses explicit Offering **id**.

## Decision: No schema migration

Existing `section_id`, `depends_on_option_ids`, and `offering_id` are sufficient.

## Out of scope

- Package ↔ Offering composition
- Auto-seeding fictional entrée options into empty branches
- Redesigning unrelated Library screens
