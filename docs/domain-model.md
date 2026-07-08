# Wevenu Domain Model

**Status:** Adopted 2026-07-07. This is the conceptual model — the business objects Wevenu is actually *about*, independent of which table, RPC, or UI surface currently implements them. Program 2 implementation should be checked against this document before new schema is written, the same way a feature is checked against `docs/product-promise.md` before it ships.
**Relationship to other docs:** `docs/product-promise.md` says what Wevenu owes the people who use it. `docs/engineering-standards.md` says how to build so those promises hold. `docs/trust-risk-register.md` and `docs/architecture-audit.md` are where the gap between this model and the current implementation was found. `docs/product-completion-roadmap.md`'s Program 2 principles (Lead lifecycle, Calendar as backbone, Conversation, Asset) and `docs/contract-lifecycle-design.md` are this document's ideas, arrived at independently during earlier work — this document is where they're unified and given company alongside everything else Wevenu is built from.

**How to read each entity below:**
- **Represents** — the real-world thing, in plain language, not a table description.
- **Owned by** — whoever has the authority to change it and bears responsibility for it: the venue, the couple, a vendor, or the platform itself.
- **Lifecycle** — the states it moves through, and what causes each transition.
- **Relationships** — what it connects to, using this document's own vocabulary.
- **Canonical source of truth** — where this fact actually lives today. Named honestly, including where today's implementation is fragmented across more than one place — this document doesn't pretend the ideal is already built.
- **Exposed through** — every transport, view, or workflow a person or system actually encounters this object through.

---

## Venue

**Represents:** A single wedding/event business operating on Wevenu — the tenant. Everything else in this model exists *within* a venue; nothing crosses venue boundaries except the platform-level views in Wevenu HQ.

**Owned by:** The venue's Owner (exactly one per venue, always). Day-to-day stewardship is shared with Managers/Coordinators/Staff per the roles defined below, but the Owner is the accountable party — the one who can transfer, close, or fundamentally reconfigure the venue.

**Lifecycle:** Created at signup → setup (branding, spaces, business hours) → active → (rare) ownership transfer → (rare) closed/churned. A venue is never truly deleted while it has historical Contracts/Invoices/Events — those are permanent records regardless of the venue's own status, per the Legal/Financial Integrity promises.

**Relationships:** Has many Team Members, Leads, Clients, Events, Vendors (via relationships), Contracts, Invoices, Assets. Has one brand/identity (name, colors, logo) that every couple- and vendor-facing surface inherits.

**Canonical source of truth:** `venues`, plus `venue_spaces`/`venue_business_hours`/`venue_capacity_rules`/`venue_operational_info` for the operating details.

**Exposed through:** The coordinator app (everything is scoped to "the current venue"), Settings, the couple portal's branding, the vendor portal's venue-facing views, Wevenu HQ (the one place venues are seen *across* tenants, for support/analytics only — never mutated the way a venue mutates its own data).

---

## Team Member

**Represents:** A person who works for the venue and has a login: the Owner and everyone they've invited (Manager, Coordinator, Staff).

**Owned by:** The venue's Owner (who can invite/remove/change anyone), with Managers granted a deliberately narrower version of the same authority (can manage Staff/Coordinator, never another Manager or the Owner — see `docs/permissions-model-proposal.md`).

**Lifecycle:** Invited (pending, no login yet) → accepted (has a real session) → active → removed (soft-deleted, access revoked). Role can change while active (e.g., Coordinator promoted to Manager) subject to who's making the change.

**Relationships:** Belongs to exactly one Venue. Can be assigned to Tasks and Events. Acts as the "actor" behind almost every other entity's audit trail (who sent this Contract, who recorded this Payment, who created this Task).

**Canonical source of truth:** `venue_staff` — this *is* the canonical table. (`venue_users`, a compatibility view over it, existed only to satisfy older RLS policies and had its own staleness bug, TR-G3, fixed 2026-07-07 — it is not a second source of truth, just a view, and should not be extended further; new code should reference `venue_staff`/`current_user_venue_id()`/`current_user_role()` directly.)

**Exposed through:** Settings → Team, the invite-acceptance flow (`/join`), and implicitly everywhere an "assigned to" or "completed by" field is shown.

---

## Lead

**Represents:** A person or couple who has expressed interest in the venue but hasn't yet committed — the pre-Client identity. **Adopted principle (Program 2):** every way a person can first reach the venue — Request Information, Schedule Tour, Manual Entry, Phone Call, Referral, Walk-In, CSV Import, Facebook Lead, The Knot, WeddingWire, and any future source — is a different *entry point* into the same Lead, not a different kind of object. The entry point differs; the identity and lifecycle do not.

**Owned by:** The venue (specifically, whichever Team Member is working the relationship — though today nothing restricts visibility to an assigned owner; every team member sees every lead).

**Lifecycle:** Created (via any entry point) → contacted/nurtured → tour scheduled/completed (optional) → won (converts into a Client) or lost. A Lead's activities, notes, scores, and tour history accumulate across its whole life, regardless of which entry point or how many touchpoints occurred.

**Relationships:** May have Tour appointments, Tasks, Notes, and Activities. On conversion, produces exactly one Client (and the Lead record is retained as history, not deleted). Appears on the Calendar (as a tour or follow-up) prior to conversion.

**Canonical source of truth:** `leads`, today. **Known gap (Program 2, not a Trust Risk):** `create_public_lead()` (inquiry form) and `book_tour()` (tour booking) each unconditionally insert a *new* `leads` row with zero deduplication — the same person contacting the venue twice through two entry points becomes two separate Leads today, violating the adopted principle above until Program 2's Lead-unification work lands.

**Exposed through:** the Leads pipeline in the coordinator app, the public inquiry form, the public tour-booking widget, CSV import, and (in the calendar-backbone future) the Calendar itself as a tour/follow-up entry.

---

## Client

**Represents:** A Lead that has committed — a couple who has actually booked the venue for their event. The identity doesn't change at conversion (it's the same relationship, now further along its lifecycle); what changes is the set of capabilities available (contracts, invoices, the couple portal).

**Owned by:** The venue (operationally) and the couple (their own planning data — guest list, budget, seating — within the couple portal, per the Data Ownership promise).

**Lifecycle:** Created via `convertLeadToClient` (coordinator-triggered, not automatic) → active planning → event occurs → post-event (archived, but never deleted — historical Contracts/Invoices/Payments outlive the planning relationship).

**Relationships:** Originates from exactly one Lead. Has one (usually) Event. Has many Contacts (see below), Contracts, Invoices, Payment Schedules, Assets, a Conversation, and — on the couple's own side — Guests, a Budget, a Seating plan.

**Canonical source of truth:** `clients`, with `clients.lead_id` linking back to its origin Lead.

**Exposed through:** the coordinator app's Client detail pages, and — via the couple portal token — the couple's own view of everything they own.

---

## Contact

**Represents:** A specific person associated with a Client beyond "the couple" themselves — a parent, planner, maid of honor, or anyone else who might need their own scoped view into the relationship.

**Owned by:** The Client (a Contact only exists in relation to one), configured by the venue's coordinator.

**Lifecycle:** Invited (with a chosen access scope) → active → removed. A Contact's portal access can be revoked independently of the couple's own.

**Relationships:** Belongs to exactly one Client. Optionally has its own Portal Session with a scoped `access_level`, distinct from the couple's own full-access session.

**Canonical source of truth:** `client_contacts`, with `portal_role` describing the *intended* scope (`full_access`/`planning`/`financial`/`view_only`/`reminders_only`) and `client_portal_sessions.access_level` as the actual *enforced* scope on any session created for them. **These two must be kept in sync at session-creation time** — TR-G4 (fixed 2026-07-07) was exactly this synchronization missing, silently granting every Contact full access regardless of the role a coordinator chose for them.

**Exposed through:** the Client detail page's Contacts tab (coordinator side), and the Contact's own portal link (`/p/{token}`) scoped to whatever `access_level` their session actually carries.

---

## Event

**Represents:** The wedding (or other occasion) itself — the actual date, space, and occasion the whole relationship exists to produce.

**Owned by:** The venue, on behalf of the Client.

**Lifecycle:** `draft` → `confirmed` → `in_progress` (day-of) → `complete`, or `cancelled` at any point before completion.

**Relationships:** Belongs to exactly one Client (today — no `lead_id`, so an Event only exists post-conversion). Occupies a Venue Space for a date/time window. Has many Tasks, a Floor Plan, a Payment Schedule, Contracts, Invoices, and (in the calendar-backbone future) is one of several kinds of thing the Calendar visualizes.

**Canonical source of truth:** `events`.

**Exposed through:** the coordinator app's Event detail page (the hub most other per-event objects are reached from), the Calendar, the couple portal, day-sheets/run-of-show exports.

---

## Calendar Entry

**Represents:** *Not an independent business fact* — a temporal projection of something else that's already true: an Event, a Tour, a Hold, a Task due date, a Payment due date, a Key Date, or an operational block. **Adopted principle (Program 2):** the Calendar is the temporal visualization of everything happening at the venue, not a feature that owns its own data. A Calendar Entry's "reality" belongs entirely to whatever it represents; the Calendar only decides how to render it on a timeline.

**Owned by:** Whatever underlying entity it represents (an Event's owner is the venue; a Payment due date's owner is the Invoice it belongs to; and so on) — the Calendar itself owns nothing.

**Lifecycle:** Appears the moment its underlying entity would place something on a specific date/time, and disappears (or changes) exactly when that underlying entity does. A Calendar Entry has no lifecycle of its own to track — if it seems to, that's a sign something has drifted from its source (see TR-B4 below).

**Relationships:** Points back to exactly one underlying entity (an Event, a Lead's tour, a Payment, a Task, a Hold, a Team Member's schedule, a vendor arrival). Never stands alone.

**Canonical source of truth:** *Today, fragmented and known-stale in one place* — `lib/calendar/service.ts`'s `getCalendarData` aggregates seven source tables (`events`, `leads.tour_date`, `leads.follow_up_date`, `payment_line_items`, `client_key_dates`, `date_holds`, `calendar_blocks`) at query time. TR-B4 (Identified, sequenced into Program 2) found that the "tour" source specifically reads a legacy field (`leads.tour_date`) rather than the real `tour_appointments` table the public booking flow actually writes to — the clearest illustration of why this entity's *conceptual* rule ("no independent truth of its own") matters: the moment a projection reads from anywhere other than its source's current canonical table, it lies.

**Exposed through:** the coordinator app's Calendar view — and, per the adopted Program 2 vision, eventually vendor arrivals, walkthroughs, staff schedules, and planning milestones as well, all on the same timeline.

---

## Task

**Represents:** A discrete piece of work that needs to happen, generated from a Playbook template and attached to a specific Event, or created ad hoc.

**Owned by:** The venue (assigned to a Team Member), or — for `client_owned`-visibility tasks — the Client, who can complete it themselves from the couple portal.

**Lifecycle:** `pending` → (optionally `blocked` on a dependency) → `pending`/`overdue` → `complete` (or `waived`). Completion can be manual (a person checks it off) or automatic, via a named trigger (`contract_signed`, `questionnaire_submitted`, `timeline_created`, and others — see the caution below).

**Relationships:** Instantiated from a Playbook Template (`playbook_tasks`) for a specific Event. May depend on another Task (blocking/unblocking). May be linked to the real-world event that auto-completes it (a signed Contract, a submitted Questionnaire).

**Canonical source of truth:** `event_tasks` for the instance, `playbook_templates`/`playbook_tasks` for the template it was generated from. **Known gap:** the audit found `AUTO_COMPLETE_TRIGGERS` declares more trigger types than the codebase actually fires (`payment_received`, `document_uploaded_insurance`, `floor_plan_created` are selectable on template tasks but structurally dead) — a Task can silently never auto-complete despite being configured to. Not yet fixed; flagged in `docs/architecture-audit.md`.

**Exposed through:** the Event detail page's task list, the couple portal's "Plans"/task section (for client-owned tasks), and reminder emails (once the reminder-delivery engine referenced in `task_reminders` is actually built — currently scaffolded, not live).

---

## Conversation

**Represents:** The durable relationship between the venue and one person or couple (or, eventually, one Vendor) — not a message thread that happens to be long-lived, but the relationship itself, of which communication is the visible trace. **Adopted principle (Program 2):** email, SMS, portal chat, internal notes, phone-call logs, voicemail, and push are transports and events *within* the Conversation, not the Conversation itself. The test: a coordinator should think "I'm looking at Emma & James' conversation," never "I'm looking at their emails" or "I'm looking at their texts." Full lifecycle reasoning in `docs/conversation-lifecycle-design.md`.

**Owned by:** Jointly the venue and the person/couple — both sides read and write to it (a Conversation is the one entity in this model that's inherently bilateral by nature, not primarily owned by one side with the other granted access). Multiple Participants (the Lead/Client, a Contact, a venue Team Member) can all contribute without forking the conversation — attribution lives on the message, not on a separate thread per person.

**Lifecycle:** Provisioned automatically the moment its anchor (a Lead, or a vendor relationship) exists — never explicitly "created" by a person, never lazily created on first message. Accumulates Messages indefinitely. **Has no independent status of its own** — no open/resolved/closed states the way a support ticket would have. "Active" vs. "dormant" vs. "needs attention" are computed at read time from `last_message_at` and the linked Lead/Client's own status, the same projection discipline Calendar Entry uses — never a stored field a coordinator toggles. A Conversation with a years-quiet former client is still that Conversation, not archived, not requiring "reopening," ready the moment contact resumes.

**Relationships:** Anchors to exactly one **Lead** (not Client) — Lead is the identity that exists from first contact and persists through Client conversion (see Lead, above; Program 2 Phase 1's "one canonical Lead" work is a direct prerequisite for this to hold), or to one Vendor relationship. Contains many Messages, each attributed to a Participant and a Channel. Deliberately does **not** absorb Lead/Contract/Payment activity history into its own schema — a separate, composed **Relationship Timeline** view interleaves Conversation messages with that activity log read-only, the same way Calendar composes without owning.

**Canonical source of truth:** *Not yet unified — this is the clearest gap between this model and today's implementation.* Two entirely disconnected systems currently each hold half of what should be one Conversation: `message_threads`/`messages` (an outbound-email log, keyed to `client_id`) and `couple_threads`/`couple_messages` (real bidirectional portal chat, also keyed to `client_id`, but never joined to the first system anywhere in the code). This is registered as TR-C1 — Identified, explicitly not a same-day patch, and is the single largest architectural project this domain model implies. The target schema (`conversations` anchored on `lead_id`, no `status` column) is designed in `docs/conversation-lifecycle-design.md`.

**Exposed through:** the coordinator app's per-client "Messages" tab (email history only, today), the main-nav "Messaging" inbox (portal chat only, today), and the couple portal's own message view — three separate windows onto what should be one Conversation.

---

## Contract

**Represents:** A specific, legally-binding agreement between the venue and the Client. A specialized, higher-scrutiny member of the Asset family (below) — every Contract is an Asset, but not every Asset is a Contract, and Contracts carry lifecycle guarantees generic Assets don't.

**Owned by:** The venue (drafts, issues) and the Client (signs) — jointly, once executed, neither party unilaterally.

**Lifecycle:** `draft` (fully editable) → `sent` (content snapshot frozen, merge fields resolved) → `signed` (couple has signed) → **permanently locked**: no edit, no delete, no resend, no regenerate, for any role, ever. Post-execution change is never an in-place edit — it's a new **Amendment** or **Version/Clone**, each a new record referencing the original. See `docs/contract-lifecycle-design.md` for the full target lifecycle (including the not-yet-built venue countersignature step and `client_signed`/`executed` states).

**Relationships:** Belongs to exactly one Client (and usually one Event). Generated from a Contract Template. May have a parent Contract (if it's a clone/version or an amendment, once that model ships). Triggers the `contract_signed` Task automatically, only on real signature (TR-L4).

**Canonical source of truth:** `contracts` — genuinely a single, clean source of truth today, the most mature entity in this whole model (per `docs/architecture-audit.md`'s ranking). Legal evidence of signature (IP, user-agent, explicit consent) lives on the same row (TR-L3).

**Exposed through:** the coordinator app's Contracts section, the public signing page (`/sign/[token]`, token-authenticated, never by row `id` — TR-L6), and the couple portal's document view.

---

## Invoice

**Represents:** The financial statement for a Client — what's owed, in total, across everything they're being charged for.

**Owned by:** The venue (creates, sends), read-only for the Client.

**Lifecycle:** `draft` → `sent` → (as Payments arrive) balance decreases → `paid` (balance reaches zero) or remains partially paid indefinitely. Never silently recalculated without accounting for what's already been collected (TR-M2's whole lesson — Engineering Standard #1).

**Relationships:** Belongs to exactly one Client (and usually one Event). Has many Invoice Line Items. Linked to one or more Payment Schedules, whose collected amounts determine its `balance_due`.

**Canonical source of truth:** `invoices` + `invoice_line_items`, with `balance_due` recomputed from the linked Payment Schedules' actual collected amounts (net of refunds) on every relevant write — never patched in place.

**Exposed through:** the coordinator app's Invoices section, invoice PDFs/print view, the couple portal's payment view (which should reflect the same balance — see Payment's own known gap below), and the venue-side data export (TR-G2).

---

## Payment

**Represents:** Money that has actually moved (or is scheduled to move) between a Client and the venue — a Payment Schedule is the plan (a set of installments), a Payment Line Item is one specific installment's actual state.

**Owned by:** The venue (records/collects/refunds — refunds Owner-only, per the decided permissions model). The couple, in the near future, will directly initiate payment themselves once real Stripe collection ships (`docs/stripe-payment-architecture.md`) — today, all collection is manually recorded by a coordinator.

**Lifecycle (per line item):** `pending` → (`overdue` if past due) → `paid` (collected) → optionally `partially_refunded` or `refunded`. A refund is always a new delta against the original paid amount, never an edit to it (Engineering Standard #4) — this is the same append-only principle Contract's execution lock is built on, applied to money instead of legal text.

**Relationships:** Belongs to a Payment Schedule, which belongs to a Client and is usually linked to one Invoice. Its collected/refunded amounts are what Invoice's `balance_due` is computed from.

**Canonical source of truth:** `payment_schedules` + `payment_line_items`, with `refunded_amount` tracked as a running total against the original `paid_amount` (TR-M3). **Known gap:** `payment_schedules.total_amount` itself is never recomputed from its own line items (the function that could, `updateScheduleTotalAmount`, has zero callers) — the coordinator UI's own "over-allocated" warning is evidence this already drifts in practice; and the couple portal's payment view computes its own totals with a filter that predates refund support, so a couple's displayed "amount paid" can already be wrong the moment a refund happens. Neither is fixed yet.

**Exposed through:** the coordinator app's Payments section, the couple portal's payment view, and (once built) a real Stripe-backed checkout inside that same view.

---

## Asset

**Represents:** Any file or generated record attached to a Venue, Client, Event, or Vendor that isn't itself a Contract or Invoice — a floor plan, a certificate of insurance, a permit, a questionnaire response, an uploaded PDF or image. **Adopted principle (Program 2):** these should be one conceptual family — a **Type**, a **Visibility** (venue/couple/vendor/planner/family), and a **Linked To** (event/client/venue/vendor) — rather than unrelated systems that happen to each hold "files."

**Owned by:** Whoever uploaded or generated it (venue or couple), with Visibility determining who else can see it.

**Lifecycle:** Created → (optionally) shared/visible to another party → superseded or archived. Unlike Contract, a generic Asset has no append-only requirement by default — a floor plan can legitimately be revised in place — *unless* its Type carries its own stricter promise (a signed Contract's immutability doesn't relax just because Contract is technically an Asset subtype).

**Relationships:** Linked to a Venue, Client, Event, or Vendor. May itself reference other Assets (a Floor Plan's revision history, once that exists).

**Canonical source of truth:** *Not yet unified — three unrelated tables today*, per `docs/architecture-audit.md`'s Documents finding: the generic `documents` table (venue-side, includes a `'contract'` category that's misleadingly never shown to the couple), `couple_documents` (couple-uploaded), and the couple portal's "Documents" tab, which is a hand-written union of `contracts` + `invoices` + `couple_documents` that never queries the venue-side `documents` table at all. Floor Plans (`floor_plans`/`floor_plan_objects`) are a further, fourth, entirely separate system representing the same underlying idea ("a layout attached to an event") with no link to the couple-facing Seating tool that logically shares its core fact. None of this is fixed yet — it's the clearest concrete evidence for why the Asset model is needed, not just a nice abstraction.

**Exposed through:** Settings/Client detail pages' Documents sections (venue side), the couple portal's Documents tab, the Floor Plan Studio, and — critically — nothing today includes generic venue Documents or Floor Plans in the venue data export (TR-G2's stated permanent-fix scope named "clients, events, payments, contracts metadata at minimum," which this model's Asset unification would extend to be genuinely complete).

---

## Vendor

**Represents:** An external business the venue works with — a photographer, caterer, florist, etc. — who may serve many venues, not just one.

**Owned by:** Itself, fundamentally (a Vendor is a real independent business with its own login), with each Venue holding its own *relationship* to that Vendor rather than owning the Vendor record outright.

**Lifecycle:** Discovered/added by a venue (unclaimed) → invited → claims their own profile (gains a login) → active relationship with one or more venues → (per-venue) assigned to specific Events.

**Relationships:** Has a `venue_vendor_relationships` row per venue it works with. Assigned to Events. Has Packages, Availability, and (in the target Conversation model) a Conversation with each venue it works with.

**Canonical source of truth:** `vendors` (global identity) + `venue_vendor_relationships` (per-venue relationship) — a clean split. **Known gap:** `vendors.is_claimed`/`claim_token` and `vendor_invitations.status` are two separate "has this vendor accepted?" signals that never sync, so HQ/activation reporting can permanently misreport a claimed vendor as still-pending. Also: the token-based vendor portal's core RPC currently throws on every call (a later migration renamed a column the RPC still references) — the entire `/v/[token]` surface is non-functional right now, silently, per `docs/architecture-audit.md`.

**Exposed through:** the coordinator app's Vendors section, the public vendor invitation/claim flow, the authenticated vendor portal (`app/vendor/*`), and the legacy token-based vendor portal (`/v/[token]`, currently broken).

---

## Luv Observation

**Represents:** A piece of intelligence Luv (the venue assistant) surfaces — a noticed pattern, a suggested next step, a narrative "here's what changed" moment. Ranges from a simple computed nudge ("this payment is overdue") to a marketed differentiator ("Luv noticed this contract has been amended three times before execution").

**Owned by:** The platform (Luv generates it), presented to the venue (and, via `luv-ask`, answering the couple directly in the portal).

**Lifecycle:** Computed fresh on each relevant page load (the stateless, pure-TS layer — `observations.ts`, `event-readiness.ts` — genuinely real and working), or, for the persistent "learned" layer (memory/insights/health scores/recommendations), intended to be cached and recomputed on a schedule.

**Relationships:** References whatever it's observing — a Client, an Event, a Payment, a Contract, a Lead. Its recommendations link to the entity that would resolve them.

**Canonical source of truth:** *Two very different states of health, both real facts about today's implementation.* The stateless observation layer has no persistent source of truth by design — it's computed from the same tables every other entity above already defines. The DB-backed "learned" layer (`luv_memories`, `luv_insights`, `venue_health_scores`, `luv_recommendations`) does have tables — but per `docs/architecture-audit.md`, most of the SQL functions that populate them reference `venue_users`-shaped queries with column/table mismatches introduced when the underlying schema moved on without them, and appear to throw on every invocation, silently swallowed by every caller. Separately, "Luv" is independently reimplemented three more times (Wevenu HQ's own rules pass, the vendor portal's inline computation, the couple portal's standalone Claude-backed route) with no shared engine. None of this is fixed yet.

**Exposed through:** the coordinator dashboard's Luv widget, Wevenu HQ (a separate implementation), the vendor portal (a separate implementation), and the couple portal's "Ask Luv" (a separate implementation) — four surfaces sharing a brand, not yet sharing an engine.

---

## What this model implies for Program 2

Ranked by how far today's implementation is from this model, most to least aligned:

1. **Contract** — already matches this model closely; only the versioning/amendment layer (`docs/contract-lifecycle-design.md`) is still to build.
2. **Venue, Team Member, Client, Event, Invoice, Payment** — each has a genuinely clean, single canonical source of truth today; known gaps are narrow (Payment's schedule-total drift, Contact/portal_role sync) not structural.
3. **Lead** — clean today for a single entry point; the cross-entry-point identity this model requires isn't built yet.
4. **Calendar Entry, Vendor** — conceptually sound splits, with specific, fixable staleness bugs (TR-B4, the vendor RPC break) rather than structural fragmentation.
5. **Asset, Conversation** — the two entities where today's implementation doesn't match this model at all yet: each is genuinely 2-4 unrelated systems today, not one entity with known bugs. These are the real Program 2 architecture projects, not incremental fixes.
6. **Luv Observation** — the computed layer matches this model; the persisted "learned" layer needs real repair before it can.

This ranking, not a feature list, is what should determine Program 2's actual sequencing.
