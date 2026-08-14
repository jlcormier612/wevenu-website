# Library IA — Final Decision Pass

**Type:** Product decision only. No code, schema, migrations, or UI were modified to produce this document.
**Method:** Read `docs/library-ia-final-recommendation.md`, `docs/library-ia-current-state.md`, `docs/library-ia-implementation.md`, `docs/left-navigation-final-recommendation.md`, `docs/left-navigation-implementation.md`, and `docs/library-interaction-model-standardization.md` in full, then verified the current working tree directly against them (`app/(app)/library/page.tsx` read in full, plus the individual destination pages for every label named in Decision E). **No contradiction found** between the documented state and the current working tree — the 6-group, 14-card structure, the Venue Guide/Pipeline removals, and the Packages canonical redirect are all confirmed exactly as documented. This document resolves Decisions A–G with no alternatives left open, per instruction.

---

## Executive Summary

Six of seven decisions resolve to **keep the current structure**, confirming the prior implementation pass got nearly everything right on the first attempt. Two real, evidence-backed changes are recommended: **move the Inventory catalog and Inventory Templates from Pricing & Packages to Planning** (Decision D — the one place this pass found a genuine conceptual mismatch), and **correct two confirmed, live label inconsistencies** (Decision E — "Packages & Inventory" as a page title when the page contains no Inventory content at all, and the Library home description's "every wedding" framing, which doesn't hold for Saved Reports). Everything else — the six group names, the Communication group's single card, Saved Reports' Library placement, and QR Campaigns' Library placement — is confirmed correct and should not change.

---

## A — Communication

**Recommendation: KEEP.** A single-card group is not, on its own, a problem — "Reports" is also a single-card group today and causes no confusion, because both labels are accurate to their one contents card regardless of size.

**Why:** Folding Message Templates into Marketing (as the recommendation doc's option 2 considered) would be a worse fit than leaving it alone — a message is not a marketing artifact, and forcing it under Marketing would teach a venue the wrong category boundary the next time a real Communication asset is added. Renaming the group (option 3) solves a problem that doesn't exist yet — "Communication" is already the correct, accurate word for what's there.

**Exact resulting placement:** unchanged — `Communication → Message Templates`.

**Code change required:** No.

**Implement now or defer:** N/A — no change.

**Confidence:** High. The one-card shape is cosmetic, not conceptual; nothing about it would confuse a venue owner scanning the page.

---

## B — Category Names

**Recommendation: KEEP all six** — Agreements, Pricing & Packages, Planning, Communication, Marketing, Reports.

**Why, evaluated individually:**
- **Agreements** — the weakest-fitting of the six (a Questionnaire isn't literally an "agreement"), but both cards under it share the real underlying shape ("paperwork you send a couple to fill out or sign"), and a venue would resolve any ambiguity within seconds of seeing the two cards. Not confusing enough to warrant a change.
- **Pricing & Packages** — accurate for Packages and Payment Schedules; its fit with Inventory is the actual problem, resolved by moving Inventory out (Decision D), not by renaming the group.
- **Planning, Communication, Marketing, Reports** — all confirmed accurate to their contents, no issue found.

**Exact resulting placement/label:** unchanged for all six.

**Code change required:** No.

**Implement now or defer:** N/A.

**Confidence:** High for Planning/Communication/Marketing/Reports. Medium-high for Agreements — defensible as-is, but the single softest name in the set if this is ever revisited after real customer feedback.

---

## C — Saved Reports

**Recommendation: KEEP in Library.**

**Why:** Confirmed directly in code — `/reporting` (the Overview → Reports operational destination) **does not link to Saved Reports anywhere in its own navigation or tabs.** The Library card is not a redundant second path to something already discoverable elsewhere; it is currently the **only** discoverable path to Saved Reports at all, aside from a direct URL. Removing it, as the original recommendation's option 2 considered, would make a real, working feature effectively unreachable. Saved Reports also genuinely fits the Library shape once the definition is read plainly — "a filter/date-range configuration you set up once and return to repeatedly" is a definition-you-reuse, even though what it reuses is a live view rather than a document copied onto an event.

**Exact resulting placement:** unchanged — `Reports → Saved Reports`, `/reporting/saved`.

**Code change required:** No.

**Implement now or defer:** N/A.

**Confidence:** High. This is the one decision in this pass with a hard, unambiguous fact behind it (no incoming link from Reports) rather than a judgment call.

---

## D — Inventory

**Recommendation: MOVE.** Both **Inventory (catalog)** and **Inventory Templates** move from **Pricing & Packages** to **Planning**.

**Why:** The catalog is genuinely a Library asset — confirmed, it follows the same definition-to-instance pattern as everything else in Library (a catalog item is copied into a specific event's inventory, the same shape as a Contract Template becoming a Contract). The question was never *whether* it belongs in Library, only *which group*. Its own page copy is the deciding evidence: *"Keep a list of the items and amenities your venue provides, then use them to build event-specific inventory"* — this is a "getting the event physically ready" concept, the same mental category as Floor Plan Templates and Event Order Templates, not a "what am I charging for" concept, which is what actually unifies Packages and Payment Schedules. Inventory Templates moves with it rather than staying behind, because splitting a catalog from its own starter bundles across two different groups would be a worse outcome than the mismatch being fixed — a venue managing "what we typically use for a wedding" (Inventory Templates' own description) is doing planning work, not pricing work, and should find both in the same place.

**Exact resulting placement:**
```
Pricing & Packages
  Packages
  Payment Schedules

Planning
  Planning Templates
  Timeline Templates
  Floor Plan Templates
  Event Order Templates
  Inventory
  Inventory Templates
```

**Code change required:** Yes — moving two `ToolboxCard` entries between two `Group` blocks in `app/(app)/library/page.tsx`. No route, schema, or data change.

**Implement now or defer:** Implement now — small, low-risk, and it's the one substantive structural gap this whole pass found.

**Confidence:** High on the conceptual fit; medium-high on bundling Inventory Templates into the same move (a defensible, evidence-based extension of the brief's own question, not a scope departure, but worth naming as the one place this document went slightly beyond the letter of what was asked).

---

## E — Labels

Resolved individually, current → final, KEEP where no change is warranted:

| Item | Current | Final | Rationale |
|---|---|---|---|
| Packages page title | **"Packages & Inventory"** (`app/(app)/packages/page.tsx`) | **"Packages"** | Confirmed live: this page renders only `PackageList`/`getPackagesWithItems` — it contains no Inventory content whatsoever. The title is not a stylistic mismatch, it's factually wrong about what the page shows. This is the one label in this pass that is an outright error, not a judgment call. |
| Library card | "Packages" | KEEP | Already correct; the page title needs to match the card, not the reverse. |
| Questionnaires & Feedback | "Questionnaires & Feedback" | KEEP | Accurate — confirmed the templates behind it genuinely span Client Planning Questionnaire, Final Details, and Post-Event Feedback; the "& Feedback" isn't padding, it's describing real scope. |
| Contract Templates | KEEP | KEEP | Clear. |
| Planning Templates | KEEP | KEEP | Clear. |
| Timeline Templates | KEEP | KEEP | Clear. |
| Floor Plan Templates | KEEP | KEEP | Clear. |
| Event Order Templates | KEEP | KEEP | Clear. |
| Inventory Templates | KEEP | KEEP | Clear, and now correctly adjacent to its own catalog under Planning (Decision D). |
| Payment Schedules | KEEP | KEEP | Clear. |
| Message Templates | KEEP | KEEP | Clear. |
| QR Campaigns | KEEP | KEEP | Clear. |
| Brochures | KEEP | KEEP | Clear. |
| Saved Reports | KEEP | KEEP | Clear. |
| Inventory catalog page title | "Your Inventory" vs. Library card "Inventory" | KEEP both | Not a real inconsistency — "Your Inventory" is a natural, personalized restatement of the same word, not a competing term. |

**Code change required:** Yes, one string (`app/(app)/packages/page.tsx` metadata title + `PageHeader` title). No other label changes.

**Implement now or defer:** Implement now — a one-line, zero-risk correction of a factually wrong page title.

**Confidence:** High.

---

## F — QR Campaigns

**Recommendation: KEEP in Library, Marketing group.**

**Why:** QR Campaigns pass the same definition-to-instance test as everything else recommended to stay — a campaign is configured once (destination link, design) and then printed/reused across many physical placements and scans, the same "define once, apply many times" shape as a Contract Template or Package, even though what it "applies to" is a physical sign rather than a single event. The live layer here — scan analytics — is a secondary, real-time overlay on top of the definition, exactly the same relationship a Package has to the invoice line items it eventually produces; the presence of live data doesn't reclassify the definition itself. No existing operational "Marketing" destination exists anywhere in the current navigation for this to move to, and inventing one would directly violate the instruction not to build a new marketing system to house it.

**Exact resulting placement:** unchanged — `Marketing → QR Campaigns`.

**Code change required:** No.

**Implement now or defer:** N/A — no change. **Deferred consideration, explicitly not for now:** if QR scan analytics ever grow into a substantial, frequently-checked live dashboard in their own right, *that specific reporting layer* (not the campaign-definition card) might eventually warrant its own operational home — this is a future possibility, not a current gap, and is not being recommended here.

**Confidence:** High.

---

## G — Description

**Recommendation: REVISE.**

**Current:** *"Your venue's toolbox — everything reusable, in one place. Templates you build once and use for every wedding."*

**What's inaccurate:** "Templates you build once and use for every wedding" is a good description for roughly two-thirds of the 14 cards (Contract Templates, Packages, Inventory, Timeline/Floor Plan/Event Order Templates, Payment Schedules) but breaks down for the rest — a Saved Report has nothing to do with a wedding at all, and a QR Campaign is a standing tool, not something meaningfully described as a "template… for every wedding."

**Final copy:**

> *"Your venue's toolbox — the things you set up once and use again and again: agreements, packages, planning tools, marketing, and more."*

This keeps "toolbox" (already warm, already understood, no reason to lose it), replaces the too-narrow "Templates… for every wedding" with the broader and equally plain "set up once and use again and again" (true of every one of the 14 cards without exception, including Saved Reports and QR Campaigns), and keeps the sentence short enough to read in the same glance as the original.

**Code change required:** Yes — one string (`app/(app)/library/page.tsx`, the `PageHeader` `description` prop).

**Implement now or defer:** Implement now — bundles naturally with the other two small copy/placement fixes in this pass (Decisions D and E).

**Confidence:** High that the current copy is inaccurate for a real subset of cards; medium-high that the exact replacement wording above is the best possible phrasing (a legitimate, low-stakes place for a final polish pass at implementation time, without reopening the underlying decision).

---

## Whole-Library Usability Check

Every item the brief asked to trace, after applying Decisions A–G:

| "I need to find X" | Where a venue goes | Inside or outside Library? |
|---|---|---|
| Contract template | Agreements → Contract Templates | Library |
| Questionnaire | Agreements → Questionnaires & Feedback | Library |
| Message template | Communication → Message Templates | Library |
| Package | Pricing & Packages → Packages | Library |
| Inventory item | Planning → Inventory *(moved)* | Library |
| Inventory template | Planning → Inventory Templates *(moved)* | Library |
| Payment plan | Pricing & Packages → Payment Schedules | Library |
| Planning template | Planning → Planning Templates | Library |
| Timeline template | Planning → Timeline Templates | Library |
| Floor plan template | Planning → Floor Plan Templates | Library |
| Event order template | Planning → Event Order Templates | Library |
| Brochure | Marketing → Brochures | Library |
| QR campaign | Marketing → QR Campaigns | Library |
| Saved report | Reports → Saved Reports | Library |
| Venue Guide | Your Venue → Venue Guide | **Outside Library, correctly** |
| Pipeline Template | Sales → Leads → Pipeline Templates / Pipeline board | **Outside Library, correctly** |

**Verdict: every item resolves to exactly one predictable home, with the two intentional exceptions landing exactly where the governing principles require.** No remaining ambiguity found.

---

## Final Decision Table

| Decision | Final recommendation | Exact placement/label | Implement now? |
|---|---|---|---|
| A — Communication | Keep as-is | `Communication → Message Templates` | No change |
| B — Category names | Keep all six | Agreements / Pricing & Packages / Planning / Communication / Marketing / Reports | No change |
| C — Saved Reports | Keep in Library | `Reports → Saved Reports` | No change |
| D — Inventory | Move both catalog and templates | `Planning → Inventory, Inventory Templates` | **Yes** |
| E — Labels | Fix one factual error | `/packages` page title → "Packages" | **Yes** |
| F — QR Campaigns | Keep in Library | `Marketing → QR Campaigns` | No change |
| G — Description | Revise Library home copy | New one-sentence description (above) | **Yes** |

---

## Final Library IA

```
LIBRARY (/library)

  Agreements
    Contract Templates          → /library/contracts
    Questionnaires & Feedback   → /library/questionnaire-templates

  Pricing & Packages
    Packages                    → /packages
    Payment Schedules           → /library/payment-schedules

  Planning
    Planning Templates          → /library/playbooks
    Timeline Templates          → /library/timeline-templates
    Floor Plan Templates        → /library/floor-plan-templates
    Event Order Templates       → /library/event-order-templates
    Inventory                   → /library/inventory
    Inventory Templates         → /library/inventory-templates

  Communication
    Message Templates           → /communication/templates

  Marketing
    QR Campaigns                → /library/qr-campaigns
    Brochures                   → /library/brochures

  Reports
    Saved Reports                → /reporting/saved
```

**Not on Library home, unchanged:** Pipeline Templates (Sales → Leads), Venue Guide (Your Venue).

---

## Final Navigation / Library / Your Venue / Sales / Help Model

- **Global Navigation — where the venue works.** Live, operational destinations: Leads, Clients, Vendors, Inbox, Automations, Task Center, Requests, Contracts, Invoices, Payments, Calendar, Dashboard, Reports.
- **Library — what the venue creates, manages, and reuses.** Every definition a venue sets up once and applies repeatedly, organized by the purpose it serves (agreements, pricing, planning, communication, marketing, reports) — never by which database table it happens to live in.
- **Your Venue — what the venue continuously maintains.** Settings (configuration) and Venue Guide (venue-owned, always-current client-facing reference) — things that are true about running the venue itself, not reusable assets applied to a specific relationship.
- **Sales — where the venue manages leads, pipeline, and tours.** Includes Pipeline Template configuration, deliberately not in Library, because a Pipeline Template is live-referenced venue configuration, not a copy-once asset.
- **Help & Guides — where the venue learns how to use Hello to Cheers.** Product education, Hello to Cheers-owned; never a place a venue manages their own content, and never a Library category.

---

## Explicitly Deferred Items

Nothing from Decisions A–G is deferred — all seven are resolved above with a firm recommendation. Explicitly out of scope for this pass, per the brief's own instruction:

- Library search, recommendation engines, related content, Luv integration, or contextual help of any kind.
- Any new content system, new navigation section, new asset type, or new database.
- Decision H (the Pipeline Templates deep-link copy) — already resolved separately, in the Pipeline P0 remediation pass, not part of Library IA.
- Any category rename beyond the two small copy fixes in Decisions E and G.

---

## Confidence / Remaining Risks

- **High confidence** on Decisions A, B, C, F — each is grounded in a hard fact (a missing incoming link, a confirmed page-content mismatch, an absence of any alternative destination) rather than a close judgment call.
- **High-to-medium confidence** on Decision D — the catalog's move to Planning is well-evidenced by its own page copy; bundling Inventory Templates into the same move is a reasoned extension of the brief's question, not an explicit instruction, and is the one recommendation in this document most worth a second look if Cursor's implementation surfaces something this audit didn't see (e.g., a caller that assumes Inventory and Packages are adjacent).
- **High confidence** on Decision E's factual correction; **medium-high** on Decision G's exact replacement wording, which is a reasonable final copy pass rather than a load-bearing product decision.
- **No architectural risk identified anywhere in this pass** — every recommended change is a card move or a string edit inside `app/(app)/library/page.tsx` and one page-title string in `app/(app)/packages/page.tsx`. Nothing here touches routes, schema, the interaction model, or any domain's underlying data.

This document ends here. No code, schema, migrations, or UI were changed in producing it.
