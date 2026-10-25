# Current state and gaps — EO Template builder

## Observed problem (pre-fix)

- Template detail listed **all sections** in a long vertical stack, then a separate **Choice groups** list at the bottom.
- Dependent groups (e.g. Plated dinner details / Buffet dinner details) appeared as peer cards, not nested under the parent option.
- “Add from Offerings” / option Offering pickers showed a **flat mixed catalog** (catering, bar, rentals, services together).
- Empty dependent branches were easy to miss as “done.”
- Venue had to scroll and mentally reassemble one commercial workflow.

## Existing contracts (preserved)

- Hybrid Offering-backed vs template-only options; explicit `offering_id` only.
- `depends_on_option_ids` conditional engine (choice-tree CLOSED).
- Template sections are the venue’s commercial categories (Catering, Bar, Rentals, Services, …).
- Offering categories (`offering_categories`) are the catalog taxonomy — reused for **discovery filter only**, never for silent name-matching links.
- Packages remain a separate booking spine.

## Root cause

Information architecture: section content and choice-tree authoring were **split across the page**, and Offering discovery was **not section-aware**. The data model already supported `group.sectionId` and dependencies; the builder did not present them as one category-first workflow.
