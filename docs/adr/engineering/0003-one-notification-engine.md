# ADR-0003: One Notification Engine

**Date adopted:** 2026-07-08 (engine itself shipped earlier as the `task_reminders` / `lib/notifications/engine.ts` cron pipeline; formalized as the single required path during the Notification System redesign).

## Decision

There is exactly one notification engine (`task_reminders` table + `lib/notifications/engine.ts`) for every reminder and escalation in the product, regardless of what triggers it or who it notifies. Notification **events** (what a venue wants to know about) are modeled separately from notification **channels** (how they want to hear about it — in-app, email, SMS, push), so a venue's choice of "what" never has to be re-decided per "how."

## Reasoning

A second, parallel reminder mechanism — even a well-intentioned one built for a specific feature — immediately creates the exact duplicate-truth risk Engineering Standard #12 exists to prevent: two places that could each decide when to notify someone about the same underlying fact. Separating events from channels was necessary because a venue's answer to "do I want to know about this" and "how do I want to be told" are genuinely independent questions, and collapsing them forces a venue to reconfigure both together every time.

## Alternatives considered

- **A dedicated reminder mechanism per feature** (e.g., a separate escalation pipeline for Planning Playbooks) — rejected; Planning Playbooks explicitly reuses `task_reminders`/`reminderBeforeDays`/`escalationAfterDays` rather than building a second pipeline (`docs/planning-playbooks-design.md`, Phase 2 implementation).
- **Notification preference as a single flat toggle list** (no category/channel separation) — rejected as a cognitive-load problem; most venues would face dozens of individual toggles instead of a small set of Profiles (Minimal/Recommended/Everything/Custom).

## Where it applies

- All reminder/escalation delivery, present and future: Planning Playbook task reminders, escalating unanswered inquiries (Booking Journey's "Decision Pending" stage), and any future notification category.
- Category and profile design: `docs/notification-system-redesign.md`.
