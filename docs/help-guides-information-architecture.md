# Help & Guides — Information Architecture

**Type:** Architecture specification only. Nothing here has been implemented.
**Companion:** `docs/help-guides-product-education-audit.md` (read first — this document assumes its findings, especially the current Success Library's real shape and its total lack of a nav entry point).

---

## PART 3 — Top-Level Information Architecture

**Not a sidebar mirror.** Organized around what a venue is *doing*, matching how the product's own domain model already thinks about the world (Lead → Client → Event, per the established platform architecture) rather than the app's feature-by-feature navigation groupings.

1. **Getting Started** — setup, branding, team, permissions, first-time orientation. The entry point for a brand-new venue.
2. **Finding & Booking Clients** — leads, inquiries, tours, follow-up, pipeline, converting to a booking.
3. **Working With Clients** — the Relationship Workspace, Conversations, the Client Portal, contacts, notes, tasks.
4. **Contracts & Payments** — templates, sending, signing, amendments, invoices, payment plans, refunds, Stripe/QuickBooks.
5. **Planning the Event** — Questionnaires, Timeline, Playbooks, key dates.
6. **Building the Event** — Event Order/BEO, Inventory, Packages, Floor Plans — the concrete, buildable pieces of what will actually happen.
7. **Event Day** — Day Sheet, Wedding Day Ops, vendor check-in, the day-of experience.
8. **After the Event** — feedback, reviews, closeout.
9. **Vendors** — the Vendor Network, assignments, the Vendor Portal (as the venue experiences managing it — vendor-side self-help is a separate, smaller, future consideration, not in this initiative's scope).
10. **Your Venue** — branding, the Venue Guide, settings, integrations — distinct from "Getting Started" in that this is where a venue *returns* to change something, not where they start.
11. **Reports** — Reporting, Saved Reports.
12. **Guided Journeys** — a small, deliberately separate area (not a dumping ground) for the handful of genuinely multi-step, cross-domain journeys named in Part 9 below.

**Why this shape, not the sidebar's:** the sidebar (confirmed via `components/shell/sidebar-nav.tsx`) is organized by data object (Leads, Clients, Events, Contracts, Payments, ...) because that's the right shape for *doing work*. Help content answers a different question — "what am I trying to accomplish right now" — and a venue mid-task rarely thinks "I need the Contracts section," they think "I need to send this to my couple" or "why can't I edit this." The 12 areas above map each major *task cluster* to one place, and — critically — every area name uses words a venue owner would actually say, not internal product nouns (this mirrors the standing product principle already established for the app itself: a venue thinks "I got a lead," not "I have an Opportunity").

**Predictability test, applied per the brief's own instruction:** "Why can't I edit my invoice?" → Contracts & Payments. "What does this icon mean on my floor plan?" → Building the Event. "I just booked a couple, what now?" → Guided Journeys. All three land in one guessable place without needing to know which underlying feature name the product uses internally.

---

## PART 4 — Article Type Taxonomy

Six types, deliberately small, matching the brief's own proposal with one refinement (Best Practice's existing register, per the audit's Part 12 finding, is kept intact rather than reshaped to match the others):

| Type | Purpose | Example |
|---|---|---|
| **Quick Answer** | One fact, one screen, one control | "What does the lock icon mean on my floor plan?" |
| **How-To** | A short, numbered task | "How do I send a questionnaire?" |
| **What Is This?** | A concept a venue hasn't met before | "What is an Event Order?" |
| **Why Does It Work This Way?** | An intentional, sometimes counter-intuitive product behavior | "Why can't I edit a signed contract?" |
| **Guided Journey** | A genuinely multi-step, cross-domain sequence | "I just booked a couple. What's next?" |
| **Best Practice** | Business-outcome coaching (the current Success Library's own register, kept) | "Getting Paid, On Time" |
| **Troubleshooting** | Something went wrong, here's the fix | "I sent the wrong contract" |

**Why not fewer:** Quick Answer and How-To look similar but serve genuinely different reading behaviors — a Quick Answer is read in place, without leaving the screen; a How-To is often read once, then followed step by step, possibly printed or referenced mid-task. Collapsing them would force How-To content to either bloat Quick Answers or force Quick Answers to carry unnecessary step-structure.

**Why not more:** every type on this list already exists as a real, recognizable pattern somewhere in the product's own existing content (the current Success Library IS Best Practice; the contract-signature FAQ drafted in `docs/contract-electronic-signature-readiness.md` this session IS Quick Answer/Why). No type was invented without a concrete example already in hand.

---

## PART 5 — Article Length Rules

The binding principle, stated once and applied throughout: **answer the question, get the venue owner back to work.** Every length limit below is a *target*, not a hard technical cap — but exceeding it should require a deliberate reason, not just more to say.

| Type | Target length | Reasoning |
|---|---|---|
| Quick Answer | 20–75 words | Must be readable in the time it takes to glance away from the task at hand. If it needs more than 75 words, it's not a Quick Answer — reclassify as How-To or What-Is-This. |
| How-To | 60–200 words, numbered steps | Long enough for real steps, short enough that a venue owner doesn't need to scroll on a phone mid-task. |
| What Is This? | 50–120 words | One clear paragraph. If a concept needs more, that's a sign it should link to a Guided Journey rather than grow in place. |
| Why Does It Work This Way? | 50–150 words | Enough room for the *reason*, not a design essay. |
| Guided Journey | 150–350 words total, broken into clear stage headers, each stage linking out to its own How-To/Quick-Answer rather than re-explaining it inline | A journey orchestrates; it should not duplicate content that already lives elsewhere — this is the single most important discipline for keeping the whole system from drifting into a manual. |
| Best Practice | 150–350 words (matches the existing 5 articles' real, observed length) | Kept as-is — this type's whole value is the coaching narrative, not brevity for its own sake. |
| Troubleshooting | 75–200 words | Diagnose, then fix — no more than 2-3 branches before it should become its own set of linked articles rather than one long one. |

---

## PART 6 — Search Experience

**Reuse the existing global search, don't build a second one.** `/api/search` (confirmed live, powering `components/shell/command-palette.tsx`, already indexing leads/events/vendors/guests/documents/tasks/conversations/requests) is the correct home for Help & Guides content too — a venue typing into the same command palette they already use for everything else should see help articles appear alongside their real data, not need to remember a separate search box exists.

**Conceptual model:**
- **Title matching** — direct, highest-weighted.
- **Keyword matching** — a curated `keywords` field per article (not just full-text on the body — a Quick Answer is too short for full-text search to work well alone), populated with the actual words a venue would type, not product vocabulary. "chairs," "tables," "seats" should all surface the floor-plan-seating article even though the article itself says "furniture objects."
- **Feature-name synonyms** — a small, maintained synonym table mapping internal product nouns to venue language (Event Order ↔ BEO; Timeline ↔ schedule/order of events; Package ↔ pricing tier) — reuse the same "venue language, not software jargon" discipline already an established, standing product-wide principle.
- **User-language queries** — the brief's own examples ("wrong contract," "why can't I change my invoice") should work via the keyword field above, populated deliberately with real question phrasings during content authoring, not left to full-text alone.
- **Contextual weighting** — an article tagged to the screen the venue is currently on should rank above an equally keyword-matched article from an unrelated area. This requires search results to know the current route, which `/api/search` already has access to via the request context.
- **Related articles** — a small, manually-curated `related_slugs` field per article (not auto-computed similarity, at least initially — this product's own content volume won't be large enough for automatic relatedness to outperform a human picking 2-3 genuinely useful next-reads).
- **"Was this helpful?"** — a simple yes/no plus optional free text, logged against the article slug; **the existing `linked_gap_keys` field on `success_library_articles` is worth reusing as the anchor point for this** — negative feedback on an article already linked to a specific product "gap" concept gives a real, structured signal about where content (or the product itself, per Part 15's own distinction) is failing.

---

## PART 7 — Contextual Help, By Surface

For each major surface, whether a simple Help link suffices, whether it should be tied to a specific control, and whether Luv should say anything (full Luv treatment in the companion `docs/help-guides-luv-integration.md` — this section only marks yes/no per surface).

| Surface | Contextual help needed | Tied to a specific control? | Luv opportunity |
|---|---|---|---|
| Floor Plan Studio | Yes — the richest control surface in the product (Part 10) | Yes — Lock/Unlock specifically, plus a general "what do these icons mean" entry point | Yes — first-time-in-editor nudge |
| Event Order / BEO | Light — mostly a status-vocabulary explainer | No — a general Help link is sufficient | No — status is already visible without ambiguity |
| Contract Detail / Sign flow | Yes — signing order, what "finalized" means, amendments | Partially — the send/finalize actions specifically | Yes — before-send review nudge (already drafted conceptually in this session's own contract audit) |
| Invoice Detail | Yes — "why can't I edit this," balance/status vocabulary | No | Light — only when a genuinely committed-and-locked state is reached |
| Questionnaire editor | Light — mostly How-To | No | No |
| Timeline editor | Yes — Owner/Lock/Visibility concepts are genuinely new to most venues | No | Light |
| Vendor Network | Light | No | No |
| Conversations | Light — mostly a "why isn't my email branded" honest-limitation note (Part 15) | No | No |
| Reporting / Saved Reports | Light | No | No |
| Settings / Branding | Yes — the "where do my colors actually show up" question is real and already-confirmed non-obvious | No | Light — once, at first brand-color save |

---

## PART 9 — Guided Journeys

Five, matching the brief's own proposed list, each checked against whether it's genuinely useful as a *single connected sequence* rather than better served as independent How-Tos:

1. **New Venue** (setup → first usable venue) — **keep.** Genuinely sequential, genuinely first-time-only, genuinely benefits from "here's the order that makes sense" framing beyond what the setup wizard's own UI already provides.
2. **New Lead** (inquiry → tour → follow-up → booking) — **keep.** Spans multiple product areas (Leads, Tours, Pipeline) that a new venue owner has no reason to already know are connected.
3. **New Booking** (booking → contract → payment → client portal) — **keep,** and this is the journey most directly served by turning the existing "Turning a Lead into a Signed Client" Best Practice article's structure into this format (Part 12 of the audit doc).
4. **Planning** (booked client → questionnaire → timeline → vendors → inventory → floor plan → Event Order) — **keep, but flag as the longest and most likely to need active maintenance** as planning features themselves evolve — recommend this journey link out heavily to individual How-Tos rather than try to narrate all seven steps inline, per the length discipline in Part 5.
5. **Event Week** (final details → payments → vendors → floor plan → Event Order → day-of) — **keep**, genuinely distinct from Planning in urgency and audience (a venue anxious the week-of needs a checklist, not education).
6. **After Event** (feedback → review → closeout) — **keep, but shortest** — this is a real but small journey; don't pad it to match the others' length just for symmetry.

No journey was added beyond the brief's own proposed six — each was checked, not assumed, and all six earned their place.

---

## PART 10 — "What Does This Icon Mean?" Inventory

**Floor Plans, confirmed as the richest control surface** (`components/floor-plan/floor-plan-editor.tsx`, direct icon-import inspection):

| Icon | Real control | Ambiguity | Recommendation |
|---|---|---|---|
| Lock / Unlock | Lock a venue-controlled object so the couple can't move it | High — this is the exact example the brief itself uses | Quick Answer + Luv nudge on first lock action |
| Magnet | Snap-to-grid/alignment | Medium | Quick Answer |
| Grid3x3 | Grid visibility toggle | Low (visually self-evident once toggled) | Tooltip sufficient; no article needed |
| Maximize2 | Fit-to-screen / fullscreen | Low | Tooltip sufficient |
| ChevronUp / ChevronDown | Bring forward / send back (layering) | Medium — a real, common canvas-editor convention, but not universal | Quick Answer |
| Copy | Duplicate object | Low | Tooltip sufficient |
| RotateCcw | Reset rotation | Low | Tooltip sufficient |
| Settings2 | Open the properties panel | Low | Tooltip sufficient |
| Printer | Print the floor plan | Low | None needed |
| ImageIcon | Background image upload | Low | None needed |

**Recommendation for Floor Plans specifically:** most of these icons are individually fine (standard canvas-editor conventions); the real gap is that there's no single, easy "what do all these mean" entry point in the editor itself — a single Quick-Answer-linking help affordance covering the 3-4 genuinely non-obvious ones (Lock, Magnet, layering) closes most of the real risk cheaply, without a UX redesign.

**Other domains, lighter-touch pass** (confirmed via direct import inspection, not assumed): **Event Order** uses almost no icon-only controls (`ExternalLink`, `Trash2`) — its ambiguity, where it exists, is in status *vocabulary* (`DISPLAY_STATUS_LABEL`/`PROVENANCE_LABEL`), not icons — a documentation, not UX, need (Part 15 of the audit doc). **Contracts/Payments/Inventory/Timeline** were not individually icon-audited to the same import-level depth in this pass — flagged here as `UNKNOWN` at the specific-icon level rather than assumed equivalent to Floor Plans; a focused, cheap follow-up pass (the same `grep "from \"lucide-react\""` technique used here) should precede final content authoring for those areas specifically.
