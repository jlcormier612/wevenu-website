# Planning Playbooks — How They Evolve Over Time

**Status:** Current-behavior documentation + recommendation, requested as part of the Vendor/Planning Playbook commit review. Verified against the running code and a live rolled-back-transaction test, not inferred.

---

## What happens today, verified

**Editing a playbook template never touches any event it was already applied to.** `applyPlaybookToEvent` copies every field (title, dates, visibility, reminders, milestone name/kind) into `event_tasks` at the moment it's applied — it does not keep a live reference back to the template. I confirmed this directly: renamed a task in a template *after* applying it to a test event, and the event's own copy of that task kept its original name. This is by construction, not by a check that could be forgotten — there is no code path anywhere that writes from `playbook_tasks` into an already-existing `event_tasks` row.

So, concretely:

- **Existing events** (the playbook already applied): never affected by a later edit, ever. Not "usually," not "unless you check a box" — structurally never, today.
- **Future events**: the *next* time someone applies that template to a new event, they get whatever the template currently looks like. This isn't a deliberate "publish" step — it's simply that each apply reads the template fresh at that moment.
- **Is the venue given an explicit choice?** No — and this is the actual gap. There's no prompt when you edit a playbook that's already in use, because *nothing happens* to any existing event that would need confirming. The venue isn't asked "apply this update to your 3 upcoming weddings too?" because that capability doesn't exist at all yet, not because it's deliberately withheld behind a choice.

## Does this honor "System proposes. Human confirms."?

Partially, and worth being precise about which half. The principle has two things it protects against: the system silently *doing* something, and the system silently *not offering* something a venue would reasonably want. Today's behavior gets the first half right by construction — nothing is ever silently altered. It doesn't yet get to the second half — a venue who edits "Standard Wedding" because they realized something was missing has no way, not even a manual one, to bring their already-booked upcoming weddings up to date. The original design work anticipated this (`docs/planning-playbooks-design.md` names an explicit "apply to future events only / upcoming events / this event" choice as the intended shape), but it was never built — Phase 2 implemented the milestone/builder/duplicate work approved so far, not this piece.

## A related finding, since resolved: re-applying a playbook wasn't safe

While tracing this, I checked whether a venue could work around the missing sync by just re-applying the playbook to an event that already has one. At the time, they couldn't safely — `applyPlaybookToEvent` had no guard against being called twice, so doing so would have inserted a second full set of tasks alongside the first.

**Resolved 2026-07-08.** Per explicit product decision, V1 behavior is deliberately simple rather than a smart merge: if a playbook has already been applied to an event, a second application (same or different template) is blocked outright, with a clear explanation shown to the coordinator — no replace, no merge. This is enforced at both layers (Engineering Standard #3): the service layer returns a specific, readable message, and a new `event_playbook_applications` table (one row per event, primary-keyed on `event_id`) gives the database an atomic, race-safe backstop — a concurrent second attempt fails on the primary key rather than after already inserting duplicate tasks. Verified live: first application succeeds, a second attempt on the same event correctly fails with `unique_violation`, and exactly one application record remains.

Replace/merge behavior remains explicitly deferred — tracked in `docs/product-backlog.md` — until real customer demand justifies the added complexity, per the same reasoning as the sync-prompt recommendation below.

## Recommendation

**Don't build the full future/upcoming/this-event sync prompt speculatively right now.** It's real, named, designed work — but building it before a venue has actually hit the need risks the same "collected but not used" pattern this program keeps finding elsewhere (a feature nobody asked for yet, sitting unused). Validate the need with real customers before introducing that complexity, per explicit product direction. Tracked in `docs/product-backlog.md`.
