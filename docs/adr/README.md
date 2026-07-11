# Architectural Decision Log

The permanent record of Wevenu's major product-architecture decisions — started 2026-07-08 so the reasoning behind a decision survives past the conversation it was made in, rather than needing to be re-derived or searched for later.

Each ADR is short: the decision, the reasoning, the alternatives considered, where it applies, and the date adopted. Link related design docs rather than repeating their content — an ADR records *that a decision was made and why*, not the full analysis behind it.

## When to add one

Add an ADR when a design review lands on a decision that will shape more than one future feature — a naming choice, a schema pattern, a governing principle. Not every implementation detail needs one; the test is the same as `docs/engineering-standards.md`'s: would a future reviewer need to know *why*, not just *what*, to avoid re-litigating or accidentally reversing it.

## Categories

Numbering is one global sequence across all categories (an ADR's number reflects *when* it was adopted, not which folder it lives in) — the folders exist only to make browsing easier as the log grows.

- **`product/`** — decisions about what Wevenu does and the principles that govern user-facing behavior (a feature's shape, a trust commitment).
- **`engineering/`** — decisions about how the system is built underneath (data-modeling patterns, infrastructure, standards that hold regardless of which feature is being built).
- **`ux/`** — decisions about interaction patterns and experience conventions reused across features (none yet — the first candidate is likely the Planning Playbook Builder's reuse of the Day-of Timeline's interaction model, or the vendor claimed/unclaimed editing pattern).

## Log

| # | Decision | Category | Applies to |
|---|---|---|---|
| [0001](engineering/0001-identity-vs-relationship.md) | Identity vs. Relationship | Engineering | People, Vendors |
| [0002](engineering/0002-definition-vs-execution.md) | Definition vs. Execution | Engineering | Planning Playbooks, Booking Journey, Tasks |
| [0003](engineering/0003-one-notification-engine.md) | One Notification Engine | Engineering | All reminders, escalations, and delivery channels |
| [0004](product/0004-planning-playbooks.md) | Planning Playbooks | Product | Event task/reminder/milestone architecture |
| [0005](product/0005-system-proposes-human-confirms.md) | System Proposes. Human Confirms. | Product | Every AI/system-initiated business action |
| [0006](engineering/0006-one-fact-one-owner.md) | One Fact, One Owner | Engineering | Every stored status, lifecycle stage, or completion signal |
