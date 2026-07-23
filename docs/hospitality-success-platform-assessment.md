# Hospitality Success Platform — Architecture Assessment

**Program 3 — Customer Success & Growth Platform, Initiative A.** Research and assessment only — no implementation. Companion to `docs/hospitality-success-platform-implementation-plan.md`.

**Date:** 2026-07-22

This assessment answers one question honestly, pillar by pillar: **what already exists that this initiative should extend, and what is genuinely greenfield.** The headline finding is that this platform has been quietly building toward a Hospitality Success Platform for months without naming it one — three of the four pillars have real, substantial existing architecture. The fourth (Success Center) is genuine greenfield. Nothing here needs to be built from zero, but several existing systems currently overlap without talking to each other, and this initiative is the reason to finally reconcile them rather than add a fourth parallel one.

---

## 1. Guided Setup

### What exists today

| Piece | State | Where |
|---|---|---|
| Pre-creation setup wizard | Real, 7 steps + Welcome | `components/setup/setup-wizard.tsx`, `setup-steps.tsx`, `lib/venue/validation.ts`'s `SETUP_STEPS` |
| Resumable/partial-save wizard | **Does not exist** — pure client memory, one-shot submit at the end | `setup-wizard.tsx` |
| Post-creation "what's done / what's missing" checklist | Real, DB-driven, 8 steps with time estimates and CTAs | `computeOnboarding()` in `lib/dashboard/service.ts`, `GettingStartedCard` |
| Composite activation/health score | Real, SQL-computed, 5 weighted dimensions, 4 phases | `compute_venue_activation_score()`, `lib/activation/service.ts` |
| Milestone/celebration system (setup-adjacent) | Real, 7 of ~10 designed milestones shipped | `lib/activation/types.ts`'s `MilestoneId`, `MilestoneToast` |
| "Why this matters" / prerequisite framing per step | Minimal — one paragraph on the Financial Setup screen is the best example that exists | `components/setup/post-setup-financial.tsx` |
| Venue-owner-facing "how to use this software" help | **Does not exist** — "Venue Guide" is client-facing FAQ content authored by the venue, the opposite direction | confirmed via `docs/product-completion-roadmap.md`, independently via nav inventory |

**The core finding: there are already two separate, non-integrated "what's next" systems**, plus a third generic salutation:

1. **Getting Started checklist** (`lib/dashboard/service.ts:computeOnboarding()`) — ad hoc TypeScript field/count checks (profile filled, tour scheduling enabled, vendor count, playbook count, first lead, first booking), each with a time estimate and a CTA. This is the closest thing in the codebase today to what "Guided Setup" wants: it already answers "what's done, what's missing, what to do next," just scoped to 8 post-creation tasks.
2. **Activation Engine** (`lib/activation/service.ts` + `compute_venue_activation_score()` SQL function) — a genuinely computed, weighted, 5-dimension (Setup/Couple Engagement/Workflow/Team Adoption/Habit Formation), 100-point score with real phase bands (`setup` → `connected` → `almost` → `full`) and its own milestone-firing mechanism, cached with a 1-hour TTL in `venue_activation_scores`.
3. **`DashboardLuvIntro`** — a one-shot "I'll help you stay ahead of everything" card gated purely on `venue.luvIntroSeenAt` being null (not a real "is this venue genuinely new" signal — just "has this flag ever been set, once, ever").

These three do not share a data model. Getting Started doesn't know about Activation's dimension scores; Activation's gaps (`{label, points, href}`) don't reference Getting Started's steps; both separately compute "has this venue added a vendor" from the same `vendors` table using different queries. A Guided Setup pillar that adds a *fourth* parallel "what's next" system without reconciling these three would make the problem worse, not better.

**The pre-creation wizard has no memory of what a venue already told it.** It's built as pure `useState` client memory (`createInitialSetupInput`), and nothing is persisted to the database until the final "Create venue" submit calls the atomic `complete_venue_setup` RPC. Abandon the wizard at step 4, come back tomorrow, and you start over from Welcome with every field blank. This is the single biggest structural gap standing between the current wizard and "a journey, not a wizard" — a journey implies the platform remembers where you left off.

**Personalization with the venue's real name is inconsistent.** It's genuinely used in exactly two places: the Dashboard greeting (`"Here's what's happening at ${venueName} today"`) and the Financial Setup completion screen (`"${venue.name} is set up and your workspace is live"`). Everywhere else — the Getting Started card header, the Activation widget, every milestone toast — uses generic phrasing ("Your venue is fully connected," "You're 62% set up") even though `venue.name` is available server-side at every one of those render points. This is exactly the gap the "journey" principle in your message is naming.

### Reusable architecture

- `computeOnboarding()`'s live-signal-derivation pattern (profile completeness, related-table counts) is the right foundation for "what's already done" — it's already correct, just needs to be the *one* source of truth instead of duplicating Activation's dimension checks.
- `compute_venue_activation_score()`'s weighted dimension/gap model is the right foundation for "what's the highest-value next action" — it already computes exactly that (`gaps` sorted by points), just isn't surfaced as guidance, only as a score.
- The `luvIntroSeenAt`/`onboardingDismissed` one-shot-boolean-flag pattern is an established, deliberate convention (confirmed by `docs/luv-experience-completion-implementation-plan.md` explicitly reusing it) — new "seen this" state should follow the same shape, not invent a new mechanism.
- `post-setup-financial.tsx`'s structure (real venue name, explicit "nothing here is required to continue" permission-to-skip, reusing production Settings components rather than parallel onboarding-only UI) is the template for what every Guided Setup step should look like.
- `MilestoneToast`'s copy-map + `sonner` toast + one-time-fire pattern is the established "celebrate completion" mechanism — reuse it rather than building a new celebration UI (see also Luv's `celebrateLuv()`, §3, which is nearly the same mechanism with confetti added).

### Gaps

- No resumable/persisted pre-creation wizard state.
- No unification between Getting Started and the Activation Engine — two sources of truth for "is this venue set up."
- No per-step "why this matters / estimated time / prerequisites / success criteria" framing in the pre-creation wizard (only in the post-creation Getting Started card, and only time estimates + CTA, not the other three).
- No "genuinely new venue" signal beyond a permanent one-shot boolean.
- Sparse venue-name personalization outside two screens.
- A previously-flagged risk (`docs/email-intake-self-service-plan.md`, that `complete_venue_setup` might predate a NOT NULL constraint on `lead_email_key`) was checked live during this assessment and confirmed **already resolved** — the column carries a real DB default (`lower(replace(gen_random_uuid()::text,'-',''))`) from an earlier phase of this engagement. Venue creation itself is not at risk; safe to build on.

---

## 2. Migration Center

### What exists today

**`/settings/import` is not a placeholder — it's a real, fairly mature import wizard**, not something this initiative invents from scratch:

- 5-step flow: entity select → upload (CSV/Excel/Word/PDF/paste) → field mapping (fuzzy auto-guess, remembered per-entity in `localStorage`) → dry-run preview (flags missing-required-field rows in red before any write) → results (imported/skipped/error counts, downloadable error CSV, entity-specific "what to do next" CTA).
- Real multi-format parsing: PapaParse (CSV, client-side), ExcelJS (`.xlsx`/`.xls`, server action), mammoth (`.docx` → Luv-assisted structuring), pdf-parse (`.pdf` → Luv-assisted structuring), plus a freeform-paste path that falls back to the same Luv-assisted extraction when the pasted text doesn't look tabular.
- Downloadable CSV template per entity, and a real defensive check (`looksLikeHeaderRow()`) against a common real-world failure: a data file with no header row at all.
- Five importable entities today: Leads, Clients ("couples"), Vendors, Inventory, Packages. Events, Contracts, and Invoices are explicitly "Coming soon" in the existing UI.

**The real gaps, confirmed precisely, not assumed:**

1. **Duplicate detection exists for exactly one of five entities: Leads.** `lib/leads/repository.ts`'s `findActiveDuplicate()` (venue-scoped, active-status-only, email match with name fallback) was shipped as a named release blocker per `docs/lead-pipeline-release-readiness.md`. Clients, Vendors, Inventory, and Packages have **no** equivalent — a re-run import of the same file creates full duplicates every time. This is the single highest-value, most concretely-scoped gap in the entire Migration Center pillar, because the pattern to replicate already exists and is proven.
2. **No import-job/batch concept anywhere.** No `import_batch_id` column, no job table. There is nothing in the data model today that can answer "which records came from import run #4" — which means rollback/undo is not currently buildable without first adding a grouping key. The codebase's general philosophy toward bulk actions today is "confirm before, not undo after" (explicit comments in `floor-plan-editor.tsx` and elsewhere confirm this is a deliberate existing pattern, not an oversight to preserve) — a Migration Center that promises rollback is a genuine departure from that norm and should be scoped deliberately, not bolted on lightly.
3. **A reserved-but-dormant trust tier and status already exist, unused**, evidence the schema anticipated exactly this: `TrustTier` includes `"import"` (never actually used — CSV-imported leads today are logged as `trustTier: "manual"`), and `lead_intake_attempts.status` includes `"rejected_duplicate_batch"` (defined in the DB check constraint and the TypeScript union, aggregated in monitoring, but never set by any code path). These are dormant hooks the Migration Center should claim, not two more things to invent.
4. **No white-glove (staff-driven) mutation surface exists.** Wevenu HQ's "View As" (`app/admin/*`, `docs/wevenu-hq-architecture.md`) is real, audited, and explicitly **read-only by design** — the doc itself names true write-as-a-venue impersonation as an explicitly deferred Phase 2, because `current_user_venue_id()` (the function nearly every RLS policy resolves through) has no per-request "act as venue X" channel today. Building real staff-driven migration means either (a) a smaller lift — an HQ-side "acting for venue X" selector that calls the *existing* venue-scoped import wizard/actions on the venue's behalf, reusing its own RLS rather than bypassing it, or (b) a larger lift — genuine impersonation infrastructure. This is a real, sizable architectural fork this initiative needs to decide, not skip past.
5. **No competitor/legacy-format precedent exists.** There is no "Weven" (the competitor whose shutdown created this platform's beta cohort) export-format documentation or parsing code anywhere — every mention of "Weven" in the codebase is trust/brand narrative ("Welcome Back" pricing, a `yearsWithWeven` intake field), never a data schema. One existing doc already treats this as solved by the generic CSV wizard: *"a HoneyBook/Aisle Planner/etc. export is just a CSV, already covered."* If Weven's actual export has a distinctive, non-generic shape, that parsing is genuinely new work.
6. **A separately-written, third copy of relationship/dedup logic already exists** for exactly the manual-entry/CSV-import path (`create_lead_atomic`), independently of the shared `find_or_create_relationship` two other intake paths use — a documented, pre-existing inconsistency (`docs/lead-intake-architecture-assessment.md`) worth resolving *before* a fourth (migration) path is built on top of it, or the inconsistency triples.

### Reusable architecture

- **The Lead Intake pipeline (`ingestLead()`, `lib/lead-intake/pipeline.ts`) is the closest existing thing to a "migration importer core"** — Normalize → Validate → Log Attempt → Duplicate/Abuse Check → Relationship Resolution → Creation → Activity Log → Automation → Notification, already proven across 5 independent source adapters (manual, CSV, Facebook, email-parsed, webhook). Leads should stay on this path; Clients/Vendors/Inventory/Packages should very likely grow an analogous shared core rather than each staying a bespoke insert loop.
- **The Facebook Lead Ads processor (`lib/facebook/processor.ts`) is the right precedent for a background, retryable, batched import job** — atomic claim, connection-level circuit breaker, exponential backoff, dead-letter ceiling, per-attempt log row. The current import wizard is a synchronous client-triggered loop with none of this; a "process a 2,000-row migration file" job needs exactly this shape, not the current wizard's shape.
- **`resolveLeadSourceKey()`'s typed-enum-with-graceful-fallback pattern** (unrecognized source string → `"other"`, original value preserved) is the right template for mapping a competitor platform's arbitrary column values onto Hello to Cheers' internal vocabulary.
- The existing field-mapping UI, dry-run preview, and per-entity CSV template are all genuinely good and should not be redesigned — Migration Center extends this wizard, it does not replace it.

### Gaps

- No batch/job grouping (blocks rollback and "what's already been imported" progress tracking as separately-trackable runs).
- No duplicate detection outside Leads.
- No staff-write ("white-glove") surface — only read-only View-As.
- No competitor-format-specific parsing.
- No AI-assisted *field mapping* specifically (Luv's import-assist family currently helps structure *unstructured* text like pasted lists/PDFs/Word docs into rows — it does not yet suggest which source column maps to which target field for a genuinely messy competitor CSV export with unfamiliar headers).
- The three-way dedup/relationship-resolution inconsistency named above.

---

## 3. Luv Success Guide

### What exists today

This is the pillar with the most existing depth. Luv is already a large, real system — 26 files in `lib/luv/`, a defined six-kind observation contract, five independent live-Claude integrations, a settings surface, and an explicit, written phase model (*"Phase 1: Notice. Pure data pattern matching. Phase 2: Draft. Generated content reviewed before any action. Phase 3: Assist. Proactive, trusted."*).

**The `ObservationKind` contract** (`lib/luv/types.ts`) is the foundational abstraction: `"fact" | "inference" | "recommendation" | "celebration" | "waiting" | "risk"`, precedence-ordered, with an explicit trust model (`docs/luv-platform-intelligence-architecture.md §6`): Facts are never hedged, Inferences must be traceable back to the Facts that produced them and never presented as Fact, Recommendations always link to an action rather than implying Luv will act on its own. Any new Luv surface must fit inside this contract, not invent a seventh kind or a looser one.

**Proactive, stateless observation generation already exists and already works** — `observations.ts` (coordinator side, 927 lines) and `portal-observations.ts` (couple side) compose dozens of pure-function checks (stale contracts, qualified leads with no tour booked, expiring documents, no follow-up on a new lead, tour momentum, portal inactivity, Request Framework items) into a capped, priority-sorted feed with zero AI calls — this is Luv already doing almost exactly what your message's examples describe ("I noticed your website isn't collecting inquiries yet," "Nobody can currently schedule a tour") for a subset of cases. **"Story Mode"** (`trends-service.ts`) already picks one narrative archetype per venue per period (`needs_attention`/`building_momentum`/`strong_month`/`couples_loving`/`steady`) with evidence — the closest existing thing to a single proactive "here's the story of your business right now" headline.

**The celebration mechanism is genuinely tiny and correct, and is the template for "Luv proactively guides"'s tone**: `celebrateLuv()` is a toast + 2-second CSS confetti burst, never a modal or full-screen moment, explicitly designed to "last about two seconds — confetti, a nice message, continue working." Exactly 5 milestone types, each enforced to fire exactly once via a DB unique constraint, each a real Commitment Lifecycle transition, never an arbitrary action.

**The single most important precedent for "not a chatbot" already exists inside this codebase, documented explicitly**: `components/portal/luv-ask-section.tsx` is a genuine chat-bubble, growing-thread UI (couple-facing), while `components/wedding-website/guest-concierge.tsx` — built later, for a different audience — deliberately rejects that exact pattern in its own source comment: *"deliberately a concierge, not a chat interface... exactly one question/answer visible at a time rather than a growing thread."* Its backing prompt instructs Claude: *"you're a concierge at a front desk... never ramble, never over-explain."* This platform has already run the experiment and already has a documented internal conclusion about which pattern fits "trusted advisor" better. A Luv Success Guide should follow the concierge/briefing precedent, not the chat-thread one.

**Daily Briefing — designed in real detail, zero code.** `docs/luv-platform-intelligence-architecture.md §4` fully specifies what it would say (what needs you now, what's coming this week, what got resolved since you last looked, what's purely informational) and names the one genuinely new piece of infrastructure it needs: a "last observed state" persistence table (to compute "resolved since you last looked" — nothing today tracks what a venue has already seen across sessions). Every subsequent status doc (as recently as `docs/release-candidate-roadmap.md`) confirms this is still unbuilt and named as a deferred future phase, not a gap that was missed.

**A real settings surface for autonomy/tone already exists**: `LuvSettings { observationsEnabled, draftingEnabled, autonomyLevel: "suggest_only"|"draft_for_review", preferredTone: "warm"|"professional"|"formal" }` — any new proactive-guidance surface should read and extend this row, not create a parallel preference store.

### Reusable architecture

- The six-kind `ObservationKind` contract and its trust-tier rules — a Success Guide's proactive nudges are just another observation-generating function feeding the same contract, not a new concept.
- The stateless observation-composition pattern (`observations.ts`) is directly extensible to Guided Setup's "what's missing" data (it already reads Event Readiness, Communication Health, etc. by "read, never recompute" — Guided Setup's gaps should be read the same way, not recomputed a third time inside Luv).
- `celebrateLuv()` for celebrating setup milestones — no new celebration UI needed.
- `LuvSettings` for any new "how proactive should Luv be" control.
- The Daily Briefing architecture spec is already 90% of the design work for "Luv proactively guides the venue" — it needs the missing persistence table and an actual UI, not a redesign.
- The concierge-vs-chat precedent, already internally documented, directly answers "how should this not feel like a chatbot."

### Gaps

- Daily Briefing itself: unbuilt, needs the "last observed state" table.
- Full six-kind narration convergence across the 4 (of 8 total) observation/narration-purpose Claude integrations — currently each generates prose somewhat independently rather than through one unified narration layer.
- No progressive-disclosure "hide Luv" control for the couple/vendor audience (named as a deferred, small item in existing docs).
- No connection today between Luv's observation feed and Guided Setup's gaps specifically — Luv narrates Event Readiness, Communication Health, lead momentum, etc., but does not yet narrate "you haven't connected QuickBooks" or "nobody can currently schedule a tour" as setup-completion observations. This is a real, nameable gap directly matching your message's own examples.

---

## 4. Success Center

### What exists today

**Confirmed, from three independent angles, that this is genuine greenfield:**

1. Nav inventory (`lib/navigation.ts`) has no Help/FAQ/Resource Center/Success Center/Knowledge Base item anywhere.
2. "Venue Guide" (`/guide`) — the only guide-shaped surface in the product — runs in the opposite direction: it's operational content **authored by the venue** (parking, policies, FAQs) for **couples** to read in their portal, and for Luv to answer couple questions from. It is not Wevenu teaching the venue anything.
3. Two independent prior audit docs confirm the absence explicitly: *"No help center, tooltips, guided tour, or live-chat widget anywhere... the only support channel is an async ticket form. A new venue owner stuck mid-setup has no faster path to help than filing a ticket and waiting."*

There is no prior art anywhere in this codebase's docs history for "Success Center" or "Venue University" as a concept — nothing to reconcile, nothing to avoid duplicating.

### Reusable architecture

- The Getting Started checklist's CTA-linking pattern (`ctaHref`) is a reasonable template for "every article links back to the actual feature it's about."
- Luv's observation/recommendation feed is a natural distribution surface for Success Center content ("your first proposal template isn't finished — here's how other venues write theirs" as a `recommendation`-kind observation linking into a Success Center article) — but this is a new integration point, not existing behavior.
- Nothing else to reuse; this pillar is additive by nature.

### Gaps

Everything. Content model, authoring workflow, navigation entry point, goal-based information architecture — all genuinely new.

---

## 5. Cross-cutting reusable architecture (applies to more than one pillar)

- **`getCurrentVenue()` / venue-scoped session pattern** — every pillar's server-side code should resolve venue the same established way; nothing here needs a new auth pattern.
- **The one-shot-boolean "seen this" flag convention** (`onboardingDismissed`, `luvIntroSeenAt`) — reuse for any new "has this venue seen X" state rather than inventing a new mechanism per pillar.
- **`sonner` toast + `celebrateLuv()`** — the one established "celebrate a completion" UI; do not build a second one.
- **RLS + explicit `service_role` GRANT in the same migration** — this exact discipline has been hard-learned and re-learned multiple times across QuickBooks, Facebook, and other prior initiatives in this engagement (missing `service_role` grants have caused live bugs at least five times). Any new table this initiative adds must follow it from the first migration, not discover it live a sixth time.
- **The Facebook Lead Ads processor's atomic-claim + backoff + dead-letter queue shape** — the one real "background batch job" precedent in this codebase; reusable for Migration Center's import jobs and, if Daily Briefing needs any batch precomputation, for that too.
- **Direct-`fetch`-to-Anthropic pattern** (not the installed but unused `@anthropic-ai/sdk`) — every existing Claude integration in this codebase hand-rolls the HTTP call rather than using the SDK; any new AI-assisted feature (competitor-CSV field-mapping, Success Center content generation, Daily Briefing narration) should match this existing convention rather than introduce the SDK as a second pattern.

## 6. Risks and open considerations worth flagging before planning proceeds

- **Three "what's next" systems already exist (Getting Started, Activation Engine, Luv's proactive observations) and don't share data.** This initiative is the forcing function to unify them. Not doing so risks a fourth parallel system — the single biggest architectural risk in this whole assessment.
- **White-glove migration's real cost is the HQ write/impersonation gap**, not the import logic itself — the import wizard already works; the missing piece is a safe way for staff to act on a venue's behalf at all, which today doesn't exist by explicit design (View-As is read-only).
- **Rollback is a real product commitment, not a small addition** — it requires a first-class batch/job identity in the data model that doesn't exist anywhere today, and cuts against this codebase's established "confirm before, don't undo after" philosophy. Worth deciding deliberately, not assuming.
- **A previously-flagged venue-creation risk was checked live and confirmed already resolved** (see Guided Setup §1) — `complete_venue_setup` is safe to build on.
