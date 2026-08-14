# Venue Left Navigation — Final Recommendation

**Type:** Decision/synthesis pass. Converts `docs/left-navigation-information-architecture-audit.md` into one coherent, final recommendation. No code, schema, navigation, routes, Help & Guides, Luv, or Library was modified to produce this document.
**Method:** Builds directly on the completed audit's evidence; the full inventory pass was not repeated. A small number of additional, targeted checks were made against the current working tree specifically to resolve the decisions this document is asked to make (confirmed below inline, each sourced).

Two additional facts, verified fresh for this pass and load-bearing for the decisions below:

1. **`app/(app)/events/page.tsx` is a retired redirect to `/clients`** — its own comment states: *"The standalone Events list is retired — Bookings (`/clients`) is now the venue's master workspace list."* This confirms, from the product's own code, that there is no cross-venue global "Events" list independent of Clients — Clients already is that list.
2. **No global `/event-orders` route exists anywhere** — only `/library/event-order-templates` (the definition) and each Event workspace's own "Event Order" tab (the live record). Confirmed by directory search.

These two facts directly shape Part 2 below: they are why the final sidebar has no standalone "Events" section.

---

## Part 1 — Final Mental Model

When a venue owner thinks about Hello to Cheers, they should be thinking about six things, in roughly this order of how often they touch them:

1. **"Who might book with me, and where are they in that decision?"** — Leads, Tours. The pre-commitment relationship.
2. **"Who has booked, and what's happening with them?"** — Clients (which includes the vendors who work those bookings alongside them), Communication. The post-commitment relationship, worked inside each client's own workspace.
3. **"What do I need to do, and what am I waiting on?"** — Task Center, Requests. The venue's own execution layer, aggregated across every relationship at once.
4. **"Is the money and paperwork in order?"** — Contracts, Invoices, Payments. The financial and legal ledger.
5. **"What do I reuse instead of rebuilding from scratch every time?"** — Library. Everything the venue defines once and applies to many future clients.
6. **"How do I learn this product, and how do I run my venue's own settings?"** — Help & Guides, Venue Guide, Settings. Two very different kinds of "help" (product literacy vs. venue-specific reference) plus configuration.

The organizing idea underneath all six: **a venue owner is always either working a relationship (1–3), tracking money (4), reusing something they built once (5), or looking after the shop itself (6).** Nothing in the final sidebar below needs a seventh category — every current destination fits cleanly into one of these, once the destinations that only *look* distinct because of when they happened to be built (Resources/Templates) are reassigned to where they actually belong.

---

## Part 2 — Final Sidebar

```
OVERVIEW
  Dashboard
  Reports
  Calendar
  Help & Guides

SALES
  Leads
  Tours

CLIENTS
  Clients
  Vendors

COMMUNICATION
  Inbox
  Automations

TASKS
  Task Center
  Requests

FINANCIALS
  Contracts
  Invoices
  Payments

LIBRARY
  Library

YOUR VENUE
  Settings
  Venue Guide
```

**Deliberately absent as top-level items, and why:** Message Templates, Pipelines, Planning, Timelines, Contract Templates, Packages, Floor Plans, Inventory, QR Campaigns, Brochures, Payment Schedules, Questionnaire templates, Event Order templates, Saved Reports — all fold into **Library**, which already groups them coherently (§4). **No "Events" section** — per the two facts above, there is no genuine cross-venue live list this section could point to that Clients doesn't already serve; per-event work (Playbook, Timeline, Floor Plan, Inventory, Event Order tabs) happens inside that specific event's own workspace, reached through Clients.

---

## Part 3 — Section-by-Section Rationale

**OVERVIEW**
*Purpose:* Things a venue checks without a specific task already in mind.
*Why together:* All four are unprompted-need destinations — a snapshot, a deeper look, a schedule, and "I'm stuck."
*Why not elsewhere:* None of the four belongs to a single relationship or a single piece of money — they're all cross-cutting.
*Keep out:* Anything that requires having already decided to act on one specific person or record.

**SALES**
*Purpose:* The pre-booking relationship — someone who hasn't committed yet.
*Why together:* Tours is a lead-conversion activity, not an independent to-do category (§Part 8).
*Why not elsewhere:* Once someone books, they leave this section entirely and move to Clients — Sales should only ever contain people who haven't booked.
*Keep out:* Anything post-booking. Pipelines is deliberately not here — see Part 7.

**CLIENTS**
*Purpose:* Every ongoing relationship the venue manages over time — couples and vendors alike.
*Why together:* Both are relationships worked over months, not templates applied once (§Part 6).
*Why not elsewhere:* Vendors isn't a Library asset (nothing about a vendor is "customized once, then applied") and isn't Financial.
*Keep out:* Per-event vendor *assignment* — that's a fact about one booking, and lives in that event's own Vendors tab, not here.

**COMMUNICATION**
*Purpose:* How the venue talks to everyone in Sales and Clients, and what runs on its own.
*Why together:* Both Inbox and Automations are live/running, not templates (§Part 10).
*Why not elsewhere:* Neither is a relationship by itself (they're the *tool* two relationships use) and neither is financial.
*Keep out:* Message Templates — a reusable definition with no live/running component of its own; it belongs in Library (§Part 10).

**TASKS**
*Purpose:* The venue's own execution layer — what it owes, and what it's waiting on — across every relationship at once.
*Why together:* Both are cross-event aggregations, just pointed in opposite directions (§Part 9).
*Why not elsewhere:* Neither is a template (nothing here gets "applied" to a booking) and neither is financial.
*Keep out:* Planning/Playbooks — the checklist *definitions* live in Library; the checklist *in progress* lives inside one event's own Playbook tab. Task Center is the aggregated output of that process, not the process itself.

**FINANCIALS**
*Purpose:* The money and legal paperwork ledger.
*Why together:* All three are live, cross-client financial/legal records a venue reviews in aggregate (§Part 11).
*Why not elsewhere:* Each has a Library-side definition (Contract Template, Payment Schedule) that is genuinely different in kind — reviewed once when setting up, not tracked as a running ledger.
*Keep out:* Packages — despite being "financial" in flavor, a Package has no live, cross-client ledger of its own; its only "live" form is as line items already embedded inside a real Invoice or Event Order (§Part 11). Event Orders — event-level only, no cross-venue list exists.

**LIBRARY**
*Purpose:* Everything the venue defines once and reuses on future bookings.
*Why together:* All share the identical define-once-apply-many shape, confirmed directly in each item's own page copy in the audit.
*Why not elsewhere:* These are deliberately *not* live, running, or per-relationship — that's precisely what makes them Library items instead of something above.
*Keep out:* Anything with a genuine, independent live/running counterpart that a venue would want to review in aggregate (Contracts, Invoices, Payments, Task Center, Requests, Clients, Vendors) — those stay as their own destinations; only their *definition* side lives here.

**YOUR VENUE**
*Purpose:* Configuration and always-current venue-specific reference — visited with intent, not daily.
*Why together:* Both are "about the venue itself," not about any one relationship or piece of money.
*Why not elsewhere:* Settings isn't a template (nothing is "applied" from it to a booking) and Venue Guide isn't product education (it's the venue's own content, not Hello to Cheers's).
*Keep out:* Help & Guides — a different kind of "guide" entirely (product literacy, not venue-specific facts); stays in Overview, not here (§Part 12).

---

## Part 4 — Library, Final Model

**What is Library?** The single home for everything a venue creates once and reuses on future bookings — the definition side of every define-once-apply-many pattern in the product.

**What belongs inside:** Contract Templates, Questionnaire templates, Packages, Inventory (catalog) and Inventory Templates, Payment Schedules, Planning Templates, Timeline Templates, Floor Plan Templates, Event Order Templates, Message Templates, QR Campaigns, Brochures, Saved Reports. (Pipelines is a deliberate, temporary exception — see Part 7.)

**What does NOT belong inside:** Anything with its own genuine, independently-reviewed live ledger or list (Contracts, Invoices, Payments, Clients, Vendors, Task Center, Requests) — those keep their definition-side counterpart in Library, but the live thing itself is not a Library item.

**Which current sidebar items become Library-only:** Vendors is the one exception that moves *out* of Library's orbit entirely (to Clients, since it's a relationship, not a definition — §Part 6). Every other current "Resources/Templates" item becomes Library-only: Planning, Timelines, Pipelines *(demoted, not promoted — §Part 7)*, Contract Templates, Packages, Floor Plans, Inventory, QR Campaigns.

**Which things remain direct operational destinations:** Contracts, Invoices, Payments, Clients, Vendors, Task Center, Requests, Inbox, Automations, Leads, Tours, Calendar, Reports, Dashboard, Settings, Venue Guide, Help & Guides.

**How the venue should understand the difference, in plain language — no technical terms:**

- **Library → Package** is "the menu you built." **Event → Package** is "what this couple ordered." Editing the menu tomorrow never changes what a couple already ordered last month.
- **Library → Contract Template** is "the agreement wording you always use." **Contracts** is "the actual signed agreement with this couple's names, date, and price filled in."
- **Library → Timeline Template** is "the day-of schedule shape you've refined over the years." **Event → Timeline** is "Saturday's actual, specific schedule, minute by minute."
- **Library → Floor Plan Template** is "a room layout you like." **Event → Floor Plan** is "how the room will actually be set for this couple's guest count."
- **Library → Inventory Template** is "what a typical wedding uses." **Event → Inventory** is "what this specific wedding is actually getting, checked off as it's confirmed."
- **Library → Questionnaire (template)** is "the questions you always ask." **Event → Questionnaire** is "this couple's actual answers."

Every one of these follows the identical rule, stated once so it never needs restating per feature: **Library is what you'd show a new employee to explain how you do things. A workspace is what's true about one specific wedding.**

---

## Part 5 — Global vs. Workspace: The Rule

**If a venue reviews it in aggregate, across every client or event at once, it belongs in global navigation.**
**If it's only ever true about one specific relationship, it belongs inside that Client/Event workspace.**
**If it's a definition applied to many future relationships, but has no life of its own until applied, it belongs in Library.**
**If it teaches the venue how to use Hello to Cheers itself, it belongs in Help & Guides.**
**If it's a fact specific to running this one venue (not a relationship, not a definition, not the product) — brand, hours, integrations — it belongs in Settings or Venue Guide.**

The test that resolves the hard cases (confirmed against every genuine ambiguity found in the audit): **ask whether a venue would ever want to see a cross-venue list of the live version of this thing.** Contracts, Invoices, Payments, Clients, Vendors, Task Center, Requests all pass — a venue genuinely wants "all my unpaid invoices" or "everyone I'm behind on responding to" as one list. Timelines, Floor Plans, Inventory, Packages, Event Orders all fail that test — no venue owner has ever wanted "every floor plan across every wedding I've ever done" as a single list to review; they want *this Saturday's* floor plan, reached through *that* event. That's the line between a global destination and a Library item with a workspace tab.

---

## Part 6 — Vendors: Definitive Recommendation

**Venue-wide Vendors live under Clients**, as their own item, peer to Clients itself — not folded inside it, not reached only by drilling into a specific couple.

**Event-specific vendor assignment** lives inside that Event's own Vendors tab — already correctly built, already confirmed not duplicating the global page.

**Should Vendors have a global sidebar destination?** Yes. It fails the Library test (nothing about a vendor relationship is "customized once, then applied" — it's an ongoing relationship, worked over time, exactly like a Client) and it's used with real, standing frequency (confirmed: claim/invite/manage flows, direct messaging, assignment to bookings).

**Reached primarily through Clients/Relationships?** No — as its *own* item within the Clients section, not nested inside any single couple's workspace, because a vendor relationship exists independently of any one booking (a photographer partners with the venue across many weddings, not just one).

**Is "Vendors" the right label?** Yes — plain, accurate, no jargon, already well understood in the audit's own testing. No rename.

---

## Part 7 — Pipelines: Definitive Recommendation

**What Pipelines is supposed to represent:** a venue-customized, named sequence of stages a lead moves through — the thing a venue would naturally call "our sales process."

**Is it actually connected to Leads?** No. Confirmed directly from the Library page's own copy: *"Not connected to Leads yet — this is just the editor."* The real Leads pipeline (`/leads/pipeline`) runs on a separate, fixed, seven-value canonical stage vocabulary (`lib/leads/pipeline-stage-mapping.ts`), explicitly documented in that file's own comments as `leads.status remains the single enforced source of truth everywhere else in the app (analytics, Automated Series, scoring, activity trigger)`. Customizing a pipeline in the Library editor today changes nothing a venue actually sees on a real lead.

**Should it be exposed to venues today?** No. **This is the definitive recommendation, stated plainly per the brief's own instruction:** don't expose Pipelines as a primary, promoted venue-facing navigation destination — neither as a global sidebar item (already resolved by retiring "Resources/Templates") nor as a promoted card in Library's main grouping — until it's genuinely wired to the real Leads pipeline. A destination that lets a venue "customize" something with no observable effect is worse than no destination at all; it teaches a false mental model on first use.

**Where should it live in the meantime?** The route and editor should remain in the codebase, reachable if directly linked, but not promoted in Library's primary card grid. This is a navigation-visibility recommendation, not a request to delete or hide the code.

**Should it remain in Library?** Conceptually, yes — once connected, it is a genuine Library-shaped definition (a reusable stage sequence, applied to the running Leads pipeline the same way a Contract Template is applied to a real contract). The problem today isn't its category; it's that the "apply" half of the definition-instance pair doesn't exist yet.

**Should it be renamed?** Not necessary if it's demoted from promoted visibility — the current label is accurate to what the editor *is* (a pipeline editor); the problem is what it implies about connection, not its name.

**A real, separate product gap, named explicitly so it isn't lost:** the Leads pipeline's fixed seven-stage vocabulary is itself acknowledged in its own code comments as incomplete (`"decision" has no equivalent in the current 7-value status vocabulary at all... approximated`). Wiring Pipelines to Leads is not a small connective-tissue task — it requires resolving that vocabulary gap first. This belongs in a product backlog as its own item, not as a navigation fix.

---

## Part 8 — Tours: Definitive Recommendation

**Section:** Sales, alongside Leads.
**Label:** Tours — unchanged, already clear.
**Relationship to Leads:** a Tour is a specific, scheduled action taken *on* a lead as part of moving them toward a decision — not a separate category of work. `Lead → Tour → Booking` should read to a venue owner as one continuous story: someone inquires (Leads), the venue shows them the space (Tours), they book (they leave Sales and become a Client).
**Relationship to Calendar:** Tours also appear on the venue's Calendar, exactly like the audit's Communication finding — two legitimate, intentional paths to the same fact (Calendar for "what's on my schedule today," Tours for "manage and track my tour pipeline specifically"), not a duplication needing resolution.
**Relationship to Tasks:** none directly — a tour follow-up reminder may generate a task in Task Center, but Tours itself is a scheduling and tracking destination, not a to-do list. Its prior placement under "To Do's" mischaracterized it; it was never a task list, it's a sales activity.

---

## Part 9 — Task Center / Requests: The Distinction

Three different altitudes, not three competing "things to do" lists:

- **Dashboard's "Needs Attention"** (confirmed, `lib/dashboard/service.ts`, currently lead-specific) is the **glance layer** — a small, most-urgent-first triage feed, not a full list.
- **Task Center** is the **execution layer** — the complete, filterable list of everything the venue itself must still do, aggregated from every event's own applied Playbook plus manually-added tasks.
- **Requests** is the **waiting-on-someone-else layer** — the complete list of everything asked of a couple or vendor that hasn't yet been answered.
- **Planning / Playbooks** is not a "things to do" surface at all — it's the Library-side definition (the checklist shape) and the per-event tab where that checklist is actually worked. It's the *source* that eventually populates Task Center, not a duplicate destination for viewing tasks.
- **Timeline** is unrelated to any of the above — a schedule, not a task list.

**The clear rule to state to the team:** *"Am I asking myself what I need to do, or am I asking what I'm waiting on someone else for?"* — those are Task Center and Requests, respectively, and nothing else in the product should ever try to answer either question a second way.

---

## Part 10 — Communication: Final Model

**Inbox and Automations stay global.** Both are live and running — Inbox is literally in-progress conversations; Automations are actively executing right now, not "applied once and forgotten" the way a template is.

**Message Templates moves to Library-only.** It has no live/running component of its own — a template only becomes real the moment it's sent, at which point it's just a message inside Inbox, not a separate tracked object. It fails the "would a venue want a cross-venue list of the *live* version of this" test from Part 5 in the same way Packages does: there is no live, running "Message Templates" ledger, only the reusable text itself.

This is exactly the distinction the brief asked to be made explicit, and the underlying evidence — confirmed in the audit, re-confirmed here — is that Message Templates already exists as a Library card today; this recommendation simply stops giving it a second, redundant top-level entry.

---

## Part 11 — Financials: Final Model

| Item | Category | Final home |
|---|---|---|
| Contract Template | Reusable definition | Library |
| Contract | Live legal/financial commitment | Financials |
| Invoice | Live financial commitment | Financials |
| Payment (schedule tied to a real invoice) | Live financial commitment | Financials, labeled "Payments" |
| Payment Schedule (starter preset) | Library asset (code-level preset, not a DB record) | Library |
| Event Order | Event-level record, no cross-venue list exists | Event workspace only |
| Event Order Template | Library asset | Library |
| Package | Library asset — has no independent live form; its "live" state is a line item already embedded in a real Invoice or Event Order | Library |

**The architecture is not flattened by this table** — it names, precisely, that Contracts/Invoices/Payments are the only three Financials items with a genuine cross-client ledger a venue would review in aggregate. Everything else in this table is either a pure definition (Library) or has no existence outside one specific event (event workspace only, no global list needed).

---

## Part 12 — Help & Guides, Venue Guide, Luv: Final Distinction

**Confirmed final placement: Help & Guides stays under Overview**, unchanged from the audit's recommendation — already the most discoverable position without adding a low-traffic single-item section.

**The three, stated so they can never be blurred again:**

- **Help & Guides = canonical product education.** How to use Hello to Cheers. Owned by Hello to Cheers, same content for every venue.
- **Venue Guide = venue-specific information.** Parking, policies, FAQs — owned and written by *this* venue, shown to *this* venue's clients. Confirmed via its own page copy: "Everything your clients need to know... Clients browse this in their portal."
- **Luv = optional contextual concierge.** Not a second knowledge base. Points *into* Help & Guides when relevant; never authors or owns content of her own. No implementation or behavior change recommended here — Luv is out of scope for this navigation decision per the Stop Condition, and nothing about the final sidebar requires her placement to change.

**Should the final navigation expose all three?** Two of them, yes — Help & Guides (Overview) and Venue Guide (Your Venue). **Luv is deliberately not a sidebar destination in this recommendation or the prior audit** — she's a contextual presence, not a place a venue navigates *to*, consistent with the product's own stated Luv philosophy (optional, quiet, dismissible).

---

## Part 13 — New Venue Morning Test (Final Navigation)

| # | Task | Path | Predictable? | Remaining ambiguity |
|---|---|---|---|---|
| 1 | Find a new lead | Sales → Leads | Yes | None |
| 2 | Follow up with a lead | Sales → Leads → open it | Yes | None |
| 3 | See all clients | Clients → Clients | Yes | None |
| 4 | Open everything about one client/event | Clients → Clients → their record | Yes | None |
| 5 | Create a package | Library → Pricing & Packages | Yes | None — single canonical route once the P0 duplicate is resolved (§Part 15) |
| 6 | Find a package template | Library → Pricing & Packages | Yes | Same destination as #5 — correctly, since a Package *is* its own template until applied |
| 7 | Create a questionnaire | Library → Agreements | Yes | None |
| 8 | Find a contract template | Library → Agreements | Yes | None |
| 9 | Send a contract | Financials → Contracts | Yes | None |
| 10 | See whether a contract is signed | Financials → Contracts | Yes | None |
| 11 | Set up a payment plan | Financials → Payments (a starter preset is offered from Library if needed) | Yes | Minor — a first-timer might look in Library first; acceptable, since Library → Payment Schedules exists precisely to be found from that instinct too |
| 12 | See an invoice | Financials → Invoices | Yes | None |
| 13 | Send a message | Communication → Inbox, or from the client's own workspace | Yes | None — intentional dual path (§Part 3) |
| 14 | Create a message template | Library → Communication | Yes | None |
| 15 | Create an automation | Communication → Automations | Yes | None |
| 16 | Build a floor plan | Clients → their event → Floor Plan tab | Yes | None — a first-timer might initially check Library, find the *template*, and correctly realize the live one is inside the event |
| 17 | Create a timeline | Clients → their event → Timeline tab | Yes | Same pattern as #16 |
| 18 | Manage inventory | Library (catalog) to define it; Clients → their event → Inventory tab to apply it | Yes | Two legitimate steps, not one — inherent to the define/apply pattern, not a flaw |
| 19 | Manage vendors | Clients → Vendors | Yes | None |
| 20 | Find a report | Overview → Reports | Yes | None |
| 21 | Get help with a floor-plan icon | Overview → Help & Guides | Yes, if they think to look | Contextual help doesn't exist yet (Phase 2+, not this task's scope) |
| 22 | Find venue-specific guidance | Your Venue → Venue Guide | Yes | None |
| 23 | Find settings | Your Venue → Settings | Yes | None |

**Result: 23 of 23 tasks resolve to a single, predictable path.** The only residual friction (#16–18) is inherent to the define/apply architecture itself, not a navigation defect — and is the same friction a well-designed product *should* have, since it's teaching the venue owner the correct mental model (a template isn't the same thing as this Saturday's actual wedding) rather than hiding it.

---

## Part 14 — Navigation Creep Rule

**Before adding anything to the left navigation, ask:**

> **"Would a venue owner want a single cross-venue list of the live version of this — reviewed on its own, not through any one client or event — and does it fail to fit inside Library, Help & Guides, or Settings?"**

If yes to both, it earns a global nav item. If it's a definition applied to many future bookings, it belongs in Library, not beside it. If it's true only about one relationship, it belongs in that workspace, not the sidebar. If it teaches the product, it's Help & Guides. If it's a venue-wide fact rather than a workspace or a relationship, it's Settings.

**A one-line gut-check version for quick use in product reviews:** *"Is this a place, or is it a fact about a place we already have?"* Contracts is a place. A signed contract's PDF is a fact about the Contracts place — it doesn't get its own nav item.

---

## Part 15 — Migration Impact (Not Implemented)

| Change | Severity | Notes |
|---|---|---|
| Resolve `/packages` vs. `/library/packages` duplicate — canonical route recommended: **`/packages`**, since Library's own existing card already links there, not to `/library/packages` | **P0** | Independent bug fix; not contingent on any other change below |
| Retire "Resources/Templates" as a sidebar section | P1 | Structural — the core of this recommendation |
| Move Vendors from Resources/Templates to Clients | P1 | Route unchanged, section changes |
| Move Tours from "To Do's" to Sales | P1 | Route unchanged, section changes, section itself renamed |
| Rename "To Do's" → "Tasks"; move Requests into it alongside Task Center | P1 | Label + section change |
| Fold Planning, Timelines, Contract Templates, Floor Plans, Inventory, QR Campaigns into Library-only (remove redundant sidebar entries) | P1 | Routes unchanged — already reachable via Library; only the sidebar shortcut is removed |
| Remove Message Templates from the Communication section sidebar entry; Library-only | P1 | Already a Library card; only the redundant top-level entry is removed |
| Demote Pipelines from any promoted Library visibility until connected to real Leads data | P1 | Product decision, not just a nav change — see Part 7 |
| Resolve Venue Guide's dual placement (Operations sidebar item + Library "Communication" card) — keep only the Your Venue sidebar item | P2 | Minor, low-risk |
| Rename "Operations" → "Your Venue" | P2 | Label only |
| No change: Overview, Communication's Inbox/Automations pairing, Financials' internal three items, Help & Guides placement, the Global/Event-workspace boundary, the Library page's own internal grouping | Intentional | Already correct per the audit |

**Redirects likely needed:** `/library/packages` → `/packages` (or the reverse, per the canonical choice above). No other route changes are implied — every other item above is a *sidebar entry* change, not a route change, since the destinations already exist at their Library URLs.

**Internal links / docs to check when implemented (not done here):** any hardcoded links to `/library/packages`; any Help & Guides article copy that references "Resources/Templates" by name (none currently found in the five published articles, but worth a pass at implementation time); this document and the prior audit both reference the current label set and will read as historical once implemented.

---

## Product Decisions Still Required

Two genuine, unresolved questions this document's evidence cannot fully settle, named per the brief's own instruction to separate these from the final recommendation:

1. **Should Pipelines eventually be built out to actually connect to Leads?** This document recommends demoting its visibility today, but whether the underlying connective engineering work (including resolving the seven-stage vocabulary gap named in Part 7) is worth doing at all is a product-prioritization call, not something derivable from the current code.
2. **Canonical Packages route — `/packages` vs. `/library/packages`.** This document recommends `/packages` based on which one Library's own card already links to, but if there's a reason the team prefers the reverse (e.g., URL structure consistency with the rest of Library), that's a legitimate, easy override of this one specific recommendation without affecting anything else in this document.

Everything else in this document is a final, single recommendation — not left open.

---

## Part 16 — Final Decision Table

| Current destination | Final home | Keep as global nav? | Rename? | Notes |
|---|---|---|---|---|
| Library | Library | Yes | — | Single destination; internal grouping unchanged |
| Packages (`/library/packages`) | Library only | No | — | Canonical route: `/packages` (P0 fix required) |
| Contract Templates | Library | No | — | Already a Library card |
| Contracts | Financials | Yes | — | Unchanged |
| Vendors | Clients | Yes | — | Moved section, label unchanged |
| Tours | Sales | Yes | — | Moved section, label unchanged |
| Pipelines | Library (demoted) | No | — | Not promoted until connected to Leads (Part 7) |
| Planning | Library | No | — | Already a Library card ("Planning Templates") |
| Timelines | Library | No | — | Already a Library card ("Timeline Templates") |
| Floor Plans | Library | No | — | Already a Library card ("Floor Plan Templates") |
| Inventory | Library | No | — | Already a Library card |
| QR Campaigns | Library | No | — | Already a Library card |
| Message Templates | Library | No | — | Already a Library card; drop the Communication-section duplicate |
| Task Center | Tasks | Yes | — | Section renamed from "To Do's" |
| Requests | Tasks | Yes | — | Moved from Operations |
| Help & Guides | Overview | Yes | — | Unchanged, confirmed correct |
| Venue Guide | Your Venue | Yes | — | Section renamed from "Operations"; drop the Library-card duplicate |

---

## "If we were launching Hello to Cheers today, this is the sidebar I would ship"

```
OVERVIEW
  Dashboard
  Reports
  Calendar
  Help & Guides

SALES
  Leads
  Tours

CLIENTS
  Clients
  Vendors

COMMUNICATION
  Inbox
  Automations

TASKS
  Task Center
  Requests

FINANCIALS
  Contracts
  Invoices
  Payments

LIBRARY
  Library

YOUR VENUE
  Settings
  Venue Guide
```

This document ends here. No code, schema, navigation, routes, Help & Guides, Luv, or Library was changed in producing it.
