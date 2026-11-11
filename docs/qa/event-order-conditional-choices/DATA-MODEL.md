# Conditional choices — data model

## Verdict

Conditional parent→child choice groups **did not exist** in the schema before this work. A minimal additive extension was required.

## What already existed

| Capability | Support |
|------------|---------|
| Choice groups (single / multi, min/max) | `event_order_template_groups` + options |
| Included fixed lines | Template lines `included_by_default` |
| Client answers → EO lines on finalize | `finalizeClientChoices` + `resolveSelectedOptions` |
| Single-select conflict cleanup by option label | `conflictingSingleSelectLineIds` (financial fix lineage) |
| Required validation (client + RPC) | Group min/max |
| Offering FK on options | Optional; starters leave `offering_id` null |
| Price snapshots on EO lines | Yes |

## Extension (backward-compatible)

| Artifact | Change |
|----------|--------|
| `event_order_template_groups.depends_on_option_ids` | `uuid[] not null default '{}'` — empty = always visible |
| Frozen `client_choices.definition.groups[].dependsOnOptionIds` | Mirrored at freeze via `selectionDefinitionFromEventOrderTemplate` |
| `submit_client_choices` RPC | Skips inactive dependents; rejects orphan answers on inactive children; still enforces min/max on active groups |
| Starters EO-D-01 / EO-D-02 | Dinner + Bar parent groups; empty dependent scaffolds keyed by `dependsOnOptionNames` (no invented menu items) |
| `ensureConditionalChoiceScaffolding` | Additive insert of missing empty dependents on existing uncustomized masters |

## Semantics

- **Offering:** reusable catalog item (optional FK on options). Not required for dinner packages that live on the template.
- **Parent choice:** e.g. Dinner service / Bar package option.
- **Dependent choice group:** `depends_on_option_ids` non-empty; active only while a listed parent option is selected.
- **Event Order selection:** answers on active groups only become EO lines on finalize.
- **Price snapshot:** unchanged — option `unit_price` frozen into definition and EO line.

## Commercial rules enforced

1. Hidden/inactive children are not validated as required.
2. Orphan answers on inactive children are rejected (RPC + TS validate).
3. `reconcileAnswersForDependencies` clears inactive answers on UI change, save, submit, and finalize.
4. `resolveSelectedOptions` ignores inactive groups — inactive children cannot stay billable.
5. Empty dependent groups (honest empty) use `minSelect: 0` and show configuration messaging — no fabricated entrées.

## What is intentionally not done

- No auto-link of Chicken Marsala / Vegetarian entrée offerings into plated/buffet children by name.
- No Premium / Signature / Champagne bar packages invented.
- No rewrite of finalized Event Orders or published invoices.
- No overwrite of venue-customized templates.
