# Client Collaboration Workspace — Architectural Assessment

**Status: Assessment + architecture proposal + explicit mapping. No implementation. No navigation or page changes made.**

**Date:** 2026-07-22

**Directive this responds to:** the Couple Portal has drifted from the platform built over the past year and needs to be reconciled against it, not preserved as-is. The portal is not a consumer wedding planner — it exists because the venue purchased Hello to Cheers, and its job is to answer, every time a couple logs in: *"What does my venue need me to know, review, complete, approve, upload, sign, pay, or discuss today?"*

**Method:** six parallel research passes across the codebase, each independently grounded in file:line citations — not memory, not assumption. Every claim below traces to real code. Where a research pass found ambiguity or a stale/contradictory comment, that's reported as found, not resolved by guessing.

---

# Part 1 — Capability Matrix

Pure audit. No design opinions in this section — those are reserved for Part 2/3. For every capability: does it exist, is it couple-visible, how, and is anything duplicated or disconnected.

**Current portal nav baseline** (`components/portal/portal-shell.tsx:4031-4048`, `NAV_ITEMS`), 18 entries in two groups:
- **`"yours"`** (couple-owned): Home, Guests, Plans, Budget, Seating, Website, Our Story, Journey, People, Ask Luv, Account
- **`"venue"`** (venue-shared): Requests, Venue Guide, Tasks, Timeline, Vendors, Payments, Messages

A 19th surface, **Documents**, is a real `PortalSection` with a live renderer but **has no nav entry at all** — reachable only by manually setting the `#documents` hash. This is the single most consequential finding in this audit and recurs throughout Part 1.

## A. Venue Collaboration — Financial & Legal

| Capability | Exists (venue-side) | Portal-visible | Read/write | Prominence | Duplicate/disconnect |
|---|---|---|---|---|---|
| **Conversations** | Y — `lib/conversations/*` | Y — `components/portal/message-section.tsx`, `app/api/portal/messages/route.ts` | Read-write | Own nav item ("Messages") | Legacy `couple_threads`/`couple_messages` tables still exist, read by a confirmed-dead `app/(app)/messaging/legacy-inbox.tsx` ("COMPATIBILITY-ONLY... not wired into any live route"). Live route adapts new data into the old shape as a shim. |
| **Shared Documents** | Y — `lib/documents/*` (`Document`, category incl. `contract`) | **Y but architecturally separate and orphaned.** Portal reads a *different* table, `couple_documents`, via RPC `get_couple_documents` — never queries the venue's real `documents` table at all. | Read-write (own uploads) | **No nav entry.** Reachable only via `#documents` hash or a deep link from Requests. | Two parallel schemas: `Document` (venue) vs `CoupleDocument` (portal), different category taxonomies, zero reconciliation. |
| **Attachments** | Y — `ConversationMessageAttachment`, `MessageAttachment` | Y, embedded in Messages and Documents | Read-write | Rides inside Messages (prominent) and Documents (orphaned) | None beyond the above |
| **Contracts** | Y — `lib/contracts/*`, full CRUD/templates/send | **Y in theory, unusable in practice.** Appears only as an inert summary row (status + signedAt, `fileUrl: null` — not openable) inside the orphaned `get_couple_documents` union. | Read-only | **None** — no nav entry, buried inside the unreachable Documents tab, and even there a couple cannot open/read the actual contract text | `contracts.is_couple_visible` defaults to `false` and is gated on send status (fixed from an earlier default-`true` leak, `20261028000000_...publication_gate.sql`) |
| **E-signatures** | Y — `sign_token` on Contract, public page `app/sign/[token]/*`, `sign_contract()` RPC | **Not found anywhere inside the portal.** The sign link is emailed directly (`${baseUrl}/sign/${signToken}`) and is completely independent of `client_portal_sessions` — a couple who's logged into their portal has no record there that a contract is waiting for their signature. | N/A | None inside portal | Deliberate, documented as a standalone public-link flow — not a bug, but a real gap under the new philosophy ("what do I need to sign today" is unanswerable from inside the portal) |
| **Invoices** | Y — `lib/invoices/*`, line items, Event Order projection/freeze, QuickBooks sync | Same as Contracts — one inert summary row (name, total, `fileUrl: null`) inside the orphaned Documents union. No line-item/tax/discount breakdown ever shown. | Read-only | None | Same publication-gate history as Contracts |
| **Payment Plans** | Y — `PaymentSchedule`/`PaymentLineItem`, always tied to an Invoice | Y — this **is** what the "Payments" tab renders (`components/portal/payment-section.tsx`, RPC `get_portal_payments`) | Read-only for the schedule itself | Own nav item ("Payments") — the one financial capability that's fully, prominently wired | None — real data, real RPC |
| **Payments** | Y — Stripe integration, webhook-confirmed status lifecycle | Y — `PayNowButton` → real Stripe Hosted Checkout (`/api/portal/checkout`) | Effectively read-write (couple triggers a real charge; mutation lands via webhook) | Same "Payments" tab | None |
| **Receipts** | **Not found as its own domain.** No `Receipt` type, no stored receipt URL. | Not found. | N/A | N/A | Deliberate, documented design: delivered as (a) a system message inside the Conversation thread, and (b) Stripe's own emailed receipt — never a first-class in-app artifact (`lib/stripe/notify.ts`, decision §6.4 cited in code). |

**Standout finding:** Contracts and Invoices — two of the highest-stakes documents in the entire relationship — are both currently unreachable in the live product for a couple who hasn't been sent a direct email link. The nav item that would surface them (`Documents`) does not exist.

## B. Venue Collaboration — Planning

| Capability | Exists (venue-side) | Portal-visible | Read/write | Prominence | Duplicate/disconnect |
|---|---|---|---|---|---|
| **Questionnaire** | Y — `lib/events/questionnaire.ts` | **Y, but entirely outside the portal shell.** Standalone tokenized page `app/questionnaire/[key]/page.tsx` — same shape as `/sign`, `/rsvp`, structurally unrelated to `client_portal_sessions`. | Read-write (standalone) | None inside the portal — no nav item, no record of "you have a questionnaire waiting" once logged in | Not a duplicate, but disconnected from the portal a couple actually lives in |
| **Venue Requests** | Y — `lib/requests/*`, explicitly "a reusable capability... intentionally generic" | Y — own nav item ("Requests") + a summary card on Home | Read-write to respond (couple cannot initiate a Request) | Own nav item, real RPCs, well-architected | None — deliberately routes "Open Related Item" back to the *originating* feature rather than re-rendering it (a good pattern) |
| **Approvals** | Y — folded into Requests as `RequestType: "approval"`, no separate module | Y, via the same Requests section, with real Approve/Reject buttons | Read-write | **Not its own nav item** — only reachable by opening a request that happens to be approval-type | None |
| **Timeline collaboration** | Y — `lib/timeline/*`, owner/lock/audience model | Y — own nav item ("Timeline") | Mixed by design: venue's structural framework read-only, couple's own draft items fully editable until Submit | Own nav item — **one of the best-architected systems in this audit** | None — single shared data model, clean ownership rules, well commented |
| **Planning Playbooks** | Y — `lib/playbooks/*`, `PlaybookKind: "client" \| "venue"` | **Partial, and never named as such.** The couple only ever sees the realized output (individual tasks in "Tasks"), never a template/milestone/kind concept. | RO for `client_visible`, RW for `client_owned` | No dedicated nav presence — folded entirely into "Tasks" | **Real correctness gap, not just an exposure gap**: the visibility gate checks "does a released Client Planning application exist for this event," then filters tasks only on `visibility`, never on which playbook `kind` produced them. A `kind: "venue"` (internal/Venue Planning) task marked `client_visible` would surface in the couple's Tasks list indistinguishable from a genuine Client Planning task. |
| **Shared Tasks** | Y — `event_tasks`/`EventTask` | Y — own nav item ("Tasks") | Mixed (`client_visible` read-only, `client_owned` completable, both gated server-side) | Own nav item | Deliberately parallel to "Plans" (see Wedding Planning below) — two checklist surfaces, intentionally separate data, same nav bar |
| **Key Dates** | Y — `ClientKeyDate` (`lib/clients/types.ts`) | **Not found anywhere in the portal.** | N/A | N/A | The portal's Journey/Milestone widgets *look* similar but read from an entirely different, hardcoded, unrelated data source — a naming/concept collision, not the same feature |
| **Shared Notes** | Y, but explicitly staff-internal — `Client.internalNotes` | **Not found**, and correctly so — the field name and usage signal deliberate venue-only intent | N/A | N/A | None — the portal's "Our Story" journal is a different, couple-private concept, not a match |
| **Shared Files** | Only exists as Documents (see above); no separate generic "files" concept | Same orphaned-nav-entry situation as Documents | Read-write | No nav entry | `ClientMedia` (website photos) and `CoupleDocument` (contracts/uploads) are two separate file paths for distinct purposes — not itself a drift bug |

## C. Venue Information

| Capability | Exists (venue-side) | Portal-visible | Read/write | Prominence | Duplicate/disconnect |
|---|---|---|---|---|---|
| **Venue Guide (container)** | Y — `venue_operational_info` table, 10 fields | Y — own nav item ("Venue Guide"), all 10 fields verified rendered, none silently dropped | Read-only | Own nav item | None |
| **Policies** | Y (`policies` field) | Y — sub-section of Venue Guide | Read-only | Sub-section | None |
| **FAQ** | Y (`faqs` jsonb) | Y — sub-section, with search | Read-only | Sub-section | Same source also feeds "Ask Luv" and the separate guest-facing (non-couple) concierge — no divergence risk there |
| **Parking / Directions** | Y (`parking_info`, `transportation` — no separate "Directions" field, folded into transportation) | Y — sub-section | Read-only | Sub-section | **Real drift risk**: the couple's own Wedding Website has a separate "Travel & Hotels" section that only *suggests* from this data via a one-click, non-live "Fill from venue details" button — never re-synced after. If the venue edits parking/transportation later, the two copies silently diverge with no notification. |
| **Venue Contacts** | Y, but as a manually-typed JSON blob (`important_contacts`) — **not** linked to the real `venue_staff` roster | Y — sub-section, last item, buried | Read-only | Buried sub-section, no standalone surface | Two "who works here" sources (`important_contacts` vs. `venue_staff`) that are never reconciled. Compounding this: Messages shows every venue-side sender collapsed to the generic label `"venue"` — nowhere does the couple see their actual coordinator's name. |
| **Office Hours** | Y — `venue_business_hours` | **Not found.** Zero portal surface. | N/A | N/A | A second, independent table (`tour_availability_windows`) was built specifically because tour-booking availability had been wrongly inferred from this one — explicitly documented as now "fully independent." Neither ever reaches the couple. |
| **Property Information** | Y, minimally — `venue_spaces` (name, description, capacity only; no square footage, no amenities, no photos anywhere in the schema) | **Not found.** | N/A | N/A | No couple-facing counterpart exists at all, not even partial |
| **Preferred Vendors** | Y — `preference_level` on `venue_vendor_relationships` | **Deliberately removed, not merely absent.** A prior venue-wide read-only vendor list was intentionally replaced by an event-scoped recommendation model ("Vendor Management — Next Iteration, 2026-07-10"). | Event-scoped only | "Vendors" nav item exists but shows only recommendations for this couple's event | Product decision, well documented — not a gap by accident |
| **Venue Resources** (rain plan, ceremony instructions, "things to know") | Y — 3 more `venue_operational_info` fields | Y — all three verified rendered as sub-sections | Read-only | Sub-sections | None |

## D. Wedding Planning (Couple-Owned)

| Capability | Exists | Venue-visible | Prominence | Duplicate/disconnect |
|---|---|---|---|---|
| **Guests** | Y — `couple_guests` | **RLS says partial, code says likely broken.** A venue-wide read policy was deliberately dropped in 2026-08 as "Client-Owned in name only... a bug class." But a separate, later file (`lib/guests/service.ts`, Event Readiness) still directly queries `couple_guests` with a comment claiming the now-removed policy still exists — this read path is very likely returning empty results in production today. | Own nav item | A `visibility_to_venue` opt-in column exists with zero UI wiring anywhere |
| **Seating** | Y | Y — deliberately, well-architected. A first, duplicate seating-canvas system was found and retired ("second seating canvas, second table model"); real venue visibility now flows through a purpose-built "Private Until Committed" delegation/submission model. | Own nav item | **One of the best-architected systems in this audit** — no current duplication |
| **Website** | Y | **One-way only.** Venue data flows *into* the couple's website (address, hotel blocks); nothing meaningful flows back except three passive coordinator-facing Luv notices ("isn't published yet," "missing accommodations," "just published — here's the link"). No in-app preview, no per-couple analytics for the venue, no collaboration surface at all inside `app/(app)`. | Own nav item | RLS grants for venue read exist and are actually used (unlike Guests/Budget/Plans below) — just for passive notices, not a real feature |
| **Budget** | Y — `couple_budgets` etc. | **RLS exists, zero application code uses it.** No venue-side page or component queries budget data anywhere; only a boolean "has a budget been configured" rolls into portfolio analytics. | Own nav item | **Confirmed double-entry risk**: this is a fully separate, manually-typed planning tool with no reference to the venue's real Invoices — two disconnected sources of truth for what the wedding costs |
| **Personal Notes** | N — no standalone capability; fragmented `notes` columns bolted onto Guests/Todos/Budget rows | N/A | Not a nav item | N/A |
| **Our Story** | Y — `couple_profiles.ourStory` + `couple_journal_entries` | **N, explicitly and deliberately** — code comments state "the venue has no read access... couple_profiles is entirely couple-owned" | Own nav item | **Overlaps with "Journey"** (see below) — same underlying journal data, two different nav items |
| **Inspiration** | Y, but fragmented into two disconnected surfaces: (a) a static, hardcoded Overview widget with canned seasonal copy, no real data; (b) real inspiration photos uploaded inside "Our Story" | N — hardcoded `visibility: "private"` on every upload, no toggle exposed despite the schema supporting venue-visible photos | **Not a nav item at all** | Two unrelated "Inspiration" experiences under one name |
| **Personal Plans ("Plans")** | Y — `couple_todos` | Same dead-RLS pattern as Budget — a live venue-read policy with zero application consumer | Own nav item | **Confirmed, deliberate two-system design**: "Plans" (private) and "Tasks" (venue-assigned) are two separate top-level nav items for what a couple experiences as "my checklists," with the UI itself stating the split explicitly but never cross-linking them |

## E. Vendor Collaboration

| Capability | Exists (venue-side) | Portal-visible-to-couple | Read/write | Prominence | Duplicate/disconnect |
|---|---|---|---|---|---|
| **Assigned Vendors** | Y — real operational table `event_vendor_assignments` | **The couple never sees this table at all.** The "Vendors" tab reads a completely separate table, `event_vendor_recommendations` — a curated shortlist, not the real "who's confirmed for my wedding" fact. | Read-write on the recommendation list only (pick/unpick/submit) | Own nav item ("Vendors") | Deliberate, documented split ("a recommendation is a distinct fact from an operational assignment") — but means a couple cannot answer "who's actually booked for my day" from inside their own portal |
| **Vendor Contact Info** | Y | Y, but only for recommended vendors, not confirmed/assigned ones | Read-only | Same tab | Same gap as above |
| **Vendor Documents** | Y — venue's general `documents` table, `entityType: "vendor"` (e.g. proof of insurance) | **Not found.** The couple's Documents union never queries the venue-side `documents` table at all. | N/A | N/A (and Documents itself has no nav entry regardless) | Confirmed by the codebase's own internal design-proposal doc as a known, not-yet-closed gap |
| **Vendor Messages** | Y — a distinct conversation type anchored to `event_vendor_assignment_id` on the same `conversations` table | **Architecturally unreachable**, not merely hidden — the portal's message-resolution path only ever looks up conversations by the couple's own relationship id | N/A | N/A | Clean, deliberate separation — not a legacy artifact, but worth confirming this is still the intended experience under the new philosophy |
| **Shared Floor Plans** | Y — `client_access` and `shared_with_vendors` are two independent gates on the same `floor_plans` row | Y — embedded inside the Seating tool, not a standalone surface | Read for layout, read-write for the couple's own seat assignments | Reached via "Seating," not its own nav item | Clean design — one real floor plan, two independently controllable audiences |
| **Shared Assets** | **No feature by this literal name exists.** Only a proposed, unbuilt "unified Asset model" design doc. | N/A | N/A | N/A | Flagged as an undefined/aspirational term, not a shipped capability |

## F. Hospitality / Luv

| Capability | Exists (venue-side) | Couple-portal-visible | Nature |
|---|---|---|---|
| **Luv** | Y — `lib/luv/observations.ts`, the coordinator "Notice" engine | Partial — "Ask Luv" is Q&A-only over Venue Guide content (parking, policies, FAQs); a separate module, `lib/luv/portal-observations.ts`, embeds proactive stateless nudges directly inside portal sections (Overview, Guests, Seating, Budget, Payments) — this *is* proactive Luv reaching the couple, just as inline cards, not a chat feed |
| **Daily Briefing** | **N — documentation/design only, zero shipped code.** Explicitly out of scope for actual build so far (Phase 3 of an unbuilt roadmap). | N/A | Nothing to surface yet |
| **Progress** | Y, as three unrelated concepts sharing the word: per-booking Event Readiness (coordinator), Venue Activation (Wevenu/HQ-facing SaaS-adoption score), and a third, couple-facing "% of venue tasks done" computed independently in the portal shell itself | Y — `ReadinessRing`, `WeddingSnapshotCard`, etc. | Genuine, but the label ("% of venue tasks done") reflects only venue-task completion, not the couple's own independent planning progress |
| **Milestones** | Y, again as two unrelated concepts: venue-account activation milestones (Wevenu-facing) vs. per-booking operational events | Y, via yet a third concept — `WeddingJourneySection`'s hardcoded 5-step journey and a separate couple-authored journal milestone list | Confirmed bug: the Journey section hardcodes `website: false` regardless of actual publish state — already flagged in the platform's own architecture doc as a known-wrong shortcut |
| **Celebration moments** | Y — exactly 5 approved "Commitment Lifecycle" transitions, fire-once, enforced server-side | Y — 4 of 5 fire directly in couple-facing code with first-person copy | `final_payment_received` is coordinator-only by explicit type exclusion — no couple-side toast when their own final payment lands |
| **Notifications** | Y — one shared engine (`lib/notifications/engine.ts`), `NotificationRole` includes `"couple"` | Partial — real couple-directed email sends exist (task reminders, tour reminders with portal deep links), but **no in-app notification center, bell, or feed exists anywhere in the portal.** SMS/in-app/push for the couple role is explicitly stubbed ("not yet implemented, skip gracefully"). | Email-only today |
| **Activity** | Y, but write-mostly — `engagement_events` is read back only by Wevenu/HQ's internal venue-account view, never by the couple | Y, but via a completely separate, narrow, self-referential surface — a 7-day rolling "This Week" card of the couple's *own* actions only (uploads, guest additions, completed todos, journal entries) | The couple's usage is tracked (for venue/HQ analytics) but that data is never reflected back to them in any meaningful "your activity with your venue" sense |

**Overview/Home — full inventory** (13 distinct widgets/cards, in render order): Hero (photo/countdown/story line) → Memory Strip (latest journal entry) → [Keepsake Mode or Wedding Day Mode, date-conditional] → Your Season card (narrative copy) → Planning Journey (milestone-dot progress ring) → Wedding Snapshot (2×2 stat grid) → mobile quick-tiles → **"Your venue has tasks waiting" banner (the one genuinely operational widget)** → "This Month" editorial suggestions → a single Luv observation → Next Big Moment suggestion → Wedding Journey Milestones (5-item checklist, full width, closes the page).

**Conclusion, stated plainly:** the Home page today is predominantly an editorial "your love story so far" experience — hero imagery, narrative copy, milestone journeys, memory strips. Exactly one of thirteen widgets is organized around "what does my venue need from me" — everything else is emotional framing or couple-facing planning encouragement. This is the clearest, most direct evidence in the entire audit that the current portal does not answer the question the directive states it should answer every time a couple logs in.

## G. Cross-Cutting Findings

1. **Documents has no nav entry at all**, despite being a fully-built, live-rendering `PortalSection`. This single gap is why Contracts, Invoices, and general Shared Files are all effectively invisible in the live product today.
2. **Two nav items present the same underlying data**: "Our Story" (edit) and "Journey" (read-only view) both read `couple_journal_entries` — "Journey"'s own empty state links back to "Our Story."
3. **Two nav items are deliberately parallel checklists**: "Plans" (private) and "Tasks" (venue-assigned) — intentional data separation, but presented as two competing top-level destinations with no cross-linking.
4. **A real correctness gap in task visibility**: Venue Planning tasks marked `client_visible` can leak into the couple's Tasks view unfiltered by which playbook produced them (see Planning Playbooks above) — this should be fixed regardless of any navigation decision.
5. **Two "dead RLS grant" cases** (Budget, Plans) where a venue-read policy exists at the database level with zero application code ever using it — and one "opposite" case (Guests) where a policy was deliberately removed but a service file still assumes it's there, likely silently broken.
6. **E-signature and Receipts are architecturally outside the portal by design** — not bugs, but genuine gaps against the new philosophy, since neither "sign this" nor "here's your receipt" can be answered from inside the portal today.
7. **Assigned Vendors the couple sees are recommendations, not real operational assignments** — a couple cannot answer "who's actually booked for my wedding" from their own portal.
8. **Venue Contacts is a manually-typed JSON blob**, never reconciled with the real staff roster, and Messages never reveals which real person the couple is talking to.
9. **A legacy, confirmed-dead messaging system** (`couple_threads`/`couple_messages`) still exists in the schema, read only by dead code — safe cleanup candidate, not urgent.
10. **Inspiration exists as two disconnected experiences** under one name — a static hardcoded widget and a real, private photo board.

---

# Part 2 — Proposed Architecture: The Client Collaboration Workspace

This is design, not audit. It follows directly from Part 1's findings and the stated core philosophy.

### Purpose

The workspace exists to make the venue-couple relationship easy to run from both sides, for the length of one specific engagement. It is not a tool for planning a wedding in the abstract — it is the shared operating surface for planning *this* wedding, at *this* venue, with *this* coordinator. Every capability in it either (a) moves the relationship forward — a decision, a document, a payment, a date — or (b) supports the couple in a way that makes their side of that relationship easier to hold up. Nothing in the workspace should exist purely because a consumer wedding app would have it.

### Navigation philosophy

Replace the current flat 18-item, two-group list with **three tiers**, ordered by how often a couple actually needs each one:

1. **Today** (not a nav item — the Home page itself, rebuilt as an action queue, see below).
2. **Working With Your Venue** — everything that is a live, two-way commitment: Messages, Requests & Approvals, Documents & Agreements (new — replaces the orphaned Documents tab and absorbs Contracts/Invoices/Receipts/E-signatures), Payments, Timeline, Tasks, Vendors (rebuilt to show real assignments), Venue Info (renamed from "Venue Guide" — reference material, not a daily check).
3. **Your Planning Space** — couple-owned, private-by-default, still present because it makes the relationship easier, not because it competes with Joy/Zola: Guests, Seating, Budget, Website, Our Story (absorbs Journey), To-Do (absorbs Plans, presented alongside — not instead of — venue Tasks).

Account and People stay as account-level settings, not planning content.

The philosophical shift: today's grouping (`"yours"` vs `"venue"`) is a *data-ownership* label applied to navigation. The proposed grouping is a *relationship* label — "what am I doing with my venue right now" vs. "what am I holding for myself" — which is a different, and more legible, organizing question for a couple than who technically owns the row in the database.

### Relationship model

Three concentric layers, matching how the rest of the platform already models a booking (Client → Event, per the Booking Financial Architecture work):

- **The Venue** — one identity throughout: name, brand, and now also a *real* coordinator identity (not a JSON blob) surfaced wherever the couple interacts with "the venue" (Messages, Requests, the dashboard).
- **The Engagement** — everything venue and couple do together for this one wedding: documents, payments, timeline, tasks, vendors, requests. This is where "collaboration" actually lives.
- **The Couple's Own Space** — private planning tools that exist in service of the engagement going well, held to a lower bar of venue involvement by design, but never fully walled off from the relationship (e.g., a couple should still be able to share a piece of their private planning — an inspiration photo, a seating layout — the moment they choose to, without switching mental models).

### Shared vs. private information

- **Shared by default**: anything the venue created or that requires venue action — Documents, Payments, Timeline (venue's own entries), Requests, Tasks, Venue Info.
- **Private by default, shareable by choice**: Guests, Seating (already correctly built this way — "Private Until Committed" is the right pattern), Budget, Website, Our Story, Inspiration, To-Do.
- **Never shared, by design and correctly so today**: internal staff notes (`Client.internalNotes`), any Venue Planning task not explicitly marked couple-visible.

The one correction needed to this axis: today, "shareable by choice" mostly isn't actually wired (Budget, Plans, Inspiration all have the schema for venue visibility with zero UI path to ever use it). The architecture should either build the toggle for real (Seating's delegation model is the template) or stop implying it exists.

### Venue-owned vs. couple-owned information

Venue-owned: Contracts, Invoices, Payments, Timeline structure, Tasks, Venue Info, real Vendor assignments, Requests.
Couple-owned: Guests, Seating draft, Budget, Website content, Our Story, Inspiration, To-Do.
**Jointly-owned, genuinely** (the category the current architecture doesn't name): Timeline entries the couple submits, Seating's final submitted plan, Requests once responded to. These are the moments collaboration actually produces something — worth their own visual treatment (e.g., "Submitted to your venue" states already exist for Timeline and Seating; this pattern should extend to every joint-commitment moment, including a couple's completed Questionnaire and any future e-signed Contract).

### What belongs on the dashboard (Home)

Rebuilt around the stated question, literally. A single, prioritized action queue synthesized live across every "Working With Your Venue" system: unsigned contracts, unpaid/due invoices, open Requests awaiting a response, an incomplete Questionnaire, Timeline entries awaiting submission, incomplete required Tasks. This becomes the *primary* content of Home — not a single banner among thirteen widgets.

The warmth the current Home page has (hero photo, countdown, story line, milestone journey) is real product value and should not be deleted — but it becomes secondary framing around the action queue, not the majority of the page. A couple should see "2 things need your attention" before they see a seasonal illustration.

### What belongs in navigation

Only things a couple returns to repeatedly and needs to find predictably: the 12–14 items sketched under Navigation Philosophy above. Anything that's a one-time or rare event (signing a specific contract, responding to a specific request) belongs surfaced *from* the dashboard action queue and from Documents/Requests directly, not as its own permanent nav slot.

### What should never appear

- Anything a consumer planning app would show that has no venue relevance and no support role — a general vendor marketplace, a public registry/gift-tracking product, wedding-industry content/ads, anything that competes with the venue as the source of vendor recommendations.
- Any generic "community" or social feed.
- Raw internal venue operations data (staff notes, financial margins, other couples' information) — already correctly excluded today.
- A couple's own budget numbers should never silently disagree with the venue's real invoice total on the same page without an explicit reconciliation UI — currently a live risk since both exist with zero connection.

### How this differs from consumer planning apps

A consumer app (Zola, Joy) is built to be comprehensive and venue-agnostic — every couple's single source of truth regardless of who they book with. This workspace is deliberately the opposite: it is *this venue's* side of the story, and its private planning tools exist only because a couple who's already here shouldn't have to leave to do adjacent planning work. The tell is prominence: in a consumer app, "your budget" and "your guest list" are the product. Here, "your contract," "your next payment," and "what your venue is waiting on from you" are the product, and the private tools are support cast. Every design decision in Part 2 above is a restatement of that one distinction.

---

# Part 3 — Explicit Mapping

No assumptions; every row ties back to a Part 1 finding.

### Current nav items

| Current item | Action | Why |
|---|---|---|
| Home (Overview) | **Keep, rebuild content** | Restructure around the action queue (Part 2); currently 1 of 13 widgets is operational |
| Guests | **Keep** | Well-scoped; fix the likely-broken venue-read code path (Part 1.G.5) as a defect, independent of nav |
| Plans (To-Do) | **Keep, reposition** | Present adjacent to Tasks under one "To-Do" grouping (two clearly labeled sections) rather than two separate nav clicks |
| Budget | **Keep** | Flag venue-connection (to real Invoice data) as a future enhancement, not a nav change |
| Seating | **Keep as-is** | Best-architected system in the audit; no changes needed |
| Website | **Keep** | Flag venue-side visibility (an in-app preview) as a future enhancement — couple-side nav unchanged |
| Our Story | **Merge with Journey** | Same underlying data (`couple_journal_entries`), two nav items today |
| Journey | **Merge into Our Story** | See above — becomes a "View" tab inside one section |
| People | **Keep** | Move near Account — it's an access-management setting, not planning content |
| Ask Luv | **Keep** | Still valuable; consider embedding contextually in future rather than only as a standalone tab (not a Part 3 action, flagged for later) |
| Account | **Keep** | — |
| Requests | **Keep** | Well-architected; becomes a core input to the new dashboard action queue |
| Venue Guide | **Rename → "Venue Info," reposition** | Move out of the primary daily-use tier into reference material — a couple checks parking directions occasionally, not daily |
| Tasks | **Keep, reposition** | Grouped with Plans under one "To-Do" umbrella (see above) |
| Timeline | **Keep as-is** | Second-best-architected system in the audit; no changes needed |
| Vendors | **Keep, redesign** | Rebuild to surface real confirmed/assigned vendors (`event_vendor_assignments`), not only pre-booking recommendations |
| Payments | **Keep, expand** | Absorb real Invoice detail (line items) — currently the invoice total is disconnected from what Payments actually shows |
| Messages | **Keep, enhance** | Surface the real coordinator identity (from `venue_staff`) instead of the generic "venue" label |
| **Documents** *(exists, no nav entry today)* | **Move into primary nav, rebuild** | Becomes "Documents & Agreements" — the new home for real, readable Contracts, real Invoices, Receipts, and uploads. This is the single highest-priority nav change in this whole mapping. |

### Missing capabilities

**Existing feature needing exposure** (built, working, just not reachable from the portal):
- **E-signatures** — bring the pending-signature state into Documents & Agreements and/or the dashboard action queue; the actual `/sign/[token]` flow can stay as the signing mechanism, but its *existence* needs a portal-visible record.
- **Questionnaire** — same treatment: surface "you have a questionnaire to complete" from the dashboard/Documents, even if the fill-out experience stays a focused standalone flow.
- **Receipts** — at minimum, list them in Documents & Agreements alongside the invoice they belong to; the Conversation-message/Stripe-email delivery can continue in parallel.
- **Key Dates** (`ClientKeyDate`) — surface these on the dashboard/Timeline rather than leaving them coordinator-only.

**Existing feature needing redesign** (built, reachable, but the wrong shape for the new philosophy):
- **Assigned Vendors** — rebuild "Vendors" to prioritize real confirmed assignments over the recommendation shortlist.
- **Venue Contacts** — reconcile the manual `important_contacts` blob with the real `venue_staff` roster; this is also what should power "who am I messaging" in Messages.
- **Documents (the whole tab)** — as above, this is a rebuild, not just a nav fix; it needs to actually query the venue's real `documents`/`contracts`/`invoices` data with usable detail, not inert summary rows.
- **Our Story / Journey** — merge per Part 3's nav table.
- **Plans / Tasks** — regroup per Part 3's nav table.

**Completely missing** (no code exists yet, anywhere):
- **In-app notifications** — no bell, no feed, no in-app notification center; today it's email-only.
- **A real "what's happening with my venue" activity view** beyond the narrow 7-day self-referential "This Week" card.
- **Property Information / Office Hours couple-facing surfaces** — assessed as low priority; "when can I reach my venue" is likely better served by Messages responsiveness and a real coordinator-contact card than a static hours page, but flagging the option rather than deciding it here.

---

# Appendix — Defects Found (fix regardless of any navigation decision)

1. **Playbook `kind` leak** (Part 1.B) — Venue Planning tasks marked `client_visible` can surface in the couple's Tasks list unfiltered by which playbook produced them. Data-correctness bug, independent of the architecture question.
2. **`lib/guests/service.ts` likely-broken venue read** (Part 1.G.5) — assumes a Sprint 107 RLS policy that was deliberately dropped in a later migration; the Event Readiness guest-stats query probably returns empty rows in production today.
3. **Two dead RLS grants** (Budget, Plans) — live venue-read policies with zero application code ever using them. Not a security problem (nothing is exposed that shouldn't be — the policies just permit a read nothing performs), but worth cleaning up or building the feature the grant implies.
4. **`WeddingJourneySection` hardcodes `website: false`** regardless of actual publish state — already named as a known-wrong shortcut in the platform's own architecture doc, never fixed.
5. **Stale code comment** in `lib/conversations/types.ts` still claims Conversations is "not wired into any UI yet" — factually false, has depended on it since RC2.

---

This document is the shared reference for the review conversation ahead — no implementation should begin against Part 2/3 until you've reviewed and responded to it, per your own instruction.
