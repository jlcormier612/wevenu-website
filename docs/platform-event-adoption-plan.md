# Platform Event Adoption Plan

**Status:** Architecture and implementation planning only. No application code, database schema, or existing feature is changed by this document.
**Read first:** `docs/platform-orchestration-architecture.md` (approved — this document's entire §0/§1 inventory is taken as given, not re-derived), `docs/calendar-platform-integration.md`, `docs/luv-platform-reconciliation.md`. `docs/platform-workspace-architecture.md` and `docs/platform-intelligence-contract.md` still do not exist in this repository (re-confirmed directly) — this document proceeds without them, consistent with every prior document this program.

**Product Philosophy, stated once, governing every section below:** Platform Events are infrastructure. They do not perform work, send notifications, update Readiness, or call Luv. They publish that something meaningful occurred. Consumers decide whether to react. **If the framework disappeared tomorrow, every feature should still function correctly** — this is the test every recommendation below is measured against, restated at the end of every section that could tempt otherwise.

---

## 1. Inventory Existing Mechanisms

Taken directly from `docs/platform-orchestration-architecture.md` §0 — this section classifies what that document only described.

### (a) Trigger-based notifications — `create_venue_notification()` + 9 triggers → `venue_notifications`

- **Owner:** each triggering table's own feature (Leads, Guests, Planning, Vendor Management, Communication). The shared `create_venue_notification()` function itself has no single feature owner — it's Notifications-shaped infrastructure embedded at the database layer.
- **Current behavior:** each trigger detects one specific condition (RSVP status → attending/declined, task status → complete with `completed_by` in couple/vendor, etc.) and writes directly into `venue_notifications`, gated by `venue_notification_preferences`.
- **Current consumers:** exactly one — `components/shell/notification-bell.tsx`.
- **Classification: Wrap, then Replace in a later phase.** Wrap first: each trigger, at its existing detection point, additionally publishes a Platform Event — the trigger's own `insert into venue_notifications` is untouched, so the notification bell keeps working exactly as it does today throughout the wrap phase. Only once a new, event-driven Notifications consumer (§5) has run in production long enough to be trusted does a later phase retire the trigger's direct `venue_notifications` insert and let the new consumer own that write instead. **Do not do both in the same phase** — see §6.
- **Replacement strategy:** the trigger functions stay in Postgres (they're the only place with cheap, transactional access to `OLD`/`NEW`); each gets one additional `perform emit_platform_event(...)`-shaped call alongside its existing logic, not a rewrite of its detection condition.

### (b) Inline synchronous calls — `triggerSequencesForRelationship` (Leads only)

- **Owner:** Leads (`lib/leads/service.ts`), calling into Message Sequences.
- **Current behavior:** two `void`-called, fire-and-forget calls at lead creation and lead stage change.
- **Current consumers:** Message Sequences' own enrollment logic.
- **Classification: Wrap.** Add a Platform Event publish call immediately alongside the existing `triggerSequencesForRelationship` call — same file, same two call sites, zero change to Message Sequences itself. The existing call is not removed; a Platform Event–driven Automation consumer (§5) is a *second*, independent way to reach the same enrollment action, not a replacement for the first, until proven equivalent.

### (c) Scheduled polling — `task_reminders` sweep, `mark_overdue_payments`

- **Owner:** Notifications (`lib/notifications/engine.ts`) and Payments (`mark_overdue_payments` RPC) respectively.
- **Current behavior:** time-crossing checks — `processReminders()` sweeps due reminders on a cron/manual trigger; `mark_overdue_payments` flips `pending → overdue` lazily, only when Payments' own service functions run.
- **Current consumers:** the reminder email pipeline; whatever reads `payment_line_items.status` afterward (Calendar's `payment_due` item, Payments' own UI).
- **Classification: Keep the sweep, Wrap the flip.** The sweep mechanism itself is the only correct way to detect a time-crossing fact (per the orchestration doc's own state-transition vs. time-crossing distinction) and should not be replaced by anything event-shaped. What changes: the *moment a sweep detects a crossing* (a reminder becoming due, a payment becoming overdue) is exactly a state transition worth publishing — so each sweep, at the instant it flips a row, additionally emits a Platform Event for that one row. The sweep's own scheduling and query logic are untouched.

### (d) Passive activity logs — `event_activities`/`lead_activities`/`client_activities`/`request_lifecycle_events`

- **Owner:** each record's own feature (Events, Leads, Clients, Requests).
- **Current behavior:** triggers/service calls write one row into that record's own history table on creation or status change.
- **Current consumers:** that same record's own activity-feed/history UI, exclusively.
- **Classification: Wrap — and the safest, highest-reuse starting point in this entire inventory (see §4).** These already fire at precisely the correct moment, already carry `entityId`/`from`/`to`/timestamp, and are already isolated, single-purpose triggers or service calls with no other behavior to protect. Adding a Platform Event publish alongside each existing insert is closer to a pure addition than any other mechanism in this inventory — there is no existing consumer behavior that could regress, because the existing consumer (the activity feed) reads its own table directly and would never be pointed at the new event stream.

### (e) Direct synchronous reads at render time — not an inventory item, a baseline

Calendar, Luv, and Event Readiness reading feature-owned tables/service functions at render time is **not an event-producing mechanism** — it produces nothing, it only consumes current state. It is not classified here because there is nothing to Keep/Wrap/Replace/Retire; it is the fallback behavior every event in §1 already has today, and it remains correct, permanently, for anything that has no Platform Event yet (§6) and for Event Readiness specifically, forever (§8).

**Nothing in this inventory is classified Retire.** Every one of (a)–(d) is either already correct and merely needs a parallel publish added (Wrap), or is structurally necessary and stays exactly as-is (Keep). This is itself a finding: the orchestration doc's §0 did not surface any mechanism that is simply wrong and should be deleted — only mechanisms that are *narrower than the platform now needs*.

---

## 2. Event Contract

The canonical Platform Event shape — architecture, not a serialization format:

```
PlatformEvent = {
  eventType:     string          // "Feature.Verb" — see §3
  sourceFeature: string          // the owning feature, e.g. "planning", "requests", "contracts"
  entityType:    string          // e.g. "event_task", "request", "contract"
  entityId:      string          // the row's own id — never a denormalized copy of its fields
  venueId:       string          // every event is venue-scoped; this platform has no cross-venue concept anywhere
  clientId:      string | null   // present when the entity belongs to a client relationship; null for venue-only entities (e.g. a Calendar block)
  occurredAt:    timestamp       // when the underlying transition happened, not when a consumer later processes it
  actor:         { type: "staff" | "client" | "vendor" | "system"; id: string | null; name: string | null }
  payload:       Record<string, unknown>   // minimal — see below
}
```

**The one architectural decision this section exists to make explicit: `payload` is minimal by design, never a denormalized snapshot of the entity.** A Platform Event tells a consumer *that* `entityType`/`entityId` changed and *what kind* of change it was — never a copy of the entity's current field values. A consumer that needs to know more always re-fetches the entity's *current* state through that feature's own service function (`getRequest`, `getContract`, etc.), the same call it would make if it had discovered the change by any other means. This is not a serialization optimization — it is the mechanism that keeps Platform Events from ever becoming a second, potentially-stale copy of feature-owned data, which is exactly the failure mode `docs/luv-platform-reconciliation.md` §0 already found once, in a different form (the DB-backed Luv layer's persisted tables drifting from the tables they were meant to summarize). `payload` may carry the specific field(s) that make the event itself meaningful to route on (e.g. `Request.Submitted`'s payload might carry `sourceFeature` so a consumer can decide relevance without a fetch) — never more than that.

**Client-Owned data gets an explicit, narrower rule, not a case-by-case judgment call:** any event whose `entityType` belongs to a capability `docs/client-workspace-collaboration-architecture.md` §8 marks **Client Only** (Guests, Budget, Seating, Website, Our Story, Journey, People) must never carry an identifying field in its `payload` — a name, a note, a response detail. `Guest.RSVPSubmitted`'s payload is `{ rsvpStatus: "attending" }`, never the guest's name, closing the exact tension `docs/platform-orchestration-architecture.md` §1 flagged and explicitly declined to resolve. `entityId` (an opaque guest row id) is still present, because a consumer authorized to look the guest up through the couple's own portal-scoped context needs *something* to correlate against — but the event itself never does that lookup or names anyone.

---

## 3. Event Naming

**Convention: `Feature.Verb`, PascalCase on both sides, verb in past tense.** One consistent pattern, matching the examples given exactly:

| Event | Name |
|---|---|
| Planning task completed | `Planning.TaskCompleted` |
| Planning task scheduled | `Planning.TaskScheduled` |
| Request created | `Request.Created` |
| Request submitted | `Request.Submitted` |
| Request reviewed | `Request.Reviewed` |
| Request completed | `Request.Completed` |
| Contract signed | `Contract.Signed` |
| Payment received | `Payment.Received` |
| Payment became overdue (§1(c)'s sweep-detected flip) | `Payment.Overdue` |
| Document expired | `Document.Expired` |
| Guest RSVP submitted | `Guest.RSVPSubmitted` |
| Floor Plan shared | `FloorPlan.Shared` |
| Vendor accepted | `Vendor.Accepted` |
| Communication replied | `Communication.Replied` |
| Tour booked | `Tour.Booked` |
| Booking confirmed | `Booking.Confirmed` |
| Event completed | `Event.Completed` |

**`Feature` is the owning feature named in `docs/platform-orchestration-architecture.md` §2's ownership table, never the consumer.** `FloorPlan` uses PascalCase-joined-compound (matching `entityType: "floor_plan"`'s existing snake_case convention translated once, consistently) rather than `Floor.PlanShared` or `Floorplan.Shared` — one compound-noun feature name, decided here so no future implementer re-litigates it per event. Time-crossing events (§1 of the orchestration doc's distinction) use the same convention with a state-adjective verb (`Overdue`, `Expired`) rather than a false action verb (`Payment.WentOverdue` reads as awkwardly as it needs to, to avoid implying someone did something at that moment — no one did; time passed).

---

## 4. Adoption Order

Ordered strictly by smallest architectural risk, highest reuse, easiest verification — not by product importance:

1. **Wrap the passive activity logs (§1(d)) first.** Smallest possible blast radius: four isolated triggers/service calls, each already writing exactly the entity/actor/timestamp a Platform Event needs, each with exactly one existing consumer (that record's own history tab) that is trivially provable unaffected (its query doesn't change at all). This slice alone produces `Booking.Confirmed`, `Event.Completed`, `Request.Created`, `Request.Submitted`, `Request.Reviewed`, `Request.Completed` — six of the sixteen named events, for the lowest possible risk of any slice in this plan.
2. **Wrap the trigger-based notifications (§1(a)) second.** Slightly higher risk only because there are nine triggers instead of four, and one live consumer (the notification bell) that must be proven byte-for-byte unaffected — still a pure addition, still Postgres-only, still no application-code change. Produces `Planning.TaskCompleted`, `Guest.RSVPSubmitted`, `Vendor.Accepted`, `Communication.Replied` (legacy schema only, per the orchestration doc's own flagged gap — closing that gap is explicitly not part of this wrap, only reproducing it faithfully as a Platform Event for now).
3. **Wrap the inline sequence-triggering (§1(b)) third.** One file, two call sites, application-code (not SQL) — the first slice that touches TypeScript rather than only Postgres, hence ordered after the two purely-additive SQL wraps above so the team has already proven the "add a publish call, change nothing else" discipline once in the lower-risk substrate first.
4. **Wrap the sweep-based time-crossing mechanisms (§1(c)) fourth.** Requires the most care of the four wraps — a sweep processes many rows per run, and the publish call must fire once per row that actually flipped, not once per sweep — genuinely a small amount of new logic (a diff check), not a pure addition, hence last among the four existing mechanisms.
5. **Only then, emit new events with no existing mechanism at all** (`Contract.Signed`, `Payment.Received`, `Timeline.Published` once Timeline gains a publish concept, `FloorPlan.Shared` once that feature is actually built per the collaboration doc's own note that it's "reserved but unbuilt"). These are genuinely new triggers, not wraps — ordered last because "new trigger, new code path, zero existing behavior to protect" is a fundamentally different (and in one sense *simpler*, in another sense *less proven*) risk profile than wrapping something already running in production.
6. **Defer the unmodeled events indefinitely** (`Guest count finalized`, `Floor Plan approved`, `Seating completed`, `Timeline published`'s exact "published" moment) until each has the small product decision `docs/platform-orchestration-architecture.md` §1 already named as a prerequisite. This plan does not schedule them, because there is nothing yet to wrap or emit.

---

## 5. Consumer Migration

- **Notifications** migrates last among the "already has a mechanism" consumers, deliberately: it is the one consumer §1(a) already serves directly, so it has the least urgency and the most to lose from moving too fast. Migration path: once Phase 2 (§4) wraps the 9 notification triggers, build a *new*, event-driven notification path that reads Platform Events and independently decides (per `docs/platform-orchestration-architecture.md` §4's five categories) whether and how to alert — run it silently alongside the existing trigger-fed bell for a full cycle (§6) before ever retiring the trigger's direct `venue_notifications` insert.
- **Luv** migrates narrowly, not wholesale — most of Luv's work (reading `EventReadinessSummary`, `SeatingReadinessSummary`, etc.) is poll-based by design and never migrates to events at all (§3 of the orchestration doc; unchanged here). The one place Luv genuinely needs Platform Events: Celebration detection, which today would require Luv to invent its own "is this the first time I've seen this state" comparison. Once Platform Events exist, a `Request.Completed` or `Contract.Signed` event *is* that first-occurrence signal, directly — Luv subscribes to the specific transition-shaped events named in `docs/luv-platform-reconciliation.md` §4's Celebration definition, and nothing else changes about how Luv computes Facts/Inferences/Recommendations/Waiting/Risk.
- **Calendar** does not migrate in the sense of changing what it reads — per the orchestration doc §3, it stays render-time synchronous, always. The only opportunity Platform Events offer Calendar is *cache invalidation* (if a cache is ever added), an optional future optimization this plan does not schedule and Calendar's correctness never depends on.
- **Automation** is the newest consumer relationship, not a migration of an existing one (with the one exception of §1(b)'s inline call, which genuinely does migrate). Automation subscribes to specific events and takes one of the five allowed actions named in the orchestration doc §5 — this plan does not expand that allow-list, only gives Automation a cleaner signal to act on than the ad hoc inline call it has today.
- **Reporting** is the most natural first *new* consumer, full stop — it wants volume and durability, not immediacy, so a simple append-only log of every Platform Event (however that's eventually persisted — out of scope here, per §2's "no serialization" instruction) is directly useful to Reporting from day one of Phase 1, with no risk to anything else, since Reporting has no existing behavior to protect.
- **Daily Briefing** does not migrate, because it was never a direct consumer (`docs/platform-orchestration-architecture.md` §3, §6, restated, not revisited here). It inherits every benefit of this plan transitively, through Luv's own migration above.

---

## 6. Coexistence Strategy

**The rule for every phase in §4: add the Platform Event publish call, change nothing else, in the same commit.** No existing trigger's `insert into venue_notifications` is removed, no existing inline call is deleted, no existing sweep's own update logic changes — every Wrap in §1 is additive by construction, which is what makes coexistence possible at all rather than a hard problem to solve separately. Concretely:

- **During Phase 1–4 (§4), every consumer keeps working exactly as it does today**, because their existing code paths are untouched — the activity feed still reads its own table, the notification bell still reads `venue_notifications`, Message Sequences still gets its inline call, `payment_line_items.status` still flips the same way.
- **New, event-driven consumers run in shadow mode** — built and deployed, reading Platform Events, but not yet the system of record for anything a user would notice if it silently failed. A new Notifications path can log "would have sent X" without sending it; a new Luv Celebration detector can be compared against Luv's own current output before anyone trusts it.
- **No feature flag is required to gate the *old* path** — the old path was never touched, so it cannot regress. A feature flag is only useful to gate the *new* path's visible effects (e.g., "does the new event-driven notification actually fire to the user, or only log"), and that flag decision belongs to whichever consumer is migrating, not to this plan.
- **Retirement of an old direct-write (e.g., a trigger's `venue_notifications` insert) only happens after its replacement consumer has run silently, side-by-side, long enough to be trusted — and is its own separate, later phase, never bundled with the wrap that made it possible.**

---

## 7. Verification Strategy

Each phase in §4 is independently verifiable, and none require the next phase to exist first:

1. **Verify the wrap fires correctly.** For every real transition the wrapped mechanism already handles (a task completed by a couple, a lead created, a payment crossing its due date), confirm a Platform Event is published with the correct `eventType`/`entityId`/`occurredAt`/`payload` — the same live-transactional-test discipline this program has used throughout (a `begin; ...; rollback;` against the real schema, not a mocked one).
2. **Verify the existing behavior is provably unchanged.** For every wrapped mechanism, diff the mechanism's own original output (the `venue_notifications` row, the `event_activities` row, the sequence enrollment) before and after the wrap — byte-for-byte identical is the bar, since the wrap was supposed to add a line, not touch one.
3. **Verify the new consumer independently, before it's trusted.** Whatever shadow-mode consumer reads a newly-wrapped event (§6) gets its own verification pass — confirm it reacts correctly to the event stream in isolation, without yet asserting anything about the user-visible outcome that depends on it.
4. **Only then, verify the cutover** (a later, separate phase per §6) — confirm the new consumer's behavior matches or improves on the old direct-write mechanism's behavior for a real, representative window of production data before the old write path is retired.
5. **Roll out narrowly before broadly** — a single venue or a small cohort first, matching the caution already established for schema changes elsewhere in this program (`docs/wedding-workspace-architecture.md`-adjacent precedent of transactional verification before trusting a migration), never all venues on the first deploy of a new wrap.

---

## 8. Out of Scope

Explicitly, and tied to a specific existing thing each, not left abstract:

- **Business logic** — what `computePlanningReadiness`/`computeSeatingReadiness`/etc. actually compute never moves into a Platform Event or its consumer. An event says *that* something happened; it never contains the logic that decided whether that something *matters*.
- **Authorization** — RLS policies, `current_user_venue_id()`, portal `access_level` gating all stay exactly where they are. A Platform Event is not a permission boundary and never substitutes for one; a consumer reading an event still goes through the exact same authorization path it would use to read the entity directly.
- **Client-Owned decisions** — per §2's explicit rule above, a Platform Event never carries a Client-Owned capability's identifying detail, and no Platform Event ever *writes* Client-Owned data on Automation's behalf (`docs/platform-orchestration-architecture.md` §5's boundary, unchanged, restated because it is the single easiest rule for a future implementer to accidentally violate under this framework specifically).
- **Scheduling logic** — `task_reminders.scheduled_for` computation, `reminder_before_days` offsetting, and `mark_overdue_payments`'s own due-date comparison all stay exactly where they are (§1(c)). Platform Events observe the moment a sweep detects a crossing; they never decide when a sweep runs or what it checks.
- **Readiness calculations** — `lib/readiness/compute.ts` never consumes a Platform Event, ever, by design (`docs/platform-orchestration-architecture.md` §3's explicit, permanent exception, restated here because it is the one consumer this plan's adoption order might otherwise tempt someone to wire in "for consistency" — do not).
- **Luv observations** — the `ObservationKind` classification logic (Fact/Inference/Recommendation/Waiting/Risk, per `docs/luv-platform-reconciliation.md` §4) stays entirely inside Luv. Platform Events supply Celebration's *trigger moment* (§5 above) — never the logic that decides what any observation, of any kind, actually says.

**Platform Events announce change. They do not create change.** Every item above is a piece of business logic that decides *what to do about* a change — the line this framework must never cross, restated once more because it is the entire test in the closing instruction below.

---

## Closing constraint, restated

Treat the Platform Event Framework as plumbing, not product functionality. If it disappeared tomorrow, every feature in §1 would keep functioning exactly as it does today — because every wrap in this plan is additive, and nothing in §8 was ever allowed to depend on it. Consumers become simpler *because* Platform Events exist (one shape to subscribe to, instead of nine trigger functions and one inline call and two sweeps to individually understand); they never become *dependent* on Platform Events to execute their own business logic.

*End of document. No implementation, migration script, or code is proposed — see task scope.*
