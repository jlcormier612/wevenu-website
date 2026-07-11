# ADR-0004: Planning Playbooks

**Date adopted:** 2026-07-08. Implemented same session (`supabase/migrations/20260722000000_planning_playbook_milestones.sql`, `components/playbooks/playbook-builder.tsx`).

## Decision

The venue's real need — "ensure nothing is forgotten from booking through event completion" — is modeled as **Planning Playbooks**: milestones (venue-renameable, reorderable chapters) holding tasks (one model, filtered by audience — Client/Venue/Vendor — rather than three separate task systems), reusing the Day-of Timeline's builder and template-picker interaction patterns rather than inventing new ones.

## Reasoning

The underlying schema (`playbook_tasks`, `event_tasks`, owner/visibility/category/dependency/reminder/escalation fields) already existed and was already sufficient — the actual gap was that milestones were a fixed 4-value enum a venue couldn't rename or reorder, and the editor exposed none of the reminder/escalation fields it already had. Rebuilding around a new milestone entity, rather than a new task system, is the smallest change that makes the experience feel like planning an event instead of editing database rows.

## Alternatives considered

- **Keep the fixed phase enum** — rejected; a venue that doesn't think in "final_details"/"wedding_day" language can't make it their own, which fails Hospitality over Software directly.
- **Separate task systems per audience** (a Client Planning system, a Vendor Coordination system) — rejected; this is exactly the "duplicate experience" pattern named in `docs/architectural-debt-review-checklist.md`. One task model filtered by audience, reusing the existing `visibility`/`ownerType` fields, was already sufficient once the portals' existing delivery surfaces were properly connected.

## Where it applies

- `playbook_milestones` (new Definition-side entity, ADR-0002), `playbook_tasks`, `event_tasks`.
- Couple Portal (`get_portal_tasks` RPC) and Vendor Portal (`lib/vendor-events/service.ts`) as the two delivery surfaces — not separate planning systems.
- Full design: `docs/planning-playbooks-design.md`, `docs/planning-playbook-experience-design.md`.
