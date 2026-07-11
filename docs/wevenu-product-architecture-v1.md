# Wevenu Product Architecture v1

**Status: Design only. Nothing in this document is implemented, and nothing should be built from it until it's approved.** Written in response to an explicit instruction to stop building features and resolve a structural mismatch: the product decisions made across `docs/booking-workspace-design.md` (Lead → Pipeline → Booked → Client, not Lead → Client → Event) and `docs/communication-platform-next-phase.md` (venue language, not CRM language) were designed correctly, but the application's navigation and object model were never rebuilt around them. Features kept landing on the old skeleton — Leads, Clients, and Events as three separate top-level objects; a "Series" nav item using the internal engineering name; a Library that exists beside the workflow instead of inside it.

This document does not revisit the settled decisions (Sales Pipeline ends at Booked, no Client Pipeline after booking, Planning as the primary post-booking system). It answers eleven specific questions about the product's shape, in order, and nothing else. No implementation, no database tables, no migrations — those come later, only after this is approved.

---

## 1. What are the primary objects in the system?

- **Lead.** A prospective booking, moving through the sales pipeline (Contacted → Qualified → Proposal Sent) toward Booked, or exiting as Lost.
- **Client.** The enduring person or couple a venue has a relationship with — independent of any single booking. A Client is who the venue has a history with: past inquiries, past events, ongoing conversation. This is not a new object the venue has to think about separately; it's the same identity that already carries a Lead's inquiry into a Booking's workspace and into Messages, today, under the hood. This document is the first place that identity gets named as a first-class product object rather than an implementation detail.
- **Booking.** One specific event a Client is booked for. A Booking is what "Nicole & Colby's wedding" *is* — it holds the Planning checklist, the Timeline, the Payments, the Messages, the Documents, the Vendors assigned to it. In the near-universal case, a Client has exactly one Booking; a Client having more than one (a repeat client, a referral that becomes a second wedding) is a real but rare case, not designed further here.
- **Vendor.** An external partner the venue works with — florist, caterer, DJ. A Vendor is a resource the venue maintains and recommends from, not a pipeline object with lifecycle stages the way Leads and Bookings are.
- **Template.** A reusable starting point a venue builds once and applies repeatedly — Planning Templates, Timeline Templates, Contract Templates, Message Templates, Packages. Distinct from the Booking it gets applied to; editing a template never changes a Booking that already used it.
- **Task.** One checklist item inside a Booking's Planning, sourced from a Planning Template and then specific to that Booking.
- **Timeline Entry.** One moment in a Booking's day-of schedule, sourced from a Timeline Template and then specific to that Booking.
- **Message / Automation.** Communication tied to a Client relationship (pre-booking) or a Booking (post-booking), sent manually or by an Automation the venue set up once.

Everything else in the product — payments, documents, notes, activity, feedback — is content that lives *inside* a Booking, not a separate object in its own right.

---

## 2. What is the lifecycle from Lead to completed event?

1. **Inquiry.** A Lead enters the pipeline — from the website form, a phone call, a walkthrough, or a coordinator adding one directly.
2. **Pipeline.** Contacted → Tour Scheduled/Qualified → Proposal Sent. A Tour is an activity that happens during this stage, not a separate object with its own lifecycle.
3. **Booked.** The Lead reaches Won. This is the single moment a Client and their Booking come into existence — the workspace is created, and (per `docs/booking-workspace-design.md` §1) Venue Planning, Client Planning, and the Timeline should apply automatically from the venue's defaults.
4. **Booking Workspace.** Everything between Booked and the wedding day happens here: Planning tasks get worked through, the Timeline gets built out, Payments get scheduled and collected, Vendors get assigned, Documents get collected, Messages (manual and automated) go back and forth.
5. **Event Day.** The Timeline becomes the live, operational schedule for the day itself — the same object, now being executed rather than planned.
6. **Completed.** The event has happened. Feedback is collected. The Booking becomes historical — visible, not active — and the Client relationship persists for any future business (a referral, a repeat event), independent of this specific Booking closing out.

A Lead can also exit the pipeline as **Lost** at any point before Booked — that's the only other terminal state before a Booking exists.

---

## 3. Which pages are primary navigation?

The pages a coordinator navigates to directly, every day, as a destination in their own right:

- **Dashboard** — today's view across everything.
- **Calendar** — every date-bound thing across every Booking.
- **Leads** — the pipeline.
- **Tours** — scheduled walkthroughs.
- **Bookings** — every active/upcoming Booking Workspace. This is the page that replaces both today's standalone Clients list and the standalone Events list — one list, each row opens one Booking Workspace.
- **Clients** — the full relationship history: everyone the venue has ever worked with, including completed Bookings, for the cases Bookings' upcoming-work view isn't built for (referrals, repeat business, "have we worked with this person before"). Same underlying object as Bookings, a different list for a different question.
- **Task Center** — every Planning task due across every active Booking, rolled up in one place, for a coordinator planning their week rather than looking at one wedding at a time.
- **Inbox** — every conversation across every Client and Booking.
- **Insights** — venue-wide reporting.

---

## 4. Which pages are supporting resources?

Things a venue sets up occasionally and rarely visits day-to-day, that get *used by* the primary navigation rather than worked in directly:

- **Planning Templates**
- **Timeline Templates** — does not exist as a real, venue-editable resource today (currently four hardcoded, non-editable templates baked into the application itself, per the Timeline Dependency Review). Belongs here once it does.
- **Contract Templates**
- **Packages**
- **Vendor Library** — the venue's maintained roster of vendors, the catalog a coordinator recommends *from* when assigning Vendors to a specific Booking.
- **Venue Guide**

**Message Templates** are a deliberate exception — they live in Communication (§6 below), not here, because they're reached for in the moment of composing or automating a message, not applied wholesale to a new Booking the way Planning/Timeline/Contract Templates are. That's the actual distinction between "Resources" and "Communication's own templates": one gets applied once, at setup; the other gets reached for constantly, mid-conversation.

---

## 5. Which pages should disappear entirely?

- **Events**, as a standalone top-level list and page. This is the core of the mismatch: a Booking already *is* the client's event. A separate Events object beside Clients was the leftover of the old Lead → Client → Event model this product explicitly moved away from. Its tabs don't disappear — they become the Booking Workspace (§7, §11).
- **The standalone `Timeline` top-level page** — today an empty, unwired placeholder, not the real day-of Timeline (which already lives correctly inside an event and simply needs to move into the Booking Workspace, §9). Nothing of value is lost removing it.
- **The standalone Floor Plan page** — already decided (`docs/booking-workspace-design.md` §2) to be a destination reached from Planning, not a page or even a tab of its own. This document doesn't reopen that; it's carried forward.
- **Standalone Contracts and Invoices pages.** Both are per-Booking content masquerading as venue-wide lists. They fold into the Booking Workspace. Which existing tab they fold into (Documents vs. Payments) is flagged, not resolved, in §11.
- **A standalone Vendors relationship page**, if it exists as something distinct from the Vendor Library. Vendors don't have pipeline stages the way Leads do — one maintained resource (§4), referenced from each Booking, is the whole shape. See §10.
- **"Series" as user-facing language.** Not a page removal, but the same category of problem: it's the internal engineering name, exposed directly. §6 below covers the replacement.

---

## 6. What does the left navigation become?

```
Dashboard
Calendar

SALES
  Leads
  Tours
  Bookings
  Clients

OPERATIONS
  Task Center
  Timeline            (a cross-Booking rollup — flagged as a new concept, not yet designed; see §9)

RESOURCES
  Planning Templates
  Timeline Templates  (new — see §4, §9)
  Contract Templates
  Packages
  Vendor Library
  Venue Guide

COMMUNICATION
  Inbox
  Templates            (Message Templates — see §4)
  Automations           (was "Series" — see below)

INSIGHTS
  Insights

SYSTEM
  [needs a new name — "Operations" is already claimed above by the Sales-adjacent section; keeping both would put two different things named "Operations" in the same nav]
  Settings
```

**Naming note on Automations:** "Series" was this session's earlier decision, and it was already a step in the right direction from "Sequences" — but it's still the internal object name surfacing in the UI, not language a venue owner would use. **Automations** (or **Automated Follow-Ups**, if a shorter single word is wanted) replaces it as the section name. Inside that section, individual automations keep venue-language instance names already decided — a Follow-Up Automation, a Welcome Automation, a Reminder Automation — the same way "Planning Template" is the category and "Standard Wedding" is the name a coordinator actually gives one. This revises `docs/communication-platform-next-phase.md` §3.6's "Series" recommendation; the reasoning there (internal name stays technical, UI name doesn't) still holds, only the specific word changes.

The "Wevenu" admin-only section (Feedback Inbox) is unaffected and not shown above.

---

## 7. What is the Booking Workspace?

The single home for everything about one Client's Booking, from the moment they're Booked through the event and into its archived, completed state. It's what a coordinator lands on when they open one row from Bookings or Clients — replacing the standalone Event page entirely, not sitting beside it.

Tabs (already decided in `docs/booking-workspace-design.md` §2, carried forward unchanged): **Planning, Timeline, Messages, Documents, Payments, Vendors, Activity, Notes, Team, Feedback** — plus Overview (purpose still to be decided) and a reserved Guests slot for future work. Floor Plan is reached from inside Planning, not a tab of its own.

---

## 8. Where does Planning live?

Three related, distinct surfaces, same underlying idea:

- **Primary home: the Planning tab inside each Booking Workspace** — the actual checklist for that one wedding, the thing a coordinator works from day to day.
- **The templates it's built from: Planning Templates**, in Resources — a venue's reusable checklists, edited occasionally, applied once per Booking.
- **The cross-Booking view: Task Center**, in Operations — every task due across every active Booking at once, for a coordinator planning their week rather than one wedding at a time.

---

## 9. Where does Timeline live?

- **Primary home: the Timeline tab inside each Booking Workspace** — the day-of run-of-show for that one wedding. This already exists in essentially the right shape (per the recent Timeline Dependency Review) and needs no redesign, only to move from being a tab on a standalone Event page to a tab on the Booking Workspace.
- **The templates it's built from: Timeline Templates**, in Resources — currently the one template type in the whole product that isn't venue-editable (four names hardcoded into the application itself). Bringing it in line with how every other template type already works is a prerequisite named in the Timeline Dependency Review, not solved here.
- **A possible cross-Booking rollup, in Operations** — "what does this week look like across every wedding happening," the same relationship Task Center has to Planning. This is new: nothing today aggregates Timeline across Bookings, and the existing standalone `/timeline` page is not this — it's an empty placeholder (§5) and should simply be removed, not repurposed. Whether this rollup is worth building is a real open question, not resolved here.

---

## 10. Where do Vendors live?

Two surfaces, not one Vendors object with its own pipeline:

- **Vendor Library**, in Resources — the venue's maintained roster of who they work with. A reference catalog, edited occasionally.
- **The Vendors tab inside each Booking Workspace** — which vendors are actually assigned or recommended for *this* wedding, picked from the Library.

Unlike Leads and Bookings, Vendors don't move through stages the way a relationship with a couple does — there's no vendor pipeline, no vendor equivalent of "Booked." That's why no standalone top-level Vendors page is needed the way one is needed for Leads or Bookings: the Library already is the whole of what a vendor "is" outside a specific Booking.

---

## 11. Which existing pages become tabs inside the Booking Workspace instead of standalone pages?

- **Events** — its twelve existing tabs are, almost entirely, already the Booking Workspace's tabs; the standalone Events *list* is what disappears, not the tab content.
- **Timeline** (the real, per-event one, not the empty standalone placeholder) — moves from "a tab on the Event page" to "a tab on the Booking Workspace." No change to what it shows.
- **Floor Plan** — already decided: a destination reached from Planning, not a tab.
- **Contracts** and **Invoices** — fold into the Booking Workspace. **Flagged, not resolved:** whether Contracts belongs inside Documents (it's a legal document) or inside Payments (it's tightly coupled to the payment schedule in most venue workflows) isn't decided by this document and needs a call before it's built.
- **Vendors** (today's standalone relationship page) — splits in two per §10: the reference list becomes Vendor Library in Resources; the per-Booking assignment view is the existing Vendors tab, unchanged.

Pages that stay standalone and do **not** become tabs: Leads, Tours, Bookings, Clients, Task Center, Inbox, Insights, Calendar, Dashboard, and everything in Resources.

---

Nothing above authorizes implementation. This document is for approval, or for correction where it's guessed wrong at something that should instead be flagged back to you rather than resolved unilaterally.
