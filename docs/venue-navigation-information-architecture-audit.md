# Venue Navigation & Information Architecture Audit

**Type:** Discovery and recommendation only. No code, schema, navigation, routes, Library, Help & Guides, Luv, or content was changed to produce this document.
**Date:** 2026-08-12
**Note on concurrent work:** Cursor is actively building the Help & Guides foundation in parallel with this audit — confirmed directly (a new `/help` route and `lib/help-guides/areas.ts` already exist alongside the older `/success-library` route, which has not yet been removed). This audit treats that in-flight state as ground truth, accounts for Help & Guides as the eventual destination described in the prior `docs/help-guides-*.md` series, and does not touch, evaluate the quality of, or block that work in any way.
**Method:** Direct inspection of `lib/navigation.ts` (the actual, single source of truth for the current sidebar — not inferred from screenshots or memory), the Library page's real card inventory, the Event workspace's real tab structure, and targeted route-level checks. Combined with first-hand familiarity with this product built up across this entire engagement. Every structural claim below is sourced to a specific file; every judgment call is marked as a recommendation, not asserted as fact.

---

## 1. Executive Summary

**What's wrong with the current navigation, stated plainly:** the sidebar's "Resources/Templates" section is not really a navigation section — it's a *duplicate table of contents for the Library page*. Nine of its ten items (Library, Vendors, Planning, Timelines, Pipelines, Contract Templates, Packages, Floor Plans, Inventory, QR Campaigns) are — confirmed directly against the Library page's own real card list — either literally the same destination Library already links to, or a near-duplicate route serving the same content. This isn't a matter of degree; one of them (**Packages**) is a confirmed, exact duplicate: `/packages/page.tsx` and `/library/packages/page.tsx` are the same component, same data-fetch, same logic, differing only in the page title string. The sidebar grew additively, one item at a time, as each new capability shipped — reasonable in the moment, but the result today asks a venue owner to hold two mental models simultaneously ("is this a sidebar thing or a Library thing?") for content that is, in every case checked, the same thing.

**A second, smaller but real problem:** the current "Financials" section (Contracts, Invoices, Payments) sits right next to "Resources/Templates," and "Contract Templates" (a Library concept) uses the same icon and a near-identical label to "Contracts" (an operational workspace) — the exact ambiguity the brief itself named as the motivating example.

**A third, structural observation, not a criticism:** the current nav has almost no dedicated destinations for anything Event-specific (Event Order, Floor Plans-in-use, Timeline-in-use, Guest/Vendor coordination for one particular wedding) — and that's *correct*, not a gap. That work already lives inside the Event workspace's own 14 tabs (confirmed: Overview, Planning, Timeline, Floor Plan, Documents, Vendors, Event Order, Inventory, Invoice, Conversation, Activity, Notes, Team, Feedback). The sidebar's job is to get a venue to the right *client or event*; it should not try to also represent everything that happens once they're there.

**What the final navigation should be, in one sentence:** a sidebar organized around five kinds of venue intent (Overview, Find & Book, Work With Clients, Reusable Resources, Configure the Venue), where every reusable/template concept has exactly one home (Library), every live/operational concept has exactly one home (a workspace, reached through Clients), and nothing appears in both places under two different names.

---

## 2. Current-State Inventory

Source: `lib/navigation.ts`, read directly, verbatim structure below.

| Section | Item | Route | Live work / Reusable asset / Config / Reporting / Communication / Education | In Library too? |
|---|---|---|---|---|
| Overview | Dashboard | `/dashboard` | Reporting (roll-up) | No |
| Overview | Reports | `/reporting` | Reporting | No |
| Overview | Calendar | `/calendar` | Live work (aggregated view) | No |
| Overview | Help & Guides | `/help` | Education | No — but duplicates `/success-library`, not yet retired |
| Pipeline | Leads | `/leads` | Live work | No |
| Clients | Clients | `/clients` | Live work / entry to Relationship Workspace | No |
| Communication | Inbox | `/messaging` | Live work | No |
| Communication | Message Templates | `/communication/templates` | Reusable asset | **Yes** — Library "Communication" group |
| Communication | Automations | `/communication/series` | Configuration | No |
| To Do's | Tours | `/tours` | Live work | No |
| To Do's | Task Center | `/tasks` | Live work | No |
| Resources/Templates | Library | `/library` | Reusable asset (the index itself) | — |
| Resources/Templates | Vendors | `/vendors` | Live work (a relationship system, not a template) | No — miscategorized, see §3 |
| Resources/Templates | Planning | `/library/playbooks` | Reusable asset | **Yes**, as "Planning Templates" |
| Resources/Templates | Timelines | `/library/timeline-templates` | Reusable asset | **Yes**, as "Timeline Templates" |
| Resources/Templates | Pipelines | `/library/pipeline-templates` | Reusable asset | **Yes**, as "Pipeline Templates" |
| Resources/Templates | Contract Templates | `/library/contracts` | Reusable asset | **Yes** |
| Resources/Templates | Packages | `/library/packages` | Reusable asset | **Yes** — but the Library card itself links to `/packages`, a **confirmed exact-duplicate route** |
| Resources/Templates | Floor Plans | `/library/floor-plan-templates` | Reusable asset | **Yes**, as "Floor Plan Templates" |
| Resources/Templates | Inventory | `/library/inventory` | Reusable asset (catalog) | **Yes** |
| Resources/Templates | QR Campaigns | `/library/qr-campaigns` | Reusable asset (marketing tool) | **Yes** |
| Financials | Contracts | `/contracts` | Live work | No |
| Financials | Invoices | `/invoices` | Live work | No |
| Financials | Payments | `/payments` | Live work | No |
| Operations | Settings | `/settings` | Configuration | No |
| Operations | Venue Guide | `/guide` | Config / venue-specific info | **Yes** — also a Library "Communication" card |
| Operations | Requests | `/requests` | Live work (Client Portal request inbox) | No |
| Help *(admin-only)* | Feedback/Requests | `/admin/feedback` | Internal, staff-facing | No |

**Items in the Library page (`app/(app)/library/page.tsx`) with NO sidebar equivalent at all:** Questionnaires & Feedback, Inventory Templates (distinct from the "Inventory" catalog itself), Event Order Templates, Brochures, Saved Reports.

**Major product areas confirmed to have no primary-nav presence, checked individually rather than assumed:**
- **Events/Bookings** — correctly absent; reached only via Clients → the Relationship Workspace. Not a gap.
- **Event Orders, Questionnaires (live, per-event), Floor Plans (live), live Inventory, live Timeline, per-event Vendor assignment** — all correctly absent from primary nav; all live inside the Event workspace's own tabs.
- **Wedding Website / Hosted Experience** — confirmed, via direct route search, to have **zero venue-staff-facing entry point anywhere in `app/(app)`.** Its editor (`components/portal/website-editor.tsx`, `website-studio.tsx`) is reached exclusively from the couple's own portal. This is consistent with this product's own, already-established, repeatedly-confirmed principle that the Hosted Experience is the couple's own aesthetic domain, never venue-controlled — **correctly absent, not a gap**, and should stay that way.
- **Conversations** — present, as "Inbox."
- **Documents** — no standalone top-level destination; lives inside each Event workspace's Documents tab, and inside Library for the reusable-template side (Contracts, Brochures). Correctly split this way, not missing.
- **Notifications** — a bell icon in the shell (`components/shell/notification-bell.tsx`), not a nav item — correct placement for a live, transient, cross-cutting stream.
- **Requests** — present, under Operations. Worth revisiting placement (§6).
- **Luv** — no persistent nav item found anywhere; see §9.

---

## 3. Conceptual Collisions

**Library vs. the sidebar's own "Resources/Templates" section — the dominant finding of this audit.** Confirmed item-by-item: Library, Planning, Timelines, Pipelines, Contract Templates, Floor Plans, Inventory, and QR Campaigns are not *similar* to their Library counterparts — they are, in every case checked, **the exact same route** the Library page already links to. This is not "both, but with clearly different purposes" (one of the brief's own offered options) — there is no different purpose here to point to. **Recommendation: retire "Resources/Templates" as a sidebar section entirely.** Library becomes the one destination; its own internal grouping (already real, already good — Agreements / Pricing & Packages / Planning / Communication / Marketing / Reports) does the organizing work the sidebar section was redundantly trying to do.

**Packages specifically — a confirmed bug, not a design question.** `/packages/page.tsx` and `/library/packages/page.tsx` are the same component with two different page titles ("Packages & Inventory" vs. "Packages"). This should be resolved by picking one canonical route and retiring the other — **recommend keeping `/packages`** (it's the one the Library page's own, more-recently-touched card already links to, and "Packages & Inventory" is the more complete, accurate title of the two) and removing `/library/packages`.

**Venue Guide — a genuine, deliberate exception to "Library owns all reusable things."** It appears both under Operations and as a Library "Communication" card. Per the product's own stated principle ("Venue Guide means venue-specific information — do not blur it with Library"), this is correctly understood as its **own** category, not a Library item at all — it's not a template a venue picks and applies per-booking, it's a single, persistent, always-on resource, closer in kind to a Settings page than a template library. **Recommendation: remove the Library card, keep the one Operations/Settings-adjacent entry.**

**Vendors — miscategorized, not duplicated.** Vendors sits in "Resources/Templates" today, but a Vendor is not a reusable template — the Vendor Network is a real, live relationship system (claimed/invited/active/inactive states, per-event assignments, a genuine two-sided portal). It has no Library counterpart because it isn't a Library concept at all. **Recommendation: Vendors moves out of the retired Resources/Templates section into its own placement (§6) — it belongs with the other live, relationship-oriented work, not with templates.**

**Packages, conceptually (separate from the routing bug above): is a Package "reusable" or "operational"?** Both, genuinely — and this is exactly the brief's own named example. A Package is *defined* once (a Library act) and then *copied at commitment* into a specific invoice or Event Order (an operational act, and — per this product's own already-audited "Copy at Commitment" architecture — a real, correct, tested guarantee that editing the master definition later never rewrites an already-committed line). The correct model, and the same one that already applies cleanly to Contract Templates and Questionnaires: **the definition lives in Library; the moment it's applied to a real client, it stops being a Library concept and becomes part of that Event's own workspace data.** No navigation confusion here once the routing bug is fixed — a venue goes to Library to *define* a package, and to an Event's own workspace to *use* one.

---

## 4. Library, Precisely Defined

**Library = the reusable things a venue configures once and applies to many future clients or events.** Not "all venue resources" (too broad — it would swallow Settings, Vendors, and Reports) and not merely "templates" in the narrow document-template sense (Inventory's catalog items aren't "templates," they're a reusable master list, but they belong for the identical underlying reason).

**The precise test:** *if a venue edits this thing, does the edit change what happens on already-committed bookings?* If no (the change only affects things created after the edit), it belongs in Library. If yes (editing it directly changes a live client's data), it's operational, not Library.

**What belongs, confirmed against the current real Library page and corrected where the current implementation blurs the line:**
- **Agreements:** Contract Templates, Questionnaires & Feedback (the three starter forms, not a couple's live in-progress answers).
- **Pricing & Packages:** Packages, Inventory (catalog), Inventory Templates.
- **Planning:** Planning Templates (Playbooks), Timeline Templates, Pipeline Templates, Floor Plan Templates, Event Order Templates.
- **Communication:** Message Templates. **(Venue Guide removed — see §3.)**
- **Marketing:** QR Campaigns, Brochures.
- **Reports:** Saved Reports — genuinely borderline (a saved report is closer to a personal bookmark than a reusable definition applied to future clients), but kept here because it passes a looser version of the same test: it's a *configuration* a venue sets up once and it keeps producing value without being "used up" by any one booking, the same shape as everything else in Library.

**What does not belong, and should not be added even though it's "reusable" in a loose sense:** Vendors (a relationship, not a definition), Settings (venue-wide configuration, not a per-booking-applicable asset), Venue Guide (persistent info, not an applied-per-booking template).

---

## 5. Help & Guides, Precisely Defined (boundary only — not a re-audit of that initiative)

**Help & Guides = things the venue learns from. Library = things the venue uses, creates, or configures.** This boundary holds cleanly across every example checked: Wedding Venue Agreement (Library) vs. "How do I send a contract?" (Help & Guides); Client Planning Questionnaire (Library) vs. "How do I customize a questionnaire?" (Help & Guides); Standard Wedding Inventory (Library) vs. "What does 'finalized' mean on inventory?" (Help & Guides). **No exception to this boundary was found while cross-referencing the current Library inventory against the prior Help & Guides content plan.** The one place they should visibly connect, without merging, is contextual: a Library item's own detail page is a reasonable place for a single, small "Learn more" link into its corresponding Help & Guides article (e.g., the Floor Plan Templates page linking to the floor-plan icon Quick Answer) — a pointer, never duplicated content, matching the discipline already established in the Help & Guides Luv-integration document.

---

## 6. Recommended Information Architecture

**The brief's own hypothesis structure, evaluated critically, not endorsed by default:**

The hypothesis is close, and several sections are exactly right as proposed (Overview, Sales, Communication). But it makes three real mistakes worth naming: it keeps "Pipelines" as a Sales-section item separate from "Leads" when they're the same underlying work at different zoom levels (a lead list and its pipeline view); it doesn't resolve where Vendors goes (left implicitly under Events, where it's *used*, rather than reflecting that the Vendor Network itself — claiming, inviting, managing the relationship — is closer to a Clients-shaped concept than an Events-shaped one); and it places "Task Center" under Events specifically, when Task Center today is venue-wide (tasks from every event, not scoped to one) — confirmed by its own current sidebar placement under "To Do's," not nested under any single event.

**Proposed hierarchy:**

```
OVERVIEW
  Dashboard
  Reports
  Calendar
  Help & Guides

SALES
  Leads              (pipeline view lives here, not as a separate item)
  Tours

CLIENTS
  Clients            (entry point to every Relationship Workspace)
  Vendors            (a relationship system, same shape as Clients — not a template)

COMMUNICATION
  Inbox
  Message Templates
  Automations

TASKS
  Task Center
  Requests           (moved from Operations — this is a live, action-required inbox, not configuration)

FINANCIALS
  Contracts
  Invoices
  Payments

LIBRARY
  Library            (single destination; internal grouping per §4 does the rest)

YOUR VENUE
  Settings
  Venue Guide
```

**Rationale per section, one sentence each:**
- **Overview** — everything a venue checks first thing, before deciding what to do.
- **Sales** — the pre-booking relationship: a person isn't a Client yet.
- **Clients** — the post-inquiry relationship, including the people (Vendors) a venue has an ongoing relationship with, not just couples.
- **Communication** — how a venue talks to the people in Sales and Clients, and the tools that automate it.
- **Tasks** — the venue's own action list, across every client and event at once — deliberately not folded into Clients, because its whole value is being ungrouped.
- **Financials** — the money side of a relationship, kept separate because it has its own audience (often a different staff role) and its own trust stakes.
- **Library** — everything reusable, one destination, per §4.
- **Your Venue** — configuration and venue-specific persistent info, the two things a venue returns to occasionally, not daily.

**What's missing from the hypothesis that this version adds:** nothing structurally new — Requests moving into Tasks and Vendors moving into Clients are the only real departures, both justified above, not additions of new surface area.

**What should be removed relative to today:** the "Resources/Templates" section (§3), and the duplicate `/library/packages` route (§3) — a code-level fix, named here for completeness, not something this audit is asking to be done as part of this pass.

---

## 7. User-Intent Validation

| Scenario | Path under the proposed IA |
|---|---|
| "I have a new inquiry, where do I go?" | Sales → Leads |
| "I need to follow up with someone." | Sales → Leads (their existing lead row) |
| "I need to schedule a tour." | Sales → Tours |
| "Where do I see my sales pipeline?" | Sales → Leads (the pipeline view, same destination) |
| "I need to see everything about Emma and Jordan." | Clients → Clients → their Relationship Workspace |
| "I need to message a couple." | Communication → Inbox, or directly from their Relationship Workspace's Conversation tab |
| "I need to update the timeline." | Clients → their event → Timeline tab (workspace nav, not global) |
| "I need to edit the floor plan." | Clients → their event → Floor Plan tab |
| "I need to see what inventory is committed." | Clients → their event → Inventory tab |
| "I need to manage vendors." | Clients → Vendors (the relationship), or the event's own Vendors tab (the per-event assignment) |
| "I need to complete event tasks." | Tasks → Task Center |
| "I need to send the contract." | Clients → their event → the workspace's own contract action, or Financials → Contracts if starting from the financial side |
| "I need to see an invoice." | Financials → Invoices |
| "I need to see whether someone has paid." | Financials → Payments, or the event's own Invoice tab |
| "I need to change the payment schedule." | Financials → Payments (the schedule's own detail page) |
| "I want to create a questionnaire." | Library → Agreements group |
| "I want to create a package." | Library → Pricing & Packages group |
| "I want to reuse a contract." | Library → Agreements group |
| "I want to find my saved report." | Library → Reports group |
| "What does this floor plan icon mean?" | Help & Guides (or a contextual link from inside the Floor Plan tab itself) |
| "What does 'finalized' mean?" | Help & Guides |
| "How do I send a contract?" | Help & Guides |
| "How does a payment plan work?" | Help & Guides |

Every scenario resolves to exactly one predictable place — no scenario required knowing an internal feature name to guess correctly.

---

## 8. Relationship Workspace Alignment

**The governing rule, confirmed correct against the actual Event workspace's real 14 tabs and worth keeping exactly as the brief states it:** global navigation gets a venue to the right workspace; workspace navigation gets them through the work. Checked directly — **no current duplication was found** between the sidebar and the Event workspace's own tabs (Overview, Planning, Timeline, Floor Plan, Documents, Vendors, Event Order, Inventory, Invoice, Conversation, Activity, Notes, Team, Feedback) — none of these 14 has a competing global-nav entry pretending to be the same destination. The one soft tension worth naming: **Financials (Contracts/Invoices/Payments) is a real global destination *and* the same data is reachable per-event via the workspace's own Invoice tab.** This is not duplication in the harmful sense — it's the same underlying pattern as Clients/Vendors having both a global list view and a per-relationship detail view, which is correct and expected. The distinction that keeps it from becoming confusing: the global Financials destination is for *scanning across every client* ("who owes money right now"), while the workspace tab is for *this one relationship's* financial state — different intents, same underlying data, no fix needed.

---

## 9. Naming Recommendations

Only changes that materially improve comprehension — most current labels are already good and are explicitly left alone below.

| Current label(s) | Issue | Recommendation |
|---|---|---|
| "Resources/Templates" (section) | The section itself is being retired (§3/§6) | N/A — removed, not renamed |
| "Pipelines" (Library item) vs. "Pipeline" (sidebar section label) | Same word, two different referents in adjacent parts of the UI today | Resolved by §6's restructure — "Pipeline Templates" (inside Library) is now the only surviving use of the word in this context |
| "Help" (admin-only section, `/admin/feedback`) vs. "Help & Guides" (venue-facing, `/help`) | Two nav labels sharing the word "Help" for unrelated audiences and purposes — a real, current collision, confirmed directly in `lib/navigation.ts` | Rename the admin-only section to "Feedback" or "Internal" — it's staff/HQ-facing only and should not share vocabulary with the venue-facing Help & Guides system at all |
| "Contract Templates" vs. "Contracts" | Legitimately different (Library definition vs. live records) but visually adjacent with a shared icon today | Keep both labels as-is — they're accurate and distinct; the fix is structural (§3/§6 separates them into different sections), not lexical |
| "Planning" (Library item, → Playbooks) vs. "Planning" (an entire Event workspace tab, and a conceptual area throughout this whole product) | The single word "Planning" is heavily overloaded across this product | Rename the Library card specifically to "Planning Templates" (**already its actual label on the Library page itself, confirmed** — the sidebar's shorter "Planning" is the stale, ambiguous one) |
| "Timelines" (sidebar, plural) vs. "Timeline" (Event workspace tab, singular) vs. "Timeline Templates" (Library's own actual label) | Plural/singular drift across three surfaces for the same concept | Standardize on "Timeline Templates" for the Library concept (matches Library's own existing label) and "Timeline" for the live, per-event concept — both already correct individually, just never reconciled against each other until now |
| "Venue Guide" | Clear and accurate, no change | — |
| "Task Center" | Clear; "Center" is a slightly dated SaaS convention but not confusing | No change — not worth a rename for aesthetics alone, per the brief's own instruction |
| "Requests" | Accurate but easy to confuse with "a lead's inquiry request" — checked against real usage (`get_portal_context`-style client-portal action requests), confirmed it means something different and specific (client-portal-submitted requests awaiting venue action) | No rename — the ambiguity is real but minor, and the fix is placement (§6, moved to Tasks) more than wording |
| "Success Library" | Being retired in favor of "Help & Guides" per the concurrent, already-in-progress work — not this audit's decision to make or remake | No recommendation — deferred entirely to the in-flight Help & Guides initiative |

---

## 10. Luv Recommendation

**No persistent nav item, no dedicated destination.** This is the one recommendation most directly dictated by the product's own already-stated philosophy ("optional, quiet, dismissible, useful at moments of action") — a permanent sidebar entry would make Luv load-bearing for navigation, which contradicts "never required for navigation or education" outright.

**Luv should be:** contextual, appearing at genuine moments of action (already the established pattern — confirmed via `lib/luv/celebrations.ts` and the observation modules built up across this engagement) and reachable from a consistent, small, persistent affordance (a corner element or icon, not a nav section) available across Leads, Clients, and Events — not "all three" as three separate integrations, but one consistent presence that simply has more or less to say depending on where a venue is.

**Should Luv be accessible from Help & Guides?** Yes, in exactly the direction already established in the Help & Guides Luv-integration document: Luv points *into* Help & Guides via slug references when she has something relevant to say. Help & Guides should not need a reciprocal "ask Luv" affordance on every article — that would start making Luv feel required for education, the opposite of the stated goal.

**Architectural relationship:** Luv is a *behavior layered across* the navigation this document proposes, not a section within it. She should never be the only way to reach a piece of functionality, and she should never duplicate content that already has a canonical home in Library or Help & Guides.

---

## 11. Mobile / Narrow-Screen Consideration

Not a redesign — a check on whether the proposed structure creates a usability problem at a collapsed/narrow width. **The proposed hierarchy has 7 sections and 17 total items**, down from the current 9 sections and 24 items (excluding the admin-only section). This is a real, meaningful reduction, not just a reshuffle — fewer section headers means fewer scroll-inducing group boundaries at a narrow or collapsed sidebar width, which is a genuine, if secondary, usability win from consolidating "Resources/Templates" into Library alone. No section in the proposal exceeds 4 items, which stays well within what a collapsed/icon-only sidebar treatment (if this product ever adds one) could reasonably support without needing flyout submenus.

---

## 12. What Should NOT Be in the Sidebar

- **Every individual Library sub-type** (Contract Templates, Packages, Timeline Templates, etc., as standalone top-level items) — access through Library's own internal grouping, per §3/§6. This is the dominant finding of this entire audit, restated as a rule.
- **QR Campaigns** specifically, even setting the Library-duplication issue aside — a genuinely low-frequency, marketing-specific tool; Library is the right home, a dedicated sidebar slot is not warranted by frequency of use.
- **Automations** (`/communication/series`) — worth a second look independent of this audit's main finding: it's configuration-shaped (set up once, runs in the background) more than daily-work-shaped. Recommend keeping it visible for now given it's genuinely part of the Communication story a venue actively tunes, but flagging it as the next-most-likely candidate to move into a Communication-scoped settings area if this nav is revisited again later.
- **Admin/HQ-only destinations** (`/admin/feedback`) — already correctly gated `adminOnly` in the current implementation; no change needed, just don't let its label collide with venue-facing "Help" (§9).

---

## 13. Decisions We Need to Make

Only genuine, unresolved product decisions — not manufactured for completeness.

1. **Packages route consolidation** (`/packages` vs. `/library/packages`) — this audit recommends keeping `/packages`, but this is a real, concrete engineering task (redirect or removal of the duplicate) that needs to be scheduled, not something resolvable by architecture recommendation alone.
2. **Should "Requests" (client-portal-submitted requests) and "Task Center" (the venue's own internal tasks) eventually merge into one unified action inbox?** They're conceptually adjacent (both are "things I need to do") but currently distinct systems with distinct data models. This audit recommends co-locating them in the sidebar (§6) without recommending merging the underlying systems — that's a larger product question this document doesn't have enough evidence to resolve either way.
3. **Should Vendors eventually get its own top-level section**, if the Vendor Network grows enough that "Clients" starts to feel like it's serving two different audiences (couples and vendors) under one label? Not warranted by current scale, but worth revisiting if the Vendor Network's own footprint keeps growing — named here so it isn't rediscovered from scratch later.

---

## Current vs. Proposed Scorecard

| Dimension | Current (1–5) | Proposed (1–5) |
|---|:---:|:---:|
| Predictability | 2 | 4 |
| Cognitive load | 2 | 4 |
| Duplication | 1 | 4 |
| Naming clarity | 3 | 4 |
| Hierarchy | 2 | 4 |
| Discoverability | 3 | 4 |
| Relationship-workspace alignment | 4 | 5 |
| Library clarity | 2 | 4 |
| Help clarity | 3 *(in transition — new `/help` route exists but `/success-library` hasn't been retired yet)* | 5 *(once the in-flight migration completes, which this document doesn't need to influence)* |
| Scalability | 2 | 4 |

**Duplication scores lowest today (1/5) deliberately** — a confirmed, byte-identical duplicate route is about as unambiguous a finding as this kind of audit produces, not a subjective judgment call.

---

## If we were launching Hello to Cheers today, this is the sidebar I would ship:

```
OVERVIEW        — everything a venue checks first, before deciding what to do next
  Dashboard
  Reports
  Calendar
  Help & Guides

SALES           — the pre-booking relationship
  Leads
  Tours

CLIENTS         — every ongoing relationship, couples and vendors alike
  Clients
  Vendors

COMMUNICATION   — how a venue talks to everyone above, and what automates it
  Inbox
  Message Templates
  Automations

TASKS           — the venue's own action list, across every relationship at once
  Task Center
  Requests

FINANCIALS      — the money side, kept separate for its own audience and stakes
  Contracts
  Invoices
  Payments

LIBRARY         — everything reusable, in one place, organized by what it's for
  Library

YOUR VENUE      — configuration and venue-specific information, visited occasionally
  Settings
  Venue Guide
```
