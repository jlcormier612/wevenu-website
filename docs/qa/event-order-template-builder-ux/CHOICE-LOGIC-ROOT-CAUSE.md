# EO Template Builder — choice logic root-cause map

**Date:** 2026-10-28  
**Schema change required:** No — existing `event_order_template_groups` (`min_select`, `max_select`, `selection_mode`, `depends_on_option_ids`) and options (`offering_id` nullable for write-ins) already represent the model.

---

## Root causes (screenshots)

1. **Duplicate “{Parent} options” groups**  
   `Add another selection group under {label}` always calls `newChildGroupUnderParentInput` with the default name `"{Parent} options"`. Each click creates another identical empty group. Catalog child toggles only write into the **first** dependent group (`ensureChildGroup`), so later groups look like unexplained duplicates.

2. **Ambiguous “How many from this group?”**  
   Label does not state that the number is the couple’s required selection count. Blank blur still resolves via `resolvePlainSelectionRule` to “any” (`maxSelect: null`), silently weakening the rule.

3. **“Add another selection group” vs add option**  
   The control creates a **group**, but venues use it expecting more **options**. There is no distinct “Add catalog option” / “Add write-in option” under each named group.

4. **Child options not scoped to named groups**  
   UI lists all catalog children as checkboxes under the parent, not under named groups (Entrées / Spirits / …). Guest Paid Bar vs Premium Open Bar diverge when one path used named groups and the other used repeated default groups + flat checkboxes.

5. **Required vs count conflation risk**  
   Required is derived from `minSelect > 0` correctly in places, but blank count + Required can save as “at least 1, any max,” which does not match “choose exactly N.”

6. **Optional + count semantics**  
   Optional with `minSelect=0, maxSelect=N` currently allows 1…N. Spec requires skip **or** satisfy exact count N.

---

## Intended representation (no schema change)

| Concept | Storage |
|---|---|
| Parent alternatives (choose exactly one) | Root group: `selection_mode=single`, `min_select=1`, `max_select=1` |
| Dependent named group | Child group with `depends_on_option_ids=[parentOptionId]`, unique `name` |
| Count N required | `min_select=N`, `max_select=N` (single if N=1) |
| Count N optional | `min_select=0`, `max_select=N` + validate: 0 or exactly N |
| Catalog option | Option row with `offering_id` set |
| Write-in | Option row with `offering_id=null`, custom `label` |

Client validation already rejects inactive dependents; extend optional exact-count rule in `validateChoicesAnswers`.
