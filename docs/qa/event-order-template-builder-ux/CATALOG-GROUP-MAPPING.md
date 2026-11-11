# Catalog → Template group mapping (Option A)

**Status:** IMPLEMENTED (Sandbox acceptance pending serving tip)  
**Branch:** `feat/spaces-booking-e1-smart-fields`  
**Migration:** `20261426000000_offering_choice_groups.sql`  
**Production:** untouched  

## Verified mapping (after Option A)

| Catalog concept | Persisted representation | Relationship to parent | Template mapping | Behavior |
| --- | --- | --- | --- | --- |
| Service category | `offering_categories` | Display/org only | Template sections (loose naming) | Unchanged |
| Parent / major Offering | Top-level `offerings` | — | Root options (`offering_id`) | Select parents (Step B) |
| Child item | `offering_major_links` | Under major(s) | Options inside a template dependent group | Snapshot members |
| **Named choice group** | **`offering_choice_groups` + `offering_choice_group_members`** | `parent_offering_id` must be top-level major; members must belong under that parent | `event_order_template_groups.offering_choice_group_id` + snapshotted name/options | Select from dropdown (Step C) |
| Always-included | any offering | — | `event_order_template_lines` | Unchanged |
| Couple selection rules | — | — | Template group min/max/mode | Stay on template (Step D) |
| Legacy template groups | Manual `name` + `depends_on_option_ids` | — | `offering_choice_group_id` **null** | Editable compatibility path; no name-based remapping |

## Root cause (historical)

Named groups lived only on templates (`event_order_template_groups.name`), so the builder forced venues to retype Entrées/Desserts and kept parallel Add Choice Group paths.

## Design

- Catalog owns reusable organization + membership.
- Templates own selection rules and option snapshots.
- Catalog edits after include do **not** mutate existing template options (snapshot boundary).
- Deleting a catalog group sets template FK to null (`ON DELETE SET NULL`); snapshotted options remain.

## Simplified builder flow

1. Always-included items (unchanged).
2. Select parent Offerings.
3. Under each parent: **Include existing group** dropdown from catalog.
4. Configure required/count/write-ins on the included template group.
5. Specialist selection rules remain collapsed for unusual cross-group cases.
