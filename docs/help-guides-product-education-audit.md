# Help & Guides — Product Education Audit

**Type:** Discovery and architecture only. Nothing in this document or its companions was implemented, coded, or built. No UI, database, search engine, or Luv behavior was changed.
**Date:** 2026-08-12
**Companion documents:** `docs/help-guides-information-architecture.md`, `docs/help-guides-content-inventory.md`, `docs/help-guides-luv-integration.md`, `docs/help-guides-coverage-matrix.md`.
**Method:** Direct inspection of the actual current codebase — routes, components, the current Success Library's real data model and content, the main app's navigation, the existing global search implementation, and Luv's existing architecture — cross-referenced against extensive first-hand familiarity with this exact product built up across this whole engagement (Contracts, Payments/Invoices, Event Orders, Floor Plans, Inventory, Timeline, Questionnaires, Vendors, Conversations, Brochures, Reporting, Wedding Website, Portal, and Luv itself have each been individually built, audited, or certified in prior work packages this session — cited by domain below rather than re-derived from scratch). Where documentation and implementation disagreed, or where something couldn't be verified, it's named explicitly rather than guessed.

---

## Headline finding, before anything else

**The current Success Library is not a smaller version of what's needed — it's a different thing wearing a similar name, and it is currently invisible.** Its actual database schema (`success_library_articles`: `goal_category`, `why_it_matters`, `when_to_use`, `best_practices`, `common_mistakes`) is a **business-coaching content model** ("what to do, when to do it, the mistakes worth avoiding — organized by what you're trying to accomplish, not by feature," per the page's own subtitle), not a task/reference help model. It has exactly **5 published articles** across 4 goal categories (Booking More Tours, Getting Paid, Growing Your Venue, Working with Vendors). And — confirmed by grepping the entire app shell, sidebar, command palette, and every Luv/Dashboard surface — **it has no link anywhere in the live venue-facing navigation.** A venue can only reach `/success-library` by typing the URL directly. This is a genuinely different starting point than "the Help Center is too small" — there effectively isn't one a venue owner would ever find.

---

## PART 1 — Product Inventory (venue-facing)

Organized by what a venue is trying to accomplish, per the brief's own instruction, not by sidebar. Each domain is annotated with its real current maturity (drawn from this session's own completed audits/builds, cited) and the concrete surfaces that would need help coverage.

### Getting Started / Venue Setup
Setup wizard (`components/setup/setup-steps.tsx`) and Settings (`components/settings/venue-settings.tsx`) share one canonical flow: venue profile, `BrandStep` (logo, primary/secondary/accent/neutral color), team invites, permissions (Owner/Manager/Coordinator/Staff — a real, enforced 4-role model), integrations (Stripe, QuickBooks), and the Venue Guide (FAQs). Confirmed this session (`docs/venue-white-label-collateral-certification.md`): setup color selection is real and well-labeled, but two of the four colors a venue picks have no visible effect anywhere outside the Couple Portal — a strong candidate for a "Where do my brand colors actually show up?" article, since the honest answer is genuinely non-obvious even to someone who built the feature.

### Leads & Sales
Canonical lead intake pipeline (`ingest_lead`), one Lead lifecycle regardless of entry point (form, tour, manual, referral, CSV, Facebook Lead Ads, forwarded-email intake), tour scheduling with real recurring-availability rules, pipeline stages (venue-editable, not fixed — a real, already-corrected-once stale claim worth getting right in help copy), lead-to-booking conversion. Genuinely rich, mature system; the number of *entry points* (7+) is itself a real education need — a venue owner should understand these all funnel into one Lead, not learn it by discovering a duplicate.

### Clients / Relationships
The Relationship Workspace (one Event, three workspaces per the Unified Relationship Workspace initiative), client contacts (a real multi-person-per-client model — `client_contacts`, with roles/relationship labels/portal access levels — found and reused during the contract-signature audit this session), Conversations (RC2 — one Conversation object, pluggable channels, replacing two legacy systems), notes, activity timeline, tasks, Luv observations, the Client Portal invitation flow.

### Bookings / Events
Event creation, double-booking prevention (server-enforced, not just a warning), event readiness, multi-day event support, guest count, space assignment.

### Contracts
Contract Templates (Starter Library ships one: Wedding Venue Agreement), merge-field-resolved working contracts, venue send, client sign (`/sign/[token]`, no auth required, single-use token), Finalize (locks a real generated PDF), amendments (a real, append-only versioning mechanism, `amends_contract_id`). **As of this session's own audit** (`docs/contract-electronic-signature-readiness.md`, `docs/venue-white-label-collateral-certification.md`), the product does **not yet** support venue-first signing — this is real, in-progress product work (confirmed by concurrent file changes to `lib/contracts/repository.ts` observed during this very session, which now shows a `contract_signers` table and multi-signer types actively being built). **Flag: help content for the signing flow should be written against whichever signer model actually ships, not the single-signer model documented mid-transition — this is a real "documentation could drift from implementation before it even launches" risk, named explicitly per the brief's own instruction.**

### Payments / Financials
Payment schedules and presets (3 primary + 2 additional certified splits, all code-defined, not seeded rows), invoices (draft/sent/paid/void), refund/void (Owner-only), Stripe Connect (Card + ACH, built and verified short of live credentials — Sprint 4), QuickBooks (one-directional sync, same launch posture as Stripe). The "what can and cannot change after commitment" question is real, already-audited (`docs/venue-white-label-collateral-certification.md` Section G/J) product behavior, not a hypothetical — genuinely good material for a "Why can't I edit this?" article family.

### Planning
**Questionnaires** — a real 3-family model (Client Planning, Final Details, Post-Event Feedback), authoring capability, autosave, notification lifecycle (D5D). **Timeline** — Owner/Lock-State/Visibility/Submission model, multi-day support (Starter Library's TL-03), a real architectural concept most competitors don't have and a venue owner has no prior mental model for. **Playbooks** — Client Planning vs. Venue Planning templates, task auto-completion, key dates.

### Event Order / BEO
Section/line structure, two starter templates (EO-01 full, EO-02 reception-only), package/inventory relationships, "add to Event Order" from Event Inventory (a real, once-buggy-now-fixed idempotent handoff — D8), finalize/lock. Icon usage here is light — mostly labeled buttons and status badges (`DISPLAY_STATUS_LABEL`/`PROVENANCE_LABEL` — real, product-specific vocabulary worth a Quick Answer article more than a tooltip, since these are words, not icons).

### Inventory
Catalog (Starter Library ships 9 categories/49 items, no price/quantity — deliberately, so a venue never sees invented numbers), inventory templates, working (per-event) inventory, the finalized-immutability trigger (an item on a finalized inventory genuinely cannot change — a real, correct, and non-obvious behavior a venue will ask about).

### Packages
Starter packages (Essential/Signature/Full-Service, unpriced by design), package-to-invoice/Event-Order commitment boundary (a real "Copy at Commitment" architectural principle — editing a package later never rewrites an already-committed line, confirmed and tested this session in the package starter certification).

### Floor Plans
**The richest icon/control surface in the product** — see Part 10. Room dimensions, furniture objects, couple-facing seating (a genuinely different, deliberately-scoped-narrower collaboration model than full furniture co-editing — confirmed in the Starter Library certification as an "intentional difference," not a gap), lock/unlock, venue-vs-couple-controlled elements, finalization.

### Vendors
Vendor Network (a real relationship lifecycle — claimed/invited/active/inactive states, previously found to have real "has this vendor accepted" duplicate-truth bugs, now resolved), vendor assignments per event, vendor portal (a genuinely separate, real authenticated app for vendors, with its own 12-workflow certification pass), vendor floor-plan/inventory sharing.

### Communication
Conversations (the canonical system — RC2), Message Templates (11 real starters, merge-field-resolved), automated/sequenced messages, notifications. **Real, current gap** (found this session, `docs/venue-white-label-collateral-certification.md` Section E): Conversations' own live "Send Now" and Scheduled Sends currently send fully unbranded plain-text email — a genuine product limitation a help article should be honest about if a venue asks "why doesn't my email look branded," rather than implying it's a settings problem on their end.

### Brochures / Documents
Brochures (D7B — a real, separate-from-Contracts Document type, no finalize/lock concept by design since it's marketing collateral, always renders live), the Document Workspace, shared document views, public brochure pages.

### Reporting
The canonical `/reporting` IA (R1-R3), Saved Reports (4 real starters — Sales/Bookings/Revenue/Events — auto-seeded), drill-down, the retired legacy `/analytics` surface (a real "if a venue bookmarked the old URL" migration-education need).

### Event Day
The Wedding Day Ops dashboard (`app/(app)/events/[id]/today/`), Day Sheet, vendor check-in, Timeline execution view.

### After Event
Post-event feedback questionnaire, review/referral automation (an opt-in, Event.Completed-triggered nudge — RC2), event history.

### Luv
See `docs/help-guides-luv-integration.md` for the full treatment — a real, mature Decision Engine (`lib/luv/`: recommendation, insights, health, observations across setup/vendor/portal/communication domains, briefing, celebrations, memory, roll-up, trends). Currently owns the Success Library by name and by nav absence — this is the single most important architectural reconciliation this whole initiative needs to make (Part 13, and `docs/help-guides-luv-integration.md`).

---

## PART 12 — Current Success Library Assessment

**What it's actually good for:** its 5 articles are genuinely well-written, business-outcome-framed coaching content ("Turning a Lead into a Signed Client," "Getting Paid, On Time") — the *writing quality and framing* are a real asset, not something to discard. This is exactly the register a "Best Practice" article type (Part 4 of the companion IA doc) should keep using.

**What should stay:** the 5 existing articles, migrated into the new "Best Practice" article type, under the new IA's relevant top-level areas (not the current `goal_category` taxonomy, which doesn't map cleanly onto product structure — see the IA doc).

**What should move:** everything, structurally — the HQ-authored, draft/published, `is_hq_admin()`-gated content pipeline (`success_library_articles` table, admin CRUD at `app/admin/success-library/`) is sound infrastructure and should be **reused as the canonical content store for the entire new Help & Guides system**, not replaced — see Part 13 / the source-of-truth recommendation.

**What should be rewritten:** the page's own framing copy ("organized by what you're trying to accomplish, not by feature") — this is a real, deliberate design philosophy worth keeping for the Best Practice/Guided Journey content types specifically, but it cannot be the *only* organizing principle once Quick Answer and How-To content (the vast majority of what's actually needed, per Part 2 of the companion audit) genuinely does need to be feature-anchored ("what does this icon mean on my floor plan" has no meaningful "goal" framing — it has a screen).

**What should become a guided journey:** "Turning a Lead into a Signed Client" and "Inviting Your First Couple to Their Portal" are both already shaped like journeys, not single-topic articles — strong candidates to become the first two real Guided Journeys (see the IA doc's Part 9 treatment) rather than staying flat articles.

**What should be retired:** nothing outright — see above, everything has a place, just not its current one.

**What's redundant:** nothing found — 5 articles is far too small a set to have internal redundancy.

**What's missing:** essentially everything task/reference-shaped — Quick Answer, How-To, What-Is-This, and Why content types don't exist in the current system at all (the schema has no field shape for a 40-word icon explanation; every current article is a multi-section, ~200-400-word coaching piece). This is the dominant gap this whole initiative exists to close.

**Discrepancy flagged, per the brief's own instruction:** the product currently *brands* this system as "Luv's Success Library" (both in the page title and the route), while the direction given for this initiative is "Help & Guides = canonical knowledge, Luv = concierge, not a second knowledge base." These are in real tension as currently implemented — not a contradiction to silently resolve by picking one, but a naming/ownership decision that needs to be made explicitly. See `docs/help-guides-luv-integration.md` for the recommendation.

---

## PART 15 — Documentation Need vs. UX Defect (flagged throughout, consolidated here)

Per the brief's explicit instruction not to paper over confusing UI with documentation:

| Finding | Classification |
|---|---|
| Floor Plan editor's icon-only toolbar (Lock/Unlock, Magnet, Grid3x3, Maximize2, etc.) has no visible tooltips confirmed in this pass | **Documentation need, with a UX note** — icons here are a defensible, common canvas-editor convention (matches Figma/Canva-class tools most venue owners have likely touched somewhere), so contextual Quick Answer content is the right primary fix; adding native tooltips as a small, cheap UX improvement alongside is a reasonable secondary recommendation, not a redesign |
| Event Order's status vocabulary (`DISPLAY_STATUS_LABEL`/`PROVENANCE_LABEL`) is words, not icons, and not inherently ambiguous | **Pure documentation need** — no UX defect; a short What-Is-This article is sufficient |
| Success Library has zero discoverable entry point anywhere in the live app | **UX defect, not a documentation gap** — no amount of content quality fixes this; it needs an actual navigation surface (a nav item, a command-palette result, a contextual link) before any of the content work in this initiative can deliver value. **This is the single highest-leverage, lowest-content-cost fix available** and should be treated as a near-term implementation priority independent of how much content exists on day one. |
| Two of four venue brand colors have no visible effect outside the Portal | **Both** — genuinely confusing (a venue picks a color and it does nothing visible in 90% of the product), and already named as a real P1 product gap in `docs/venue-white-label-collateral-certification.md`, not something a help article should quietly paper over by explaining "that's just how it works." A help article here should be honest that this is a known, named limitation, not present it as an intentional design a venue should simply understand. |
| Contract signing's evidentiary model (typed name, no drawn signature, no identity verification) | **Not a UX defect** — already assessed in `docs/contract-electronic-signature-readiness.md` as a legitimate, legally-recognized method; the education need is explaining *why* (Why-type article), not fixing anything |
