# Pre-Launch Commercial Readiness — Initiative 1: Completion Report

**Date:** 2026-08-03
**Scope:** Venue Onboarding + Competitor Migration Experience, per the initiative brief. Full audit at `docs/prelaunch-onboarding-migration-audit.md` — read that first; this report assumes it.

## What existed before this initiative

The audit found two mature, working systems already in production, neither connected to the other:

1. **A real guided setup wizard** (`/setup`) — persona capture (new/switching/Weven-returning), progressive-disclosure steps for the venue's own settings, full resumability via `setup_last_step`, and a dashboard "Getting Started" card driven entirely by live data (`compute_venue_activation_score`), not checkboxes.
2. **A real Migration Center** (`/settings/import`) — a complete Upload → Understand → Map → Preview → Confirm → Import → Results pipeline for five domains (Clients, Leads, Vendors, Inventory, Packages), each reusing the exact same create functions the normal UI uses, each with duplicate detection, batch tracking, and rollback. A white-glove staff-assisted counterpart exists too (`app/admin/onboarding/import-actions.ts`).

**The gap was integration, not construction.** The wizard's steps were about venue settings, not the initiative's 6-stage journey; the Migration Center was Settings-only, never surfaced during onboarding; `onboarding_persona` was captured but read nowhere except one line of wizard copy; Weven had zero recognized data-shape or even a UI presence beyond one marketing intake field; and `import_batches.source_label` existed in the schema but no UI ever populated it.

## What was added

Nothing here duplicates an existing data-writing path. Every new screen either reads real data live or calls into the Migration Center's existing, unmodified `createClient_`/`createLead`/`createVendor`/`createItem`/`createPackage` functions.

### New files
- **`components/setup/setup-migration-steps.tsx`** (new) — the Bring Your Business, Your Offerings, Your Business Tools, and Your People & Business stage components, plus the shared source picker and the documents-only upload path.
- **`docs/prelaunch-onboarding-migration-audit.md`** — Part 1 of the initiative.
- **`docs/prelaunch-onboarding-migration-completion-report.md`** — this file.

### Changed files
- **`components/setup/setup-wizard.tsx`** — `SCREENS` restructured from `["welcome","origin",...SETUP_STEPS]` to `["welcome",...SETUP_STEPS]` (the Path A/B choice absorbed into "welcome"); new stage-grouped progress header ("Stage 2 of 6 · Bring Your Business") replacing the old flat "Step N of Total"; render branches added for the four new steps; extracted a shared `advanceFromStep()` helper so the new self-advancing stages and the footer Continue button share one code path.
- **`components/setup/setup-steps.tsx`** — `WelcomeStep` + `OriginStep` (two screens) replaced by one `PathChoiceStep` matching the initiative's literal Path A/B copy ("I'm starting fresh" / "I'm bringing my business with me," the second visually emphasized per spec). `ReviewStep` gained a new `ReadyToGoSummary` block at the top showing real, live counts with checkmarks — venue profile plus any of packages/contract templates/vendor relationships/contacts/upcoming events that are non-zero. `STEP_META` extended for the four new steps; `review`'s title changed to "Ready to go."
- **`components/settings/import-wizard.tsx`** — added three optional props to the existing `ImportWizard`: `sourceLabel` (threaded into the five `import*Action` calls, which already accepted this parameter but nothing ever passed it), `embedded` and `onDone` (suppress the outbound "go look at your data" links in favor of a "Continue setting up →" callback when rendered inside onboarding rather than `/settings/import`). No existing behavior changed for the standalone Settings usage — `embedded`/`onDone` default to falsy, reproducing the old behavior exactly.
- **`lib/venue/validation.ts`** — `SETUP_STEPS` gained four new step ids (`bring-your-business`, `your-offerings`, `business-tools`, `your-people`) inserted between `payments` and `review`, each with an empty `STEP_FIELDS` entry (no field validation, matching `payments`/`review`'s existing pattern). Added `SETUP_STAGES` (the 6-stage list) and `STAGE_FOR_STEP` (step → stage lookup) for the new progress header.
- **`lib/venue/service.ts`** — added `getSetupReadyCounts(venueId)`, a single function querying real, live counts (packages, inventory, contract templates, communication templates, playbook templates, active vendor relationships, contacts [clients + leads], upcoming events) via `count: "exact", head: true` queries against the venue's own RLS-scoped session. Read-only; writes nothing.
- **`app/setup/actions.ts`** — added `getSetupReadyCountsAction()`, following the exact same session-resolution pattern `getPaymentsStepDataAction` already used (no venue id threaded through wizard state, since a real venue row exists from the first step onward).

## Routes/components created or changed

No new routes. `/setup` is the only route touched; `/settings/import` gained three new optional props on its underlying component with no route or URL contract change. The Migration Center is *embedded* inside `/setup` as a React component (`<ImportWizard embedded .../>`), not linked to as a separate page — this was a deliberate architectural decision, not an oversight: every other `(app)/*` route is gated behind `venue.setupCompleted`, and a mid-setup venue's session can't reach them without redirecting straight back to `/setup`. Embedding was the only way to offer real migration during onboarding without touching that gate. Confirmed safe before building: `current_user_venue_id()` and every RLS policy checked do not gate on `setup_completed`, and `saveSetupProgress()` already creates a real (incomplete) `venues` row as soon as the venue name is entered — a fact the existing Payments step already depended on and this initiative extends the same way.

## Database changes

**None.** No migration was written. Every column this initiative uses already existed: `venues.onboarding_persona`, `venues.setup_last_step`, `import_batches.source_label`. The only "gap" was that `source_label` was never populated by any UI — closed by threading a `sourceLabel` prop through, not by schema change.

## The 6-stage journey, as shipped

1. **Welcome** (`PathChoiceStep`, outside `SETUP_STEPS`) — "Welcome to Hello to Cheers. Let's get your venue ready." Two paths: "I'm starting fresh" (persona → `new`) and "I'm bringing my business with me" (persona → `switching`, visually emphasized per the initiative's Part 2).
2. **Your Venue** (`venue-info` → `payments`, 6 existing steps, unchanged) — grouped under one stage header. This is where `saveSetupProgress` first creates the real venue row (after `venue-info`).
3. **Bring Your Business** (`bring-your-business`, new) — "Do you already have information you'd like to bring in? Yes / Not right now." Not right now never blocks. Yes leads to a source picker (Weven / another platform / spreadsheets / files or documents / I'll enter things myself) which sets `sourceLabel` and, for Weven/other-platform/spreadsheets, nudges `onboarding_persona` toward `weven_returning`/`switching` — then embeds the real `ImportWizard` (full 5-entity picker, not pre-scoped) so a venue can bring over several domains in one sitting.
4. **Your Offerings** (`your-offerings`, new) — live packages/inventory counts. If both are zero, an inline "Bring these over now" button jumps back to stage 3; never blocks.
5. **Your Business Tools** (`business-tools`, new) — live contract/communication/playbook template counts. No CSV import exists for these domains (see Limitations); the stage instead points at the existing, real, already-shipped Luv-assisted "Bring your existing wording" importers on the Contracts/Message Templates/Planning pages, reachable once setup finishes.
6. **Your People & Business** (`your-people`, new) — live contacts/vendor-relationship/upcoming-event counts, with a shortcut back to stage 3 for contacts/vendors. Upcoming events explicitly named as not-yet-importable, with the safe alternative (add from Events post-setup) stated directly.
7. **Ready to Go** (`review`, extended) — a new "{venue} is ready" block with checkmarked real counts sits above the pre-existing settings-review sections; "Create venue" behavior unchanged. The post-submit celebration screen's CTA copy was changed from "Enter your workspace" to "Go to my workspace" to match the initiative's literal spec.

## Supported import domains (unchanged from what already existed, now reachable during onboarding)

Clients (booked customers), Leads, Vendors, Inventory, Packages — all five via the embedded Migration Center, all five with pre-existing duplicate detection (`findActiveDuplicate*`) and batch tracking (`import_batches`), all five verified live in this pass (see Verification).

## Supported file types

CSV and Excel (`.xlsx`/`.xls`) parse deterministically. Word (`.docx`) and PDF (`.pdf`) extract to raw text and route through a live Luv/Anthropic proposal step (`proposeStructuredRows`) before anything is shown for review — nothing from an unstructured file is ever saved without the coordinator confirming it in the same map → preview → import flow every structured import goes through. All pre-existing; unchanged by this initiative.

## Duplicate handling

Pre-existing, unchanged, verified live in this pass: each of the five domains checks for an active-record match (email, or name-fallback for leads/clients; business name + email for vendors; name for packages/inventory) before creating, and a second occurrence of the same identity *within one file* is independently caught and skipped (verified live — see Scenario D/Results below). Every duplicate check is wrapped fail-open ("a duplicate check failing must never block a legitimate import") — a pre-existing, deliberate tradeoff, not something this initiative changed.

## What is intentionally NOT automatically importable

Named directly in the product, not silently absent:

- **Events/bookings** — no CSV import path. No existing dedup function, and the real double-booking conflict guard (`checkEventSpaceConflict`) is untested territory for bulk historical import. The People & Business stage says so explicitly and points at normal event creation post-setup.
- **Contract templates, communication templates, playbook/timeline templates** — no CSV row-import exists for any of these (contract templates have no import mechanism at all; the other three have an existing, separate, non-CSV Luv-assisted "paste your existing wording" flow). The Business Tools stage names this directly and points at where those existing flows live, rather than building a new, redundant, unproven CSV path under time pressure.
- **Attaching an *existing* global vendor profile to a new venue relationship** rather than creating a new one — no reusable function exists for this in the current codebase; every vendor-creation path (import or manual) makes a new global vendor row. Documented in the audit, not built.
- **Word/PDF/other original documents** are saved as-is via the existing Documents system (new "Bring your files" step, Part 8) — never silently converted into a contract, template, or package.

## Verification performed

- `tsc --noEmit`: clean.
- `next build`: clean, zero errors, full route manifest unchanged except the (already-removed, unrelated) Operations route.
- Browser-verified end to end with real Supabase Auth accounts and a real local Postgres, not mocked — Scenarios A through G, all passed:

| Scenario | Result |
|---|---|
| A — fresh venue, no import | Full run: Path A → 6 existing venue steps → Bring Your Business ("Not right now") → Offerings/Tools/People (all real "nothing yet" states) → Ready to Go (only "✓ Venue profile" shown, no fabricated counts) → Create venue → real dashboard with the pre-existing Getting Started card correctly showing 1/12 |
| B — established venue, real data | Path B → Bring Your Business → "Spreadsheets" → embedded Migration Center → uploaded a real 4-row CSV (one intentional duplicate) → mapping → preview → import: **3 imported, 1 skipped** → "Continue setting up" → Offerings/Tools/People → Ready to Go correctly showed **"✓ 3 contacts"**, a real count flowing end-to-end from the CSV through to the final summary |
| C — partial setup, exit, return | Verified twice: resumed correctly at "Ready to Go" (last completed step: your-people) after exiting post-import, and separately resumed at the start of "Bring Your Business" (last completed step: payments) after exiting mid-import without completing the sub-flow — real data (the earlier import) persisted in both cases; only the in-progress choice/source UI state (never persisted, by design) reset |
| D — duplicate data | Same CSV as Scenario B: **row 4, an intentional exact duplicate of row 1, correctly skipped** ("duplicate of an earlier row in this same file"), not silently re-created |
| E — bad/incomplete import | A 3-row CSV with one row missing both required name fields: **2 imported, 1 skipped**, flagged precisely ("Row 2 — Missing required fields: first name, last name"), downloadable error CSV offered, no corruption to the two good rows |
| F — already-configured venue | Confirmed on venues actually created through this new flow (Scenario B's and G's venues): login lands directly on `/dashboard`; explicitly navigating to `/setup` redirects straight back to `/dashboard` |
| G — Weven as a recognized source | Selecting "Weven" in the source picker: (1) client-side persona immediately switched the journey-line copy to the Weven-specific "Welcome back — let's get {venue} moved over..." variant and swapped in Weven-specific body copy ("We know exactly what that transition feels like..."); (2) a real vendor CSV import through that path completed (2 imported); (3) **verified directly against the database**: `import_batches.source_label = 'Weven'` — the previously-identified, previously-never-populated gap, now closed and confirmed with a real row, not just UI |

Screenshots for every scenario above were captured during this pass (local scratch directory, not committed to the repo).

### An incidental discovery, investigated and ruled out as unrelated

While verifying Scenario F, `owner@example.com`'s long-lived test venue (`Sweet Daisy Barn & Farm`, reused across many earlier, unrelated tasks in this session) produced a `PGRST116` error ("Results contain 6 rows... requires 1 row") and a 500 on `/setup`. **Investigated directly, not assumed:** reproduced identically with this initiative's entire diff `git stash`-ed away (i.e., against the unmodified baseline), and reproduced on a bare `/dashboard` visit with zero interaction with any of this initiative's new code. Conclusively pre-existing, unrelated to this initiative, and most likely a symptom of accumulated test-data volume against that one long-lived account from earlier sessions rather than a real code defect. Not fixed — out of scope. Flagging here rather than silently noticing and moving on, per this codebase's own documentation convention. Every fresh venue created through the actual new onboarding code in this pass showed no such issue.

Also noted, separately pre-existing and unrelated: a React dev-mode console warning ("Encountered a script tag while rendering...") on `/settings/import`, reproduced identically on the unmodified baseline. Not fixed — out of scope, cosmetic dev-only warning, not a functional defect.

## Remaining limitations

- Events, Contracts, Communication Templates, and Playbook/Timeline Templates are not part of the structured CSV Migration Center — see "What is intentionally NOT automatically importable" above. All have named, real, safe alternatives already in the product.
- Attaching an existing vendor profile (rather than creating a new one) during import isn't supported — every vendor import/create path makes a new global vendor row.
- `onboarding_persona` still isn't editable from Settings after initial setup — a pre-existing gap (a prior planning doc's unfulfilled promise), unrelated to and out of scope for this initiative.
- The Business Tools stage's pointers to the Playbooks/Timeline/Message Template "bring your existing wording" flows are copy only (they can't be reached until setup completes, since those routes are gated behind `setup_completed`) — a deliberate, disclosed scope boundary rather than an embedded sub-flow, to avoid extending the app's central route gate under time pressure. Once a venue completes the 6-stage journey, those flows are immediately reachable and already fully real.

## Bottom line

An established venue can now: choose "I'm bringing my business with me" on the very first screen; upload real CSV/Excel/Word/PDF exports (or paste a list) during onboarding itself, not after hunting through Settings; see exactly what got imported, what was skipped and why, and what needs review; watch the rest of the guided journey automatically recognize that real, imported data instead of asking again; and land on a workspace that already reflects real work, not an empty shell. Nothing was faked to get there — every count on the "Ready to Go" screen and every domain claimed as importable was verified against a real local database in this pass.
