# Client Workspace — Product Architecture

**Status:** Documentation only. No code, schema, or navigation changed as part of this task.
**Purpose:** State the product philosophy and conceptual model the Client Workspace is designed around, using patterns already present in the codebase as the reference points — not a new invention. Where the current implementation conflicts with a principle stated here, the conflict is called out inline. This document does not specify how to build anything; it specifies what the system means when it's built correctly.
**Companion document:** `docs/client-workspace-collaboration-architecture.md` (current-state audit + conflict inventory). This document takes that inventory as its evidence base and states the principles it implies; read that document first for the full ground-truth detail behind the claims made here.

---

## 1. Product Philosophy

The Client Workspace is the couple's own space for planning their wedding — not the Venue Workspace with some tabs hidden. This is already stated directly in the codebase's own comment on `portal-shell.tsx`: *"The client portal is not the venue portal filtered for the couple."* This document treats that sentence as the governing philosophy, not an incidental remark.

Three consequences follow from it:

1. **Some things belong entirely to the couple**, exist for no venue purpose, and have no venue-side equivalent at all — their guest list, their budget, their seating chart, their wedding website, their story. A venue should never need to "grant" the couple these; they are first-class and pre-existing the moment a booking exists.
2. **Some things belong entirely to the venue** — its internal operations, its other clients, its vendor roster and margins, its notification/automation configuration — and should never be visible to a client under any configuration.
3. **Some things are genuinely shared** — a single fact two parties both act on (the day-of schedule, a vendor decision, a task, a message thread). Shared does not mean jointly *owned*; it means both parties have a legitimate, bounded stake in the same record.

The relationship implied by this philosophy is a **collaboration between two parties**, not a venue administering an account on the client's behalf. Access the venue holds over client-owned material should be an intentional, visible grant — never an implicit default the client can't see or influence.

**Conflict with current implementation:** access to a client's own Portal is entirely venue-administered today (creation, labeling, revocation — see `docs/client-workspace-collaboration-architecture.md` §4/§7). This is not merely an implementation gap under this philosophy — it is the philosophy's central claim ("the client owns their workspace") being contradicted by the one piece of infrastructure everything else depends on (who can get into it in the first place).

---

## 2. Ownership Matrix

Three ownership categories, matching the philosophy above:

- **Client-Owned** — exists for the couple's benefit; the venue has no default visibility or control.
- **Venue-Owned** — exists for the venue's operations; the client has no default visibility or control.
- **Shared** — one record, two legitimate parties, each with a bounded set of actions.

| Domain | Ownership | Basis / existing precedent |
|---|---|---|
| Guest list | **Client-Owned** | Already enforced at the schema level — `couple_guests` is explicitly excluded from venue visibility beyond an aggregate count. This is the reference implementation for what Client-Owned should mean everywhere else. |
| Budget | **Client-Owned** | No venue-side reference exists anywhere in the codebase — matches the model. |
| Seating chart | **Client-Owned** | Same as budget — no venue-side reference found. |
| Wedding website, Our Story, Journey | **Client-Owned** | Authored, published, and read entirely within the Portal; the Venue Workspace has no editing surface for any of it. |
| Day-of Timeline / schedule | **Shared** | One `timeline_entries` table, authored by the venue, editable by the client on rows explicitly opened for it, published to guests on rows explicitly tagged for it. This is the reference implementation for what Shared should mean. |
| Tasks / Playbooks | **Shared** | Venue authors and assigns; a task can be `client_visible` (read-only) or `client_owned` (client completes it). |
| Vendor recommendations | **Shared** | Venue proposes, client decides; both sides act on the same record. |
| Vendor CRM / directory / assignments | **Venue-Owned** | The venue's operational relationship with vendors it works with generally — no client stake in the roster itself. |
| Messaging | **Shared** | Bidirectional by design — both parties author messages in the same thread. |
| Documents the venue shares, or the client uploads and shares back | **Shared** | `couple_documents` already models this bidirectionally. |
| Documents in the venue's own library | **Venue-Owned** | Internal reference material with no client-facing purpose (insurance, permits, internal notes) unless explicitly shared. |
| Contracts | **Shared, asymmetric** | Venue authors and sends; the client's only action on it is signing — a narrow, single-purpose action, not general edit access. |
| Invoices / Payments | **Shared, asymmetric** | Venue authors and manages; the client's legitimate action is viewing status (and, prospectively, paying) — never editing the record. |
| Floor Plans | **Venue-Owned today; anticipated to become Shared** | A `client_access` field (`edit`/`view`/`hidden`) already exists specifically to make this configurable per floor plan — the ownership category is meant to vary by plan, not be fixed venue-wide. |
| Inventory | **Venue-Owned** | Purely an operational catalog; no client stake in it exists or is implied anywhere. |
| Final-details Questionnaire | **Shared, request-shaped** | Venue asks, client answers — see §5 for why this is a distinct pattern from ordinary "Shared." |
| Notifications / Automations configuration | **Venue-Owned** (the tool); its *output* touches the client | The rules, timing, and templates are venue-configured; the client only ever receives the result. |

**Conflict with current implementation:** Floor Plans is listed above as "anticipated to become Shared" specifically because the codebase already contains a column built for exactly that (`floor_plans.client_access`) with zero code path reading or writing it — the Ownership Matrix already exists in the schema for this one feature, unconnected to anything.

**Conflict with current implementation:** Vendor reviews (`vendor_reviews.is_public`) don't appear in this matrix as their own line because their intended ownership category is unclear from the code — a Venue-Owned toggle exists with no Client-facing consumer, so today it is neither meaningfully Shared nor cleanly Venue-Owned; it is unresolved.

---

## 3. Visibility Model

Visibility is not one flag. Two things are true in the reference implementation (Timeline) that should hold everywhere Shared or Client-Owned data exists:

1. **Visibility and editability are separate axes.** Being able to *see* a record does not imply being able to *change* it. Timeline already separates these: `audiences` controls who sees a row at all; `clientEditable` separately controls whether the client can change a row they can see. A Shared feature without this separation collapses two different questions into one flag.
2. **Visibility is per-item, not a single global switch.** Timeline's `audiences` array is per-row and per-section, not "is the Timeline visible to clients: yes/no" for the whole booking. A per-record visibility model is the standard this document treats as correct; a single global on/off toggle for an entire feature is a weaker substitute for it.

A third distinction the reference implementation makes, worth stating explicitly because it is easy to blur: **Client Portal visibility and Guest-facing visibility are not the same audience**, even where they reuse the same field. A couple and their wedding guests are different people with different legitimate views of the same data (a guest should see the ceremony time; a guest should not see the vendor payment schedule tagged to the same event). Timeline's `audiences` vocabulary (`couple`, `guest`, `vendor`, `public`, `internal`) already treats these as distinct tags on one array — the principle is that they are conceptually distinct visibility targets, whether or not they end up implemented as adjacent values of one field or as genuinely separate mechanisms.

The reserved three-state vocabulary on Floor Plans (`edit` / `view` / `hidden`) is the clearest existing statement of what a per-item visibility state should look like when editability is folded in as a third tier rather than a separate boolean: hidden (no visibility), view (visible, not editable), edit (visible and editable). This document treats that three-tier vocabulary as the canonical visibility model for any Shared feature, ahead of the plain boolean pattern used elsewhere.

**Conflict with current implementation:** Contracts and Invoices carry a boolean `is_couple_visible` (not a three-tier model, and defaulting to `true` with no UI on either side ever changing it) — visibility here is neither per-item in any meaningful sense (nothing ever sets it differently per record) nor does it distinguish "visible" from "actionable" the way Floor Plans' reserved field does.

**Conflict with current implementation:** the Timeline's `audiences` field is the one place Client-Portal-visibility and Guest-facing-visibility are implemented as literal adjacent values in the same array on the same field, rather than as distinguishable mechanisms — the conflation this section warns against already exists in the one fully-built example.

---

## 4. Collaboration Model

Collaboration means a Shared record where each party has a defined, bounded set of legitimate actions — not equal or unrestricted access for both sides. The existing patterns already demonstrate three different shapes this can take:

- **Author / Editor-within-bounds** (Timeline): the venue authors and owns structure (sections, ordering, which rows exist); the client may edit specific fields on specific rows it has been given editability over, and may add new rows only into sections explicitly opened for it. The client's collaboration is real but bounded by the venue's prior configuration — it is not open editing of the whole record.
- **Propose / Decide** (Vendor recommendations): the venue proposes options; the client's collaborative act is a decision (select one), not authorship. The venue does not lose control of the option set by sharing it.
- **Assign / Complete** (Tasks): the venue defines and assigns work; the client's collaborative act is completion (or, for `client_visible`-only tasks, none at all beyond viewing).
- **Symmetric exchange** (Messaging): both parties author freely in the same thread — the one place true symmetry is appropriate, because the record's entire purpose is two-way communication.

State changes on a Shared record should be visible to both parties without either having to ask — a vendor selection made by the client should appear on the venue's side immediately; a task the venue assigns should appear as owned in the client's workspace immediately. Collaboration that requires a manual sync or a separate notification to be aware of the other party's action is a weaker form of the model than one where the shared record itself is simply the same data on both sides.

**Conflict with current implementation:** the transition points in these collaboration patterns (a recommendation moving to "selected," a task moving to "complete") exist in code but not as a documented state model — the *shape* of collaboration (propose/decide, assign/complete) is implicit in comments and field names rather than stated as a first-class concept anywhere, which makes it easy for a new feature to invent a fourth, inconsistent shape.

**Conflict with current implementation:** Messaging, the one place symmetric collaboration is the whole point, is currently split across two parallel schemas (see the companion audit, §9.1–9.2) — the one feature that should most cleanly embody "Shared, symmetric" is the least architecturally unified feature in the system today.

---

## 5. Request vs Share

Two different things are commonly folded into "the venue gives the client something" or "the client gives the venue something," and they are not the same relationship:

- **Share** — information or material made available, with no expected action in return. It is informational. Nothing is pending; there is no open loop. Examples: the Venue Guide, a shared reference document, the published wedding website.
- **Request** — the venue (or client) asks the other party for something specific: an answer, a decision, a signature, a document. A Request has a lifecycle — it is outstanding until it is fulfilled — and that lifecycle should be a visible status, not just a UI element that either has or hasn't been interacted with yet.

The Questionnaire is the existing reference implementation of a Request done properly: it has an explicit status (`draft` → `sent` → `submitted` → `reviewed`), the venue takes an explicit action to create the open loop (`sendQuestionnaireToCouple`), and both parties can tell whether it's still outstanding. This is the standard this document holds up for what "Request" should look like anywhere a decision or input is genuinely expected back.

Contract signing is also a Request in substance (a decision — sign or don't — is explicitly expected) even though it is not framed as one architecturally; it currently behaves more like a one-off action link than a tracked open loop with a visible status inside the workspace.

Vendor recommendation is a Request in substance — a decision is expected — but is not currently modeled with the Questionnaire's kind of explicit status lifecycle; the only observable state is whether a selection has been made or not, not that a decision has been been asked for.

Documents mix both patterns in one surface without distinguishing them: a venue-shared file is a Share (informational, no action expected); a couple-uploaded file flagged for the venue is closer to a Share in the other direction; neither currently carries a "please review/respond" Request framing even where one might be intended (e.g., the venue wants the client to review something specific).

**Conflict with current implementation:** only Questionnaire currently has the request lifecycle (status + explicit send action) this section describes as the standard; Vendor recommendations and Contract signing are Requests in substance without that lifecycle, and Documents doesn't distinguish Request from Share at all.

---

## 6. Automation Principles

Automations (Message Sequences) act **on behalf of the venue** — they are a Venue-Owned tool whose effect lands on the client. Several principles follow directly from the Ownership and Visibility models above, rather than being new:

1. **Automations may act on Venue-Owned and Shared data; they should never directly write to Client-Owned data.** An automation may create a task, send a message, or move a lead through a pipeline stage — it should not edit a couple's guest list, budget, or seating chart on their behalf. Nothing in the current codebase does this today; this section states it as a boundary precisely because nothing currently prevents a future automation from crossing it.
2. **Automations must respect the same visibility rules a human venue user would.** An automated message or a system-triggered field should never surface Venue-Owned information to a client, or Client-Owned information into a venue-facing report, that a coordinator manually performing the same action would not be allowed to expose.
3. **A system-triggered change to a Shared record is a distinct kind of event from either party's manual action, and should be identifiable as such.** The existing `triggerAutoComplete` pattern — a vendor selection automatically completing a related Planning task — is the reference example of this working correctly: the state change is real, attributable to the automation, and is not confused with either the venue or the client having manually toggled it.
4. **The client should be able to tell an automated communication from a personal one.** This follows from the Product Philosophy's transparency principle (§1) — a client reasoning about "did my coordinator write this, or did the system send it" is reasoning about trust in the relationship, not a cosmetic detail.

**Conflict with current implementation:** principle 4 has no existing implementation to point to — Message Templates and Automations do not appear to carry any client-visible marker distinguishing a sequence-triggered message from a personally written one anywhere in the Portal's Messages tab or the legacy thread view.

**Conflict with current implementation:** principle 1 is not enforced anywhere because no automation in the current system touches Client-Owned data yet — this is a boundary with no violation to point to today, only an absence of the guardrail itself, which matters once any future automation (e.g. a budget reminder, a seating-chart nudge) is built against Client-Owned data for the first time.

---

## 7. Client Workspace Navigation

Navigation should communicate the Ownership Matrix directly, not obscure it. The existing Portal navigation already does this correctly in structure: sections are grouped into "yours" (Client-Owned) and a second group (Shared, labeled by the venue's presence in it) — matching §2 above almost exactly, down to the grouping mechanism already existing in code (`group: "yours" | "venue"`).

The standard this document holds the navigation to:

- Every section a client can reach should have a discoverable entry point in that navigation. A workspace with content reachable only by incidental navigation (a link buried in another tab, or no link at all) does not meet the "this is your workspace" philosophy in §1 — if it's part of the workspace, it should be listed as part of the workspace.
- Grouping should reflect ownership (Client-Owned vs. Shared), not feature taxonomy (e.g., not grouped by "planning tools" vs. "financial tools") — the existing two-group structure already gets this right and should remain the organizing principle as sections are added.
- A feature that is Venue-Owned (§2) should have no navigation presence in the Client Workspace at all, by definition — there is nothing to reconcile here; Venue-Owned features simply don't appear.

**Conflict with current implementation:** the Documents section is fully built and reachable in code but has no entry in the current navigation list — by the standard above, this is a direct conflict: a Shared-ownership feature (§2) exists without the discoverability the navigation principle requires.

**Conflict with current implementation:** Floor Plans has no navigation presence at all, which is *not* a conflict under the Ownership Matrix as it stands today (Floor Plans is currently Venue-Owned, so no client nav entry is correct) — but it is worth naming here because the moment `client_access` is wired up for any single floor plan (making that plan Shared per §2), the navigation principle above would require a Floor Plans entry to appear, and nothing in the current navigation model anticipates a per-item reason for a whole section to appear or disappear.

---

## 8. Venue Visibility by Feature

The reverse direction of §2: for each Client-Owned or Shared feature, what the venue can see. Client-Owned features should default to no venue visibility unless a specific, narrow exception is deliberately carved out (as guest count is, below); Shared features are visible to the venue by definition, since the venue is one of the two legitimate parties.

| Feature | Venue visibility | Basis |
|---|---|---|
| Guest list | **None** (aggregate count only) | Reference implementation for a deliberate, narrow exception to "no visibility" — the venue needs a headcount for operations, not the guest list itself. |
| Budget | **None found** | Matches the model — no exception has been carved out, and none is implied by any operational venue need. |
| Seating chart | **None found** | Matches the model on its face, but see the conflict note below — this is one of the more debatable "no visibility" cases, since a venue plausibly has an operational reason (catering counts, room capacity) to know seating outcomes, and no exception has been considered either way. |
| Wedding website | **None as a workspace feature** (the published site is simply public, like any visitor) | The venue has no *dedicated* visibility path into it; it can view it the same way any guest can, which is a different thing from a workspace granting venue visibility. |
| Vendor recommendations | **Full** (the venue authored the recommendation and observes the selection) | Correct by definition — this is Shared, not Client-Owned. |
| Tasks | **Full** for tasks the venue itself assigned; **not applicable** to any purely personal to-do the client might keep elsewhere (Plans/Todos is Client-Owned and separate from Playbook tasks) | Matches the model — Playbook-derived tasks are Shared, the personal "Plans" list is Client-Owned and has no venue visibility. |
| Timeline | **Full** | Correct — the venue owns the underlying table. |
| Messaging | **Full**, symmetric | Correct — the whole feature is bidirectional communication. |
| Documents shared by the client (`share_with_venue`) | **Visible once flagged** | Matches the model — an explicit Share action gates visibility, not a default. |
| Contracts / Invoices | **Full** (venue-authored) | Correct — the venue is the author of these records; the interesting visibility direction here is client-facing, covered in §2/§3, not venue-facing. |
| Additional participants the client invites ("People") | **Unconfirmed** | Whether the venue has any listing of who a client has delegated portal access to was not established with confidence in the underlying audit — flagged here rather than asserted either way. |

**Conflict with current implementation:** Seating and Floor Plans are two separate features (a client-owned seating chart; a venue-owned floor plan) describing overlapping physical reality — table counts, room layout — with no relationship to each other in the data model today. Neither one's visibility model currently accounts for the other existing.

---

## 9. Authentication Principles

The principles below describe what "the client's identity" should mean in a Client Workspace, independent of any specific login mechanism (this document does not specify one — see the scope note at the top).

1. **Access should represent an identifiable relationship, not merely possession of a link.** A Client Workspace access grant should be traceable to *who* it was issued to and *why*, not merely valid because a URL was correctly guessed or shared. Today's model — a bearer token with no account behind it — makes "the client" and "anyone holding this URL" the same thing by construction.
2. **Distinct people should have distinct access, even when collaborating on the same booking.** Where a booking involves multiple people (the couple, a parent, a planner, a co-host), each should be individually identifiable in the system, not indistinguishable holders of one shared credential. The existing `client_contacts`/per-contact portal session pattern already reflects this correctly — a contact gets their own session, not the couple's session copied — and is the reference example to build on rather than deviate from.
3. **The party the access belongs to should be able to see and manage it.** A client should be able to tell how many active access grants exist for their own workspace and to revoke one, the same way a venue can today for anything it grants. Authentication that only the *granting* party can inspect or revoke is asymmetric in a way this document treats as a gap, not a design choice.
4. **Access tiers, once modeled, should be reachable through the interface that creates access.** If the system supports more than one level of access (full/planning/financial/view-only, or similar), the creation flow for a primary grant should be able to produce any of them — a tier that exists only in validation logic and never in the UI that issues access is not really configurable.

**Conflict with current implementation:** principle 1 is a direct conflict with the current model as documented in the companion audit — there is no client account, only a bearer token, and the token is the entirety of "being the client."

**Conflict with current implementation:** principle 3 is unimplemented in either direction for the primary access grant — only the venue can list or revoke it.

**Conflict with current implementation:** principle 4 is only partially confirmed — the schema supports multiple access tiers and every read path already gates behavior on them, but the primary session-creation flow was not confirmed to expose a choice among them (see the companion audit, §6).

**What already aligns:** principle 2 — per-contact portal sessions for delegated participants — is already built this way, and is the one authentication pattern in the current system this document does not need to hold up as a target still to be reached.

---

## 10. Future Expansion Areas

Named here as areas consistent with the philosophy above that are not built, or are only partially built, today — not a roadmap, not a set of proposed solutions:

- **Floor Plans as a Shared feature**, using the already-reserved `client_access` field, following the same visibility/editability separation the Timeline already demonstrates.
- **Contract and Invoice visibility actually reachable**, using the already-reserved `is_couple_visible` fields, per a real per-item visibility decision rather than an unchanging default.
- **Online payment as a genuine Shared collaboration**, rather than the current view-only-with-a-deflection-to-Messages pattern.
- **A unified messaging model**, resolving the two-schema split so that "the conversation" is the same thing regardless of which side is looking at it.
- **A stated Request lifecycle for Vendor recommendations and Contract signing**, following the Questionnaire's existing status-lifecycle pattern rather than each Request-shaped feature inventing its own ad hoc signal for "still pending."
- **A relationship between Seating (Client-Owned) and Floor Plans (Venue-Owned, prospectively Shared)** — two features describing overlapping physical reality with no connection between them today.
- **Vendor review visibility resolved one way or the other** — currently a Venue-Owned toggle with no Client-facing consumer, sitting in between the two ownership categories in §2.
- **Client-side session/access management**, so the ownership principle in §9 (the party access belongs to can see and manage it) has an actual home in the interface.
- **Multi-booking Portal access**, since the current session model assumes one client has exactly one relevant event.
- **A visible marker distinguishing automated from personally authored client-facing communication**, per §6.

---

*End of document. No implementation, migration plan, or code is proposed — see task scope.*
