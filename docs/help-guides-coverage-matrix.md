# Help & Guides — Coverage Matrix

**Type:** Assessment only. No content exists yet against most of this matrix — coverage figures below measure the current, pre-initiative state (effectively "what exists today," which for nearly everything is close to zero, since the current Success Library covers none of this domain), so this matrix is a baseline, not a report card on work already done.
**Companions:** all four other Help & Guides documents — the matrix below is a synthesis, not new investigation.

**The self-service test, applied literally:** could a brand-new venue owner answer this question without contacting Hello to Cheers? Scored against what exists in-product **today** (tooltips, labels, existing Success Library content, self-evident UI) — not against what this initiative proposes to build.

---

| Domain | Coverage today | Biggest gap | Notes |
|---|:---:|---|---|
| Getting Started | 40% | Where do my colors actually show up | Setup wizard itself is well-labeled and largely self-explanatory; the gap is entirely in the *non-obvious* questions (roles, brand-color reach), not the mechanical steps |
| Leads & Sales | 55% | Understanding the pipeline/lead-source model as *one* system, not several | The product itself is well-built and consistent; a venue coming from a competitor tool has no existing mental model for "every entry point is the same Lead" |
| Working With Clients | 50% | Where Conversations replaced two older systems | Real risk of confusion for anyone who used the product before RC2; near-zero risk for a genuinely new venue |
| Contracts | 35% | Who signs first, and what happens to a signature mid-transition | The lowest-coverage P0 area in the whole audit — actively-evolving product behavior (venue-first signing) compounds a pre-existing gap (amendments, the finalize step) |
| Payments / Financials | 45% | Stripe/QuickBooks honest status; the "sent/paid/void" vocabulary | Real financial confusion risk if a venue assumes Stripe collection is live when it isn't yet |
| Planning (Questionnaires/Timeline/Playbooks) | 40% | The Timeline's Owner/Lock/Visibility model — a genuinely new concept for this audience | Questionnaires and Playbooks are more self-evident by comparison |
| Event Order / BEO | 45% | Relationship to Packages and Inventory (three related-but-distinct concepts) | Low icon-ambiguity (Part 10 of the IA doc); the confusion is conceptual, not visual |
| Inventory | 40% | Why a finalized item can't change | A real, correct, but surprising behavior with no in-product explanation found |
| Packages | 50% | What happens to existing bookings when a package changes | The correct "nothing, it's already committed" answer is real and reassuring, but nowhere stated |
| Floor Plans | 25% | Icon/control education — the lowest-coverage domain in the audit | The brief's own flagship example; confirmed the richest, least-explained control surface in the product |
| Vendors | 55% | Status vocabulary (preferred/inactive) and vendor-portal visibility | Moderate — the Vendor Network itself has had real bugs found and fixed this engagement, but current state is solid |
| Communication | 45% | Honest disclosure that Conversations email isn't currently branded | A real, confirmed, currently-true limitation with no in-product acknowledgment |
| Brochures / Documents | 60% | Minor — mostly self-evident, marketing-collateral-shaped UI | Highest coverage of any domain, likely because it's the newest, most recently-designed surface |
| Reporting | 55% | The retired `/analytics` migration | A real but bounded, time-limited gap (matters only to venues who used the product before the R2 migration) |
| Event Day | 50% | What the Wedding Day dashboard is actually showing | Lower-stakes — this surface is used live, in person, with lower tolerance for reading documentation anyway; strongest candidate for in-UI labeling over help-article coverage |
| After Event | 60% | Minor | Small surface area, correspondingly small gap |
| Luv | N/A for this matrix | — | Luv is the *delivery mechanism* for closing these gaps, not a domain with its own coverage score — see the Luv integration doc |

**Weighted overall estimate: ~45% self-service coverage today**, concentrated almost entirely in "the UI is self-evident enough that a careful user can figure it out," not in any actual explanatory content — since the current Success Library (5 Best-Practice articles, no nav entry point) contributes close to 0% toward any of the specific questions in this matrix.

---

## The three largest gaps, ranked

1. **Floor Plans (25%)** — the richest control surface, the lowest coverage, and the brief's own chosen example. Highest-leverage single area to close first.
2. **Contracts (35%)**, specifically because the underlying product behavior (venue-first signing) is mid-change — closing this gap requires the content to track a moving target, which the audit doc flags explicitly as a real sequencing risk (write help content against the shipped signer model, not the one being replaced).
3. **Inventory (40%) and Timeline (40%)**, tied — both have a real, correct, *intentional* product behavior (finalized-immutability; Owner/Lock/Visibility) that a venue owner has no prior mental model for and the product currently does nothing to explain.

## What should be implemented first, and what should not be built yet

**Implement first, independent of any content being written:** a real, visible navigation entry point for Help & Guides. This is the single highest-leverage fix identified in this entire audit — zero dollars of content investment pays off if the surface remains undiscoverable, exactly as the current Success Library is today.

**Should not be built yet:** the search/relatedness/feedback infrastructure described in the IA doc's Part 6, full Luv wiring described in the Luv integration doc, and any content beyond the ~18 P0 articles identified in the content inventory. All three are real, valuable, and correctly sequenced *after* the navigation fix and the initial P0 content — building them first would be optimizing a system nobody can find yet.
