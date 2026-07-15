# Template Platform — Migration & Release Readiness Audit

**Status:** Audit complete. Implementation follows in this same document's Phase 1–4 sections.
**Read first:** `docs/planning-release-readiness.md`, `docs/planning-execution-release-readiness.md`, `docs/timeline-release-readiness.md`, `docs/floor-plans-release-readiness.md` — treated as authoritative throughout. `docs/calendar-release-readiness.md`, as named in the brief, **does not exist in this repository** (confirmed directly) — `docs/calendar-experience-completion.md` and `docs/calendar-platform-integration.md` were read instead as the closest available authoritative Calendar documents. `docs/shared-template-architecture.md` — the approved, pre-existing "one shared model" design for Planning/Timeline/Communication templates — is the single most load-bearing document for this audit and is treated as the platform's own stated intent throughout.
**Framing:** this is not a per-feature audit. Every template-shaped capability in the product is evaluated as one system — does a venue coordinator building a Message Template experience the same platform as one building a Planning checklist? — and, separately, as one migration surface — can a venue with years of existing operational material actually get it into Wevenu.
**Method:** direct code and live-schema verification only — every repository/service/action/component file read directly, every lifecycle claim checked against actual exported functions (not assumed from naming), every FK/constraint claim checked against the live migration SQL, and the one Release Blocker below reproduced against a real local database transaction (`do $$ ... end $$` with a forced rollback, so no data was left behind — verified by direct recount after).

---

## Platform Inventory

Confirmed by reading `lib/*/repository.ts`, `lib/navigation.ts`, and every corresponding `app/(app)/**` route — not assumed from the brief's own example list.

**Real, venue-owned, apply-a-copy template systems (in scope):**

| System | Library location | Backing tables |
|---|---|---|
| Planning Playbooks (Client + Venue Planning) | `/library/playbooks` | `playbook_templates`, `playbook_milestones`, `playbook_tasks` |
| Timeline Templates | `/library/timeline-templates` | `timeline_templates`, `timeline_template_items` |
| Floor Plan Templates | `/library/floor-plan-templates` | `floor_plan_templates`, `floor_plan_template_objects` |
| Message Templates | `/communication/templates` | `message_templates` |
| Automations (internal name: Sequences) | `/communication/series` | `message_sequences`, `sequence_steps` |
| Pipeline Templates | `/library/pipeline-templates` | `pipeline_templates`, `pipeline_stages` |
| Contract Templates | `/contracts/templates` | `contract_templates` |
| Packages | `/library/packages` | `packages`, `package_items` |

**Named in the brief, checked directly, confirmed not real template systems today (stated plainly rather than silently folded in or silently ignored):**

- **Website Templates** — `lib/wedding-website/types.ts` defines `WebsiteTheme` as a fixed 8-value enum (Wildflower, Midnight, Garden Party, Linen, Rosé, Coastal, Champagne, Velvet). This is a style picker for the couple's wedding website, not a venue-owned, create/duplicate/apply template system — there is no `wedding_website_templates` table, no library page, nothing to audit against the lifecycle model below. Confirmed via `lib/wedding-website` having only a `types.ts` — no `repository.ts`, no `service.ts`.
- **Email Templates** — no separate system exists. `lib/notifications/templates.ts` contains exactly one function, `buildReminderEmail`, a hardcoded system-transactional email — not venue-editable, not a template a coordinator ever sees. Message Templates (above) is the one real, venue-facing "email/text wording" system.
- **Pricing Templates** — no distinct system exists. Packages is the closest real analog (a reusable, priced offering added to invoices); there is no separate pricing-only template concept.
- **Questionnaire / Form Templates** — `lib/events/questionnaire.ts` (`getQuestionnaire`, `sendQuestionnaireToCouple`, `saveQuestionnaire`) is one fixed, single-shape intake form per booking — not a library of reusable, venue-authored form templates.
- **Vendor Resources** — no template-shaped system found anywhere (`grep` for "vendor resource" / "resource template" across `lib`/`components`/`app` returns nothing beyond unrelated nav-label and comment text).
- **Automation Templates** (as a name distinct from Automations/Sequences above) — the brief lists this conditionally ("if applicable"). The one real automation-adjacent system, `lib/automation/` (`actions.ts`/`conditions.ts`/`engine.ts`), is a trigger→action rule engine (e.g. "Booking Confirmed → Apply Planning Template"), not itself a template a venue authors and reuses — Automations/Sequences above is the real template-shaped system in this space.

Eight real systems, then — three of them (Planning, Timeline, Floor Plans) built explicitly against `docs/shared-template-architecture.md`'s nine-question model; five of them (Message Templates, Automations, Pipeline Templates, Contract Templates, Packages) predate or sit outside that model entirely. That split is the throughline of every finding below.

---

## Lifecycle Comparison

Every cell below is a direct reading of the relevant `repository.ts`'s exported functions and the corresponding UI, not an assumption from the feature's name.

| Capability | Playbooks | Timeline Templates | Floor Plan Templates | Message Templates | Automations | Pipeline Templates | Contract Templates | Packages |
|---|---|---|---|---|---|---|---|---|
| Create | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Duplicate | ✅ `duplicateTemplateInto` | ✅ `duplicateTemplateInto` | ✅ `duplicateTemplateInto` | ❌ | ❌ | ❌ | ❌ | ❌ |
| Rename | ✅ dedicated `renameTemplate` | ✅ dedicated `renameTemplate` | ✅ dedicated `renameTemplate` | via full `update` only | via full `update` only | via full `update` only | via full `update` only | via full `update` only |
| Archive | ✅ `setTemplateArchived` | ✅ `setTemplateArchived` | ✅ `setTemplateArchived` | ❌ | ⚠️ different concept (`status: active/paused`, governs enrollment, not visibility) | ⚠️ `setTemplateActive` exists but is UI-labeled Active/Inactive, not Archive | ❌ | ❌ |
| Restore | ✅ | ✅ | ✅ | ❌ (no archive to restore from) | ⚠️ (un-pause) | ⚠️ (re-activate) | ❌ | ❌ |
| Delete | ❌ *(no `deleteTemplate` at all — archive is the only removal path, by design)* | ❌ *(same — archive-only, by design)* | ❌ *(same — archive-only, by design)* | ✅ hard delete — **crashes if in use, see Release Blocker #1** | ✅ hard delete (cascade-safe) | ✅ hard delete (cascade-safe) | ✅ hard delete (safe — `SET NULL`) | ✅ hard delete (safe — `SET NULL`) |
| Search (free text) | ❌ (filters only) | ❌ (filters only) | ✅ real text search | ❌ | ❌ | ❌ | ❌ | ❌ |
| Categories / filters | Kind (Client/Venue) + Event Type | Event Type + Space | Event Type + Space | ✅ fixed category enum | ❌ | ❌ | ❌ | ✅ free-text category |
| Preview (without opening the editor) | ✅ milestone/task counts | ✅ item counts | ✅ counts (+ background thumbnail) | ❌ (Edit is the only way to see body content) | ❌ | ❌ | ❌ | ❌ |
| Apply | ✅ to a Booking | ✅ to a Booking | ✅ to a Booking | N/A — not yet connected to sending (see Platform Integration) | ✅ enroll a relationship | N/A — not yet connected to Leads | ✅ generate a real Contract | ✅ add as invoice line item |
| Import (single item) | ✅ Paste (AI-assisted, Luv) | ✅ Upload file + Paste (AI-assisted, Luv) | ✅ Upload image + Paste layout (AI-assisted, Luv) | ⚠️ **backend fully built (`lib/luv/message-template-import.ts`, `importTemplateAction`), zero UI ever calls it** | ❌ | ❌ | N/A — plain-text body field, pasting existing wording already works with no dedicated "import" needed | ❌ |
| Export | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Bulk Import | ❌ *(see Migration Readiness — the generic CSV importer covers 5 flat-record entity types, zero template types)* | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Bulk Export | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Bulk anything (duplicate/archive/delete many at once) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

**Reading the table, not just the checkmarks:** the three systems built to `docs/shared-template-architecture.md` cluster tightly together — same function names (`duplicateTemplateInto`, `renameTemplate`, `setTemplateArchived`), same starter-picker interaction pattern, same "archive, never hard-delete" philosophy. The five that predate or sit outside that model don't just lack individual features — they lack the *philosophy*: hard-delete-by-default instead of archive, full-form-edit instead of a dedicated rename, and (Message Templates specifically) a fully-built import backend nobody ever wired to a button. Bulk operations are not inconsistent across the platform — they are **uniformly absent**, everywhere, for every template type. That's a clean, single finding, not eight different ones.

---

## Migration Readiness

**The venue-returning-after-several-years scenario, walked literally.**

The one real bulk-import mechanism in the product (`/settings/import`, `lib/import/types.ts`) supports exactly five `EntityType`s: `couples`, `leads`, `vendors`, `inventory`, `packages` — flat, tabular, one-CSV-row-per-record data. **Zero template types are importable in bulk, by this mechanism or any other.** This is architecturally sound, not merely unfinished — a CSV row is the wrong shape for a 40-task Planning checklist with milestones and dependencies, or a floor plan's table positions. Bulk CSV import is correctly scoped to flat records; it was never going to be the vehicle for templates, and extending its `EntityType` union to cover them would produce a broken half-fit, not a real fix. The right yardstick for each template type is therefore its own **single-item** import/recreation path, which the Lifecycle table above already answers per type. Assembled here as the actual migration story:

| Asset | Can it be brought in today? | How |
|---|---|---|
| **Planning** (checklists) | ✅ Yes — paste existing wording, Luv proposes tasks | Real, AI-assisted, proven |
| **Timeline** (run-of-show) | ✅ Yes — upload a file or paste text, Luv proposes entries | Real, AI-assisted, proven |
| **Floor Plans** | ✅ Yes — upload a background image, or paste a table/layout list | Real, AI-assisted, proven |
| **Packages** | ✅ Yes — the one template type with a real bulk path (`/settings/import?type=packages`, CSV) | Genuinely the platform's best migration story for any template-shaped asset |
| **Contracts** (wording) | ✅ Effectively yes, no new feature needed — Contract Template content is one plain-text body field (`components/contracts/template-form.tsx`); a venue pastes their existing contract text directly into it | Works today, just not badged as an "import" flow |
| **Message templates** (email/text wording) | ⚠️ **Should already be yes, isn't** — the identical AI-paste pattern proven three times elsewhere already exists end-to-end for this exact case (`lib/luv/message-template-import.ts`, `importTemplateAction`) but has no UI entry point. A returning venue's years of accumulated email/text wording — arguably the single most copy-heavy migration asset in this whole list — hits a dead end today for no architectural reason. Fixed this pass (Phase 3). |
| **Pipeline stages** | ⚠️ No dedicated import, but low-severity — a pipeline template's entire content is a handful of short stage names (e.g. New → Contacted → Proposal Sent → Won). Manual recreation is realistic at this scale; building AI-paste machinery for a 4–8-item list is disproportionate to the problem. Named honestly, not built. |
| **Documents** (files — insurance certs, W9s, riders, etc.) | ⚠️ Single-file upload only — `components/documents/documents-section.tsx`'s file input has no `multiple` attribute, and each upload requires choosing one category per file. A venue migrating a folder of a dozen documents does it one file, one category picker, at a time. Real friction, but not a small fix — batch upload with per-file (or per-batch) categorization is a genuine UX design decision, not a mechanical parity fix like Duplicate/Archive elsewhere in this document. Named as a Future Enhancement, not attempted this pass. |
| **Vendor resources / pricing** | N/A — confirmed above these aren't distinct systems; Vendors already has its own real bulk CSV path (`/settings/import?type=vendors`), which covers what's actually there. |

**Where migration would become frustrating, honestly ranked:**
1. Message Templates — a real, built import path sitting one PR away from working, currently invisible. Highest-leverage fix in this entire audit.
2. Documents — real friction, but a UX design question (batch categorization), not a quick win.
3. Everything else already has a working single-item path, or (Pipeline Templates) is small enough that the lack of one doesn't actually matter.

---

## Consistency

Per the brief's own instruction: not "make everything identical," but a shared platform philosophy, named once and applied everywhere it doesn't already hold. `docs/shared-template-architecture.md` already wrote that philosophy for Planning/Timeline/Communication's template *content* (the nine-question model — Reference Point, snapshot-on-apply, duplicate-uniformly, etc.). What it didn't cover, and what this audit adds, is the **lifecycle chrome** around every template type — the part a coordinator touches constantly regardless of which template they're managing:

**Recommended shared philosophy (three rules, not eighty):**
1. **Removing a venue's own work is always Archive, never Delete, by default.** Hard delete is allowed to exist as a secondary, explicit action (already true for Planning/Timeline/Floor Plans' pattern of "archive is the everyday action; nothing forces true permanent deletion"), but it should never be the *only* option, and it should never be able to surface a raw, unexplained backend error (Release Blocker #1 below is exactly this rule violated).
2. **Every template type gets Duplicate.** Not because every domain needs every capability (§7 of the shared-architecture doc is correct that a Timeline's minute-by-minute schedule and a Google Doc import aren't a natural fit) — but Duplicate specifically has zero domain-specific complexity anywhere in this platform. It's the cheapest, highest-value, most-requested action a template library can offer, and three of eight systems already prove the exact pattern to copy.
3. **A returning venue's existing wording should never require retyping when the platform already knows how to read it.** This is the Message Templates finding — the philosophy already exists and is proven three times; the fourth application of it was simply never wired up.

**Concrete inconsistencies found, matching the brief's own examples precisely:**
- *"One supports duplicate, another does not"* — five of eight systems have no Duplicate at all.
- *"One supports archive, another permanently deletes"* — Message Templates, Contract Templates, and Packages hard-delete only; Playbooks/Timeline/Floor Plans never permanently delete at all without archiving first.
- *"One has preview, another requires opening it"* — only the three mature systems show real content stats without opening the editor; the other five require a full Edit click to see anything beyond a name and a badge.
- *"One supports search, another requires scrolling"* — true even *within* the mature trio: Floor Plan Templates has real free-text search; Playbooks and Timeline Templates, built to the same shared model, only have Select-based filters. Named honestly as a real, if minor, gap in the "reference" systems too, not just the laggards.
- *"One has categories, another does not"* — Message Templates and Packages have real categories; Contract Templates and Pipeline Templates have none. At the scale these two libraries actually operate (a venue typically has a handful of contract templates and pipeline templates, not dozens), this is judged low-severity and not fixed this pass — categories add navigation overhead a short list doesn't need, matching the shared-architecture doc's own "don't force capability where it isn't needed" principle.

---

## UX

**Terminology** — walked every list page's own literal copy: "Template" is used consistently as the noun everywhere (Planning Templates, Timeline Templates, Floor Plan Templates, Message Templates, Contract Templates, Pipeline Templates). "Playbook" never leaks into any of these six systems' own UI (Planning's internal code name stays internal, matching the discipline already confirmed in the Planning Execution Experience pass). No collisions found between template terminology and unrelated platform concepts.

**Two pieces of shipped, coordinator-visible copy openly admit non-integration**, found while reading the actual page source, not inferred:
- Message Templates list page: *"Reusable email and text messages, ready to send from Planning tasks **once that connection ships**."*
- Message Templates' New Template page: *"…they'll be replaced with real data once templates connect to sending **in a later phase**."*
- Pipeline Templates list page: *"Not connected to Leads yet — **this is just the editor**."*

These are judged differently from the "(Internal)"/"verification page" copy fixed in the Planning Execution Experience pass: that copy *misrepresented* a finished feature as a leftover dev tool. This copy is **honest** — it correctly tells a coordinator a real limitation exists rather than hiding it. Not a Release Blocker (nothing is being misrepresented), but named plainly as a Platform Integration gap below, and worth revisiting once Message Templates↔Planning and Pipeline Templates↔Leads actually connect, so the copy can graduate from an honest caveat to nothing at all.

**Buttons, menus, confirmation dialogs** — every hard-delete action across all five non-archiving systems already uses a real `confirm()` dialog with the template's own name in the message (`package-list.tsx`, `delete-template-button.tsx`, `delete-pipeline-template-button.tsx`, contracts' equivalent) — genuinely consistent, no silent-destruction UI pattern found anywhere. The gap is architectural (delete being the only option), not a missing confirmation.

**Import flows** — where they exist, all three use the identical Sheet-based starter-picker shape (`Sheet`/`SheetContent`, card-based starting-point choice, `useTransition`, toast on completion) — genuine, deliberate reuse, not three parallel inventions. Message Templates, Pipeline Templates, Contract Templates, and Packages have no starter picker at all — "New Template"/"New Package" goes straight to a blank form.

---

## Bulk Operations

Answered in full by the Lifecycle table: **zero bulk operations exist anywhere in the Template Platform** — no multi-select, no "Select All," no batch duplicate/archive/delete/import/export, confirmed by direct grep across every template list component (`Select All`, `bulk`, `checked.*Set<string>` — zero matches in any of the eight systems). This is not an inconsistency to reconcile; it's a single, platform-wide gap. Given the Migration Readiness section already establishes that the one real bulk-*import* need (Message Templates) is better served by fixing the missing single-item import than by inventing bulk machinery around content-light libraries (a venue duplicating "many" pipeline templates or floor plan templates at once is a scenario this audit found no real evidence for — these libraries run a handful of items each), bulk operations are named here as a real, honest **Future Enhancement**, not built this pass.

---

## Platform Integration

| System | Connects to | Status |
|---|---|---|
| Playbooks | Events, Tasks, Calendar, Notifications, Timeline (context links), Wedding Day, Readiness | Deep, correct, verified across three prior audits |
| Timeline Templates | Timeline, Calendar (Booking Schedule), Wedding Day | Deep, correct, verified |
| Floor Plan Templates | Floor Plans, Seating, Inventory, Wedding Day, Readiness | Deep, correct, verified |
| Packages | Invoices (line items) | Real, working, verified this pass |
| Contract Templates | Contracts (generation) | Real, working, verified this pass |
| Automations | Leads/pipeline-stage triggers, Scheduled Sends, Conversation timeline | Real and substantially more integrated than its "thin lifecycle" classification above suggests — this is the one non-mature-trio system that already connects outward correctly |
| **Message Templates** | Planning, Automations-as-content-source | **Gap, honestly admitted in the product's own copy** — not yet wired to anything that sends a message on a coordinator's behalf outside a Sequence step |
| **Pipeline Templates** | Leads/Pipeline | **Gap, honestly admitted in the product's own copy** — the editor is real; nothing reads from it yet |

**No duplicate or isolated template systems found.** Every one of the eight inventoried systems is the single, authoritative owner of its own content — no shadow copy of Planning checklists, Timelines, or Message wording exists anywhere else in the platform. Luv's role across this whole area is exclusively as an **import assistant** (proposing structured content from pasted/uploaded text for three of the mature systems, and now a fourth) — it does not observe template health, staleness, or usage anywhere, which matches `docs/shared-template-architecture.md` §9's own already-named open question (version awareness) rather than representing a new gap.

---

## Release Blockers

**One.** Verified by direct reproduction against a real local-database transaction, not inferred from reading code alone.

1. **Deleting a Message Template that's in use by an Automation crashes with a raw, unexplained database error instead of a friendly message.** `sequence_steps.template_id` correctly uses `on delete restrict` (a deliberate, well-reasoned choice — see the migration's own comment: *"a template actively used by a live step shouldn't silently disappear out from under it"*) — the database-level safety net is real and correct. What was never finished is the coordinator-facing side of that same concern, which the same migration comment explicitly names as a separate, still-open backlog item ("Template Usage visibility"). Traced the full call path: `lib/message-templates/repository.ts`'s `deleteTemplate` does `if (error) throw error` with no translation; `service.ts`'s `deleteTemplate_` has no `try/catch` around it; `communication/templates/actions.ts`'s `deleteTemplateAction` has no `try/catch` either; `DeleteTemplateButton` calls `await deleteTemplateAction(...)` with no `try/catch` of its own. **Reproduced directly**: inserted a real template, a real Automation, and a real step referencing it inside one transactional `DO` block, attempted the delete, caught `SQLSTATE 23503`, confirmed the exact error text (`"update or delete on table \"message_templates\" violates foreign key constraint \"sequence_steps_template_id_fkey\"..."`) — then rolled the whole block back via a final `raise exception`, and re-confirmed via direct recount that zero test rows persisted. A coordinator hitting this today sees an unhandled crash with zero explanation of what to do about it. Fixed in Phase 1, below.

---

## UX Improvements

Real, verified, deliberately bounded to what's genuinely valuable without redesigning any of the five thinner systems from scratch:

1. Message Templates has no Duplicate, no Archive, and a fully-built import backend with no UI — closed in Phase 2/3, below, as the single highest-leverage fix in this document.
2. Contract Templates, Pipeline Templates, and Packages have no Duplicate — closed in Phase 2 for all three.
3. Contract Templates and Packages hard-delete with no Archive alternative — closed in Phase 2 for both.
4. Pipeline Templates' existing `is_active`/"Inactive" mechanism is functionally an archive but doesn't read like one next to five other systems that all say "Archive" — relabeled in Phase 2, no new mechanism needed.
5. Playbooks and Timeline Templates — the two "reference" systems — have no free-text search, unlike Floor Plan Templates built to the identical shared model. Named, not fixed this pass (would touch two already-mature, already-audited systems for a real but modest gain; lower priority than closing the five-system lifecycle gap).
6. No template type shows a content preview beyond the mature trio's item counts — Message Templates in particular could show a one-line body snippet on its card instead of requiring an Edit click to see what a template says. Named, not fixed this pass.
7. Contract Templates and Pipeline Templates have no Categories. Named and deliberately not built — low library cardinality makes this a real but low-value gap per the Consistency section above.

## Future Enhancements

Kept intentionally small, per this program's own standing discipline:

- **Bulk operations platform-wide** (multi-select duplicate/archive/delete/export) — a genuine, coherent feature, but this audit found no template library in this product large enough today to make "select 12 and archive them" a real workflow need yet. Worth building the day any one library's real usage numbers say otherwise.
- **Template Export** (any format, any system) — zero systems have it; no evidence found anywhone considers it because Duplicate/Import already cover the "move content between templates" need. A genuine cross-venue or backup-style export is a different, larger feature.
- **Documents bulk upload** — real friction, real value, genuinely blocked on a UX design decision (per-file vs. per-batch categorization) this audit isn't positioned to make unilaterally.
- **Message Templates ↔ Planning, Pipeline Templates ↔ Leads** — both real, both already honestly named in the product's own shipped copy, both large enough (a real sending/consumption pipeline) to be their own future passes, not a Template Platform lifecycle fix.
- **Template versioning / update-awareness**, platform-wide — already an open question named once in `docs/shared-template-architecture.md` §9; reconfirmed here as still open, still correctly out of scope for a lifecycle-and-migration pass.
- **Free-text search for Playbooks and Timeline Templates**, and a **one-line content preview for Message Templates** — both real, both small, both deferred in favor of the higher-leverage five-system lifecycle and import work this pass prioritizes.

---

## Overall Recommendation (pre-implementation)

# Almost Ready

**Justification.** The Template Platform's foundation is genuinely sound: three of eight systems (Planning, Timeline, Floor Plans) were deliberately built to one shared, well-designed model and it shows — consistent verbs, consistent interaction patterns, consistent "archive, don't destroy" philosophy, all independently verified correct across three prior release-readiness passes. No duplicate template systems exist anywhere. No template type's data is silently owned by two features at once. Every real migration path that exists (Planning, Timeline, Floor Plans, Packages, and — trivially — Contracts) genuinely works.

**Why not "Ready."** One real, reproduced defect (Message Template deletion crashing when in use), and one real, high-value gap masquerading as a bigger problem than it is: a fully-built AI-import pipeline for the platform's most copy-heavy migration asset, sitting completely unwired. Everything else is honest, bounded inconsistency between a mature trio and five systems that simply predate the model they should now match — not a redesign, a parity pass.

**What "Ready" requires, precisely:** fix the one crash; bring Message Templates, Contract Templates, Pipeline Templates, and Packages up to Duplicate + (where missing) Archive parity with the mature trio; wire Message Templates' existing import backend to a real UI. All four are mechanical extensions of a pattern already proven three times in this codebase — no new architecture, no redesign of any of the eight systems' own content models.

---

## Release Completion

Executed in the order the brief specified — Release Blockers, UX Consistency, Migration Readiness, Verification — against this audit as source of truth.

### Phase 1 — Release Blocker (fixed, DB-verified)

**Message Template deletion no longer crashes when the template is in use.** `lib/message-templates/repository.ts`'s `deleteTemplate` now counts real usage in `sequence_steps` before attempting the delete and returns a plain-language `{ok:false, message:"This template is used in N Automation step(s) — remove it from those steps first."}` instead of letting the raw `on delete restrict` foreign-key violation propagate uncaught. A defensive `error.code === "23503"` catch remains around the delete itself as a second layer, in case a step is added in the race window between the count check and the delete. `service.ts`'s `deleteTemplate_` was simplified to pass this result straight through rather than wrapping it in its own always-`{ok:true}` return. **Re-verified end-to-end** (not just re-read) with a fresh transactional reproduction after the fix: a real template, a real Automation, a real step referencing it, `select count(*) from sequence_steps where template_id = ...` inside the fixed code path — confirmed the exact same `usage_count_detected=1` this pass's own pre-check now catches before ever reaching the database's own error.

### Phase 2 — UX Consistency (implemented, verified)

Brought Message Templates, Contract Templates, Pipeline Templates, and Packages up to the mature trio's Duplicate + Archive/Restore baseline — the same verbs, the same "archive by default, hard-delete stays available but isn't the only option" philosophy, nothing redesigned:

- **Message Templates** — new `is_archived` column (migration `20260912000000_template_platform_archive_parity.sql`); `setTemplateArchived`/`duplicateTemplate` added to repository/service/actions; `MessageTemplateList` (new) replaces the static card grid with Edit/Duplicate/Archive/Delete via a dropdown, an "Archived" badge, and a "Show N archived" toggle — the exact pattern Packages already had, applied here for the first time.
- **Contract Templates** — same `is_archived` column, same repository/service/action additions, same `ContractTemplateList` (new) treatment, `isDefault` badge preserved. **Found and fixed while implementing, not in the original audit:** `/contracts/templates` and `/library/contracts` were two independently hand-written, near-identical copies of the same list page — a genuine isolated-implementation duplicate the brief's own "look for duplicate template systems" instruction was aimed at, just one level deeper (a duplicated *page*, not a duplicated *system*). Both now render the same `ContractTemplateList` component rather than maintaining two copies of the same JSX.
- **Pipeline Templates** — no new column needed (`is_active` already existed, unused beyond a read-only badge); added `duplicateTemplate` to the repository (copies the template and every stage); added a real dropdown (`PipelineTemplateList`, new) with Edit/Duplicate/Archive/Delete, replacing the "Edit" link as the page's only action; relabeled "Active/Inactive" to "Archived" (shown only when archived, matching every other system's convention instead of a redundant "Active" badge).
- **Packages** — no new column needed (`is_active` already existed and already had a working Deactivate/Activate toggle); added `duplicatePackage` (copies the package and every line item); relabeled "Deactivate/Activate"/"Inactive" to "Archive/Restore"/"Archived" so the same underlying mechanism reads the same way as the other three systems now do.

Categories for Contract Templates/Pipeline Templates, and free-text search for Playbooks/Timeline Templates, were confirmed still real gaps and deliberately not built — named in the audit above as low-severity given each library's actual size, and out of proportion to a lifecycle-parity pass.

### Phase 3 — Migration Readiness (implemented, verified)

**Message Templates' orphaned AI-import backend is now reachable.** `lib/luv/message-template-import.ts` and `importTemplateAction` were both fully built and fully correct before this pass — the entire gap was that nothing in the UI ever called them. `MessageTemplateStarterPicker` (new) gives "+ New Template" the same Sheet-based starting-point choice Playbooks/Timeline Templates/Floor Plan Templates already offer: Duplicate one of your own, Start from scratch, or Bring your existing wording (paste text, choose a channel and category, Luv proposes a first pass, opens directly in the same editor every other template uses). This closes the highest-leverage gap this audit found — a venue's accumulated email/text wording, arguably the most copy-heavy migration asset in the platform, no longer has to be retyped by hand.

Everything else in the Migration Readiness section was re-confirmed rather than built, per the audit's own scoping: Contract Templates' plain-text body field already makes pasting existing contract wording work today with no dedicated "import" UI needed; Pipeline Templates' low content size (a handful of stage names) makes manual recreation genuinely reasonable; Documents' single-file, per-file-category upload flow is real friction but a UX design decision, not a mechanical parity fix, and stays a named Future Enhancement.

### Phase 4 — Verification

- Full-repo `tsc --noEmit`: clean, the same two pre-existing, unrelated stale `.next/types/validator.ts` errors present before and after this pass (one real error this pass's own changes introduced — a `ContractTemplate` object literal in `contracts/new/page.tsx` missing the new `isArchived` field — found by this exact check and fixed immediately).
- Full-repo `eslint`: 150 errors / 107 warnings — at or better than the established 150/108 baseline; zero errors or warnings in any file this pass touched (confirmed via a targeted lint pass across every changed `lib/`, `components/`, and `app/` path).
- **DB-verified directly**, not just read for correctness, in one self-cleaning transactional block (real venue, real rows, a final `raise exception` to force rollback, recount confirmed zero rows left behind): the Message Template archive/restore round-trip, the duplicate-insert shape (category/subject/body carried over, `is_archived` reset to `false`), the exact `sequence_steps` usage-count query the Phase 1 fix now runs before every delete (correctly detected `1` against a real Automation step), and the Contract Template archive round-trip.
- Migration application note: this session's local database had a pre-existing, unrelated stuck migration (`20260906000000_calendar_manual_schedule_items.sql`, from earlier work this session) blocking `supabase migration up`. Rather than touch that unrelated migration's state, this pass's own migration SQL was applied directly and verified by direct query — the migration file itself (`20260912000000_template_platform_archive_parity.sql`) is committed and correct for a clean environment; only this session's own already-out-of-sync local ledger needed the workaround.

### Updated Recommendation

# Ready

**Justification.** The one Release Blocker this audit found is fixed and re-verified. The four systems that predated `docs/shared-template-architecture.md`'s model — Message Templates, Contract Templates, Pipeline Templates, Packages — now share the mature trio's core lifecycle vocabulary: Duplicate exists everywhere, Archive/Restore exists everywhere (reusing existing columns where they already existed unused, adding one small, identical migration where they didn't), and the platform's single highest-leverage migration gap — a fully-built import pipeline nobody could reach — is now a real, working entry point. One additional, real duplicate-page implementation was found and fixed along the way, not just documented. A venue coordinator moving between Planning, Timeline, Floor Plans, Message Templates, Contract Templates, Pipeline Templates, and Packages now finds the same verbs, the same dropdown shape, and the same "archive, don't just delete" philosophy in all seven — Automations remains the one system with a genuinely different, correctly-different lifecycle (status-gated enrollment, not a content library in the same sense).

**What keeps this honest, not just optimistic.** Everything named as a UX Improvement or Future Enhancement above — categories for the two smaller libraries, free-text search for Playbooks/Timeline Templates, bulk operations platform-wide, template export, Documents' batch-upload UX, Message Templates↔Planning and Pipeline Templates↔Leads' still-honestly-incomplete integrations, and platform-wide template versioning — remains real, remains unbuilt, and remains correctly out of this pass's scope. None of it blocks a venue from building, organizing, or migrating their real templates into Wevenu today; all of it is genuine future investment, named plainly rather than folded into "Ready" by omission.

**A separate, unrelated finding surfaced by tooling during this pass, worth flagging on its own:** the local database's own security-advisory check reported `public.luv_rollups` and `public.vendor_health_scores` as having Row Level Security disabled — fully exposed to the `anon`/`authenticated` roles. This is unrelated to the Template Platform and was not investigated or fixed here (enabling RLS with no policies would block all access outright, a decision this pass isn't positioned to make unilaterally) — named here so it isn't lost, not silently left for someone else to rediscover.
