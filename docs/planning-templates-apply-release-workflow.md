# Planning Templates — Applying to Events (Apply / Release Workflow)

**Status: Approved, moving to implementation.** Written in response to "Planning Templates - Remaining Product Work" (2026-07-09), item 2: "Please design the complete application workflow before implementing it." Approved 2026-07-10 with one required refinement: the Event page must always make the current state (Not Applied, Draft, Released) and the next obvious action (Edit Draft, Release to Client, View Client Portal) unmistakable — folded into §3 below.

**Grounding facts, confirmed against the current codebase before writing this** (so the design below is honest about what exists today, not aspirational):
- `applyPlaybookToEvent` applies a template **instantly and unconditionally** — one call inserts the `event_playbook_applications` marker row and every `event_tasks` row in the same transaction. There is no draft/staging state today, for either kind.
- Each task already carries a `visibility` field (`client_owned`/`client_visible` for Client Planning; `coordinator_only`/`vendor_visible`/`vendor_owned` for Venue Planning) — but this is a **permanent, per-task audience assignment set at template-authoring time**. It answers "who is this task for," not "has this checklist been shown to them yet." It is not a release gate and shouldn't be treated as one.
- **Correction (2026-07-10):** an earlier version of this document stated the couple portal had zero references to `event_tasks`. That was wrong — re-checked against the current codebase and found `get_portal_tasks` (added in `20260722000000_planning_playbook_milestones.sql`) already returns every task with `visibility in ('client_visible','client_owned')`, and `VenueTasksSection` in `components/portal/portal-shell.tsx` already renders them as a first-class "📋 Tasks" section in the couple portal today — unconditionally, the moment a task exists, with no release gate. That's exactly the gap this document closes: today, applying Client Planning to an event makes it instantly visible to the couple with no review window at all. The state model below (§2) is what adds the missing gate; §2's schema change is paired with a matching change to `get_portal_tasks` so Draft-state tasks are actually excluded, not just visually hidden on the venue side.

---

## 1. The core distinction

**Applying** a template and **releasing** it to the client are two different actions, with two different owners:

| | Applying | Releasing |
|---|---|---|
| Who does it | Coordinator | Coordinator |
| What it does | Generates real tasks with real due dates from the template | Makes an already-applied Client Planning checklist visible to the client |
| Applies to | Both Client Planning and Venue Planning | **Client Planning only** |
| Reversible | Not currently (matches today's behavior) | Yes — see §5 |

**Venue Planning never has a release step.** It's internal by definition — the moment it's applied, it's active, exactly like today. Nothing changes for Venue Planning in this design; it's included in the diagram below only for contrast.

**Client Planning gets a middle state.** Applying a Client Planning template creates a real, editable checklist tied to the event — but it starts **private to the venue**. The coordinator can review it, remove a task that doesn't apply to this specific couple, nudge a due date, before the couple ever knows it exists. Releasing is the deliberate second action that makes it visible.

This is the same interaction the earlier "Planning Experience" design work anticipated but didn't build (`docs/product-backlog.md`, "Release Client Planning to the Couple as a Deliberate Action") — this document is that idea, worked through completely.

---

## 2. State model

Three states for a Client Planning application; two for Venue Planning:

```
Venue Planning:      [ Not Applied ] ──apply──▶ [ Active ]

Client Planning:     [ Not Applied ] ──apply──▶ [ Draft ] ──release──▶ [ Released ]
                                                    │
                                                    └──(coordinator can still edit/remove tasks here)
```

**Proposed schema shape** (minimal — extends the existing marker table rather than inventing a new one):

```sql
alter table event_playbook_applications add column released_at timestamptz;
```

- `released_at is null` → Draft (Client Planning only; meaningless for Venue Planning, which we'd just leave permanently null or backfill to `applied_at` for consistency — open question, see §6).
- `released_at is not null` → Released.
- Venue Planning applications either skip this column's meaning entirely, or we set `released_at = applied_at` at apply-time so "is this active" can be answered by one consistent check (`released_at is not null`) across both kinds without a kind-specific branch everywhere it's read. **Leaning toward the latter for code simplicity** — flag in §6.

**Reminders follow release, not application, for Client Planning.** Today, `createRemindersForTask` runs immediately inside `applyPlaybookToEvent`. For Client Planning, that would mean a couple gets a reminder email for a task they've never seen, about a checklist that isn't visible yet. Proposed: for Client Planning, reminder records are created at **release** time, not apply time. Venue Planning keeps today's behavior (reminders created at apply time) since there's no draft period to wait out.

---

## 3. The venue-side experience

Extends the existing two-row apply UI (`PlaybookApplyRow` in the event's Planning tab) with three explicit, always-visible states for Client Planning — the coordinator should never have to infer what the client is currently seeing:

**Not Applied** (unchanged from today):
```
│  💍  No Client Planning checklist applied                         │
│      [ Standard Wedding ▾ ]  [ + Apply ]                          │
```

**Draft** — applied, but private to the venue:
```
│  💍 Client Planning                              [ Draft ]        │
│  Standard Wedding — not yet visible to Nicole & Colby              │
│  3 of 9 tasks · [ Edit Draft ]  [ Release to Nicole & Colby ]     │
```

**Released** — visible to the couple:
```
│  💍 Client Planning: Standard Wedding          [ Released Jul 9 ] │
│  ▓▓▓▓▓▓▓▓▓░░░  3 of 9 complete · [ View Client Portal ↗ ]         │
```

**"Edit Draft"** isn't a new surface — it scrolls to the same task list (`event-task-list.tsx`) already built and already rendered on the same page, just reachable and clearly labeled while in Draft. Nothing about task editing changes; only the badge/label communicating "the client can't see this yet" is new.

**"Release to [Client Name]"** is a single, explicit, named action — not a settings toggle buried in Advanced. Matches the trust philosophy this whole feature has been built around ("System proposes, human confirms") applied at the client-facing boundary specifically, which was the original ask when this idea first came up.

A confirmation step before release is worth having, since it's a one-way door in the couple's experience (they'll start getting reminders): *"Release Client Planning to Nicole & Colby? They'll be able to see and complete these 9 tasks, and reminders will start going out."* Simple confirm/cancel, not a new multi-step flow.

**"View Client Portal"** opens the couple's actual portal (`/p/[token]`) in a new tab — the same portal link already manageable from the client record (`PortalLinkWidget`) — so a coordinator can see literally what the client sees, not a simulation of it. If the client has no portal link yet (rare — most are created at booking), releasing creates one automatically rather than showing a dead-end "View Client Portal" button with nothing behind it.

---

## 4. When each becomes "active"

Directly answering the four things the request named:

1. **Applying Venue Planning to an event** → active immediately, exactly like today. No change.
2. **Applying Client Planning to an event** → creates the checklist, Draft state, active for the *coordinator* immediately (they can see and edit it), inactive for the *client*.
3. **When Venue Planning becomes active** → at apply time. Unchanged.
4. **When Client Planning becomes visible inside the client portal** → at release time, not apply time. This is the entire point of the two-action split.

---

## 5. Un-releasing — deferred, not built this pass

A coordinator who releases too early should have a way back eventually. Not built now: the approved scope is Apply → Draft → Release (Edit Draft, Release to Client, View Client Portal) — no revert action was named. Matches the "wait for a felt need" pattern already used for template-to-event sync elsewhere in this feature. Logged to `docs/product-backlog.md` if it turns out to be needed.

---

## 6. Decisions made for implementation

- **Venue Planning's marker row gets `released_at = applied_at` at apply-time**, and existing rows (both kinds, applied before this feature shipped) are backfilled the same way — so "is this active" is one kind-agnostic `released_at is not null` check everywhere, and no couple who could already see their checklist loses access the moment this ships. Only *new* Client Planning applications start in Draft going forward.
- **No separate toast/notification to the coordinator's team on release** — the confirm dialog is the only interaction.
- **Multi-contact events** — out of scope, consistent with today's Client Planning model already treating "the client" as one audience.

---

Implementation in progress.
