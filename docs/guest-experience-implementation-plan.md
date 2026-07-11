# Guest Experience — Implementation Plan

**Status:** Documentation only. No code, schema, or UI changed as part of this task.
**Purpose:** Audit the Guest Experience against the approved Wedding Workspace architecture's Guest Experience vision, name every gap and conflict between what's built and what's stated, and lay out an independently-phased roadmap toward closing them. This document does not implement anything.
**Companion documents:** `docs/wedding-workspace-architecture.md` (the approved product vision — §3 Ownership Model, §6 Guest Architecture, §13 Request Framework Integration, §14 Privacy Model, §15 Sharing Model are the direct references for this audit) and `docs/floor-plan-seating-architecture.md` (the Seating relationship, referenced rather than repeated below).

**Framing, stated once and held throughout:** The Guest Experience is a complete Wedding Workspace capability, not a Guest List. Its purpose is to help the couple plan and manage their guests while giving the venue only the operational information necessary to execute the event. The venue does not own the guest list. The couple does. Every finding and recommendation below is written against that framing.

---

## 1. The approved vision, restated (not redesigned)

From `docs/wedding-workspace-architecture.md` §6, with direct support from §3, §13, §14, §15:

- **Guest list is Client-Owned.** No Booking Workspace UI is meant to read `couple_guests`; the couple's guest list is named in §3 as one of the two domains ("the reference implementation of enforced Client Ownership") most likely to be assumed inviolable by product intent.
- **The venue's stake is operational, not administrative.** The venue needs to know what it must execute — headcount, meal counts, dietary aggregates, table assignments — not who's coming, who declined, or what a guest wrote in an RSVP note.
- **Collaboration happens through Requests**, per the framework's stated purpose (§13), not through direct database visibility.
- **Sharing is opt-in and granular** — `visibility_to_venue` exists specifically so the couple decides what crosses the boundary, record by record, not table by table.
- **Guest data must integrate with the rest of the couple's planning surface** — Seating, Wedding Website, Timeline/Calendar — without being re-modeled or duplicated in each place it's needed.

This document does not revisit whether this vision is correct. It compares the current implementation to it.

---

## 2. Existing functionality — exhaustive inventory

### 2.1 Guests (core)

`couple_guests` (`20260629040000_couple_owned_data.sql`, extended twice): `first_name`, `last_name`, `email`, `phone`, `plus_one`, `plus_one_name`, `plus_one_meal`, `rsvp_status` (`pending`/`attending`/`declined`/`maybe`), `rsvp_note`, `rsvp_at`, `dietary_restrictions` (free text), `meal_choice` (free text), `group_label` (free text), `household_id` (bare uuid, no FK, no table), `table_number`, `is_child`, `notes`, `sort_order`, `visibility_to_venue` (default `false`), `rsvp_token`, `rsvp_sent_at`, `rsvp_responded_at`. Fully couple-authored, from the couple's own Wedding Workspace Guests section (`components/portal/guest-section.tsx`).

Two write paths exist for individual guests:
- `add_couple_guest` — manual single-guest add from the Wedding Workspace. Does not accept `meal_choice` or `household_id` as parameters.
- `batch_add_couple_guests` (`20260629060000_couple_engagement.sql`) — the CSV import path (below). Inserts only four fields.

### 2.2 Households

No dedicated `households` table. `household_id` is a bare, unconstrained uuid column added later (`20260703120000_sprint73_rsvp_enhanced.sql`), grouping guests informally. Consumed in exactly one place: `get_seating_suggestions` (`20260703130000_sprint74_seating.sql`), which groups on `coalesce(household_id::text, id::text)` to auto-assign households to the same table, surfaced in `components/portal/seating-section.tsx`. Also bulk-writable via `submit_rsvp`'s `p_household_responses` parameter, letting one household member RSVP for the whole group.

A second, separate grouping mechanism — `group_label` (free text, populated by the CSV import's "Group" column) — coexists with `household_id` and appears to serve an overlapping purpose (see §4.4, duplicate grouping mechanisms).

### 2.3 RSVP

Guest-facing: each guest has an individually-issued `rsvp_token`. Two surfaces post through the same `submit_rsvp` RPC — the standalone `/rsvp/[token]` page, and the embedded RSVP form on the public wedding website (the guest types their personal code rather than looking themselves up by name). `submit_rsvp` is the single write path for `rsvp_status`, `meal_choice`, `plus_one`/`plus_one_name`/`plus_one_meal`, and any custom question answers.

Couple-facing: the RSVP question builder — `rsvp_questions` (`question_key`, `question_text`, `input_type`: text/textarea/select/boolean, `options` jsonb, `applies_to_plus_one`, `is_required`, `display_order`, `is_active`, unique per `(client_id, question_key)`) and `rsvp_answers` (per-guest, per-question). Fully couple-authored, generic, and reusable for any question — not guest-list-specific.

### 2.4 Meal selections

Modeled twice, in two different ways (see §4.4 for the conflict): as a hardcoded `couple_guests.meal_choice` / `plus_one_meal` free-text column pair, written only through `submit_rsvp`; and, separately, through the generic RSVP question builder using a magic convention — `question_key = 'meal_choice'` — with the couple free-typing meal options into that one question's `options` jsonb via a "meal option builder" UI (`components/portal/guest-section.tsx`, lines 268–302). No dedicated meal-options catalog exists. `add_couple_guest` and the guest-editing API route (`app/api/portal/guests/route.ts`) have no `meal_choice` parameter — a couple or anyone else cannot set or correct a guest's meal choice outside the RSVP flow itself.

### 2.5 Plus Ones

`plus_one` (boolean), `plus_one_name`, `plus_one_meal` on `couple_guests`; `rsvp_questions.applies_to_plus_one` lets a couple mark a custom question as relevant to the plus-one as well as the primary guest. Fully supported through `submit_rsvp`.

### 2.6 Children

`is_child` exists as a column on `couple_guests`. No downstream consumer of this flag — capacity math, meal defaults, seating logic, or reporting — was identified anywhere in the codebase in this pass. It is captured but currently inert.

### 2.7 Dietary restrictions

`dietary_restrictions` — free text, one field per guest. Written directly (not through `submit_rsvp` specifically — it's a plain column editable wherever a guest record is editable). Intended, per the architecture vision, to roll up into an operational summary for the venue; the one built attempt at this rollup is broken (§2.10, §4.6).

### 2.8 Seating

`couple_seating_arrangements` (one per event, 1200×800 canvas), `seating_tables` (`round`/`rectangular`/`head`/`sweetheart`/`cocktail`, position, capacity), `guest_seat_assignments` (one seat per guest, unique on `guest_id`). RPCs: `get_seating_data`, `upsert_seating_table`, `delete_seating_table`, `assign_guest_to_table`, `remove_guest_assignment`, `get_seating_suggestions` (household-aware auto-assignment, §2.2). Client-Owned, portal-token-scoped throughout. Its disconnection from Floor Plans (a separate, Venue-Owned system describing the same physical room) is documented in full in `docs/floor-plan-seating-architecture.md` and not repeated here.

### 2.9 Wedding Website integration

The public site computes aggregate RSVP stats (attending/pending counts, no names) from `couple_guests`. Its embedded RSVP form uses the same personal-code + `submit_rsvp` mechanism as the standalone `/rsvp/[token]` page — one write path serving both surfaces, which is a genuine strength (§5).

### 2.10 Venue operational view (attempted)

`components/events/event-detail.tsx` and `components/events/booking-overview-summary.tsx` — the Booking Workspace's own guest-facing surfaces — read only a manually-entered scalar, `event.guestCount`. Neither queries `couple_guests` live. The one attempt at a real, live venue-side guest view, `wedding-day-dashboard.tsx`'s `GuestSummary` component, depends on `get_wedding_day_ops(p_event_id)` (`20260704200000_sprint81_wedding_day_ops.sql`), whose `'dietary'` subquery references nonexistent columns (`cg.event_id`, `cg.dietary_restriction` — the real columns are `client_id`/`venue_id` and `dietary_restrictions`, plural). The RPC errors out entirely; `app/api/events/[id]/wedding-day/route.ts` returns a 500; the failure is silently swallowed (`.catch(console.error)`), leaving `GuestSummary` permanently non-functional with no visible error to the coordinator. Separately, `lib/luv/observations.ts` fetches `couple_guests(count)` alongside `couple_websites` but never reads the value — a dead field in an otherwise-live query.

### 2.11 Imports

CSV import (`components/portal/guest-section.tsx`'s `parseCSV`, couple-facing) supports exactly four columns: First Name, Last Name, Email, Group. `batch_add_couple_guests` inserts only those four fields per row. Plus-ones, dietary restrictions, meal choice, and household grouping cannot be set at import time — they must be added guest-by-guest afterward, and even then only partially (§2.4, §2.1).

### 2.12 Requests

The Request Framework's `source_feature` enum already permits a `'guests'` value. It has zero real call sites anywhere in the codebase — the only live usage of `source_feature` at all is `sourceFeature: "planning"` in `app/(app)/playbooks/actions.ts:152`. The enum value exists; nothing produces or consumes a Guest-sourced Request.

### 2.13 Timeline connections

Beyond the broken `get_wedding_day_ops` touchpoint above, no other Timeline↔Guest connection exists. The Wedding Website's `schedule_sync` (populating the public schedule from `timeline_entries`) is a Timeline↔Website integration, not a Timeline↔Guest one, and is noted here only because it's often conflated with guest-facing scheduling.

### 2.14 Calendar connections

None. `getCalendarData` (`lib/calendar/service.ts`) aggregates events, tours, lead follow-ups, payment due dates, `client_key_dates`, date holds, and calendar blocks — seven sources, none guest-related. `ClientKeyDate` is only ever created manually via the Client detail page's own form; no RSVP deadline, meal-selection deadline, or guest-count-finalization date is ever surfaced there automatically.

---

## 3. Missing capabilities (against the approved vision)

Ordered roughly by how directly each blocks the stated vision, not by build effort:

1. **No Requests-based collaboration channel for Guests at all** — the single largest gap, and the same gap the parent architecture document names as its most significant overall finding (§13), applied here concretely: a venue cannot request "final guest count," "dietary summary," or "seating sign-off" through the sanctioned collaboration mechanism, because no Guest-sourced Request has ever been built.
2. **No functioning venue operational summary** — the one thing the architecture vision explicitly grants the venue (operational necessity: headcount, meal counts, dietary aggregate) does not exist in working form. What's built (`GuestSummary`) is broken; what's used instead (`event.guestCount`) is a manually-typed number with no connection to the actual guest list.
3. **No household as a real entity** — a couple cannot name, view, or manage a household as a first-class thing (e.g., "the Smith family, 4 people, 1 RSVP"). It exists only as a grouping key consumed by one downstream feature (seating suggestions).
4. **No meal-options catalog** — a couple cannot define "Chicken / Fish / Vegetarian" once and have it apply consistently; the mechanism that exists (a generic question builder repurposed via a magic key) works, but is not what the vision implies by "Meal selections" as a named, first-class capability.
5. **No guest-count or RSVP-deadline surfacing on the Calendar** — a couple planning their wedding has no calendar-visible marker for "RSVPs due," "final headcount due to venue," or similar guest-driven dates, despite Calendar being named in the vision as a system the Guest Experience must integrate with.
6. **No complete import** — a couple migrating from a spreadsheet cannot bring in dietary restrictions, meal choices, plus-ones, or household grouping in one step; only four fields survive import.
7. **No enforcement of the sharing boundary** `visibility_to_venue` was built to provide** (detailed as a conflict in §4.1, listed here because it's also a missing *capability* — opt-in sharing that actually does something).

---

## 4. Conflicts

### 4.1 Ownership

The RLS policy governing `couple_guests` was changed in `20260708120000_sprint107_team_collaboration.sql` to `venue_id = current_user_venue_id()` — any active venue owner or team member can now `select` every guest row directly, unconditionally. `visibility_to_venue` (default `false`) and a `shared_couple_guests` view that filters by it were built specifically to gate venue visibility per-record; the later, broader RLS grant bypasses both entirely. The couple's guest list — named in the parent architecture document as the domain most likely to be assumed inviolable — is not actually enforced as Client-Owned at the data layer today. This is restated here, not newly discovered, but it is the single most direct contradiction of this document's own framing sentence: "the venue does not own the guest list; the couple does."

### 4.2 Privacy

Per the parent document's Privacy Model (§14), most guest-adding RPCs check only one of the system's three parallel permission vocabularies, and check it incorrectly: `add_couple_guest` and `batch_add_couple_guests` block when `access_level = 'financial' or access_level = 'reminders_only'` — but `'reminders_only'` is a value from a *different* vocabulary (`client_contacts.portal_role`) and can never actually be stored in `access_level`, whose own CHECK constraint doesn't permit it. Half of this guard can never fire. A session belonging to a contact whose `portal_role` is `reminders_only` is not blocked from adding or importing guests through these RPCs, because they never look up `portal_role` in the first place. Guest-list write access is, in practice, gated by a check that is partially dead code.

### 4.3 Sharing

`visibility_to_venue` is the one mechanism that would let a couple deliberately share specific guest records with the venue — and it is not read anywhere except inside the unused `shared_couple_guests` view. There is currently no way for a couple to exercise the granular, opt-in sharing the architecture vision describes, because nothing downstream honors the flag they'd set.

### 4.4 Duplicate data / parallel modeling

Two separate conflicts here, both worth naming precisely:

- **Meal choice is modeled twice.** `couple_guests.meal_choice`/`plus_one_meal` are hardcoded free-text columns, written only via `submit_rsvp`. Independently, the generic RSVP question builder can also represent "meal choice" as an ordinary custom question via the `question_key = 'meal_choice'` convention, with its own `rsvp_answers` rows. These are two different mechanisms describing the same fact for the same guest, maintained by two different code paths, with no reconciliation between them.
- **Guest grouping is modeled twice.** `household_id` (uuid, powers seating auto-assignment) and `group_label` (free text, populated by CSV import's "Group" column) both group guests, for what appear to be overlapping purposes, with no relationship between the two fields.

### 4.5 Multiple systems

Seating and Floor Plans model the same physical room as two disconnected systems — fully documented in `docs/floor-plan-seating-architecture.md` and not repeated here, but named as a live conflict this plan must account for in its Seating-related phase (§6).

### 4.6 Dead code

- `shared_couple_guests` — a view built specifically to enforce the venue-visibility boundary, queried nowhere.
- `sourceFeature: "guests"` — a Request Framework enum value with zero producers or consumers.
- `lib/luv/observations.ts`'s `couple_guests(count)` fetch — retrieved, never read.
- `get_wedding_day_ops`'s dietary subquery and the `GuestSummary` component it feeds — present, wired up, permanently erroring, silently caught. Functionally dead despite being fully built and visibly present in the coordinator's UI.

### 4.7 Parallel workflows

Guest creation has two independent paths — manual add (`add_couple_guest`) and CSV import (`batch_add_couple_guests`) — with two different, both-incomplete parameter sets; neither supports `meal_choice` or `household_id`, but they lack it for different, uncoordinated reasons (manual add simply never added the parameter; import was scoped to four columns from the start). A couple has no single, complete way to get a guest fully entered in one step regardless of which path they start from.

---

## 5. Existing strengths

- **The RSVP question builder is genuinely generic and reusable.** Rather than a fixed schema of guest attributes, `rsvp_questions`/`rsvp_answers` let a couple define arbitrary questions — this is the right shape for a feature that needs to flex per-wedding, and it's already how meal choice, dietary follow-ups, and anything else a couple wants to ask are implemented, however informally.
- **`submit_rsvp` is a genuine single write path** for guest self-service RSVP, meal choice, and plus-one details, shared identically by the standalone RSVP page and the embedded website form — no duplicated logic, no drift between the two guest-facing surfaces.
- **Household-aware seating suggestions already exist** and demonstrate the right instinct — using a grouping concept to make a couple's planning task easier — even though the underlying `household_id` isn't yet a first-class entity.
- **The Wedding Website's guest integration (aggregate stats, no names) is the correct shape for the "operational summary, not raw data" principle** — it's a working precedent for exactly the kind of rollup the venue-facing view should have and currently doesn't.
- **The couple-owned CSV import, while incomplete, establishes the right pattern**: bulk entry through a couple-facing UI, backed by a single RPC, logging its own activity event (`csv_imported`) — a solid foundation to extend rather than replace.

---

## 6. Implementation roadmap

Phases are written to be independently completable — each is shippable on its own and does not require the others to precede it, except where a dependency is stated explicitly. This sequence differs from the illustrative 9-phase example in the task framing where a better order was apparent from the concrete findings above; the reasoning for each placement is given.

**Quick fix, no phase dependency:** `get_wedding_day_ops`'s dietary subquery (`cg.event_id`/`cg.dietary_restriction` → `cg.client_id`+`cg.venue_id`/`cg.dietary_restrictions`) is an isolated, low-risk column-name correction that unblocks an already-built coordinator UI (`GuestSummary`) with no architectural decision required. It can be done at any time, independent of the phases below, and is called out separately rather than as "Phase 1" because it's a bugfix, not a capability phase.

1. **Guest & Household Foundation.** Reconcile `household_id` and `group_label` into one grouping concept (or clearly separate their purposes if both are meant to survive); extend CSV import and `add_couple_guest` to a common, complete parameter set (plus-ones, dietary, household) so both guest-creation paths produce equally complete records. This is the true first phase — meal unification, seating, venue views, and Requests integration all sit on top of a coherent guest/household data shape, so building it elsewhere first would mean redoing it later.
2. **Meal & Dietary Unification.** Collapse the two parallel meal-choice representations (hardcoded columns vs. generic question-builder answer) into one model; decide whether a dedicated meal-options catalog replaces the current free-typed `options` jsonb convention. Depends on Phase 1's household/record shape being settled first.
3. **Venue Operational View.** Build the operational summary the architecture vision actually grants the venue — headcount, meal counts, dietary aggregate — as a real, working replacement for the manually-typed `event.guestCount` scalar and the broken `GuestSummary`. This should be built as a genuine rollup (counts and aggregates only, no names, no notes), consistent with the Wedding Website's existing aggregate-stats precedent, and should not read `couple_guests` directly from Booking Workspace components the way the RLS grant currently makes technically possible — it should be its own dedicated, intentionally-scoped summary RPC.
4. **Requests Integration for Guests.** Wire the already-reserved `source_feature: "guests"` enum value into an actual Guest-sourced Request (e.g., a venue's "confirm final headcount" or "dietary sign-off" request), giving the venue a sanctioned collaboration path instead of raw table access. This phase is a natural place to also retire (or scope down) the Sprint 107 RLS grant on `couple_guests`, since a working Requests channel is what makes narrowing venue visibility back down actually viable operationally, and to either wire up or remove the dead `shared_couple_guests` view.
5. **Seating ↔ Floor Plan Integration.** Implement the one-way, read-only relationship documented in `docs/floor-plan-seating-architecture.md` (Seating's table inventory derived from the venue's Floor Plan), and connect Seating's household-aware auto-assignment to the now-first-class household concept from Phase 1.
6. **Calendar Integration.** Surface guest-driven dates (RSVP deadline, final-headcount-due date, meal-selection deadline) into the couple's Calendar, likely as a new kind of `client_key_date` or an equivalent guest-originated entry, rather than requiring the couple to track these dates manually as they do today.
7. **Website Integration Deepening.** Extend the Wedding Website's existing guest integration (currently aggregate RSVP stats only) to cover any Phase 1–2 additions — e.g., surfacing plus-one and children counts in the same no-names aggregate style, and reflecting a unified meal-choice model in the public RSVP form if its shape changes.

---

## 7. Guiding principles preserved

- **The couple owns the Guest Experience.** Every phase above adds venue-visible capability through a summary, aggregate, or Request — never through broadened direct table access. Phase 4 explicitly proposes narrowing the one place this principle is currently violated (§4.1).
- **The venue collaborates through Requests.** Phase 4 is the concrete implementation of this principle for Guests specifically; no phase proposes any other venue-to-guest-data channel.
- **The venue receives operational summaries, not private planning data, unless the couple explicitly shares more.** Phase 3 is built as a rollup by design (counts and aggregates, no names or notes), matching the Wedding Website's existing precedent rather than inventing a new, more permissive pattern.
- **Integration without duplication.** Phases 1, 2, 5, and 6 each resolve an existing instance of the same fact being modeled twice (household grouping, meal choice) or a system's own concept being reinvented elsewhere (Seating's table inventory) rather than adding new duplicated state.

---

## 8. Definition of success

None of the phases above should be read as "build a table and a CRUD screen for X." A completed Guest Experience should feel like the couple is planning their wedding — deciding who's coming, how families are grouped, what everyone's eating, where they'll sit — not administering a guest database. Where a phase above could be implemented multiple technically-correct ways (e.g., Phase 1's household reconciliation, Phase 2's meal-options catalog), the simplest, most intuitive planning experience for the couple should be preferred over the most flexible or most "correct" data model, while still meeting the venue's real operational needs (Phase 3) and the collaboration boundary (Phase 4).

---

## 9. Report

**Major findings:** The couple-facing half of the Guest Experience is substantially built and, in places (the RSVP question builder, `submit_rsvp`'s single write path, household-aware seating suggestions), genuinely well-designed. The venue-facing half is close to non-functional: the one built attempt at an operational guest summary is broken by a column-name bug and fails silently, and the venue's only working guest signal is a manually-typed number disconnected from the real guest list. The most consequential conflict is that "Client-Owned" for the guest list is enforced only by the absence of a UI, not by RLS — a venue-wide `select` grant was added for team collaboration in Sprint 107 and directly contradicts the ownership principle this document (and the parent architecture document) states as foundational.

**Implementation phases:** Guest & Household Foundation → Meal & Dietary Unification → Venue Operational View → Requests Integration for Guests → Seating ↔ Floor Plan Integration → Calendar Integration → Website Integration Deepening (plus an orthogonal, immediately-doable bugfix to `get_wedding_day_ops`).

**Architectural conflicts:** ownership (RLS grant vs. stated Client Ownership), privacy (a partially dead access-level check on guest-adding RPCs), sharing (`visibility_to_venue` built but unread anywhere), duplicate data (meal choice and household grouping each modeled twice), multiple systems (Seating vs. Floor Plans, documented separately), dead code (`shared_couple_guests`, the `guests` source-feature enum value, a dead field fetch in `lib/luv/observations.ts`, and the broken `GuestSummary` chain), and parallel workflows (two incomplete, uncoordinated guest-creation paths).

**Recommended first implementation phase:** Guest & Household Foundation. Every later phase — meal unification, a real venue operational summary, Requests integration, Seating's household awareness — depends on the underlying guest record and household concept being coherent first; building any of them against the current split household/group_label modeling would mean redoing that work once Phase 1 lands.

---

*End of document. No implementation, migration plan, or code is proposed — see task scope.*
