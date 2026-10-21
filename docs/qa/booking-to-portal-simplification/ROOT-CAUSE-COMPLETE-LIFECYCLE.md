# Root-cause map — Settings ↔ Setup Profiles ↔ Booking ↔ Event Setup

**Preflight (2026-10-21):** serving `19eb9a01`; HEAD `a8b2b572`; ~897 dirty paths preserved.

## Cross-layer contradiction

| Layer | What it decides today | What booking actually does |
|-------|----------------------|----------------------------|
| Venue Planning capabilities | Timeline / Floor Plan / Seating / Preferred Vendors on/off | Gates which setup steps appear; does **not** cover Planning checklists, Inventory, or Event Order |
| Setup Profile `planning` | Single `planningPlaybookTemplateId` (**client** only) | Applies client checklist; **ignores** any venue template selection (none exists in UI) |
| Setup Profile other steps | Timeline, floor plans, Inv, EO, questionnaires | Applied when Included + ref present |
| Booking inherit | `applyDefaultVenuePlaybook` heuristic (`is_default` / event_type) | Venue checklist comes from **library defaults**, not the profile — Settings/profile and booking disagree |
| Event Setup | Prepare/release recovers Inv/EO/timeline/floor plans | Cannot recover a profile-selected venue checklist that was never stored |

## Product model (locked)

Venue-wide inclusion → **complete** event-type Setup Profile (client + venue Planning = both task lists, Timeline, Floor Plans, Inventory, Event Order, Vendor Network) → auto-apply on book → optional edit → one prepare/release → separate invite. Questionnaires outside collective release.

## Required fix (this pass)

1. Persist `venuePlanningPlaybookTemplateId` on Setup Profiles; configure both checklists under Planning.
2. Hard-validate venue checklist when Planning is Included.
3. Booking applies the profile’s venue checklist (fallback to library heuristic only for legacy profiles lacking the ref).
4. Prepare/release recovers venue checklist from the event snapshot when missing.
5. Acceptance proves both checklists and both audiences after booking.
