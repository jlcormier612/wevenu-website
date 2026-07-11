# Booking Workspace — Product Workflow Design

**Status: Design only, no code.** Written in response to "Booking Workspace - Product Workflow" (2026-07-12). Nothing in this document has been built. Per the request, existing architecture decisions (Sales Pipeline ends at Booked, no Client Pipeline after booking, Planning as the primary post-booking system) are treated as settled and are not revisited here — this document designs the experience *on top of* those decisions, and calls out anywhere the request runs into something already built differently, rather than silently redesigning around it.

**Revised 2026-07-12** with product decisions resolving the conflicts and open questions §9 originally raised. Still design only — nothing below authorizes implementation. Each resolved item keeps its original reasoning in place and adds the decision on top of it, rather than rewriting history.

---

## 0. Grounding facts, confirmed against the current codebase before writing this

These are the load-bearing facts the rest of this document reasons from:

- **"Booked" already has a precise meaning in the codebase.** The lead pipeline's terminal stage is internally called `won` (label "Won," description "Booking confirmed" — `lib/leads/constants.ts`). Reaching it is what the request calls "Booked." There are two existing code paths that produce a booked Client today: `convertLeadToClient()` (a lead reaches Won) and `createClient_()` (a coordinator adds a client directly, skipping Leads entirely). Both already exist, both already end in the same place, and **this design assumes both are the entry point for Booking Creation**, not just the lead-conversion path.
- **Some Booking Creation steps are already automatic; most are not.** Right now, the moment either path above runs, the system already: creates the Client record, auto-creates the Event (`autoCreateEvent`, when an event date is known), converts any active date holds to `converted`, and **automatically creates a client portal session** (`createPortalSession`, called unconditionally at the end of both functions). Venue Planning, Client Planning, Timeline, Payment Schedule, and Vendor Recommendations are **not** part of this automatic path today — each requires a separate, manual, later action from the coordinator. This is the single biggest gap between what exists and what this document designs toward.
- **Venue Planning and Client Planning already have an "apply" mechanism**, including the Draft → Release state for Client Planning that just shipped. Both are coordinator-triggered from the event's Planning tab — never automatic.
- **Timeline already has a template-apply mechanism** (`applyTemplate` in `lib/timeline/service.ts`, exposed via a `TemplatePicker` component on the event's Timeline tab) — also coordinator-triggered, never automatic.
- **Payment Schedules have no template concept at all.** `createPaymentSchedule` exists, but every schedule is built from scratch per event via a form (`components/payments/new-schedule-form.tsx`) — there is nothing today resembling a reusable "payment plan template" to select at booking time.
- **`PlaybookTemplate.isDefault` already exists as a field** and is even displayed as a "Default" badge in the Planning Template Library — but nothing reads it to auto-select a template anywhere for Planning (contracts *do* use their own `isDefault` this way; Planning doesn't). This is a real, if dormant, hook this design can point at.
- **Vendor recommendations are per-event and manual today** (`event_vendor_recommendations`, built this session) — a coordinator picks vendors from the Vendor Library one at a time, per event. The "prepare vendor recommendations (if selected)" step this document is asked to design **depends on the not-yet-built "Recommendation Sets" concept** (logged to `docs/product-backlog.md`, explicitly not implemented). This document designs around that dependency rather than assuming it exists.
- **The event page already has 12 tabs**, not 9: `overview` (current default), `notes`, `team`, `playbook` (Planning), `timeline`, `vendors`, `floor-plan`, `invoice`, `final-details`, `documents`, `activity`, `feedback`. The request names 9: Planning, Timeline, Messages, Documents, Payments, Vendors, Guests, Activity, Notes. §2 below reconciles this explicitly rather than silently dropping or merging tabs.
- **Interactive Planning Tasks already exist** (Vendor Management — Next Iteration, shipped this session): a task can carry an `actionType` (`vendor_library | payments | documents | guest_list`) that renders as a real navigation button, and `payment_received` / `document_uploaded` / `vendor_selected` already auto-complete their related task. This is a large head start on §4's requirements — the mechanism exists; this document extends its vocabulary and coverage, not its architecture.
- **There is no venue-side Guest List view.** The real Guest List (RSVPs, dietary needs, groupings) exists only in the couple portal. This was already logged as a backlog item ("No Venue-Side Guest List View") when the `guest_list` actionType was built, pointing at Overview as an interim stand-in. The request's "Guests" tab requires this to actually be built — flagged in §7, not silently assumed solved.
- **Messages are scoped to the Relationship, not the Event.** A Conversation anchors to one `venue_customer_relationship` (via `lib/conversations/`), not to a specific event. In practice a client almost always has exactly one event, so this is invisible day-to-day — but it means "Messages" as a Booking Workspace tab is showing relationship-level data inside an event-scoped shell. Flagged in §2, not silently resolved.
- **The Payments tab is internally called "invoice," not "payments."** Already noted as a naming mismatch when Interactive Planning Tasks were built (`TASK_ACTION_TYPES` maps the `payments` action to the `invoice` tab hash). This document uses "Payments" as the user-facing name throughout, consistent with the existing tab's actual content — the internal name is a cosmetic detail for whoever implements this, not a design question.

---

## 1. Booking Creation

### 1.1 What already happens automatically (unchanged)

- Client record created
- Event auto-created (when an event date is known)
- Active date holds converted
- Client portal session created

### 1.2 What this document adds to that automatic sequence

The moment a lead reaches Won (or a coordinator adds a client directly with an event date), the system should — with no additional clicks — also:

1. **Apply the selected Venue Planning template.** "Selected" means: the venue's default Venue Planning template for this event's type, if one is marked default (`isDefault`) for that `eventType`; otherwise, the coordinator is asked once, inline, as part of the booking flow — not left to notice later that nothing happened. Venue Planning activates immediately on apply, exactly as it does today when applied manually — no change to that behavior.
2. **Apply the selected Client Planning template, in Draft.** Same selection logic as above. Because Client Planning already defaults to Draft on apply (shipped this session), this step requires no new state — auto-applying it *at* booking already produces exactly what §1 asks for: a checklist the coordinator can review and adjust before the client ever sees it. The Release action remains a deliberate, separate step — auto-applying is not auto-releasing.
3. **Apply the selected Timeline template.** Same selection pattern, using the existing `applyTemplate` mechanism. Timeline templates are already resolvable by `eventType` in the same shape as Planning templates.
4. **Create the client portal.** Already automatic — no change needed here; noted for completeness since the request lists it explicitly.
5. **Create the payment schedule — deferred (Decided 2026-07-12).** Not solved now. Payment Schedule Templates are assumed to exist later; this step of Booking Creation should **not** be built to do anything yet, and the current manual workflow (coordinator navigates to Payments, clicks "New Schedule") is not being redesigned. The requirement here is narrower than "solve it": leave a clean extension point. Concretely, that means Booking Creation's automation sequence (§1.4) should be built with this step named and present — skipped/no-op today, logged in the workspace checklist as "Payment schedule — set up manually" — rather than omitted entirely, so that wiring in real Payment Schedule Templates later is adding a step to an existing sequence, not retrofitting one. No template concept, line-item structure, or due-date logic is designed here — that's genuinely future work, not scoped by this document.
6. **Prepare vendor recommendations (if selected) — no change (Decided 2026-07-12).** Recommendation Sets are not being implemented. This step of Booking Creation does nothing until that concept ships — coordinators continue recommending vendors individually, per event, exactly as they do today. Nothing about this step is designed further here; it remains exactly the dependency named in §0.

### 1.3 Selection, not invention

None of the above should *guess* which template to apply beyond `isDefault` + `eventType` matching that already exists as a concept for other template types in this codebase. If a venue has multiple Client Planning templates for "wedding" and none marked default, Booking Creation should ask once (a single inline choice at the moment of booking, not a chase-them-down-later problem) rather than silently picking one.

### 1.4 Failure handling

Booking Creation becoming a multi-step automatic sequence means it can partially fail (e.g., Venue Planning applies, but no default Timeline template exists for this event type). The coordinator should see, on the newly created Booking Workspace, a plain acknowledgment of anything that didn't auto-apply — not a silent gap they discover a week later. This mirrors the existing `WorkspaceChecklist` component's already-established pattern (`components/clients/booking-celebration.tsx`) of showing "Event workspace created / Client portal ready / ..." as a literal checklist — that component is a natural home for "Venue Planning applied / Client Planning applied (Draft) / Timeline applied / Payment schedule — needs setup" to live, extended rather than replaced.

---

## 2. Booking Workspace — tab structure (Decided 2026-07-12)

The request originally named nine tabs; the event page has twelve today. All open questions below are now resolved. **Final tab set:** Planning, Timeline, Messages, Documents, Payments, Vendors, Activity, Notes, Team, Feedback — ten tabs — plus Overview remaining for now with its long-term purpose to be revisited later, plus a reserved (empty) Guests slot, plus Floor Plan continuing to exist as a destination reached from Planning rather than a primary tab. Final Details is retired as a tab — it becomes part of the Planning journey instead.

| Requested/kept | Existing tab | Status |
|---|---|---|
| Planning | `playbook` | Exists. Becomes the default landing tab (currently `overview` is default — see §2.1). |
| Timeline | `timeline` | Exists, unchanged. |
| Messages | *(none directly)* | **Decided — see §2.2.** New tab; relationship-based Conversation data, default-scoped to this booking. |
| Documents | `documents` | Exists, unchanged. |
| Payments | `invoice` | Exists under a different internal name (see §0) — same tab, this document's "Payments." |
| Vendors | `vendors` | Exists, unchanged (recently extended with Event Recommendations). |
| Activity | `activity` | Exists, unchanged. |
| Notes | `notes` | Exists, unchanged. |
| Team | `team` | **Decided — see §2.4.** Kept, unchanged. |
| Feedback | `feedback` | **Decided — see §2.4.** Kept, unchanged. |
| Guests | *(none)* | **Decided — see §2.3.** Future phase; reserve tab space now, no content behind it yet. |
| *(status pending)* | `overview` | **Decided — see §2.4.** Remains for now; long-term purpose to be revisited separately. |
| *(retired as a tab)* | `final-details` | **Decided — see §2.4.** Folds into the Planning journey; no longer a permanent tab. |
| *(not a primary tab)* | `floor-plan` | **Unchanged — see §2.5.** Stays, reached from Planning. |

### 2.1 Default landing tab changes from Overview to Planning

This is a concrete, decidable change this document specifies directly (not a conflict): `activeTab` currently initializes to `"overview"`; it should initialize to `"playbook"`. Straightforward once approved for implementation — noted here rather than left implicit.

### 2.2 Messages — relationship-based data, booking-scoped default view (Decided 2026-07-12)

**Decision: keep Conversations relationship-based. Do not move Conversations onto the Event.** The underlying data model named in §0 is correct and stays exactly as-is — one Conversation per relationship, not one per event, not redesigned into an event-owned thread.

What the Booking Workspace's Messages tab adds is a **presentation-layer default, not a data-model change**: opening Messages from inside a Booking Workspace should default the view to messages relevant to that booking — in practice, messages from around the time this event was booked forward, or messages explicitly linked to this booking's Planning tasks via the existing Related Context mechanism (§4) — while the full relationship history remains one scroll/click away, not hidden or split into a separate store. For the common case (one client, one event) this default view and the full history are the same thing, so nothing changes visibly. For a repeat client with more than one Booking Workspace, each booking's Messages tab shows the same underlying conversation, scoped by default to that booking's own timeframe, with older conversations (from a prior event, or before this one existed) reachable rather than cut off. This is a filtering/scroll-position behavior on top of one conversation, not a second conversation.

This does not resolve the three-communication-system fragmentation named in `docs/communication-platform-next-phase.md` §0 — that finding and its consolidation work stand independently of this decision, which is scoped only to how the Booking Workspace presents whichever conversation data exists.

### 2.3 Guests — future phase, reserve the space now (Decided 2026-07-12)

**Decision: leave Guests as a future phase. Do not build the venue-side Guest List view now.** The Booking Workspace's tab bar should reserve a slot for it — a visible "Guests" tab that communicates the workspace's eventual shape, even before there's a real view behind it — rather than omitting it and adding a tab later. What that reserved tab shows in the meantime (nothing yet, a "coming soon" state, or continuing to route the existing `guest_list` actionType at Overview as it does today) is an implementation detail, not a design question this document needs to settle — the decision here is scope (not now) and shape (reserve the slot), not the interim placeholder's exact content.

The underlying gap named in §0 stands as previously described: the request's "Complete Guest List → Opens Guest List" task example has no real destination until this is built, and the data that view would eventually show already exists and is portal-writable today (RSVPs, dietary needs, groupings) — unchanged from the original backlog entry, just explicitly deferred rather than open.

### 2.4 Overview, Team, Final Details, Feedback (Decided 2026-07-12)

- **Team — kept, unchanged.** Stays a tab exactly as it is today.
- **Feedback — kept, unchanged.** Stays a tab exactly as it is today.
- **Final Details — retired as a permanent tab.** Confirms the fold-in proposed in the original draft: the couple-facing final-details questionnaire becomes part of the Planning journey rather than a separate tab. Concretely, this extends §3.1's actionType vocabulary with a fifth value (`final_details`, alongside `vendor_library` / `payments` / `documents` / `floor_plan`) pointing a Planning task ("Complete your final details") at the questionnaire send/status experience that the `final-details` tab shows today. The tab itself goes away; the experience it hosts moves into Planning's existing navigation model rather than disappearing.
- **Overview — remains for now, long-term purpose to be revisited later.** Not folded into Planning, not removed, not one of the ten primary tabs either — an explicitly separate, pending status. No redesign of Overview's current content is specified here; this document takes no position on what it should eventually become, since that's the open question being deliberately deferred, not answered by omission.

### 2.5 Floor Plan is not a conflict

Floor Plan isn't in the request's 9-tab list, but the request's own example ("Create Floor Plan → Opens Floor Plan Studio") assumes it still exists as a destination. Reading the two together: Floor Plan stays exactly as it is today — a real tab — it's just not one of the *primary* 9 the request is focused on describing. No change needed here.

---

## 3. Planning — the default landing experience

Planning already renders as a task list grouped by status (Overdue / Waiting / Upcoming / Complete / Waived), already supports the Draft → Release state for Client Planning, and already supports per-task action buttons via `actionType`. This section extends that existing mechanism to match the request's coverage, not replace it.

### 3.1 Extending the actionType vocabulary

Today's four action types (`vendor_library`, `payments`, `documents`, `guest_list`) already cover four of the five examples in the request. Two additions, both additive to the existing enum, neither a redesign:
- `floor_plan` — "Create Floor Plan → Opens Floor Plan Studio," pointing at the `floor-plan` tab hash, following the exact pattern already established for the other four.
- `final_details` — new as of the §2.4 decision to retire Final Details as a permanent tab; points a Planning task at the questionnaire send/status experience that tab hosts today.

### 3.2 Planning drives the event, not just tracks it

The request's framing — "Planning is not simply a checklist... the user should rarely have to leave Planning to complete work" — is already the design intent behind the actionType mechanism as built. This document's job here is narrower than it might sound: confirm every meaningful cross-system action a task could represent has a real destination, and name the ones that don't yet:

| Task example | Destination | Status |
|---|---|---|
| Choose Florist | Vendor Recommendations | Exists (`vendor_library`) |
| Upload Insurance | Documents | Exists (`documents`) |
| Pay Final Payment | Payments | Exists (`payments`) |
| Create Floor Plan | Floor Plan Studio | **New — §3.1** |
| Complete your final details | Final Details questionnaire | **New — §3.1, §2.4** |
| Complete Guest List | Guest List | **Deferred — future phase, §2.3** |

---

## 4. Communication supports Planning, doesn't replace it

The request's model — questions about a task originate from that task, Messages remains its own tab — maps cleanly onto the Related Context mechanism already built for Planning tasks (`EventTaskContextLink`, linking a task to a conversation message, document, timeline entry, or link). Today a coordinator can already attach an *existing* conversation message to a task as context. What's not built: starting a *new* message from inside a task, pre-addressed to the right person, with the task's context attached automatically. That's the concrete gap between "supports Planning" as a passive link (exists) and as an active starting point (doesn't yet) — worth naming precisely rather than leaving "communication supports Planning" as an unfalsifiable design statement.

---

## 5. Notifications move Planning forward

### 5.1 What already exists

A venue notification center already exists (`create_venue_notification`, with a `p_link` field for deep-linking) and is already wired for exactly one of the six example triggers: `vendor_selected` fires a real venue notification today (built this session, alongside the auto-complete trigger). `payment_received` and `document_uploaded` currently only auto-complete their task — they do not yet also notify the venue. Task due / overdue / completed exist as a *separate* mechanism (`task_reminders`, generated at apply — or release, for Client Planning — time) aimed at the couple/vendor/coordinator via email, not as venue in-app notification-center entries.

### 5.2 The gap

Two distinct gaps, not one:
1. **Coverage** — `payment_received` and `document_uploaded` should also call `create_venue_notification`, matching the `vendor_selected` pattern already in place. Small, additive, no new mechanism needed. Still open — not addressed by the 2026-07-12 decisions below.
2. **Precision of the deep link (Captured as future work, Decided 2026-07-12)** — `p_link` today can point at an event and, via the existing hash system, a *tab*. It cannot point at a *specific task* within Planning — there's no task-level URL addressing yet. "Notifications should take the user directly to the related task whenever possible" requires a task-level anchor (e.g., `#playbook:task-{id}`) that Planning's task list would read on load to auto-expand and scroll to that specific task, the same way tab-level hashes already work today. **No implementation required now** — this is explicitly deferred, named here so it isn't lost, not scoped further.

---

## 6. Timeline connects to Planning (Decided 2026-07-12)

No mechanism exists today for a Timeline entry to reference a Planning task (or vice versa) — they're two independent lists that happen to both belong to the same event. **Decision: add a simple relationship, do not redesign Timeline around Planning.** A lightweight association is confirmed sufficient — exactly the scope originally proposed and now the explicit ceiling on this work, not a starting point for something deeper. Concretely: one nullable reference (most plausibly on `TimelineEntry` pointing at an `EventTask`) so a timeline item can optionally name the task it relates to ("Guest Count Finalized" → the Guest Count task), surfaced as a plain link in each direction's detail view. No new completion logic, no Timeline items driving task state or vice versa, no Timeline reshaped into a Planning sub-view — the association is informational, not behavioral.

---

## 7. Vendors, Payments, Documents inside the Booking Workspace

These three sections' requirements are, encouragingly, mostly already true of the current implementation, built earlier this same engagement:

- **Vendors**: Event Recommendations already live inside the event (`event_vendor_recommendations`); a client's portal selection already updates the booking automatically and notifies the venue (`vendor_selected` trigger, built this session). Nothing new required beyond §3.1's floor-plan action type addition and whatever Recommendation Sets eventually adds (§1.2 item 6).
- **Payments**: "Planning tasks should open directly into the relevant payment" and "successful payment completion should automatically complete related planning tasks" are both already true today (`payments` actionType; `payment_received` auto-complete trigger, wired this session). No gap here beyond the notification coverage item in §5.2.
- **Documents**: Same story — "opens directly into the relevant document or upload experience" and "uploading completes the task automatically" are both already true (`documents` actionType; `document_uploaded` / `document_uploaded_insurance` auto-complete triggers, wired this session). No gap here beyond §5.2.

---

## 8. Activity is the audit trail; Planning is the work

Already true of the current implementation and not something this document needs to design — the Activity tab is already a distinct, append-only log, and Planning is already the live, editable task system. Named here only to confirm no conflict exists with the request's instruction not to merge these.

---

## 9. Conflicts & open questions — resolution status (updated 2026-07-12)

1. **Payment Schedule automation (§1.2.5) — Decided.** Not solved now; a clean extension point is left in the Booking Creation sequence, current manual workflow untouched.
2. **Recommendation Sets dependency (§1.2.6, §0) — Decided.** No change; individual per-event recommendations continue until Recommendation Sets ships.
3. **Messages is Relationship-scoped, not Event-scoped (§2.2) — Decided.** Kept relationship-based by design; Booking Workspace adds a booking-scoped default view on top, older conversations stay reachable.
4. **Guests tab requires the not-yet-built venue-side Guest List (§2.3) — Decided.** Future phase; tab space reserved now, view not built now.
5. **Overview, Team, Final Details, Feedback — fate undecided (§2.4) — Decided,** except Overview. Team and Feedback are kept unchanged; Final Details is retired as a tab and folds into Planning (§3.1); Overview remains for now with its long-term purpose explicitly deferred, not answered.
6. **Task-level deep linking doesn't exist yet (§5.2) — Captured as future work, not designed further.** No implementation required now.
7. **Timeline ↔ Planning task linking is new schema (§6) — Decided.** A lightweight, informational-only association; explicitly not a deeper redesign of Timeline around Planning.

**Still genuinely open, not addressed by the 2026-07-12 decisions:**
- **§5.2 item 1** — `payment_received` and `document_uploaded` not yet calling `create_venue_notification` (notification coverage gap, distinct from the deep-linking item above).
- **§4** — starting a new message from inside a task (with context pre-attached) isn't built; today's Related Context mechanism only supports attaching an *existing* message.
- **Overview's long-term purpose** — deliberately deferred, per item 5 above, not resolved by this revision.

---

## 10. What this document deliberately does not do

Per the request: no code, no schema, no migrations. Where a section names "new schema" or "a new actionType value," that's identifying the *shape* of the gap for whoever scopes implementation next — not a spec to build from without a further pass. The existing architecture named in §0 (Draft/Release, actionType mechanism, auto-complete triggers, Related Context, the hash-based tab addressing) is treated as fixed and extended, never redesigned.
