# Left Navigation Information Architecture Audit

**Type:** Discovery and recommendation only. No code, schema, navigation, routes, content, or Help & Guides were modified to produce this document.
**Date:** 2026-08-12
**Method:** Direct inspection of the current working tree — `lib/navigation.ts`, `components/shell/sidebar-nav.tsx`, every destination's own page copy (`PageHeader`/`description` text, read verbatim from source, not paraphrased from memory), `lib/help-guides/areas.ts`, `next.config.ts` redirects, the Library page's real card inventory, the Event workspace's real tab list, and direct database queries against `success_library_articles` for the Help & Guides content state. Working tree confirmed clean (`git status` — zero pending changes) at the start of this audit, so everything below reflects the current, committed product, including the just-completed Help & Guides Phase 1 work.

---

## 1. Executive Summary

The current sidebar is not one navigation model — it's at least three, layered on top of each other as the product grew: a **relationship/lifecycle model** (Pipeline → Clients → Communication), a **database-object model** (Financials: Contracts/Invoices/Payments), and a **junk-drawer model** ("Resources/Templates," which is where anything that didn't obviously belong elsewhere over the last year ended up). A venue owner can learn each individual destination — the pages themselves are well-written, often with excellent, honest, self-aware copy — but the sidebar's *grouping* doesn't teach a consistent story about how those destinations relate to each other.

**The single most important structural finding, confirmed directly from the code:** the product already has the right underlying architecture. Every "duplication" a skeptical read of the sidebar would flag — Contracts vs. Contract Templates, Payments vs. Payment Schedules, Task Center vs. Planning — turns out, on inspection of the actual page copy, to be a real and correctly-implemented **definition vs. instance** pattern (a template is customized once in Library, then applied to a specific client and becomes that client's own record, which lives operationally elsewhere). This is not a case of the product being confused about itself. It's a case of the *navigation* not visibly organizing around a distinction the *product* already makes correctly everywhere else. That's a fixable navigation problem, not a product architecture problem — good news, because it means the fix is IA work, not a rebuild.

**One genuine exception to that good news, found and worth naming precisely:** "Pipeline Templates" (the Library item behind the sidebar's "Pipelines") is not actually the definition side of the real Leads Pipeline. Its own page says so directly: *"Not connected to Leads yet — this is just the editor."* Every other Library/live pairing in this product is a real, wired, working definition-vs-instance pair. This one is scaffolding that looks identical to the others but isn't. Flagged in detail in §4 and §6.

**On Help & Guides specifically:** Phase 1 landed exactly the foundation it set out to build — a real, discoverable, task-oriented destination (`/help`, under Overview, with a persistent nav entry), 12 genuinely task-shaped areas that do **not** mirror the sidebar's own structure (confirmed by comparing the two lists directly — they share almost no vocabulary), and a clean permanent redirect retiring `/success-library`. It is thin on content by design (5 published articles across 12 areas) and has no search yet — both explicitly out of scope for Phase 1, not gaps in this audit's findings. Its current placement (Overview, first section, always visible) is defensible and this audit does not recommend moving it — see §7.

**Severity summary:** 1 P0 (the Packages route duplication — a real bug, not an IA question), 3 P1s (Pipeline Templates' disconnected promise; the "Resources/Templates" section conflating four different kinds of things under one label; Venue Guide appearing in two places with two different implied meanings), a handful of P2 polish items, and — importantly — several places this audit affirmatively says the current structure is correct and should not change.

---

## 2. Current Navigation Inventory

Source: `lib/navigation.ts`, read directly and confirmed against each destination's own page.

| Section | Item | Route | What it actually is (from the page's own copy) | Primary classification | Thing vs. Task |
|---|---|---|---|---|---|
| Overview | Dashboard | `/dashboard` | Cross-venue roll-up: today's priorities, at-a-glance status | Reporting | Task (a place you check) |
| Overview | Reports | `/reporting` | Deeper, filterable reporting across the venue | Reporting | Task |
| Overview | Calendar | `/calendar` | Every booking/tour/event on one calendar | Workflow | Task |
| Overview | Help & Guides | `/help` | 12 task-oriented self-service guide areas | Education | Task ("I'm stuck") |
| Pipeline | Leads | `/leads` | Live inquiries, list + drag-and-drop pipeline view (`/leads/pipeline`) | Workflow / relationship management | Thing (a list of people) and Task (moving them along) |
| Clients | Clients | `/clients` | Booked/active relationships — the Relationship Workspace entry point | Relationship management | Thing |
| Communication | Inbox | `/messaging` | Live conversations with clients | Communication | Task |
| Communication | Message Templates | `/communication/templates` | "Reusable email and text messages... ready to reuse" | Template/library | Thing |
| Communication | Automations | `/communication/series` | "Automated follow-ups that go out on their own... Communication should never require you to remember what to send next" | Configuration | Thing (set up once) |
| To Do's | Tours | `/tours` | Scheduled venue tours | Workflow | Task |
| To Do's | Task Center | `/tasks` | "Your live event workspace — overdue tasks, due today, due this week, and blocked items across all events" | Workflow | Task |
| Resources/Templates | Library | `/library` | The index of every reusable/template destination (see §8) | Template/library (container) | Thing |
| Resources/Templates | Vendors | `/vendors` | "Your preferred vendors and event partners — recommend any of these to a specific client" | Relationship management | Thing |
| Resources/Templates | Planning | `/library/playbooks` | "The planning checklists you've refined over the years... ready to open and apply to any event" | Template/library | Thing |
| Resources/Templates | Timelines | `/library/timeline-templates` | Reusable day-of schedules | Template/library | Thing |
| Resources/Templates | Pipelines | `/library/pipeline-templates` | "Reusable, stage-by-stage pipelines... **Not connected to Leads yet — this is just the editor**" | Template/library (disconnected — see §6) | Thing |
| Resources/Templates | Contract Templates | `/library/contracts` | "Reusable agreements... Signed agreements live under Contracts" (its own copy names the distinction) | Template/library | Thing |
| Resources/Templates | Packages | `/library/packages` | **Confirmed exact duplicate of `/packages`** — same component, same data, near-identical copy | Template/library | Thing |
| Resources/Templates | Floor Plans | `/library/floor-plan-templates` | "Reusable room layouts a venue builds once and applies to any booking" | Template/library | Thing |
| Resources/Templates | Inventory | `/library/inventory` | "Keep a list of the items and amenities your venue provides, then use them to build event-specific inventory" | Template/library | Thing |
| Resources/Templates | QR Campaigns | `/library/qr-campaigns` | Trackable QR codes for print/signage | Marketing tool | Thing |
| Financials | Contracts | `/contracts` | "Prepare, send, and track agreements with your clients" (live records) | Financial/legal workflow | Thing + Task |
| Financials | Invoices | `/invoices` | Live invoices | Financial | Thing |
| Financials | Payments | `/payments` | "Track deposits, installments, and outstanding balances" (live payment schedules, applied from a real invoice) | Financial workflow | Thing + Task |
| Operations | Settings | `/settings` | Venue-wide configuration | Configuration | Thing |
| Operations | Venue Guide | `/guide` | "Everything your clients need to know... Clients browse this in their portal and Luv answers questions from it" | Venue-specific reference content | Thing |
| Operations | Requests | `/requests` | "Everything asked of a couple or vendor, across every booking... filter, assign, and track status" | Workflow | Task |
| Help *(admin-only)* | Feedback/Requests | `/admin/feedback` | Internal HQ tool, gated behind `NEXT_PUBLIC_WEVENU_ADMIN` | Internal administration | Task |

**Not in the sidebar at all, confirmed present and reachable only through Library or a workspace:** Questionnaires & Feedback templates, Inventory Templates, Event Order Templates, Payment Schedules (starters), Brochures, Saved Reports — all six live as cards inside `/library`, none has its own sidebar entry. This is correct and consistent (see §8).

---

## 3. Current Mental Model Assessment

The sidebar is visibly the product of **at least three different organizing principles applied at different times, never reconciled:**

1. **Overview / Pipeline / Clients / Communication** — organized around the **customer lifecycle** (a genuinely coherent model: find them, know them, talk to them).
2. **Financials** — organized around a **database object type** (contract, invoice, payment), not around a task a venue would name. It works because venues do think of "money stuff" as one category, but it's a different organizing logic than the sections above it.
3. **Resources/Templates** and **Operations** — a **catch-all by exclusion**: these are the sections for "everything that's reusable" and "everything left over," respectively. Neither has a positive definition; both are defined by what they aren't.

**Would a new venue owner understand this without training?** Partially, and unevenly. Overview, Pipeline, Clients, and Communication would likely make sense on sight — they follow a story a venue owner already knows ("someone inquires, I follow up, I talk to them"). Financials would make sense too, once they've used the product once (it's a familiar business category even if the internal logic differs from the sections around it). **Resources/Templates is where the model breaks down entirely** — ten items with no shared verb, several of which (Vendors, Pipelines) aren't templates at all by the product's own definition. A first-time user looking at that section has no way to predict what they'll find without opening it and checking.

**Candid assessment:** the lifecycle-organized two-thirds of the sidebar is genuinely good and shouldn't be treated as broken. The catch-all third is the actual problem, and it's a labeling/grouping problem, not a feature problem — everything inside it works correctly once you find it.

---

## 4. Resources / Templates Audit

Answering the brief's own lettered questions directly, against the real code:

**A. Are these all genuinely "resources"?** No. Vendors is a relationship (an ongoing connection with a real business), not a resource anyone configures and applies. QR Campaigns is a marketing tool, not a resource in the same sense as a contract template.

**B. Are they all genuinely "templates"?** No. Library (the item itself) is a container, not a template. Vendors isn't a template of anything. QR Campaigns generates trackable codes — it has no "definition vs. instance" structure the way Contract Templates or Timelines do.

**C. Are they all things a venue configures before using them?** Mostly yes, for eight of the ten (Planning, Timelines, Contract Templates, Packages, Floor Plans, Inventory) — genuinely define-once-apply-many assets. Not true of Vendors (an ongoing relationship, not configured-then-applied) or QR Campaigns (created per-use, not customized-then-reused in the same sense).

**D. Are some actually operational objects rather than templates?** Yes — most importantly, **Packages links to `/library/packages`, which is a byte-for-byte duplicate of `/packages`.** This isn't a template/instance distinction at all; it's the identical page reachable two ways, one of which (per the Library card's own internal link — the Library page's own Packages card points to `/packages`, not `/library/packages`) the product's own more-recent code already treats as canonical. **P0.**

**E. Is "Library" a generic container while other items are also effectively libraries?** Yes, precisely — and this is worth stating plainly: **the Library page (`/library`) already contains a card for eight of these ten sidebar items** (Vendors and Library itself are the only two of the ten without a matching Library card). The sidebar section is substantially a shortcut duplicate of a page that already exists and already organizes the same content better (six labeled groups vs. one flat list of ten).

**F. Is "Planning" too ambiguous?** Yes. "Planning" is used for at least three different things in this product: the Library item (`/library/playbooks`, checklist templates), the Event workspace's own "Playbook" tab (applying those checklists to one specific event), and the general concept of event planning as a business activity. The Library page itself already uses the more precise label "Planning Templates" for this same destination — the sidebar's shorter "Planning" is the less precise of the two labels for the identical page.

**G. Is "Pipelines" actually a resource/template or a business workflow?** **Neither, currently — this is the audit's most important finding in this section.** The real business workflow (moving a lead through stages) lives at `/leads/pipeline` and is powered by a working, tested mapping (`lib/leads/pipeline-stage-mapping.ts`) between lead status and a small, fixed, canonical stage vocabulary (inquiry → tour → proposal → decision → booked/lost/cancelled). The sidebar's "Pipelines" item, however, points to `/library/pipeline-templates` — a *separate*, custom-stage-naming editor whose own on-page copy states outright: **"Not connected to Leads yet — this is just the editor."** A venue owner who customizes a pipeline template there and expects it to change what `/leads/pipeline` shows will be wrong, and the product currently has no in-UI warning telling them so. This is a real gap in the underlying feature, surfaced by this navigation audit, not manufactured by it — the code's own comment names it.

**H. Are Vendors being grouped in a way that makes sense?** No. Vendors is a relationship system (claim, invite, assign to a specific event, message directly) — structurally the same *kind* of thing as Clients, not the same kind of thing as a Contract Template. It sits in "Resources/Templates" only because it isn't Financial and isn't obviously Communication — a placement by elimination, not by fit.

**I. Are Floor Plans, Inventory, Packages, Timelines, etc. actually the same underlying concept, or materially different?** They are, genuinely, the **same underlying concept** — venue-authored, define-once-apply-many catalog assets — confirmed by near-identical language across every one of their own page descriptions ("reusable," "apply to any booking," "starting points to customize"). This is the one part of "Resources/Templates" that's internally consistent; the problem is that Vendors, Pipelines, QR Campaigns, and Library itself don't share that shape and are grouped with them anyway.

**J. Are we forcing unrelated things together simply because they were added over time?** Yes, this is the accurate diagnosis for the section as a whole. It reads exactly like a section that started as one or two genuine template destinations and became the default landing spot for anything new that wasn't obviously Financial, Communication, or a to-do.

---

## 5. Financials Audit

Contracts, Invoices, and Payments **do belong together** — confirmed by their own page copy, all three describe live, per-client financial/legal artifacts, and a venue owner already groups "the money and paperwork side of a booking" as one mental category regardless of internal data model. This section is one of the more defensible groupings in the current sidebar.

**Their relationship to Packages, Event Orders, and Payment Plans is real and correctly built, just invisible from the sidebar alone:** a Package (Library) gets added to an Invoice; a Payment Schedule (Library "Payment Schedules" starter) gets applied to a real Invoice's total, never re-typed; a Contract Template (Library) becomes a real Contract once sent. The sidebar shows the live side of all three relationships (Contracts/Invoices/Payments) but not the definition side — which is fine, because the definition side already has one home (Library) and doesn't need a second.

**Verdict:** Financials creates an understandable category ("money and legal paperwork"), not merely a database-object list — the fact that it happens to match three tables is a byproduct of good naming, not evidence of a database-driven mental model.

---

## 6. Communication Audit

Inbox, Message Templates, and Automations belong together for the same reason Financials does — a venue owner already thinks of "how I talk to people and what I've automated" as one bucket. **Automations** as a label is understandable on its own but slightly under-explains itself compared to its own page copy, which is excellent ("Communication should never require you to remember what to send next") — the label alone doesn't carry that promise; a venue has to click in to learn what it does. Not a blocking problem, but the single largest gap between "how good the page is" and "how much the nav label tells you" found in this audit.

**Should communication be organized around relationships rather than tools?** This is a real, defensible alternative and this audit does not think it's clearly better. A relationship-first Communication (i.e., "message a specific couple" reached only from that couple's own workspace) would remove the one global "Inbox" venues actually want when triaging *all* conversations at once, across every couple, before deciding who to respond to first. The current tool-first Communication section correctly serves that triage need; the relationship-first path already exists too, via each Client's own Conversation tab. Both paths existing simultaneously is intentional, not duplication — see §10.

**"Where would a venue owner go to contact a couple?"** Two correct answers exist today, and both are reasonable: Communication → Inbox (if triaging across everyone) or Clients → that couple's workspace → Conversation tab (if already looking at that one relationship). No confusion found in testing this mentally against real page copy — this is the same, intentional dual-path pattern found throughout the product (see §11).

---

## 7. To Do's Audit

Tours and Task Center are grouped together as "things I need to do," but they're different in kind: Tours is a specific, scheduled, calendar-bound event type; Task Center is an aggregated, cross-event action list. The grouping isn't wrong, but the section label "To Do's" undersells Task Center specifically — Task Center's own copy calls itself "your live event workspace," a materially bigger and more central concept than the casual "To Do's" label implies.

**Task Center vs. Planning — is the distinction clear?** Yes, and it's the same definition-vs-instance pattern found everywhere else once you look at the actual copy: Planning (Library) = checklist templates, reusable, not yet attached to any real booking. Task Center = the live aggregation of tasks that have already been generated (via a Playbook applied inside a specific Event) across every current booking. No duplication — Task Center doesn't let you build a checklist, and Planning doesn't show you what's overdue today. The distinction is correct; it's simply not visible from the sidebar's grouping (Planning sits three sections away, under Resources/Templates, from the Task Center it eventually feeds).

---

## 8. Library Assessment

**Does "Library" mean one coherent thing to a venue owner?** Reasonably well, once inside it — its own internal grouping (Agreements / Pricing & Packages / Planning / Communication / Marketing / Reports) is a genuinely good, coherent breakdown of "things I define once and reuse." The word "Library" itself is slightly generic (a venue owner's first guess at its contents would likely be "documents," not "every reusable template in the product"), but it does no active harm, and no better single word was found in this audit that wouldn't also require explanation.

**Does it deserve a first-class nav position?** Yes — but currently the sidebar undermines its own answer by *also* giving eight of Library's own contents their own separate, competing top-level entries. The fix implied by this audit's findings (not prescribed here — see the Stop Condition) is not to remove Library, but to stop duplicating its contents as separate sidebar items. Library, kept as a single destination with its existing internal grouping, is doing real, coherent work today; the redundant flat list next to it is not.

**Special note on Venue Guide:** it currently appears both as an Operations sidebar item (`/guide`) *and* as a Library "Communication" card, and the two contexts imply two different meanings — Operations implies "venue configuration," while Library implies "a reusable resource for reuse across bookings." Its actual nature (a single, always-current, venue-specific reference the client reads and Luv answers questions from) is closer to the Operations framing. This is a real, minor conceptual collision, not just a routing duplicate like Packages — the same *page* is being asked to mean two different things in two different places. **P1.**

---

## 9. New-Venue Morning Test

Eighteen tasks, each assessed against the actual current sidebar (not a hypothetical one).

| # | Task | Obvious destination? | Nav decisions | Notes |
|---|---|---|---|---|
| 1 | Find first new lead | Yes — Pipeline → Leads | 1 | Clean |
| 2 | Follow up with a lead | Yes — open the lead itself | 1–2 | Clean |
| 3 | See all current clients | Yes — Clients → Clients | 1 | Clean |
| 4 | Open everything about one couple | Yes — Clients → their record | 1–2 | Clean, Relationship Workspace working as intended |
| 5 | Create first package | Ambiguous — Resources/Templates → Packages (`/library/packages`), but the destination it lands on is a duplicate of a page reachable another way | 1, but lands on the confirmed duplicate route | **P0 bug surfaces here directly** |
| 6 | Set up inventory | Yes, but requires knowing "Inventory" under Resources/Templates means the catalog, not a specific event's inventory | 1–2 | Minor hesitation, not blocking |
| 7 | Create a floor plan | Ambiguous — "Floor Plans" under Resources/Templates is actually Floor Plan *Templates*; a per-event floor plan is built inside that event's own workspace tab | 1, but wrong destination for "a floor plan for Saturday's wedding" specifically | Real but minor — label doesn't say "Templates" |
| 8 | Create a timeline | Same pattern as #7 — "Timelines" is templates; a live timeline is built inside the event | 1, same caveat | Same as above |
| 9 | Send a contract | Yes — Financials → Contracts | 1 | Clean |
| 10 | See if a contract is signed | Yes — same destination as #9 | 1 | Clean |
| 11 | Collect a payment | Yes — Financials → Payments | 1 | Clean |
| 12 | Send a message | Yes — Communication → Inbox | 1 | Clean |
| 13 | Set up an automated message | Mostly — "Automations" is a fine label once you know what it does, less obvious cold | 1 | Minor label gap, see §6 |
| 14 | Find a report | Yes — Overview → Reports | 1 | Clean |
| 15 | Find help explaining a floor-plan icon | Yes, if they think to check Help & Guides — currently no in-place "?" affordance on the floor plan editor itself pointing there (confirmed: Phase 1 explicitly does not include contextual help) | 1–2 | Working as designed for Phase 1; a known, named future phase, not a Phase-1 gap |
| 16 | Learn how to invite a couple to their portal | Yes — a real, published Help & Guides article exists for exactly this ("Inviting Your First Couple to Their Portal," confirmed in the database) | 1–2 | Clean, and a good sign Phase 1's content prioritization is on target |
| 17 | Change venue branding | Yes — Operations → Settings | 1 | Clean |
| 18 | Find something they don't understand | Yes — Help & Guides is in the first sidebar section, always visible | 1 | Clean, discoverability confirmed by placement alone |

**Overall:** 13 of 18 tasks resolve cleanly in one or two decisions. The remaining 5 all trace back to the same two root causes already identified above: the Packages route duplication (#5), and the Library-item-labels-don't-say-"Templates" pattern that makes Floor Plans/Timelines/Inventory read as operational when they're actually definitional (#6, #7, #8). No task failed outright; the friction found is real but narrow and consistent, not scattered.

---

## 10. Duplication / Overlap Findings

| Pair | Verdict | Basis |
|---|---|---|
| Library vs. Contract Templates | **Legitimate — but redundant nav entry.** Contract Templates is a real Library card; the sidebar just also lists it separately. | Confirmed both destinations are the same route |
| Library vs. Planning | Same as above | Same route (`/library/playbooks`) reachable from both |
| Library vs. Timelines | Same as above | Same route reachable from both |
| Library vs. Packages | **Legitimate distinction corrupted by a real bug** — `/library/packages` and `/packages` are near-identical duplicate *pages*, not just duplicate nav entries | Confirmed via full file diff |
| Planning vs. Task Center | **Legitimate distinction.** Definition (template) vs. live aggregation. Correctly separate destinations. | Confirmed via both pages' own copy |
| Pipelines vs. Leads | **Not a legitimate distinction today — a disconnected promise.** Pipeline Templates does not feed the real Leads pipeline. | Confirmed via the page's own copy and the stage-mapping code |
| Clients vs. Inbox | **Legitimate — both are correct, intentional dual paths** (triage-all vs. one-relationship), not competing homes | Confirmed via both pages' framing |
| Vendors vs. event Vendors tab | **Legitimate.** Global Vendors = the venue's whole network (claim/manage relationships). Event's own Vendors tab = which of those vendors are assigned to *this* booking. Same definition-vs-instance pattern as everything else. | Confirmed via both pages |
| Help & Guides vs. Venue Guide | **Legitimate, and already well-distinguished by content, not just label** — Help & Guides teaches the *product*; Venue Guide is venue-specific reference content the *client* reads. No blur found in the actual content. | Confirmed via `/guide` and `/help` copy |
| Reports vs. Dashboard reporting | **Legitimate.** Dashboard = today's cross-venue snapshot; Reports = deliberate, filterable, deeper analysis. Standard, well-understood pairing. | Confirmed via both pages |
| Contracts vs. Contract Templates | **Legitimate, and self-documented** — the Template page's own copy states "Signed agreements live under Contracts." | Confirmed directly in source |
| Payments vs. Payment Plans (Payment Schedules) | **Legitimate.** Payments = live, per-client schedules. Payment Schedules (Library) = static starter presets, explicitly "not a second DB template system" per its own code comment. | Confirmed via source comment |
| Inventory vs. Floor Plans | **Legitimate — different domains, same shape** (catalog items vs. room layout), correctly kept as separate destinations, not duplicative of each other. | Confirmed via both pages |

**Pattern across nearly every "duplication" investigated:** the *feature* almost never duplicates. The *sidebar entry* duplicates a destination Library already links to. This is the single unifying diagnosis of this entire audit.

---

## 11. Global vs. Event-Level Boundary

The product already draws this line correctly and consistently; the sidebar mostly respects it. Confirmed via the Event workspace's real 14 tabs (`components/events/event-detail.tsx`): Overview, Playbook, Timeline, Floor Plan, Documents, Vendors, Event Order, Inventory, Invoice, Conversation, Activity, Notes, Team, Feedback. **None of these 14 has a competing, same-named global sidebar entry pretending to be the same live destination.** The global "Floor Plans," "Timelines," "Inventory," and "Vendors" sidebar items are all, correctly, the *definition* or *network* side, not a duplicate of the live per-event work.

Proposed classification of every current destination:

- **Global Venue Management** (cross-client, operational): Dashboard, Reports, Calendar, Leads, Clients, Inbox, Tours, Task Center, Contracts, Invoices, Payments, Requests, Vendors (the network)
- **Event / Client Workspace** (inside one relationship, not globally navigable — correctly not duplicated in the sidebar): the 14 Event tabs, plus each Client's own detail view
- **Configuration / Library**: Library and everything inside it (Contract Templates, Planning Templates, Timeline Templates, Pipeline Templates, Packages [definition side], Floor Plan Templates, Inventory [catalog], Inventory Templates, Payment Schedules, Message Templates, QR Campaigns, Brochures, Questionnaires & Feedback templates, Event Order Templates, Saved Reports), plus Settings and Venue Guide
- **Help / Education**: Help & Guides
- **Administration**: the admin-only Feedback/Requests section (internal, gated, correctly out of venue-facing consideration)

The sidebar's problem isn't that it violates this boundary — it's that "Configuration / Library" is currently split across two visually separate places (a real Library section, and a redundant flat list under "Resources/Templates") instead of being one place.

---

## 12. Help & Guides Placement Assessment

**Current placement:** first item... no, fourth item in Overview, always visible, one click from anywhere. Confirmed live and correct against `lib/navigation.ts`.

Evaluated against each option the brief asks about:

- **Under Overview (current):** defensible — Overview is already "the things I check without needing a specific reason," and "I need help" is exactly that kind of unprompted need. This audit's recommendation: **keep it here.**
- **Under Operations:** would bury it next to Settings — a section a venue visits rarely and only with intent. Help is needed unpredictably, often mid-task, which argues against a low-traffic section.
- **Under Resources:** would misclassify Help & Guides as a template/reusable-asset, which it isn't — it's read, not applied to a booking. Also, "Resources/Templates" is itself the section most in need of narrowing (§4), not a good place to add more.
- **Its own top-level category:** considered and rejected by this audit — a one-item section for something used occasionally (not daily) would itself be a small instance of the over-navigation this brief explicitly warns against (§17 of the brief). Overview already gives it maximum discoverability without that cost.
- **Near Settings:** same objection as Operations above — wrong traffic pattern.
- **As a utility rather than a business function:** this is arguably the most accurate characterization of what Help & Guides *is*, but "where it conceptually belongs" and "where it should be discoverable" aren't the same question — this audit optimizes for the second, per the brief's own instruction not to assume importance dictates placement.

**Recommendation: no change.** Current placement already satisfies the brief's own test ("I'm confused — where do I go for help — and find it immediately") better than any alternative considered.

---

## 13. Recommended Mental Model

Derived from the product as it actually exists today — not proposed first and then justified.

The product already, correctly, separates two different jobs for every reusable concept: **define it once** (Library), and **use it on a real relationship** (a workspace). The sidebar should make that distinction the organizing structure of its non-lifecycle sections, rather than letting "Resources/Templates" pretend to be a third, separate category alongside Financials and Communication when it's actually the *definition side* of things that already have a *live side* elsewhere in the sidebar.

The clearest model, built from what's actually here:

1. **Overview** — the unprompted-need section: today's snapshot, deeper reports, the calendar, and help.
2. **Sell** — the pre-booking relationship: Leads and Tours belong together (both are about a person who hasn't booked yet), more naturally than Tours sitting in a generic "To Do's" bucket.
3. **Clients** — the post-booking relationship, including the ongoing Vendor relationships that support it (Vendors is structurally a relationship, not a template, per §4H — it belongs here, not in a templates section).
4. **Communication** — unchanged; already coherent.
5. **Tasks** — Task Center and Requests belong together: both are cross-event, cross-relationship action lists, just pointed in different directions (things the venue owes vs. things the venue is waiting on). Keeping them adjacent, rather than splitting Requests into Operations, makes that relationship visible instead of hidden.
6. **Financials** — unchanged; already coherent.
7. **Library** — the single definitional home, replacing "Resources/Templates" entirely. Its existing internal grouping already does the organizing work a flat sidebar list can't.
8. **Your Venue** — Settings and Venue Guide (configuration and always-current venue-specific reference), the two things visited with intent, not daily.

This is not a rebuild — six of the current nine sections survive essentially unchanged. The correction is narrow: retire the catch-all, and let each of its members go to the section it already conceptually belongs to.

---

## 14. Recommended Navigation

For clarity, presented as sections with rationale — **this is the audit's recommendation, not an instruction to implement it** (see Stop Condition).

```
OVERVIEW
  Dashboard, Reports, Calendar, Help & Guides
  Why: things checked without a specific task in mind.
  Not here: anything that requires deciding to act on a specific person or record.

SELL
  Leads, Tours
  Why: the pre-booking relationship — a person hasn't committed yet.
  Not here: anything post-booking.

CLIENTS
  Clients, Vendors
  Why: both are ongoing relationships the venue manages over time, not templates.
  Not here: per-event vendor assignment (that's the Event workspace's own tab).

COMMUNICATION
  Inbox, Message Templates, Automations
  Why: unchanged — already a coherent, working section.
  Not here: nothing needs to move.

TASKS
  Task Center, Requests
  Why: both are cross-relationship action lists; adjacency makes the "mine vs. waiting-on-someone-else" relationship visible.
  Not here: Tours (moved to Sell, above) or Planning (a Library definition, not a live task list).

FINANCIALS
  Contracts, Invoices, Payments
  Why: unchanged — already coherent, already understood by venues as one category.
  Not here: template/definition versions of any of these (Library owns those).

LIBRARY
  (single destination; internal grouping — Agreements / Pricing & Packages / Planning / Communication / Marketing / Reports — already does the rest)
  Why: one home for everything a venue defines once and reuses.
  Not here: Vendors (a relationship, not a definition — see Clients above).

YOUR VENUE
  Settings, Venue Guide
  Why: configuration and always-current venue-specific reference — visited with intent, not daily.
  Not here: Help & Guides (that's product education, not venue configuration — stays in Overview).
```

**What this removes from top-level nav entirely:** nine of the ten current "Resources/Templates" entries (Library survives as the section itself; Vendors moves to Clients; the other eight collapse into Library's own existing internal grouping, which already lists them).

---

## 15. Migration / Change Impact

Sequenced, but **not implemented** — provided only so the size of the change is understood, per the brief's own request.

- **Phase 1 (bug fix, not IA):** resolve the `/packages` vs `/library/packages` duplicate route. Independent of any navigation decision; can happen on its own timeline.
- **Phase 2 (label-only):** clarify that the Library items currently sharing near-identical names with live destinations (Floor Plans, Timelines, Inventory) read as "Templates" — matching the wording the Library page itself already uses internally. Zero route changes, no muscle-memory disruption.
- **Phase 3 (section restructure):** retire "Resources/Templates" as a section; move Vendors to Clients; move Tours to a renamed Sell section alongside Leads; move Requests adjacent to Task Center; the remaining eight items collapse into Library (already reachable there today — this removes a redundant path, not a destination).
- **Phase 4 (optional, lowest priority):** resolve the Venue Guide dual-placement (§8) by removing its Library card, keeping only the Operations/Your-Venue entry.

**Impact on muscle memory:** moderate for Phase 3 — venues who've learned "Resources/Templates" as a location will need to relearn that eight of its ten items now live one click deeper, inside Library. This is a real cost and should be weighed against the clarity gained, not treated as free.

---

## 16. Items That Should NOT Be Changed

Stated explicitly, per the brief's own instruction not to over-correct:

- **Overview, Communication, Financials sections** — all three are already coherent, well-labeled, and correctly scoped. No changes recommended.
- **Help & Guides placement** — already correct; see §12.
- **The Global vs. Event-workspace boundary** — already correctly drawn throughout the product; the 14 Event tabs are not duplicated in global nav anywhere, and shouldn't be.
- **The Contracts/Contract Templates, Payments/Payment Schedules, Task Center/Planning pairs** — all three are genuine, working, correctly-built definition-vs-instance pairs. Their *separation* is correct; only their *distance from each other in the sidebar* (currently three sections apart in some cases) is worth noting, not their existence as separate destinations.
- **Dual-path access to Communication** (global Inbox vs. per-client Conversation tab) — intentional, serves two different real needs, not a defect.
- **Library's own internal grouping** — already good; this audit recommends giving it more responsibility (absorbing the sidebar's redundant items), not restructuring it.

---

## 17. Open Product Decisions

Only genuine, unresolved questions this audit's evidence cannot settle on its own:

1. **Pipeline Templates: connect it, relabel it, or defer it?** The disconnection between the Library's pipeline editor and the real Leads pipeline (§4G) is a product decision, not a navigation one — this audit surfaces it because the current label ("Pipelines," presented alongside genuinely working templates) implies a working feature that doesn't yet exist. Three real options: build the missing connection, relabel the Library item to make clear it's a preview/mockup tool rather than a live customization, or leave it as-is with the honest in-page disclosure it already has (arguably sufficient, since the page itself already tells the truth).
2. **Does "Sell" (Leads + Tours) read naturally to venues, or does grouping Tours away from "To Do's" cost more familiarity than it gains in clarity?** Both structures are defensible; this audit recommends the grouping in §14 but flags it as the single most debatable individual placement decision in the whole recommendation.
3. **Requests + Task Center adjacency — is the distinction (things I owe vs. things I'm waiting on) intuitive enough on its own, or does it need a visible sub-label to avoid becoming its own new point of confusion?** Not resolvable from code inspection alone — this is a real usability question that would benefit from watching an actual venue owner encounter both for the first time.

---

## 18. Final Recommendation

**Recommended Next Step:** Fix the confirmed `/packages` duplicate route first — it's a real bug independent of any IA decision and the lowest-risk, highest-confidence item in this entire audit. Everything else in this document is a navigation-grouping recommendation, not a defect, and can be sequenced deliberately (per §15) whenever the team is ready to take on the muscle-memory cost named in that section. Help & Guides Phase 1 needs no navigation changes as a result of this audit — its placement is already correct.

This audit ends here. No code, schema, navigation, or content has been changed in producing it.
