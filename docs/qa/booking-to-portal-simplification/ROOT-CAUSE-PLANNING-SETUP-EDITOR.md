# Root cause — event-specific Planning editor

**Preflight:** HEAD `e1e5a0ff`; serving `1296269d`. Settings/Profiles frozen.

## Findings

1. **Badge:** Planning used readiness `draft`/`shared` as the Overview badge, so it read `Draft · …` instead of inclusion `Included` like Timeline. Profile name was removed from badges earlier; product wants profile name beside Included, with release explained in the summary.
2. **Open vs Change:** Both navigated into the Planning management tab (`playbook#…`). Change must open a dedicated pre-release editor, not management.
3. **Persistence:** Event checklist = `event_playbook_applications` + `event_tasks` (`template_task_id` attribution). Template replace = existing `unapplyPlaybookFromEvent` then `applyPlaybookToEvent` (no silent merge). Custom add/remove needs thin event-task helpers; Library templates are untouched.
4. **Management controls:** Create Request / complete / waive live in `EventTaskList` and must stay there — not in the setup editor.

## Fix direction

- Planning badge: `Included` (or `Released` after release) + profile name; summary carries prepare/release language.
- Open Planning → management tab only.
- Change for this event → Sheet editor: switch Client Planning template OR customize event tasks; save only; no release/invite/Q/invoice.
