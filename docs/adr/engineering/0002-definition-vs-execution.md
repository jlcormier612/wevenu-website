# ADR-0002: Definition vs. Execution

**Date adopted:** 2026-07-08.

## Decision

Anything that is a reusable template — stamped out many times across different events or clients — is modeled as a **Definition**, edited independently of any single event. What actually happens for one specific event or client is a separate **Execution** record that copies the relevant fields from the Definition at the moment it's applied, and is never silently altered by a later edit to the Definition it came from.

## Reasoning

A Planning Playbook, a Booking Journey stage, and a Task definition are each a reusable shape. What happened for Emma & James's actual wedding is a specific, situated fact that must stay stable even if the venue later renames or reorders their playbook. Referencing the Definition live (rather than copying it) would mean editing a template retroactively rewrites history for every event that already used it — a direct violation of Trust First.

## Alternatives considered

- **Live reference from event to template** (no snapshot) — simpler to build, but means editing a playbook after the fact can silently change what a couple already saw or already completed. Rejected outright; verified as already correctly avoided in `applyPlaybookToEvent` (`docs/planning-playbooks-design.md`).
- **No shared Definition at all** (every event's tasks hand-built) — this was closer to today's Payment Schedule reality (no template exists yet) and is the reason a Payment Schedule Template was named as necessary net-new infrastructure in `docs/booking-journey-design.md`.

## Where it applies

- **Planning Playbooks**: `playbook_templates`/`playbook_tasks`/`playbook_milestones` (Definition) vs. `event_tasks` (Execution, copied at apply-time — including the `milestone_name`/`milestone_kind` snapshot added in the Phase 2 migration).
- **Booking Journey**: the canonical stage set (Definition) vs. one Client's own lived progression (Execution) — `docs/booking-journey-design.md`.
- **Tasks**: task Definition (name, category, default schedule) vs. Assignment (this task, this event, this owner).
- Generalized as Engineering Standard #11 (`docs/engineering-standards.md`), alongside its sibling pattern, ADR-0001.
