# Client Workspace / Collaboration — Current Architecture & Conflict Inventory

**Status:** Documentation only. No code, schema, or navigation changed as part of this task.
**Purpose:** Record what exists today across the Venue Workspace and the Client Portal, where the two already touch, and every conflict a future Client Workspace / collaboration implementation will have to resolve. This document does not propose a target architecture, a migration plan, or a fix for anything listed below — it is a ground-truth snapshot plus a punch list of friction points.

---

## 0. Systems in scope (terminology)

Four structurally distinct systems exist in this codebase today. Getting them confused with each other is itself one of the risks this document exists to head off:

| System | Route root | Who it's for | Auth model |
|---|---|---|---|
| **Venue Workspace** | `app/(app)/...` | Venue staff (owner/manager/coordinator/staff) | Supabase Auth session, `venue_staff` row |
| **Client Portal** | `app/(portal)/p/[token]` | The couple (and anyone else holding the link) | Bearer token in the URL (`client_portal_sessions.access_token`) — **no login, no password, no account** |
| **Vendor Portal** | `app/vendor/...` | Outside wedding vendors (caterers, florists, DJs — businesses, not the couple) | Supabase Auth session, `vendor_users` row |
| **Guest-facing surfaces** | `/rsvp/[token]`, `/w/[slug]` | The couple's own wedding guests | Per-guest `rsvp_token`, or a public/optionally-password-gated website slug — no login |

This document is about the first two (Venue Workspace ↔ Client Portal) and where they intersect. The Vendor Portal and guest-facing surfaces are noted only where they share data with the Client Portal (they do, in one place: the Timeline — see §3).

Two further single-purpose, token-gated links exist that are **not part of the Client Portal shell** at all (no nav, no session, reachable only via a one-off emailed link): `app/questionnaire/[key]` (final-details intake form) and `app/sign/[token]` (contract e-signature). `app/form/[key]` is a public lead-intake form (pre-client, embed-key gated) and `app/join` is venue **staff** invitation acceptance — neither belongs to this inventory at all, included here only to rule them out explicitly.

---

## 1. What currently belongs to the Venue Workspace

Everything under `app/(app)/...`, run by an authenticated staff session:

- **Pipeline**: Leads (`lib/leads/`), Pipeline Templates
- **Bookings**: Clients (`lib/clients/`), Events (`lib/events/`)
- **Planning**: Playbooks/Tasks (`lib/playbooks/`), Timeline editor (`lib/timeline/`, `components/events/timeline/`)
- **Floor Plans**: booking floor plans (`lib/floor-plans/`) and the Floor Plan Template Library (`lib/floor-plan-templates/`)
- **Inventory**: reusable physical inventory catalog (`lib/inventory/`)
- **Vendors**: the venue's own vendor CRM/directory, assignments, and recommendations (`lib/vendors/`, `lib/vendor-recommendations/`)
- **Documents**: the venue's own document library (`lib/documents/`)
- **Contracts, Invoices/Payments**: authoring and lifecycle management (`lib/contracts/`, `lib/invoices/`)
- **Communication**: the venue Inbox (`app/(app)/messaging/`, `lib/conversations/`), Message Templates, Automations/Series (`lib/message-sequences/`)
- **Team/Settings**: staff roster (`lib/team/`), venue settings, notifications engine (`lib/notifications/`)
- **Portal administration**: creating, labeling, and revoking a client's portal link (`lib/portal/service.ts`'s `createPortalSession`/`revokePortalSession`, `components/portal/portal-link-widget.tsx`) — this administrative capability lives entirely in the Venue Workspace even though its subject (the couple's access) is the Client Portal.
- **Analytics/Insights, Operations** — venue-wide reporting, not tied to any one booking.

---

## 2. What currently belongs to the Client Portal

Per `components/portal/portal-shell.tsx`'s own `NAV_ITEMS`, sections are already grouped by the code itself into two labeled groups, `"yours"` and `"venue"` — the file's own top-of-file comment states the governing intent directly: *"The client portal is not the venue portal filtered for the couple."*

**Group: "yours" (couple-owned, no Venue Workspace equivalent at all)**

| Section | Nature |
|---|---|
| Overview/Home | Read-only dashboard |
| Guests | Full CRUD — the couple's own guest list, add/edit/delete, CSV import, RSVP question builder |
| Plans (Todos) | Full CRUD — personal to-do list, independent of venue Playbook tasks |
| Budget | Full CRUD — categories, contributors, amounts |
| Seating | Full drag-and-drop seating chart editor |
| Website | Full self-serve wedding-website builder (theme, story, photos, publish) |
| Our Story | Edit profile fields, photo uploads |
| Journey | Journal entries, milestone tracking |
| People | Invite/manage additional participants (parents, MOH, planner) with their own permission levels |
| Ask Luv | AI assistant chat |

**Group: "venue" (shared with, or fed by, the Venue Workspace)**

| Section | Nature |
|---|---|
| Venue Guide | Read-only (parking, FAQs, policies — venue-authored) |
| Tasks | Mixed — `client_visible` tasks read-only, `client_owned` tasks completable by the couple |
| Timeline | Mixed — read-only unless a row is `client_editable`, or a section is `clientCanAdd` |
| Vendors | Couple views venue-curated recommendations, can select one |
| Payments | Read-only — no online payment; footer defers to Messages |
| Messages | Full two-way chat with the venue |

**Present but not in the nav list:** Documents (`CoupleDocumentsSection`) — a valid `PortalSection` and rendered by the shell's switch statement, but has no `NAV_ITEMS` entry, so it has no visible tab today. It shows venue-shared contracts/invoices (status-only, no download) and `couple_documents` (couple-uploaded, optionally shared back to the venue).

Default landing section: `overview`.

---

## 3. Where the two currently overlap

1. **Timeline** — a single table, `timeline_entries`, is read and written by three different surfaces: the Venue Workspace's Booking Timeline editor (full read/write, all rows), the Client Portal's Timeline tab (rows tagged `couple` in `audiences`, editable only if also `client_editable`), and the public wedding website's guest schedule (rows tagged `guest` in `audiences`). One row can carry any combination of `internal`/`couple`/`guest`/`vendor`/`public` tags at once. `TimelineSection.clientCanAdd` additionally lets the couple insert new rows into a venue-opted-in section from the Portal.

2. **Messaging** — `couple_threads`/`couple_messages` (the original, purpose-built bidirectional chat schema) is read/written by both the Venue Workspace's `LegacyMessagingInbox` (when `conversationExperienceEnabled = false`) and the Client Portal's Messages tab (`PortalMessageSection`, unconditionally, regardless of the venue's flag). A newer, parallel schema (`conversations`/`conversation_messages`) backs the venue's new `ConversationInbox` (when the flag is `true`) and models `"portal"` as one of its mergeable channels, with a documented backfill/sync path from the old tables — but portal-side bridge functions that exist for it (`getPortalConversation`, `sendPortalConversationMessage` in `lib/conversations/service.ts`) are not called from any portal route or component.

3. **Vendors** — the Venue Workspace creates an `EventVendorRecommendation` (`components/events/vendors/event-vendor-recommendations-section.tsx`); the Client Portal displays it and lets the couple select one (`components/portal/vendor-section.tsx`, `select_event_vendor_recommendation` RPC); the selection is visible to the venue immediately. One shared record, asymmetric actions on each side.

4. **Documents / Contracts / Invoices** — `contracts.is_couple_visible` and `invoices.is_couple_visible` (both boolean, default `true`) gate what the Portal's `get_couple_documents` RPC includes. `couple_documents` is a separate table the couple can upload to and optionally flag `share_with_venue`. The Venue Workspace's own general-purpose `documents` table has no relationship to any of this — it is not read by any portal route.

5. **Portal session administration** — the Venue Workspace holds exclusive create/label/revoke control over `client_portal_sessions` (the primary couple link). The Portal's own "People" tab lets the couple invite secondary participants with their own access — a self-service delegation mechanism, but distinct from, and not a substitute for, control over the primary session itself.

6. **Notifications** — the Venue Workspace's automated notification engine (`lib/notifications/`) emails the couple links back into their own Portal (`/p/{token}`) as part of reminder workflows. The trigger and templates are entirely venue-side; the destination is entirely client-side.

7. **Playbooks/Tasks** — a Planning task can be marked `client_visible` or `client_owned`; the Venue Workspace authors and tracks it, the Portal's Tasks tab displays or allows completion of it depending on that flag.

---

## 4. Where the venue currently has access/control that is, conceptually, about the client's own data or decisions

- **Portal link lifecycle** — creation, labeling, and revocation of the couple's primary access link is 100% venue-initiated and venue-controlled (`portal-link-widget.tsx`'s confirm-to-revoke copy: *"The couple will no longer be able to access their workspace until a new link is created"*). The couple has no equivalent control over their own primary session — they cannot revoke or rotate it themselves.
- **Contract/Invoice visibility** — `is_couple_visible` exists as a column but is set by no UI on either side; its default (`true`) is the de facto, invisible venue posture. Neither party currently makes an explicit visibility decision here — it happens by omission.
- **Floor Plans client access** — `floor_plans.client_access` (`'edit' | 'view' | 'hidden'`, default `'hidden'`) is a per-floor-plan control that, per its own type-file comment, is meant to let "a client see/edit" a floor plan — i.e., a venue-set permission over something that is arguably about the couple's own event layout. Entirely unread/unwritten outside `lib/floor-plans/`.
- **Vendor reviews visibility** — `vendor_reviews.is_public` is toggled exclusively in the Venue Workspace (`components/vendors/vendor-reviews.tsx`, labeled *"Private — not shown to clients"*) but has no reader anywhere in the Portal — the couple can neither see nor influence which reviews are marked visible to them.
- **The inverse/contrast case, worth noting directly**: `couple_guests` is the one place client ownership is already structurally enforced — its own migration comment states plainly that "the venue does NOT see individual records," only the aggregate `events.guest_count`. This is the existing precedent for what an enforced client-ownership boundary looks like in this codebase; nothing else currently matches it.

---

## 5. Where client-owned and venue-owned features are currently mixed on the same surface or record

- **Timeline** (again, from a different angle): one table serves venue authorship, client editing, and public guest publishing simultaneously via a single tag array on each row. There is no structural separation between "the venue's schedule," "the client's schedule," and "the guest's schedule" — they are views over one shared set of rows, distinguished only by which tags happen to be present.
- **Messaging**: bidirectional-by-design (appropriate for a collaboration feature), but currently forked across two schemas depending on a venue-only flag the couple has no visibility into. The couple's experience of "the conversation" does not change based on that flag; the venue's does — so the same relationship can be represented by two different underlying data models depending on a setting the client can't see.
- **Vendor recommendation/selection**: one record, `EventVendorRecommendation`, carries both the venue's "here's an option" action and the couple's "I choose this one" action — a legitimate shared object, but the transition between those two states (and who can undo which part) exists only in code comments, not in any documented state model.
- **Documents**: `couple_documents` blends venue-shared files and couple-uploaded files in one undifferentiated portal list, distinguished only by origin/`share_with_venue`, not by a first-class ownership field.

---

## 6. Every place visibility/ownership is currently fixed, where it is partly, fully, or not-at-all configurable

| Feature | Configurable today? | Evidence |
|---|---|---|
| Timeline entry/section visibility (`audiences`, `client_editable`, `clientCanAdd`) | **Yes — the one fully-built, fine-grained model in the codebase.** Per-row, per-section, toggled from the Booking Timeline editor. | `components/events/timeline/timeline-view.tsx`, `timeline-entry-form.tsx` |
| Contract/Invoice client visibility (`is_couple_visible`) | Schema allows it (boolean column); **no UI on either side sets it.** Fixed at `true` in practice. | migration `20260703140000`; zero app-layer references outside it |
| Floor Plan client access (`client_access` enum) | Schema allows a three-state model (edit/view/hidden); **entirely unbuilt.** Fixed at `'hidden'` forever until code is written. | `lib/floor-plans/types.ts`, `repository.ts` only |
| Vendor review public visibility (`is_public`) | Configurable in the Venue Workspace; **the "public" state has no consumer** — the Portal never reads it, so the configuration currently has no observable client-side effect. | `components/vendors/vendor-reviews.tsx`; no portal references found |
| Portal session `access_level`/`portal_role` (`couple`/`planning`/`financial`/`view_only`, plus contacts' own role vocabulary) | Schema supports multiple tiers and every portal RPC gates behavior on it; **no confirmed Venue Workspace UI lets a coordinator choose anything other than the default `"couple"` level when creating the primary session.** Secondary "Our People" contacts may have their own picker (`OurPeopleSection`) — this needs direct confirmation before being relied on, since the two flows (primary session vs. contact invite) were not confirmed to share one UI. | `lib/portal/service.ts` `createPortalSession(... accessLevel = "couple")`; contacts flow in `lib/contacts/service.ts` |
| Wedding website "publish" (`is_published`) and schedule live-sync (`schedule_sync`) | Binary only, couple-controlled from the Portal's Website Studio. No per-guest or per-section granularity beyond the Timeline's own `audiences` tag. | `app/api/portal/website/route.ts`, `components/portal/website-editor.tsx` |
| Portal Documents visibility | No per-item hide/unshare control was found beyond the three-source union itself (contracts/invoices via `is_couple_visible`, `couple_documents` via origin/share flag) — whether a venue can "unshare" an already-shared `couple_documents` row was not confirmed. | `app/api/portal/documents/route.ts` |

---

## 7. Every place the venue currently reaches directly into the client experience

- **`components/portal/portal-link-widget.tsx`** (the "Wedding Workspace" card on a Client record) — an "Open portal in new tab" button that does `window.open(portalUrl(accessToken))`, i.e. opens the exact URL the couple uses.
- **`components/clients/booking-celebration.tsx`** — an "Open Client Portal" button, same pattern, shown immediately after booking.
- **`components/playbooks/event-task-list.tsx`** — a "View Client Portal" button shown once a client-facing Playbook task has been released, same pattern.
- **`lib/notifications/templates.ts`** — automated reminder emails link the couple to the same `/p/{token}` URL (not venue-side access, but confirms there is exactly one URL/identity for "the client," not a distinguishable venue-view-of-client vs. client's-own-view).
- **The structural fact underlying all of the above**: there is no login, password, or account distinguishing "the couple" from "whoever holds the link." The token *is* the identity. When a coordinator clicks any of the buttons above, they are not impersonating a separate client account through some elevated/audited access path — there is no separate account to impersonate. This is a fact about the current architecture, not a gap in one feature.
- **Session administration itself is one-directional**: `getPortalSessions`/`createPortalSession`/`revokePortalSession` are venue-authenticated-only actions. The client cannot list, audit, or revoke their own sessions from inside their own Portal.

---

## 8. Feature-by-feature categorization, as currently implemented

This reflects how the current code already treats each feature (who can act on it, where the record lives) — not a recommendation. Entries marked **Ambiguous** are ones the current implementation does not cleanly resolve one way or the other.

| Feature | Current de facto category | Basis |
|---|---|---|
| Leads / Pipeline | Venue Only | No portal exposure exists; leads predate any client relationship |
| Bookings/Clients record, Events | Venue Only (admin) | Managed entirely in Venue Workspace; the *portal session* derived from it is the client-facing artifact |
| Timeline | **Shared Collaboration** | Already tri-audience (`internal`/`couple`/`guest`), fully wired end-to-end on all three surfaces |
| Floor Plans (booking) | Venue Only today; schema anticipates Shared | `client_access` column reserved, unbuilt |
| Floor Plan Templates | Venue Only | No portal surface, no reserved column either |
| Inventory | Venue Only | No portal surface, no reserved column |
| Playbooks / Tasks | **Shared Collaboration** | `client_visible`/`client_owned` flags wired to the Portal's Tasks tab |
| Vendors — CRM/directory | Venue Only | The venue's own vendor roster and assignments |
| Vendors — recommendations | **Shared Collaboration** | Venue proposes, couple selects, both sides see the same record |
| Vendor Portal (business vendors) | **Separate system entirely** | Different people (vendors, not couples), different auth (real login) |
| Documents (venue's own library) | Venue Only | No bridge to the Portal at all |
| Documents — `couple_documents` | **Shared Collaboration** | Bidirectional by design |
| Contracts | Venue-authored; **Ambiguous** client action | Signing happens via a separate, session-less token flow (`/sign/[token]`), not from inside the Portal; visibility flag unwired |
| Invoices / Payments | Venue Only (create/manage); Client Only (view) | Read-only in the Portal, explicitly deflects to Messages for anything actionable — no online payment exists today |
| Communication | **Shared Collaboration**, but forked | Two parallel implementations depending on a venue-only flag the client can't see (§5) |
| Guests (couple's wedding guest list) | Client Only | Explicitly excluded from venue visibility at the schema level |
| Wedding Website | Client Only (authoring); guest-facing (output) | No Venue Workspace UI touches it at all |
| Budget, Seating, Todos, Our Story, Journey, People | Client Only | No Venue Workspace equivalent or visibility found anywhere |
| Ask Luv | Client Only | Portal-side AI assistant, no venue-side counterpart |
| Questionnaire | **Ambiguous** | Shared by function (venue sends, client completes) but structurally outside the Portal (separate one-time link, not a Portal tab) |
| Notifications engine | Venue Only (tool); output touches the client | Entirely venue-configured; the couple only ever receives its output |
| Portal session administration | Venue Only | No client-side equivalent for the primary session (§4, §7) |

---

## 9. Conflicts this creates for any future implementation

1. **Two parallel messaging schemas, one silent switch.** `couple_threads`/`couple_messages` vs. `conversations`/`conversation_messages`, bridged by dead code (`getPortalConversation`, `sendPortalConversationMessage` are defined, never called). Any collaboration work on messaging has to decide whether both are still live, which one the Portal should read going forward, and what happens to history already split across them.

2. **`conversationExperienceEnabled` has zero effect on the Portal.** A venue can be fully migrated to the new Conversations experience while every one of its couples is still transacting through the legacy thread tables in their Portal Messages tab, with no shared toggle and no way for either side to detect the mismatch from the UI.

3. **There is no client account, only a bearer token.** Any future model of "the client logs in and sees permissions scoped to them" runs directly into the fact that today, possessing the URL *is* being the client — indistinguishable from a coordinator who also has that URL. Introducing real client authentication would be a breaking change to the token-link distribution and notification system as currently built; not introducing it means any permission model has to be built entirely on top of token possession.

4. **The access-tier schema may be unreachable in practice.** `access_level`/`portal_role` supports `couple`/`planning`/`financial`/`view_only` and every portal RPC already gates on it, but no confirmed primary-session UI lets a coordinator choose anything but the default. A future implementation has to reconcile "the schema already supports granular roles" with "the creation flow may only ever produce one of them."

5. **Reserved-but-dead client-facing columns already exist in at least three places** (`floor_plans.client_access`, `vendor_reviews.is_public` with respect to the Portal, `contracts`/`invoices.is_couple_visible`). A future implementation must decide whether to build on top of these specific pre-existing columns (which may reflect stale assumptions) or replace them.

6. **The Timeline's audience model already conflates three concerns on one field.** `audiences` on `timeline_entries` simultaneously encodes "show this to the coordinator," "show this to the couple in their Portal," and "show this to wedding guests on the public website." Any future separation of Client-Workspace concerns from Guest-facing concerns has to either keep overloading this one array (continuing the conflation) or split it — and a split touches three consumers at once: the Booking Timeline editor, the Portal Timeline tab, and the public wedding website.

7. **Vendor "recommendation" and vendor "assignment" are two different objects that look similar.** `EventVendorRecommendation` (client-facing, Shared) and `event_vendor_assignments`/`EventVendorAssignment` (operational, Venue Only) coexist on the same event. Future work on "client-facing vendor collaboration" has to keep these straight rather than assuming one record type.

8. **"Documents" is at least three unrelated tables wearing one name.** The Venue Workspace's own `documents` table, the Portal's `couple_documents` table, and contracts/invoices unioned in as pseudo-documents (Portal-only, view-only) do not share a model. There is no single "Documents" concept spanning both systems today.

9. **The Portal session model is single-event, not multi-booking.** A `client_portal_sessions` row grants access to one `client_id` and, functionally, whichever event is earliest and non-cancelled for that client. A client with multiple bookings only ever gets Portal access to the earliest one. Any Client Workspace notion of "a client manages several events/bookings from one place" conflicts with this at the schema level.

10. **No client-side session audit or self-revocation exists.** The couple cannot see who else holds a link to their own Portal, cannot revoke a stale link, and cannot tell whether the venue itself has opened their view. A collaboration model that assumes the client can manage their own sharing/access conflicts with this capability currently existing only on the venue side (§4, §7).

11. **Payments collaboration would be a net-new capability, not an adjustment.** The Portal is view-only today with an explicit deflection to Messages for anything actionable. There is no partial online-payment flow to extend — "Shared Collaboration" on Payments starts from zero.

12. **Floor Plans collaboration and Timeline collaboration are at opposite ends of readiness.** Floor Plans has no Portal presence at all today, despite a reserved `client_access` column already anticipating the gap — a from-scratch build. Timeline collaboration is the opposite case: fully built across three consumers, and any change has to be made carefully against something already load-bearing rather than built new.

---

*End of inventory. No recommendations, target architecture, or migration plan are included by design — see task scope.*
