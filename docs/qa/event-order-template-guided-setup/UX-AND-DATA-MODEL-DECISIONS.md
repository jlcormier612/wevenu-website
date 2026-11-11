# UX and data-model decisions

## Guided flow (mandatory order)

1. **What does your venue offer?** — suggested category cards + custom category; create/remove sections with confirm when content exists.
2. **How should clients choose?** — plain-language patterns (included / choose one / choose many / main→related / optional add).
3. **Main client-facing choices** — root groups/options only (`rootsOnly`); catalog link optional.
4. **What each main option reveals** — per-parent branch guide; create follow-up group only on explicit action; remove empty follow-ups without inventing options.
5. Repeat for next selected category (chips).
6. **Review** — summary of fixed lines, groups, branches, incompleteness.
7. **Preview** — real `ConditionalChoicePreview` / full-page preview; does not send or finalize.

## Data model

- **No schema migration.** Sections, lines, groups, options, `depends_on_option_ids` unchanged.
- Patterns are UX intent derived from / applied onto existing groups (empty option lists never auto-filled).
- Deselecting a category with content requires explicit confirm → `removeSection` (destructive, explained). Prefer keep-when-selected.

## Offering selector

- Preferred filter returns **only** soft-matched category items.
- Empty preferred → visible empty state; venue must choose All categories or another category deliberately.
- Search within the current filter.
- Still id-based; never name-matched.

## Advanced editor

Collapsed escape hatch on the same page for edge cases; guided steps are the primary IA.
