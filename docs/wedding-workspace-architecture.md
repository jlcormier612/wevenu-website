# Wedding Workspace — Complete Architecture

**Status:** Documentation only. No code, schema, or navigation changed as part of this task.
**Purpose:** Give a single, complete account of the Wedding Workspace — the couple's own planning environment — as it exists in the codebase today, and name every place the current implementation conflicts with the architecture stated here. This document does not propose a redesign, a migration plan, or a fix for anything it finds. Where a conflict is identified, it is stated and left standing.
**Companion documents:** `docs/client-workspace-collaboration-architecture.md` and `docs/client-workspace-product-architecture.md` (written before Client Identity Foundation and the Request Framework existed). Several of their findings have since changed — this document supersedes them wherever the two disagree, and says so explicitly.

**Terminology.** The codebase itself uses several names for the same two things. This document fixes on:

- **Wedding Workspace** — the couple's planning environment. In code: `app/(portal)/p/[token]/page.tsx` rendering `components/portal/portal-shell.tsx`. Elsewhere called "the Client Portal" or "the Portal."
- **Booking Workspace** — the venue coordinator's operational workspace for one booking. In code: `app/(app)/clients/[id]/page.tsx` rendering `components/events/event-detail.tsx`. Elsewhere called "the Venue Workspace" (for the coordinator's tools generally) or "the Event page."

These are two different applications sharing a database, not one application with a client-filtered view. The Wedding Workspace's own governing comment states this directly (`portal-shell.tsx`): *"The client portal is not the venue portal filtered for the couple."*

---

## 1. Product Purpose

The Wedding Workspace exists so a couple can plan their wedding in their own space, with their own account, collaborating with their venue on the specific things that are genuinely shared — not administering a venue-provisioned view of the venue's own records.

Three things follow from this:

1. **Some data belongs entirely to the couple** and has no Booking Workspace equivalent: their guest list, budget, seating chart, wedding website, story, and journal. The venue does not grant these; they exist the moment a booking exists.
2. **Some data belongs entirely to the venue** — vendor CRM, internal operations, notification/automation configuration — and is never surfaced in the Wedding Workspace.
3. **Some data is genuinely shared** — Timeline, Tasks, Vendor recommendations, Messages, Payments — one record, two parties, each with bounded legitimate actions.

Since Client Identity Foundation, this purpose extends one layer further: the couple should *own* their workspace the way they own the data inside it — a real account with a password, sessions they can see and revoke, and explicit control over any venue access into their space — not merely be "whoever holds a URL." That work built the account layer; whether the rest of the system now behaves consistently with it is examined throughout this document (§2, §14, §15).

**Conflict:** the Wedding Workspace and the Booking Workspace are frequently linked from the venue side by the same literal mechanism — a raw `/p/{token}` URL, rendered as a plain link or `window.open` call — rather than through any access-controlled or auditable path. Several such links are documented below (§15) as still standing even after Client Identity Foundation introduced a sanctioned alternative.

---

## 2. Platform Architecture

**Entry point.** `app/(portal)/p/[token]/page.tsx` calls `resolvePortalContext(token)` (`lib/portal/service.ts`) and, if the token resolves to a live `client_portal_sessions` row, renders `<PortalShell>` unconditionally — there is no branching on session type, access level, or account status at the page level (see §14).

**Fetch pattern.** `PortalShell` itself fetches only a handful of top-level values on mount (guest stats, profile, recent activity). Every individual section (`GuestPortalSection`, `BudgetPortalSection`, `SeatingPortalSection`, `VendorPortalSection`, etc.) is its own client component that independently calls a matching `/api/portal/*` REST route, passing the token as a query parameter or request body field. Each route calls a `SECURITY DEFINER` Postgres RPC that **re-resolves the token itself** (looking up `client_portal_sessions` by `access_token`, checking `expires_at`) rather than trusting any shared, previously-validated session object. There is no middleware-level or centrally-shared authorization layer for the Wedding Workspace — every one of dozens of RPCs re-implements its own token lookup and (inconsistently — see §14) its own access-level check.

**Two coexisting access eras.** Since Client Identity Foundation (`20260819000000_client_identity_foundation.sql` and follow-ons):

- A `client_portal_sessions` row can now be owned by a real account: `client_user_id` (the primary couple's account) or `participant_id` (a delegate's account, via `couple_portal_participants`).
- Real login flows exist: `/client/accept` (primary invite acceptance + account creation), `/client/accept-participant` (delegate invite acceptance), `/client/login` (sign-in, resolving to the caller's own session token server-side).
- The original mechanism — a bare `client_portal_sessions` row with `client_user_id` and `participant_id` both `null`, created directly by a venue coordinator — still exists as a valid, fully-functional row type. `resolvePortalContext` does not distinguish between an account-owned session and a bare one; both render the identical `PortalShell`.

**Conflict:** there is no access-level gate anywhere in `PortalShell` or its section components. `NAV_ITEMS` (all seventeen sections) renders unconditionally regardless of `context.accessLevel`, and `accessLevel`/`portal_role`/`permission_level` are not even fetched into the client-side `PortalContext` object in a form the shell could branch on if it wanted to (see §14 for the full three-vocabulary finding). The platform's authorization model is "does this token exist and is it unexpired," full stop, at the page-render layer — every finer-grained decision (if made at all) happens deep inside an individual RPC, inconsistently.

**Conflict:** legacy bare sessions and account-owned sessions are not distinguished anywhere in the UI. A coordinator who still creates a session the old way (if any code path remaining does) produces a session indistinguishable, from the couple's own point of view, from one they created themselves via `/client/accept`.

---

## 3. Ownership Model

| Domain | Stated ownership | App-layer evidence | Data-layer (RLS) evidence |
|---|---|---|---|
| Guest list | Client-Owned | No venue Booking Workspace UI reads `couple_guests` | **Contradicts stated ownership** — `couple_guests` RLS was changed in `20260708120000_sprint107_team_collaboration.sql` to `venue_id = current_user_venue_id()`, granting any active venue owner/team member raw `select` over every guest row. `grant select on public.couple_guests to authenticated` still stands. A `shared_couple_guests` view exists that *does* filter by `visibility_to_venue`, but it is queried nowhere in the codebase — dead code. |
| Budget | Client-Owned | No venue Booking Workspace UI reads `couple_budgets`/`budget_categories`/`budget_contributors` | **Same pattern as Guests** — explicit `venue_read_couple_budgets`-style SELECT policies exist on all three budget tables, granting venue staff direct row access. Unused by any current UI, but not excluded at the data layer. |
| Seating chart | Client-Owned | No venue UI found | Not directly confirmed either way in this pass — given that both Guests and Budget turned out to have venue-read RLS despite being assumed clean, this should not be assumed without checking `seating_tables`/`guest_seat_assignments`/`couple_seating_arrangements` RLS directly before relying on it. |
| Wedding website, Our Story, Journey | Client-Owned | No Booking Workspace editing surface | Consistent — no contradicting grant found. |
| Timeline | Shared | One `timeline_entries` table, three consumers (Booking Timeline editor, Wedding Workspace Timeline tab, public website schedule) | Consistent — this is the one feature actually built as Shared end to end. |
| Tasks/Playbooks | Shared | `owner_type`/`visibility` gate what's client-facing | Consistent. |
| Vendor recommendations | Shared | Venue proposes (`event_vendor_recommendations`), client selects | Consistent, and cleanly separated from the operational `event_vendor_assignments` table (see §10). |
| Vendor CRM/directory | Venue-Owned | No client stake anywhere | Consistent. |
| Messaging | Shared | Bidirectional by design | Consistent in intent; forked in implementation (see §12). |
| `couple_documents` (venue-shared or client-uploaded-and-shared) | Shared | Unioned into one portal document view | Consistent. |
| Venue's own `documents` library | Venue-Owned | No bridge to the Wedding Workspace | Consistent. |
| Contracts/Invoices | Shared, asymmetric | `is_couple_visible` gates inclusion, default `true`, no UI ever sets it otherwise | Consistent in structure, unconfigurable in practice. |
| Floor Plans | Venue-Owned today; `client_access` column reserved and unbuilt | No Wedding Workspace surface | Consistent — and structurally unconnected to Seating, a Client-Owned feature describing the same physical room (§7). |
| Requests (new, Request Framework) | Not yet categorized in the Wedding Workspace at all | No Wedding Workspace surface exists for Requests in any form (§13) | N/A — there is nothing to check, because nothing reads or writes `requests` from the portal side. |

**Conflict:** the two clearest "Client-Owned, no venue visibility" claims in the prior architecture doc — Guests and Budget — are both now known to be false at the RLS layer, having been loosened (Guests, deliberately, as part of the venue-team-collaboration migration) or built with venue access from the start (Budget). "Client-Owned" in this codebase currently means "no venue UI happens to read this," not "the venue cannot read this." That is a materially weaker guarantee than the Ownership Matrix implies, and it applies to precisely the two domains most likely to be treated as inviolable by product intent (a couple's own guest list and their own finances).

---

## 4. Wedding Workspace Modules

Current `NAV_ITEMS` (`components/portal/portal-shell.tsx`), grouped exactly as the code groups them:

**Group "yours" (Client-Owned):** Home/Overview, Guests, Plans (Todos), Budget, Seating, Website, Our Story, Journey, People, Ask Luv, Account.

**Group "venue" (Shared):** Venue Guide, Tasks, Timeline, Vendors, Payments, Messages.

**Built but absent from `NAV_ITEMS` entirely:** Documents (`CoupleDocumentsPortalSection`) — the switch statement renders it (`activeSection === "documents"`), but no button anywhere in the header can ever set `activeSection` to that value. This has been true since before Client Identity Foundation and remains true today.

**Present in the schema, absent as any Wedding Workspace module:** Requests. The Request Framework (§13) has no representation in this list, in the switch statement, or anywhere else in `portal-shell.tsx`.

The "Account" module (change password, view/revoke own login sessions, grant/revoke temporary venue support access) is new since Client Identity Foundation and is the one module in this list with no data-table backing of its own — it is a control surface over `auth.sessions`, `client_users`, and `client_support_access_grants`, not a Client-Owned content domain like the others in its group.

---

## 5. Collaboration Model

Four collaboration shapes are already built:

- **Author / Editor-within-bounds** (Timeline) — venue owns structure; client edits specific fields it's been given editability over.
- **Propose / Decide** (Vendor recommendations) — venue proposes, client selects; both sides see the same record update instantly via a DB trigger (§10).
- **Assign / Complete** (Tasks) — venue assigns, client completes (or only views, for `client_visible`-only tasks).
- **Symmetric exchange** (Messaging) — both parties author freely in the same thread, in principle (§12 covers the fork that complicates this in practice).

A fifth shape exists since Client Identity Foundation and was not present when the companion docs were written:

- **Delegate** (People / `couple_portal_participants`) — the couple, not the venue, invites another person (parent, planner, partner) with a `permission_level`. Since this task, that invitation now produces a real account and a real, independently-owned `client_portal_sessions` row for that person, rather than a database row with no way to ever actually grant access.

A sixth, narrower mechanism also exists since Client Identity Foundation:

- **Consented, time-boxed venue access** (`client_support_access_grants` / `client_support_access_log`) — the couple explicitly grants the venue a temporary window to view their workspace; every use is logged; the grant expires automatically. This is the only sanctioned mechanism by which a venue coordinator is meant to view a couple's Wedding Workspace today.

**Conflict:** the Delegate shape's permission model is lossy at the exact moment it takes effect. `accept_couple_participant_invitation` converts a participant's `permission_level` (`full`/`planning`/`financial`/`website`/`view_only`) into a `client_portal_sessions.access_level` (`couple`/`planning`/`financial`/`view_only`) with `'website'` and `'planning'` both collapsing onto `'planning'` — the distinction the couple made when inviting that person is discarded at account-creation time, permanently, since nothing subsequently keeps the two fields in sync if the coordinator or couple later changes the participant's `permission_level` (§14).

**Conflict:** the sixth shape — consented, audited venue access — is not the only way a venue can currently reach a couple's workspace. `components/playbooks/event-task-list.tsx` still renders a "View Client Portal" button built on the original bare-token pattern (`render={<Link href={`/p/${portalToken}`} target="_blank" />}`), reachable the moment a Client Planning checklist is released, with no grant, no consent step, and no log entry. This button was deliberately left unchanged in the Client Identity Foundation task (it belongs to Planning, out of scope for that task) but its continued existence is a direct, current conflict with the collaboration principle this section states: that consented, audited access is meant to be the *only* venue path into a couple's workspace.

---

## 6. Guest Architecture

**Table** `couple_guests` (`20260629040000_couple_owned_data.sql`, extended twice): `first_name`, `last_name`, `email`, `phone`, `plus_one`, `plus_one_name`, `rsvp_status` (`pending`/`attending`/`declined`/`maybe`), `rsvp_note`, `rsvp_at`, `dietary_restrictions`, `group_label`, `table_number`, `notes`, `sort_order`, plus later additions `meal_choice`, `plus_one_meal`, `is_child`, `household_id`, `visibility_to_venue` (default `false`), `rsvp_token`, `rsvp_sent_at`, `rsvp_responded_at`.

**RSVP question builder** — `rsvp_questions` (per-client custom questions: text/textarea/select/boolean, required flag, plus-one applicability) and `rsvp_answers` (per-guest, per-question). Fully couple-authored from the Wedding Workspace.

**CSV import** — `POST /api/portal/guests` with a `guests[]` body array calls `batch_add_couple_guests`, which loops and inserts, then logs a `csv_imported` activity event. Client-side parsing (`components/portal/guest-section.tsx`) expects `First Name, Last Name, Email, Group` columns.

**Guest-facing RSVP** — each guest has their own `rsvp_token`. Both the standalone `/rsvp/[token]` page and the embedded RSVP form on the public wedding website (which asks the guest to type their personal code, not look themselves up by name) post through the same `submit_rsvp` RPC, the single write path for `rsvp_status`/`meal_choice`/question answers.

**Conflict (ownership, restated from §3 with full detail):** the RLS policy governing `couple_guests` was replaced in the Sprint 107 team-collaboration migration to `venue_id = current_user_venue_id()` — any active owner or team member can now select every guest row directly. The `visibility_to_venue` column and the `shared_couple_guests` view that filters by it were built specifically to gate venue visibility and are entirely bypassed by this later, broader grant; the view has no callers anywhere in the codebase. The couple's guest list — the domain most explicitly documented elsewhere as "the reference implementation of enforced Client Ownership" — is not actually enforced as such at the database layer today.

---

## 7. Seating Architecture

**Tables** `couple_seating_arrangements` (one per event, 1200×800 canvas), `seating_tables` (`round`/`rectangular`/`head`/`sweetheart`/`cocktail`, `position_x`/`position_y`, capacity), `guest_seat_assignments` (one seat per guest, unique on `guest_id`).

**RPCs**, all portal-token-scoped: `get_seating_data`, `upsert_seating_table`, `delete_seating_table`, `assign_guest_to_table`, `remove_guest_assignment`, `get_seating_suggestions` (household-based auto-assignment).

**Conflict:** Seating and Floor Plans (`lib/floor-plans/`) model the same physical reality — tables, capacity, room layout — as two entirely disconnected systems. Floor Plans uses an 800×600 canvas with `x`/`y` fields and an object-type vocabulary (`table_round`/`table_rect`/`table_oval`/`stage`/`dance_floor`/`bar`/...); Seating uses its own 1200×800 canvas with `position_x`/`position_y` and a different table-type vocabulary. No foreign key, shared table, or code path connects them — confirmed directly against both migration histories, not inferred. A couple arranging their seating chart and a coordinator laying out the floor plan for the same reception are working from two unrelated data models that happen to describe the same room.

---

## 8. Website Architecture

**Table** `couple_websites`: `slug` (unique, validated), `is_published`, `password` (nullable), `theme` (8 values), `accent_color`, `theme_palette`, `font_pairing` (4 values), `section_order`, `content` (jsonb), `sections_enabled` (default 7 of 13 defined `WebsiteSection` values), `schedule_sync` (default `true`).

**Publish flow** — a plain boolean; the public RPC `get_wedding_website(p_slug, p_password)` only returns content where `is_published = true`.

**Timeline integration — real, and live.** When `schedule_sync = true`, the public site's schedule section is populated directly from `timeline_entries` filtered to `'guest' = any(audiences)` and ordered by section/sort order — the same Booking Timeline the coordinator and couple already maintain, not a separately-authored copy. This is one of the more fully-realized cross-system integrations in the Wedding Workspace.

**Guest list integration** — the public site computes aggregate RSVP stats (attending/pending counts, no names) from `couple_guests`, and its embedded RSVP form uses the same personal-code + `submit_rsvp` mechanism as the standalone `/rsvp/[token]` page.

**Conflict:** website password protection is a **plain-text comparison**, unchanged through the most recent migration to touch the flow: `if v_site.password != p_password`. The migration's own comment acknowledges this: *"Password check (plain comparison for now — hash in future sprint)."* The password is also accepted via a `?p=` query-string parameter on the public page, which most browsers and proxies will log in plaintext.

---

## 9. Budget Architecture

**Tables** `couple_budgets` (`total_budget`, `notes`, scoped by `client_id` after a later migration made `event_id` optional), `budget_contributors` (`name`, `amount`, `notes`), `budget_categories` (`category_key`, `custom_name`, `budgeted_amount`, `actual_amount`).

**RPCs** — `get_portal_budget`, `upsert_portal_budget`, `upsert_portal_budget_category`, `upsert_portal_contributor`, `delete_portal_contributor` — all portal-token-scoped.

**Conflict (restated from §3):** all three tables carry explicit venue-read RLS policies scoped to `venue_users`/team membership, granting the venue direct row access to a couple's financial planning data. No Booking Workspace UI currently reads any of them, so the practical effect today is nil — but the claim that Budget has "no venue-side visibility" is true only as an accident of no one having built a reader yet, not as an enforced boundary.

**Conflict:** none of the budget-write RPCs check `access_level`, `portal_role`, or `permission_level` at all — a session created at `view_only` access can call `upsert_portal_budget` and modify the couple's budget through the same route as a `couple`-level session. This is a stricter version of the general finding in §14: Budget is the one domain surveyed here where the access-level check isn't merely inconsistent, it's entirely absent.

---

## 10. Vendor Architecture

**Table** `event_vendor_recommendations` (`vendor_id`, `note`, `recommended_at`, `selected_at` — nullable until chosen), unique on `(event_id, vendor_id)`, explicitly documented in its own migration as distinct from the operational `event_vendor_assignments` table: *"conflating them would mean every recommended-but-not-chosen vendor shows up in day-of operational views, which is wrong."*

**Selection flow** — the couple's selection (`select_event_vendor_recommendation` RPC) sets `selected_at`; a database trigger fires the venue-side notification the instant that transition happens, regardless of which code path performed the update; the same API route also triggers Planning-task auto-completion via the existing `triggerAutoComplete` mechanism. Multiple recommendations may be selected per event — V1 treats this as a shortlist, not an exclusive choice per category.

**What already aligns well:** this is one of the more cleanly built Shared features in the system. The recommendation/assignment separation is deliberate and documented at the schema level (not just convention), the state transition is a single well-defined write, and both sides observe the same fact immediately without any manual sync step — this is the reference implementation the Collaboration Model (§5) describes for "Propose / Decide."

---

## 11. Document Architecture

**Table** `couple_documents` (`name`, `file_url`, `uploaded_by` — `couple` or `venue` — `share_with_venue`, `source_type`/`source_id`).

**Union RPC** `get_couple_documents(p_token)` combines three sources into one list: (1) `contracts` where `is_couple_visible = true`, (2) `invoices` where `is_couple_visible = true`, (3) all `couple_documents` rows for the client, both origins. The venue's own general-purpose `documents` library (used elsewhere in the Booking Workspace) is a separate table entirely, with no bridge into this union at all.

**Conflict (long-standing, confirmed still present):** the `CoupleDocumentsPortalSection` component is fully built and wired into the shell's render switch, but has no entry in `NAV_ITEMS`. There is no way for a couple to navigate to it from inside their own workspace. This has been true since before Client Identity Foundation and the Request Framework, and neither of those tasks touched it.

**Conflict:** "Documents" names at least three structurally unrelated things depending on which system is asked — the venue's own library, `couple_documents`, and contracts/invoices unioned in as pseudo-documents (view-only, no first-class document identity of their own). There is no single Document concept spanning the Booking Workspace and the Wedding Workspace.

---

## 12. Messaging Architecture

The Wedding Workspace's Messages tab (`PortalMessageSection`) reads and writes `couple_threads`/`couple_messages` — the original, purpose-built bidirectional schema — **unconditionally**, regardless of the venue's `conversationExperienceEnabled` flag. That flag only affects which inbox the *venue side* uses (the legacy `LegacyMessagingInbox` versus the newer `ConversationInbox`, built on a separate `conversations`/`conversation_messages` schema during Communication Workspace Completion).

**Conflict (unresolved, unchanged since the companion audit):** a venue can be fully migrated to the new Conversations experience while every one of its couples is still transacting through the legacy thread tables in their Wedding Workspace, with no shared toggle and no way for either party to detect the mismatch from the UI. Bridge functions exist (`getPortalConversation`, `sendPortalConversationMessage` in `lib/conversations/service.ts`) but are called from no portal route or component — dead code, same as when it was first documented. This is the one place in the system where "Shared, symmetric" (§5) is most clearly the intended model and least architecturally unified in practice.

---

## 13. Request Framework Integration

The Request Framework (`requests` / `request_lifecycle_events` tables, `lib/requests/`) is a generic, reusable platform capability: title, description, request type (Document/Approval/Information/Selection/Upload/Confirmation/Task), an eight-state lifecycle (Draft→Sent→Viewed→In Progress→Submitted→Reviewed→Completed/Cancelled), visibility (Venue Only/Shared/Completed), and an owning `client_id`/optional `event_id`. It exposes lifecycle hooks (`onRequestLifecycleEvent`) for a future notification system, deliberately not building one itself.

Its only current integration is into Planning: a Booking Workspace task may optionally create and link to a Request (`event_tasks.request_id`), with task completion and Request completion kept fully independent by design (verified: deleting a linked Request nulls the task's reference and leaves the task's own status untouched).

**Conflict — this is the most significant finding in this document.** The Request Framework, whose entire stated purpose is to be "the collaboration layer" between a venue and a client, has **zero presence in the Wedding Workspace**:

- No `NAV_ITEMS` entry, no section component, no switch-statement case in `portal-shell.tsx`.
- No `/api/portal/requests` route or equivalent — no portal-token-scoped RPC exists to read or act on a Request at all.
- The `visibility` field's `shared` and `completed` values (as distinct from `venue_only`) currently have no consumer anywhere that would make that distinction observable to a client, because no client-facing surface reads the field in the first place.
- A couple whose coordinator creates a Request against one of their Planning tasks today has no way to discover it exists, see its status, or act on it from inside their own workspace — the entire loop (create → notify the client → client acts → venue reviews) that the framework's purpose statement describes is only half-built, and only on the venue's half.

This is not a bug in the Request Framework or Planning integration tasks — both were explicitly scoped to exclude Wedding Workspace changes, and did so correctly. It is named here because this document's purpose is to state the complete Wedding Workspace architecture, and "a Request has no representation in the couple's workspace at all" is the current, complete truth about that intersection.

---

## 14. Privacy Model

Three separate, independently-typed permission vocabularies currently govern "what can this person do in the Wedding Workspace," with no comprehensive reconciliation between them:

| Vocabulary | Table.column | Values |
|---|---|---|
| (a) | `client_portal_sessions.access_level` | `couple`, `planning`, `financial`, `view_only` |
| (b) | `client_contacts.portal_role` | `full_access`, `planning`, `financial`, `view_only`, `reminders_only` |
| (c) | `couple_portal_participants.permission_level` | `full`, `planning`, `financial`, `website`, `view_only` |

**How they interact, exactly:**

1. **(c) → (a), once, lossily, at invitation acceptance.** `accept_couple_participant_invitation` maps a participant's `permission_level` onto a brand-new session's `access_level`: `full→couple`, `financial→financial`, `view_only→view_only`, and **both `planning` and `website` collapse onto `planning`**. If a coordinator or the couple later changes that participant's `permission_level`, nothing updates the `access_level` already stamped onto their session — the two values can diverge permanently after the first accept, with no resync mechanism.
2. **(b) is reconciled with (a), but only inside task-reading RPCs, and each one reimplements the lookup independently.** `get_portal_tasks` and three other Planning/task RPCs each contain their own copy of an "effective role" resolution (`if session.contact_id then look up client_contacts.portal_role else use access_level`) — there is no shared helper function or trigger; the same logic exists in at least four places, separately maintained.
3. **Most other write RPCs check only (a) — and one common guard checks for a value that cannot occur.** Guest-adding RPCs (`add_couple_guest`, `batch_add_couple_guests`) block when `access_level = 'financial' or access_level = 'reminders_only'` — but `access_level`'s own CHECK constraint never permits `'reminders_only'` to be stored there; that value only exists in vocabulary (b). Half of this guard can never fire. A session created for a contact whose `portal_role` is `reminders_only` (vocabulary b) is not actually blocked from adding or importing guests through these RPCs at all, because they never look up `contact_id`/`portal_role` in the first place.
4. **Budget RPCs check neither vocabulary** (§9) — any valid token, any access level or role, can write budget data.
5. **The frontend enforces none of the three.** `PortalContext` does not carry `portal_role` or `permission_level` at all, and a direct search of `portal-shell.tsx` for `accessLevel` returns zero matches — `NAV_ITEMS` renders all seventeen sections unconditionally regardless of session type.

**Conflict, stated plainly:** there is no single point in this system — no shared function, no trigger, no middleware — that answers "what can this session do" once, consistently, for every write path. Three typed vocabularies exist; they are read independently, inconsistently, or not at all, by different code paths that each made their own local decision about which (if any) to check.

---

## 15. Sharing Model

Five distinct sharing/access-granting mechanisms coexist today:

1. **Primary client invitation** (Client Identity Foundation) — the venue invites the client's own account (`client_invitations`); the venue may invite, resend, or revoke; the venue cannot create, view, or use the client's session directly once accepted.
2. **Delegate self-invitation** (`couple_portal_participants`, completed by Client Identity Foundation) — the *couple*, not the venue, invites a Parent/Planner/Partner/etc. with a chosen `permission_level`; that person creates their own account and gets their own session.
3. **Delegate venue-invitation** (`client_contacts` / `sendContactPortalInvite`, pre-existing, untouched) — a second, parallel mechanism by which the *venue* invites a contact directly, minting a bare `client_portal_sessions` row (no account) tied to that contact's `portal_role`. This coexists with mechanism (2) — two different systems can each produce "a delegate with portal access" for the same booking, one venue-initiated and bare-token, one couple-initiated and account-owned, governed by two of the three vocabularies in §14.
4. **Temporary support access** (Client Identity Foundation) — the couple grants the venue a time-boxed, audited window; expires automatically; every use logged. This is the only sharing mechanism in this list where the couple is the grantor and the venue is the sole recipient.
5. **Content-level sharing flags** — `couple_documents.share_with_venue`, `contracts.is_couple_visible`/`invoices.is_couple_visible` — govern visibility of individual records rather than of the workspace as a whole.

**Conflict:** mechanisms (2) and (3) are not the same system and are not reconciled. A venue coordinator using `client_contacts` to invite "Jane's mother" produces a bare-token session with a `portal_role`; the couple using their own People tab to invite the same person produces an account-owned session with a `permission_level`. Nothing prevents both existing simultaneously for the same real person, and nothing in either system is aware of the other.

**Conflict:** mechanism (4)'s stated purpose — that consented, audited access is the sanctioned way a venue views a couple's workspace — is undercut by the standing exception in `event-task-list.tsx` noted in §5, which reaches the workspace by mechanism (0): a plain, unaudited link, predating all of the above.

---

## 16. Dashboard

The Overview/Home tab (`OverviewSection`, the default landing section) blends genuinely computed data with static, hardcoded content keyed only by a coarse time-to-wedding bucket (`bracket`, one of six values derived from days-until-wedding).

**Real, computed data:** days-until-wedding; guest stats (from a live `/api/portal/guests` fetch); a readiness score derived from Planning task completion; recent activity (a 7-day rolling aggregate of guest additions, completed todos, journal entries, media uploads, via `get_recent_activity`).

**Static, bracket-keyed copy tables**, none reading any database value beyond which of the six brackets applies: `NextBigMomentCard`, `MostCouplesCard`, `ComingUpCard`, `InspirationCard` — all four are entirely hardcoded editorial content selected by time-until-wedding alone (with one exception: `NextBigMomentCard` also checks whether the guest total is zero).

**Conflict:** `WeddingJourneySection`'s milestone-completion map hardcodes two of its five milestones regardless of actual state — `venue: true` always, and `website: false` always (it never checks `couple_websites.is_published`) — alongside two genuinely computed ones (`guests`, `rsvps`) and one more permanently-false placeholder (`invitations`, which has no backing data source at all). A couple who has published their wedding website will still see "Website published" marked incomplete on their own dashboard.

**Conflict:** `todoCount` (feeding both the Overview snapshot and the journey milestone) is initialized to `0` and is only ever updated by the Plans tab reporting its own count back up once visited — it is not fetched eagerly alongside guest stats and profile on initial page load. A couple with existing to-dos who lands on Overview without having visited Plans yet in that session sees an undercounted (zero) planning-items figure.

---

## 17. Future Expansion

Named as areas consistent with the architecture above that are not built, or only partially built — not a roadmap, not a proposed solution:

- **A Wedding Workspace surface for the Request Framework** (§13) — currently the single largest gap between what exists and what the framework's own stated purpose describes.
- **A single, enforced privacy/access-level model** replacing the three independent vocabularies in §14, applied consistently across every write RPC rather than checked ad hoc (or not at all) per route.
- **Reconciling the two delegate-invitation systems** (§15, mechanisms 2 and 3) into one.
- **Retiring the standing unaudited venue-to-portal links** (`event-task-list.tsx`'s "View Client Portal" button being the one confirmed still standing) in favor of the consented support-access mechanism Client Identity Foundation built to replace them.
- **Deciding, one way or the other, whether Guest and Budget data are actually meant to be venue-readable** — the RLS grants already exist; the product intent they contradict has not been revisited since they were introduced.
- **A relationship between Seating (Client-Owned) and Floor Plans (Venue-Owned)** — two systems describing the same room with no connection between them.
- **A unified Messaging model**, resolving the two-schema fork so the Wedding Workspace's Messages tab and the venue's chosen inbox experience are the same conversation by construction, not by coincidence of which schema each happens to read.
- **Hashing the wedding-website password** and removing it from the public URL's query string.
- **A Wedding Workspace `NAV_ITEMS` entry for Documents**, already fully built and merely unreachable.
- **Wiring the dashboard's hardcoded milestones** (`website`, `invitations`) to real data, and fetching `todoCount` eagerly alongside the other Overview data.

---

*End of document. No implementation, migration plan, or code is proposed — see task scope.*
