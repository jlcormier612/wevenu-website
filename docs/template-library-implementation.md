# Work Package D2 — Template Library & Template-to-Working-Item Experience

**Date:** 2026-08-08
**Scope:** First implementation phase of the Business Asset/Document experience. Builds on `/library` (BA4) exactly as it exists — no new IA, no new architecture, no new asset types. Every deliverable below is evidence-based: real code read, a real transactional SQL test run against real dev data (rolled back, nothing permanent), real schema inspected. Where the architecture doesn't support something the brief describes, that's stated as a gap, not built around.

---

## 1. Template Inventory

Every real template/reusable mechanism in the product, traced to its actual table and code — not assumed from a name.

| System | Table(s) | Template identifier | Owner | Create | Edit | Duplicate | Apply/Use | Smart fields | Preview (pre-D2) | Versioning |
|---|---|---|---|---|---|---|---|---|---|---|
| **Contract Templates** | `contract_templates` | `id` (uuid) | Venue | `/contracts/templates/new` | `/contracts/templates/[id]/edit` | Real (`duplicateTemplateAction`) | `/contracts/new` (real, pre-existing) | Real — `{{token}}`, 8 fields | None (added this phase) | None — clone-only |
| **Packages** | `packages`, `package_items` | `id` | Venue | `/packages` | in-place | Real (`duplicatePackage`) | Added as Event Order/Invoice lines | None | Card only | None |
| **Questionnaires** | `event_questionnaires` | — | — | — | — | — | — | — | — | — |
| **Questionnaire Templates** | *(does not exist — BA1 finding, reconfirmed)* | | | | | | | | | |
| **Message Templates** | `message_templates` | `id` | Venue | `/communication/templates/new` | in-place | Real | Selected when composing/scheduling | Real — independent `{{token}}` system, 5 fields | Sample-data preview (`substituteSampleMergeFields`) | None — clone-only |
| **Planning Templates (Playbooks)** | `playbook_templates`, `playbook_tasks`, `playbook_milestones` | `id` | Venue | `/library/playbooks` | in-place | Real | Apply-to-event (event creation or Planning tab) | N/A | Card + stats | None — clone-only |
| **Timeline Templates** | `timeline_templates`, `timeline_template_items` | `id` | Venue + built-in starter set | `/library/timeline-templates` | in-place | Real | Apply-to-event | N/A | Entry-count preview in picker | None — clone-only |
| **Floor Plan Templates** | `floor_plan_templates`, `floor_plan_template_objects` | `id` | Venue | `/library/floor-plan-templates` | in-place (canvas) | Real | Apply-to-event | N/A | Card + stats | None — clone-only |
| **Pipeline Templates** | `pipeline_templates` | `id` | Venue | `/library/pipeline-templates` | in-place | Real | Applied per-lead | N/A | Card only | None |
| **Inventory** | `inventory_items`, `inventory_categories` | `id` | Venue | `/library/inventory` | in-place | *(none — BA1 confirmed)* | Placed on Floor Plans | N/A | Card only | None |
| **QR Campaigns** | `qr_campaigns` | `id` | Venue | `/library/qr-campaigns` | in-place | Not checked this phase | N/A | N/A | Card only | None |
| **FAQs** | `venue_operational_info.faqs` (jsonb) | *(no per-item id)* | Venue | Whole-array rewrite | Whole-array rewrite | N/A | Live on Venue Guide | N/A | None | None |
| **Event Order templates** | *(does not exist — confirmed this phase: no `event_order_template` table/type anywhere)* | | | | | | | | | |
| **"Save as Template" (any type)** | *(does not exist — confirmed this phase, grepped for every variant)* | | | | | | | | | |

**Two independent smart-field engines found, byte-for-byte duplicated in their core mechanics** — Contracts' `lib/contracts/merge.ts` and Message Templates' `lib/message-templates/merge.ts`. Consolidated this phase (§2).

---

## 2. Template Library Implementation Report — exactly what was built

1. **Consolidated the two smart-field engines into one.** `lib/shared-merge/tokens.ts` now holds the one real implementation of `mergeContent`/`extractTokens`/`MergeData` — previously hand-duplicated (the message-templates file's own comment said "Mirrors lib/contracts/merge.ts's pattern," i.e., a known copy, not a shared module). Both `lib/contracts/merge.ts` and `lib/message-templates/merge.ts` now import and re-export from the shared module; each system's own field vocabulary (`buildMergeData`, its own `MergeContext` shape) stays where it was, since those genuinely differ and were never duplicated. No consumer's import path changed — `lib/contracts/service.ts` and `lib/scheduled-messages/processor.ts` still import `buildMergeData`/`mergeContent` from the same paths they always did.

2. **Fixed a real, confirmed count-accuracy bug on `/library`.** The landing page (built in BA4) was passing `includeArchived=true` for Contract Templates, Message Templates, and QR Campaigns, and — a second, independently-confirmed bug — the "for library" fetchers for Playbooks, Timeline Templates, Floor Plan Templates, and Inventory never filter archived/inactive at all (verified against their real repository queries: no archived predicate in any of the four). Every count on the Library landing page was inflated by retired templates. Fixed by omitting `includeArchived` where the fetcher already defaults to active-only, and filtering client-side (`!t.isArchived`) for the four fetchers whose shared "with stats" query has no filter parameter — this doesn't touch those functions' other real callers (e.g. `contract-template-list.tsx`'s own "Show N archived" toggle), which still need the unfiltered set.

3. **Added the honest "Coming Later" placeholder for Event Orders.** Confirmed this phase (no `event_order_template` table/type anywhere) — matches the treatment already established for Questionnaire Templates/Brochures/Saved Reports, not new functionality.

4. **Fixed the Contract Template "Use" button to actually carry the chosen template.** Before this phase, every card's "Use" button linked to the bare `/contracts/new` regardless of which template was clicked — the coordinator had to re-pick the template on the destination page. Now: `?templateId={id}` is passed, `/contracts/new` reads it via `searchParams`, and `NewContractForm` pre-selects that exact template (falling back to the venue's default only when arriving without one — e.g. from the sidebar "New Contract" entry point).

5. **Added a confirmation step before creating a Working Contract** (brief's own Step 37 example, reused verbatim in shape): "Create {client}'s contract? Template: {name}. This will create a new working contract you can send for signing." Uses the same `confirm()` weight this app already uses for its other simple confirmations (e.g. Contract Detail's "Cancel and void this contract?") — not a new dialog system.

6. **Added a real template preview** (`TemplatePreviewSheet` in `contract-template-list.tsx`) — shows the template's actual name, description, "Updated {relative time}," and its real content (the same text a coordinator edits, the same text that becomes a Working Contract), in a read-only scrollable panel, with a "Use Template" action that carries the template id forward. Not a generic thumbnail — the real content, per Step 12's own rule.

7. **Added "Last updated"** to every Contract Template card, reusing `formatRelative` (the same helper Playbooks' own card already uses for the identical purpose — not a new date-formatting function).

**Not touched:** Packages, Playbooks, Timeline Templates, Floor Plan Templates, Pipeline Templates, Inventory, QR Campaigns, Message Templates list UIs. Each already has its own working card with Edit/Duplicate/Archive — consistent with this codebase's own established "Template Platform Release Readiness parity pass" precedent (matching behavior across types, not one shared component forced onto all of them — confirmed by that exact phrase already in `contract-template-list.tsx`'s own header comment, predating this phase). Extending preview/last-updated/confirmation to the other six is named as follow-up work (§9), not attempted here, to keep this phase's one fully-realized example (Contracts) genuinely complete and validated rather than six examples half-done.

---

## 3. Template → Working Item Flow Map

| Template type | Destination(s) supported today | How destination is chosen | Confirmation step | Where it lands after creation |
|---|---|---|---|---|
| Contract Templates | Client only | Dropdown of all venue clients (`/contracts/new`) | **Added this phase** | Directly on the new Contract's detail page (already correct pre-existing behavior) |
| Playbook Templates | Event | Implicit — applied from inside the event's own Planning tab, or at event creation | Only for the separate "Release to Client" action (unrelated to applying itself) | Stays on the same page |
| Timeline Templates | Event | Implicit — applied from inside the event's own Timeline tab | `window.confirm` only when it would add on top of existing entries (a real risk, not applying itself) | Stays on the same page |
| Floor Plan Templates | Event | Implicit — a "+ New Floor Plan" dialog on the event's own Floor Plans tab | None | Navigates directly into the new Floor Plan's own editor |
| Packages | N/A (added as a line item, not "created for" a destination) | — | — | — |
| Message Templates | A conversation/scheduled send | Selected when composing | N/A | N/A |

**Confirmed gap, not built around:** Contract Templates support only a Client destination — there is no Event selector. The existing form's own code comment states this precisely: *"We don't have a client→events join here... Omit event select for now."* This is missing plumbing (a client→events lookup), not missing UI — building a selector on top of a join that doesn't exist would be exactly the "dangerous approximation" the brief's Step 15 forbids. Documented here per that same instruction, not implemented.

**Pattern already correct across every "apply to event" flow (Playbooks/Timeline/Floor Plan):** the destination event is always implicit, because the coordinator is already on that event's own page — there was never a "pick from a list of events" step to fix, and the brief's Step 35 vision ("start the relevant workflow without leaving context") is already how these three work today.

---

## 4. Smart Field Matrix

| Field | System | Source (system of record) | Live or snapshot | Missing-value behavior | Editable after resolve? |
|---|---|---|---|---|---|
| `venue_name` | Contracts | `venues.name` | **Snapshot** — resolved once, on "Apply merge fields" click, baked into `contracts.content` | Would render empty (venue always has a name in practice) | Yes — free-text after merge |
| `couple_name` | Contracts | `clients.first_name/last_name/partner_*` | Snapshot | Empty string | Yes |
| `primary_contact_name` | Contracts | `clients.first_name/last_name` | Snapshot | Empty string | Yes |
| `event_date` | Contracts | `events.event_date`, falls back to `clients.event_date` | Snapshot | **Empty string — confirmed silent, Step 22 concern below** | Yes |
| `event_type` | Contracts | `events.event_type`, falls back to `clients.event_type` | Snapshot | Empty string | Yes |
| `guest_count` | Contracts | `events.guest_count`, falls back to `clients.guest_count` | Snapshot | **Empty string — confirmed silent, Step 22 concern below** | Yes |
| `today_date` | Contracts | `new Date()` at merge time | N/A — computed, not stored | Never missing | Yes |
| `contract_title` | Contracts | The title field the coordinator typed | Snapshot (of form state, not a table) | Empty string if left blank | Yes |
| `venue_name`, `client_name`, `coordinator_name`, `event_date` | Message Templates | Built fresh per send from the relationship at send time | **Live** — genuinely re-resolved at send time, not schedule time (confirmed via `lib/scheduled-messages/processor.ts`'s own comment: "not a schedule-time snapshot") | Empty string | N/A — resolved into an outgoing message, not further edited |
| `days_until_event` | Message Templates | Computed from `event_date` at send time | Live (same as above) | Empty string if no event date | N/A |
| `task_name` | Message Templates | **Nothing — deliberately absent from `MergeContext`** | N/A | Left as the literal `{{task_name}}` token (unknown-token fallback) | N/A |

**A real, confirmed Step 22 violation — not fixed, documented as instructed.** Missing Contract merge values (`event_date`, `guest_count` when the client has no event or no guest count on file) resolve to a **silent empty string**, not a visible "needs attention" marker. The brief's own Step 22 explicitly names this exact failure mode ("Guest Count: —" being wrong, unless "the existing product already deliberately uses that behavior") — and the product's own behavior today is exactly that silent case, with no evidence it was a deliberate choice (no code comment claims it, unlike the deliberate `task_name` absence above, which *is* explained). Not fixed this phase — resolving it means either the merge form warns before allowing "Apply," or the missing-field UI changes, both real product behavior decisions the brief itself reserves for someone else ("Do not decide product behavior on your own"). Flagged here as the clearest, most concrete Smart Field gap this inventory found.

**Unknown/mistyped tokens** (e.g. `{{clint_name}}`) are left verbatim in the output on both systems — also silent, in the sense that nothing tells the coordinator a token didn't resolve. Same reasoning: named, not fixed.

---

## 5. Permission Matrix

Real role values confirmed from `venue_staff.role`: `owner`, `manager`, `coordinator`, `staff` (a genuine four-tier model, wider than the brief's own three-tier example — used as found, not narrowed to match the brief).

| Capability | Owner | Manager | Coordinator/Staff | Client | Vendor |
|---|---|---|---|---|---|
| View Library | ✓ | ✓ | ✓ | ✗ (RLS: `current_user_venue_id()` never resolves for a client/vendor `auth.uid()`) | ✗ (same) |
| Create/Edit template (any of the 7 real types) | ✓ | ✓ | ✓ — **no role gate exists** | ✗ | ✗ |
| Duplicate template | ✓ | ✓ | ✓ — **no role gate exists** | ✗ | ✗ |
| Archive template | ✓ | ✓ | ✓ — **no role gate exists** | ✗ | ✗ |
| **Delete** Contract Template / Package / Playbook Template | ✓ | ✓ | ✗ — **RLS-enforced** (`contract_templates_delete_gate`, etc., `current_user_role() in ('owner','manager')`) | ✗ | ✗ |
| **Delete** Timeline Template / Floor Plan Template / Message Template / Inventory Item | ✓ | ✓ | ✓ — **inconsistency, not enforced at all** (these four tables were never added to the TR-G6 delete-gate migration) | ✗ | ✗ |
| Use Template (create a Working Item) | ✓ | ✓ | ✓ | ✗ | ✗ |
| Edit resulting Working Item (e.g. a Contract in Draft) | ✓ | ✓ | ✓ | ✗ (couple only signs, never edits — BA2) | ✗ |

**A real inconsistency, surfaced not invented:** Delete is role-gated for 3 of the 7 template types and completely ungated for the other 4, with no apparent product reason for the split — it tracks exactly which tables the TR-G6 migration happened to include, not a deliberate policy. Per the brief's own instruction ("respect existing role/relationship permissions... do not decide product behavior on your own"), this phase did not add the missing gates — that would be a real RLS/behavior change requiring a product decision this phase isn't positioned to make. Named here as the Permission Matrix's own most material finding.

**Verification method:** RLS policies read directly from `supabase/migrations/*.sql` (the actual `using`/`with check` clauses, not inferred from UI), matching this engagement's standing rule that UI hiding is never treated as security. No app-layer role check exists for template CRUD beyond the RLS layer described above — confirmed by grepping every relevant `app/(app)/*/actions.ts` file for role-name comparisons.

---

## 6. Template Isolation Validation

**Real, transactional evidence — not inferred from reading code alone.** Run directly against the local dev database inside `BEGIN…ROLLBACK` (impersonating a real venue owner via the same `set_config('request.jwt.claims', ...)` pattern established earlier in this engagement); nothing below was left in the database.

1. Created a real `contract_templates` row ("D2 Isolation Test Template," content `Original content for {{couple_name}}.`).
2. Created a real `contracts` row (the Working Item) by copying that content — exactly what `lib/contracts/service.ts`'s real `createContract` path does (merge, then insert into `contracts.content`).
3. **Modified the Template's content.** Re-queried the Working Item: **unchanged**, still reads the original text.
4. **Modified the Working Item's content.** Re-queried the Template: **unchanged**, still reads its own (separately) modified text from step 3 — confirming the reverse direction too.
5. **Duplicated the Template**, modified the duplicate's content. Re-queried the original Template: **unchanged**.

All five steps produced the exact expected result — full isolation in both directions, for both edit and duplicate. Transaction rolled back; the real venue's data is untouched.

**Playbooks (Task Lists) verified by schema inspection rather than a live test, since seeding a full event fixture was out of proportion to what the schema already proves:** `event_tasks.template_task_id` references `playbook_tasks.id` `on delete set null` — a soft lineage pointer, not a live join. `event_tasks` carries its own independent `title`, `description`, `due_date`, `days_offset` columns; nothing in the codebase queries through `template_task_id` to render a task's content. Editing `playbook_tasks.title` on a template therefore cannot change an already-applied `event_tasks.title` — the same structural guarantee proven live for Contracts, confirmed here by the schema instead of a second live test.

**Timeline Templates and Floor Plan Templates were not independently tested this phase** — BA1's own prior finding ("every Template→Working Asset transition in this product is a copy, never a live reference") already covers them, and this phase's two independent checks (one live, one schema) corroborate rather than contradict that finding. Named as a real, minor gap in this validation's coverage rather than silently assumed complete.

---

## 7. Regression Report

- `npx tsc --noEmit -p .` run after every single change in this phase (nine checkpoints), clean throughout against the pre-existing baseline (four unrelated errors, same ones present at the start of this entire multi-phase engagement).
- No file outside the ones listed in §2 was modified. `lib/contracts/service.ts`, `lib/scheduled-messages/processor.ts`, and `lib/scheduled-messages/repository.ts` (the three real consumers of the merge engines) were re-read after the consolidation and confirmed to still import from their original paths — the consolidation is invisible to them.
- No scriptable authenticated browser session exists in this environment (the same limitation stated in every prior phase of this engagement) — Relationship Workspace, Client Portal, Vendor Workspace, Messaging, Invoices, Event Orders, Floor Plans, Tasks, Payment Plans, and Dashboard were not touched by any edit in this phase, so no live click-through was owed for them; none was performed, and none is claimed.

---

## 8. Duplicate-System Audit

Searched after implementation, as instructed, rather than assumed clean:

- `mergeContent`/`extractTokens` now exist in exactly one place (`lib/shared-merge/tokens.ts`); `lib/contracts/merge.ts` and `lib/message-templates/merge.ts` both re-export from it — confirmed via `grep -rln "mergeContent\|extractTokens" lib/`.
- `TemplatePreviewSheet` and `ToolboxCard` (the two new presentational pieces this phase introduced) each exist in exactly one file — no second copy anywhere.
- No second Library page, no second template-search implementation, no second "Use Template" workflow, no second permission model were created. The one real consolidation this phase performed (the merge engines) is documented in §2, not left as a silent duplicate.

---

## 9. PASS / FAIL Matrix

| Template type | Library | Preview | Edit | Duplicate | Use | Relationship instantiation | Smart fields | Permissions | Mobile |
|---|---|---|---|---|---|---|---|---|---|
| **Contract Templates** | PASS | PASS (added) | PASS* | PASS* | PASS (fixed: template now carries through + confirmation added) | PARTIAL — client only, event gap documented (§3) | PARTIAL — resolves correctly; missing-value silence is a named, unfixed gap (§4) | PASS (verified against real RLS) | Not verified this phase — named follow-up |
| **Packages** | PASS | N/A (not a document-shaped preview — line-item catalog) | PASS* | PASS* | PASS* (adds as a line item, already worked) | N/A (no single destination — used across many Event Orders/Invoices) | N/A | PASS | Not verified |
| **Questionnaire Templates** | N/A — correctly absent (doesn't exist) | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| **Message Templates** | PASS* | PASS* (pre-existing sample-data preview) | PASS* | PASS* | PASS* (compose/schedule flow, pre-existing) | PASS* (live resolution at send time) | PASS* | PASS | Not verified |
| **Planning Templates (Playbooks)** | PASS* | PASS* (stats-based preview) | PASS* | PASS* | PASS* (apply-to-event, pre-existing, already contextual) | PASS* | N/A | PASS | Not verified |
| **Timeline Templates** | PASS* | PASS* (entry-count preview) | PASS* | PASS* | PASS* | PASS* | N/A | PASS | Not verified |
| **Floor Plan Templates** | PASS* | PASS* | PASS* | PASS* | PASS* | PASS* | N/A | PASS | Not verified |
| **FAQs** | PASS* | N/A (whole-array content, not a single previewable item) | PASS* | N/A (no per-item duplicate) | N/A (live, not instantiated) | N/A | N/A | PASS | Not verified |
| **Event Orders (as templates)** | N/A — correctly absent (doesn't exist) | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |

`PASS*` = already correct before this phase, verified not rebuilt. `PASS` (no asterisk) = fixed or built this phase. Mobile is marked "Not verified" rather than PASS/FAIL for every row — no visual/device check was possible in this environment (same constraint as every prior phase), and claiming PASS without having looked would be exactly the overclaiming this whole engagement has consistently avoided.

---

## What's left, named plainly

1. **The Contract → Event destination gap** (§3) — real missing plumbing (a client→events join), not a UI gap. The next-smallest safe step would be adding that join as a read-only lookup, not building a UI on top of nothing.
2. **Silent missing-value and unknown-token behavior in both merge systems** (§4) — the clearest concrete Step 22 finding; needs a product decision (what should "Guest Count needed" actually look like) before it's implemented.
3. **Extend preview/last-updated/confirmation to the other six template types** — the pattern is proven on Contracts; repeating it elsewhere is mechanical, not exploratory, matching how prior phases in this engagement have sequenced "prove on one, then repeat."
4. **The Delete-permission inconsistency across template types** (§5) — a real product decision (should Timeline/Floor Plan/Message Templates/Inventory get the same owner/manager-only delete gate Contracts/Packages/Playbooks already have?), not something this phase should decide unilaterally.
5. **Mobile verification** — genuinely not possible in this environment; a real gap in this validation, not a false PASS.

**Stopping here, as instructed.** No new architecture, no new asset types, no PDF/signature/collaboration/approval engines, no new Dashboard/Reporting/Luv capability, no new Document Domain tables were built in this phase.
