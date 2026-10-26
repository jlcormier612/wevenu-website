# STATUS — Merge Lead FK preview labels

**Verdict: GREEN / CLOSED**

## Root cause

1. **Preview labels:** Merge preview `FieldDiff` stored and rendered `planned_event_space_id` / `assigned_staff_id` as raw UUID strings. Underlying IDs were correct for merge execution; presentation lacked authoritative name resolution from `venue_spaces.name` / `venue_staff.full_name`.
2. **Persist blocker (exposed by FK fixtures):** `merge_leads_v1` assigned jsonb text (`->>`) to uuid columns without `::uuid`, so confirm failed with: `column "assigned_staff_id" is of type uuid but expression is of type text`.

## Fix

- Preview loads `venue_spaces.name` and `venue_staff.full_name` for FK ids in diffs (`889f005e`)
- `FieldDiff` keeps `*Value` as IDs and adds `*Display` for venue-facing labels; dialog renders via `fieldDiffShown`
- Missing related rows → `Unnamed event space` / `Unknown staff member` (never UUID)
- Sandbox migration `20261423400000_merge_leads_uuid_fk_cast.sql` (`1fcd4ec1`) casts UUID FK patch columns like date columns

## Serving evidence (Sandbox)

| Item | Value |
|------|--------|
| Venue-app image SHA | `889f005e8529e79ec35129a41889712463058df5` |
| Image digest | `sha256:307b519809123cb1a9174f7958a5d8acfcb1c4021c26882fa41f7acd8d5d3d47` |
| DB migration commit | `1fcd4ec1` |
| Migration apply | [40263751062](https://github.com/jlcormier612/wevenu-website/actions/runs/40263751062) **success** |
| App deploy (labels) | prior run for `889f005e` (digest above) |

## Tests / build

| Check | Result |
|-------|--------|
| `merge.test.ts` + `merge-client-boundary.test.ts` | **40 pass** (`unit-test-r2.log`) |
| `npm run build` | **EXIT 0** (`production-build.log`, labels commit) |
| Browser + persist | **GREEN** (`browser-run-after-uuid-cast.log`) |

### Browser highlights

- `preview-space-shows-name` → `Barn` (not UUID)
- `preview-staff-shows-names` → `Jen Fancy` / `Ron Cormier`
- `redirect-to-survivor` + toast `Leads merged…`
- `space-filled-on-survivor` + `staff-kept-primary-on-survivor` IDs persisted
- Continue-gate / cancel path unchanged and passing

## Production

**Untouched.**
