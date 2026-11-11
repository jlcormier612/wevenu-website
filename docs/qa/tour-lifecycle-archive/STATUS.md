# Tour Archive + Guarded Delete — Implementation Status

**Branch:** `fix/tour-archive-guarded-delete`  
**Audit:** `docs/qa/tour-lifecycle-archive/AUDIT.md` (accepted)

## Product notes (in scope)

- Archive = `tour_appointments.is_archived` (Library pattern). Not a status.
- Default Upcoming/Past exclude archived at the **query** layer.
- Reporting / funnel queries do **not** filter `is_archived`.
- Delete allowed only for orphan (`lead_id` null) or synthetic fixture contacts; server-enforced.

## Out of scope (documented, not changed)

- **Cancelled tours** remain excluded from the Tours working lists (pre-existing). They are not auto-routed into Archived. A separate product decision would be needed to surface Cancelled in Archived or a Cancelled filter.
