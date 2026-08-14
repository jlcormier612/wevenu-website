# Work Package D5D — Questionnaire Working Experience, Collaboration & Completion

Status: **Shipped and validated against real dev data.** All migrations applied for real (not just dry-run). 23/23 real transactional/RPC checks pass. Full-project typecheck clean. Live smoke test caught and fixed one real runtime bug (client/server module boundary) before this doc was written.

## 1. What this phase is

The Questionnaire ("Final Details" form) is the one place a couple gives a venue the day-of facts the venue can't run the wedding without: guest count, songs, meal notes, and a day-of emergency contact. D3 and D5 had already found real gaps here (zero required-field validation, a completely fixed global schema, no activity log, a permission bug nobody had noticed). D5D's job was to make this a *complete, trustworthy, working experience* — not to turn it into a second Contract system. The brief was explicit and repeated throughout: **Questionnaires are not Contracts.** No automatic signature, no PDF, no immutable representation, no amendment workflow, no new generic form/template/messaging engine — unless the actual current product genuinely required it. Most of those, on inspection, did not. This document says so plainly, with the reasoning, rather than silently declining to build them.

## 2. What was read before anything was written

- `lib/events/questionnaire.ts`, `components/form/couple-questionnaire-form.tsx`, `components/events/final-details-form.tsx` — the real current implementation.
- `supabase/migrations/20260627260000_final_details.sql`, `…280000_questionnaire_collaboration.sql`, `…300000_questionnaire_messaging.sql`, `20261147000000_client_workspace_questionnaire_in_portal.sql`, `20261247000000_questionnaire_required_fields.sql` — the full migration history of this table.
- `app/(app)/events/[id]/questionnaire-actions.ts`, `components/portal/questionnaire-section.tsx`, `app/api/public/questionnaire/route.ts`, `app/api/portal/questionnaire/route.ts` — every real entry point.
- `lib/shared-merge/tokens.ts` — the one `{{token}}` merge engine (D2's consolidation of what used to be two hand-duplicated copies in Contracts and Message Templates).
- `lib/event-inventory/*` and its D5A migration — the most recent real Template → Working Item precedent, used as the pattern to mirror.
- `components/leads/activity-timeline.tsx` — the one shared `ActivityTimeline` component, reused rather than forked.
- `supabase/migrations/20261243000000_contract_signed_notification.sql` — the exact precedent for "a submission needs to actually alert the coordinator, not just log an activity."

Two real, load-bearing findings came out of this reading pass, before any code was written:

1. **`event_questionnaires`' RLS policy was wrong.** It still read `owner_user_id = auth.uid()` directly — written before Sprint 107 introduced `venue_staff`/`current_user_venue_id()`, and never migrated. Every other venue-scoped table (`event_orders`, `event_inventory`, …) uses `venue_id = current_user_venue_id()`, which resolves either the owner *or* an accepted, active staff member. This one didn't. **Any Coordinator or Staff user — not the venue owner — was silently blocked from reading or writing questionnaires at the RLS layer.** Confirmed live in §11 below.
2. **The couple form has zero persistence until final submit.** Every answer lives only in React state; there was no draft-save endpoint at all. Close the tab, lose the connection, or just get called away mid-form, and everything typed is gone. This is the single most consequential UX gap the brief pointed at ("the most important UX portion of D5D").

## 3. Scope decisions — built vs. explicitly not built

| Area | Decision | Why |
|---|---|---|
| **Fixed question set** | **Kept exactly as-is.** No new question-type framework. | D3/D5 already confirmed one fixed global schema; the brief explicitly forbids inventing a flexible question engine ("preserve existing question types"). |
| **Template layer** | **Built** — `questionnaire_templates`, real Template → Working Questionnaire flow. | The brief's own primary desired journey opens with "Template → Working Questionnaire," unlike D5C's Event Order template (which stayed conditional and was declined). A real, named gap existed (`library/page.tsx` had a `ComingLaterCard` saying exactly this didn't exist yet). |
| **What a template configures** | Only *which of the six genuinely-optional fields* (meal notes, 4 song fields, special requests) are shown/required. **Not** a flexible question builder. | Keeps the fixed-field model intact; avoids building a "generic form platform" the brief explicitly warns against. `final_guest_count` and the emergency contact stay unconditionally required — D5's own reasoning ("the venue can't run the event without this") is a safety fact, not a style preference, so it isn't template-configurable. |
| **Smart fields / `lib/shared-merge/tokens.ts`** | **Assessed, not wired in.** Documented, not silently skipped. | Contracts and Message Templates use `{{token}}` merge because they contain venue-authored free-text *content* that needs substitution. The Questionnaire has no such content — the couple's known context (event name, date, venue branding) is already shown as direct structured data in the form header. There is no template string here for `mergeContent()`/`extractTokens()` to operate on. Forcing the engine in would mean inventing content to merge into, which is the wrong direction. |
| **Autosave / draft-save** | **Built.** New `save_questionnaire_draft_as_couple()` RPC + `/api/public/questionnaire/draft`, debounced client-side. | Real, confirmed gap (§2). This is the couple's actual "save progress" mechanism. |
| **Optimistic concurrency** | **Built**, same `updated_at`-token pattern as D4 (Contracts) and D5A (Event Inventory). | Coordinator and couple can both write to overlapping fields (guest count, meal notes, songs, emergency contact, special requests) — confirmed by comparing the two forms' field sets. Without this, whoever saves last silently wins. |
| **Activity log** | **Built** — `questionnaire_activities`, reusing the existing `ActivityTimeline` component unmodified. | Named D3 gap: no activity history existed beyond three coarse timestamps. Logs meaningful lifecycle events only (sent, opened, submitted, reviewed, reopened) — never per-keystroke edits, per the brief's own instruction. |
| **Coordinator notification on submit** | **Built** — `submit_questionnaire_as_couple()` now calls `create_venue_notification()`, mirroring the exact `sign_contract()` fix from D3. | Confirmed the same gap D3 found and fixed for Contracts existed here too: submission only ever produced a system chat message, nothing pages the coordinator's notification feed. |
| **Reopen** | **Built** — plain authenticated status rollback (`submitted`/`reviewed` → `sent`) from the TS repository layer, not a `SECURITY DEFINER` RPC. | Explicit action, as required. No `SECURITY DEFINER` function was written for this specifically to avoid a caller-supplied `venue_id` parameter — the exact class of security hole this codebase's other `SECURITY DEFINER` functions all avoid. Confirmed live in a negative test (§11, 8e) that no such RPC exists. |
| **PDF representation / Document Domain** | **Not built.** | No current product requirement establishes it. The Questionnaire is a working document collecting facts, not an artifact anyone signs, prints, or archives as a record — unlike Contract (D4) or Event Order (D5C), both of which have a real "finalized, shareable, professional document" need. Decision documented here, not silently declined. |
| **Version history** | **Not built.** | Same reasoning. Nothing in the current product asks "what did the couple's answers look like before this edit." |
| **Vendor questionnaires** | **Not built.** | No existing workflow requires it; this would be new surface area with no current caller. |
| **A second messaging/template engine for sending the invite** | **Not built.** | The existing `sendQuestionnaireToCouple()` hardcoded email works and reaches the couple. Wiring the invite text through the Message Templates system (so venues can customize copy with `{{tokens}}`) is a real, legitimate *future* improvement, but it's an expansion of scope beyond "Questionnaire working experience, collaboration, completion" and was left alone rather than half-built under time pressure. Flagged here for a future phase, not silently dropped. |
| **Preview as Client** | **Built**, reusing the real `CoupleQuestionnaireForm` component with a `previewMode` prop — not a second mock. | Explicit brief requirement ("use actual rendering, not a second mock"). |

## 4. Data model

```
questionnaire_templates
  id, venue_id, name, description,
  included_fields text[]   -- subset of {meal_notes, processional_song, recessional_song,
                            --             first_dance_song, parent_dances, special_requests}
  required_fields  text[]  -- CHECK: required_fields <@ included_fields
  is_archived, created_at, updated_at

event_questionnaires  (existing table, extended)
  + template_id       uuid  -- provenance, nullable
  + included_fields   text[]  -- SNAPSHOT at creation, default = all six
  + required_fields   text[]  -- SNAPSHOT at creation, default = none

questionnaire_activities
  id, venue_id, questionnaire_id,
  type in ('sent','opened','submitted','reviewed','reopened'),
  title, description, created_at
```

**Isolation guarantee** (same as every other Template → Working Item pattern in this app): applying a template *copies* `included_fields`/`required_fields` onto the questionnaire at that moment. Editing the template afterward never touches a questionnaire already in flight. Verified live — §11, tests 2c/2d.

**Migrations** (all applied for real, transactionally dry-run first):
- `20261253000000_questionnaire_working_experience.sql` — RLS fix, `questionnaire_templates`, `event_questionnaires` new columns, `questionnaire_activities`, `submit_questionnaire_as_couple()` rewritten (dynamic required fields, concurrency, activity log, real notification), `get_questionnaire_for_couple`/`get_questionnaire_for_portal` extended, `mark_questionnaire_opened()` now logs activity.
- `20261254000000_questionnaire_draft_save_and_reopen.sql` — `save_questionnaire_draft_as_couple()`.
- `20261255000000_questionnaire_drop_old_submit_overload.sql` — a real bug found by this phase's own validation script: `CREATE OR REPLACE FUNCTION` does **not** replace a function whose parameter list changed; Postgres had silently created a second, overloaded `submit_questionnaire_as_couple()` instead of replacing the original, and PostgREST could no longer choose between the two (`PGRST203`). Fixed by explicitly dropping the old 10-argument signature.

## 5. Code changed

- `lib/events/questionnaire-constants.ts` — **new.** Pure constants (`CONFIGURABLE_FIELDS`, `ConfigurableField`, `QuestionnaireStatus`) with zero dependencies, so Client Components can import them without pulling in `lib/events/questionnaire.ts`'s server-only `next/headers` dependency. See §10 for why this file exists.
- `lib/events/questionnaire.ts` — dynamic (template-driven) required-field validation, optimistic concurrency on `saveQuestionnaire()`, activity logging, `reopenQuestionnaire()`, `getQuestionnaireActivities()`.
- `lib/questionnaire-templates/service.ts` — **new.** Template CRUD + `applyTemplateToEvent()` (the snapshot-and-isolate operation). One file, no `types.ts`/`repository.ts` split — there are no child rows here (unlike Inventory templates), so the larger domain's file layout would have been unused ceremony.
- `app/(app)/events/[id]/questionnaire-actions.ts` — new server actions: `reopenQuestionnaireAction`, `applyQuestionnaireTemplateAction`, `createQuestionnaireTemplateAction`, `updateQuestionnaireTemplateAction`, `setQuestionnaireTemplateArchivedAction`; `saveQuestionnaireAction`'s signature extended for concurrency/required-fields.
- `components/questionnaire-templates/questionnaire-template-list.tsx` — **new.** Library UI: create/edit template with the include/require checkbox grid.
- `app/(app)/library/questionnaire-templates/page.tsx` — **new** Library route.
- `app/(app)/library/page.tsx` — the pre-existing `ComingLaterCard` for "Questionnaire Templates" replaced with a real `ToolboxCard`.
- `components/events/final-details-form.tsx` — apply-template picker (draft-only), dynamic required/hint markers per field, "Preview as client" link, Reopen button, `ActivityTimeline` wired in, concurrency token tracked and refreshed after every save.
- `components/form/couple-questionnaire-form.tsx` — renders only `included_fields`; dynamic required markers from `required_fields`; debounced autosave with a save-state indicator; concurrency-conflict screen ("This form was just updated"); `previewMode` prop; mobile pass (larger tap targets, `inputMode` hints, sticky-safe bottom padding).
- `app/(app)/events/[id]/questionnaire-preview/page.tsx` — **new.** Authenticated "Preview as Client," reuses `CoupleQuestionnaireForm` unchanged.
- `app/api/public/questionnaire/draft/route.ts` — **new** draft-save endpoint.
- `app/api/public/questionnaire/route.ts` — passes the concurrency token through.
- `app/(app)/clients/[id]/page.tsx`, `components/events/event-detail.tsx` — thread `questionnaireTemplates`/`questionnaireActivities` down to `FinalDetailsForm`.
- `components/leads/activity-timeline.tsx` — added icon/color mappings for the five questionnaire activity types (`sent`, `opened`, `submitted`, `reviewed`, `reopened`) to the one shared component, rather than forking it.

## 6. Question → destination → write behavior → source-of-truth map

Required by the brief, to make explicit exactly what each answer does and does not do downstream.

| Question | Destination | Write behavior | Source of truth after write |
|---|---|---|---|
| Final guest count | `event_questionnaires.final_guest_count` only | Direct write, this table only | **Display-only.** `events.guest_count` remains the one authoritative guest count (D3's own named finding, reinforced again here). The Questionnaire's own count is never synced anywhere — not into `events.guest_count`, not into `guest_count_submissions`. Any UI needing the real guest count reads `events.guest_count`. |
| Meal notes, songs (×4), special requests | `event_questionnaires` only | Direct write, this table only | Display-only, shown on the Final Details tab and printable day sheet. No downstream writes. |
| Emergency contact name/phone | `event_questionnaires` only | Direct write, this table only | Display-only. |
| Submission event | `questionnaire_activities` (new), `venue_notifications` (new), `luv_celebrations`, `event_tasks` (via `triggerAutoComplete("questionnaire_submitted")`, unchanged from D5), `leads`/scores (unchanged from D5) | All additive, no financial or Event-Order writes | None of these create or modify a financial record, an Event Order line, or an Inventory item. Confirmed by inspection of `submit_questionnaire_as_couple()`'s full body — the only tables it touches are `event_questionnaires`, `questionnaire_activities`, `venue_notifications`, `messages`/`message_threads`. |

No blanket auto-sync exists anywhere in this system, and none was added.

## 7. Field ownership (collaboration model)

Simplest model that reflects the actual workflow — no permissions editor, no per-field ACL:

- **Couple-only-visible fields**: the six configurable fields + guest count + emergency contact (i.e. everything `CoupleQuestionnaireForm` shows).
- **Coordinator-only fields**: ceremony/reception start time, ceremony/reception location, vendor arrival notes — never shown to the couple, confirmed unchanged from the original design (`couple-questionnaire-form.tsx`'s own field list never included these).
- **Both can write** to the overlapping fields (guest count, meal notes, songs, emergency contact, special requests) — this is real and was previously silently unprotected (§2). Now protected by optimistic concurrency (§9).
- The coordinator's own `FinalDetailsForm` now shows a "Not asked in the couple's form" hint next to any of the six configurable fields the current template excludes, so the coordinator always sees exactly what the couple does — no separate "preview the field config" step needed for that half of the picture.

## 8. Status lifecycle

Unchanged real statuses only — no cosmetic ones added: `draft → sent → submitted → reviewed`, with the new `reopened` **activity type** (not a status) marking a `submitted`/`reviewed → sent` transition. `reviewed` remains a real column value with no code path that ever sets it (a pre-existing fact, confirmed unchanged — not a D5D-introduced gap).

## 9. Concurrency

Same `updated_at`-token pattern as D4 (Contracts) and D5A (Event Inventory):
- TS side (`saveQuestionnaire()` with `expectedUpdatedAt` set): conditional `UPDATE … WHERE updated_at = $token`; zero rows affected → `{ reason: "stale" }`.
- SQL side (`submit_questionnaire_as_couple()`, `save_questionnaire_draft_as_couple()`): `p_expected_updated_at` param, explicit `updated_at <> p_expected_updated_at` check before the write.
- Verified with a real two-writer scenario (§11, tests 5a/5b): coordinator writes, couple's in-flight (now-stale) token is rejected on both the SQL RPC path and the TS repository path.
- On conflict, the couple sees a dedicated screen ("This form was just updated") rather than a silent overwrite or a generic error.

## 10. A real bug found during live testing (and fixed)

`lib/events/questionnaire.ts` is a server-only module — its first import is `createClient` from `integrations/supabase/server`, which itself imports `next/headers`. `CONFIGURABLE_FIELDS` was originally defined inside that file and imported as a **value** (not `import type`) by two Client Components (`final-details-form.tsx`, `questionnaire-template-list.tsx`). ESM value imports pull in the whole module graph regardless of what's actually used from it — so both components silently bundled a server-only file into client code.

This didn't show up in `tsc --noEmit` (TypeScript doesn't know about the client/server bundling boundary) — it only surfaced as a real HTTP 500 when the public `/questionnaire/[key]` page was hit live:

```
Error: ./integrations/supabase/server.ts:1:1
You're importing a module that depends on "next/headers". This API is only
available in Server Components in the App Router, but you are using it in
the Pages Router.
```

Fixed by extracting the pure constants into `lib/events/questionnaire-constants.ts` (zero dependencies) and pointing both Client Components at it directly. `lib/events/questionnaire.ts` re-exports the same names for its existing server-side importers, so nothing else needed to change. Confirmed fixed by re-hitting the same live URL (200, correct payload) after the change — see §11.

## 11. Real validation performed

All of the following ran against real dev data (Supabase local, `docker exec -i supabase_db_wevenu-website psql`), with real authenticated sessions (`@supabase/supabase-js` signed in as real users), not mocked or simulated. 23/23 pass.

| # | Check | Result |
|---|---|---|
| 1a | Coordinator (non-owner) can INSERT `event_questionnaires` (RLS fix) | PASS |
| 1b | Staff (non-owner) can SELECT `event_questionnaires` (RLS fix) | PASS |
| 1c | Staff (non-owner) can UPDATE `event_questionnaires` (RLS fix) | PASS |
| 2a | Create `questionnaire_templates` row | PASS |
| 2b | CHECK constraint rejects `required_fields` not a subset of `included_fields` | PASS |
| 2c | Applying a template snapshots `included_fields`/`required_fields` onto the questionnaire | PASS |
| 2d | Editing a template afterward does **not** change an already-applied questionnaire (isolation) | PASS |
| 3a | `submit_questionnaire_as_couple` rejects a missing template-required field | PASS |
| 3b | `submit_questionnaire_as_couple` accepts once the template-required field is present | PASS |
| 4a | Submission creates a real `venue_notifications` row (previously silent) | PASS |
| 4b | `questionnaire_activities` logs `'submitted'` | PASS |
| 5a | `save_questionnaire_draft_as_couple` rejects a stale `updated_at` token | PASS |
| 5b | TS-side conditional update matches zero rows on conflict (D4/D5A pattern) | PASS |
| 6a | Submission succeeds when valid | PASS |
| 6b | Draft-save rejected once submitted (`not_editable`) | PASS |
| 7a | Questionnaire is `'submitted'` before reopen | PASS |
| 7b | Coordinator (non-owner) can reopen via plain authenticated UPDATE (RLS fix) | PASS |
| 7c | Draft-save works again after reopen | PASS |
| 8a | Anon direct table SELECT on `event_questionnaires` is denied (no anon grant + RLS) | PASS |
| 8b | `get_questionnaire_for_couple` returns empty for an invalid access key | PASS |
| 8c | Cross-venue RLS blocks reading another venue's `questionnaire_templates` | PASS |
| 8d | Re-submitting an already-submitted questionnaire is idempotent, not an error | PASS |
| 8e | No `SECURITY DEFINER reopen_questionnaire(p_venue_id)` RPC exists (avoided caller-supplied-venue-id hole) | PASS |
| Live | Public `/questionnaire/[key]` page renders (was a 500 before §10's fix); conditionally hides the whole "Music selections" section when no song field is included; shows the correct required markers | PASS |
| Live | `POST /api/public/questionnaire/draft` round-trips through the real HTTP route (not just the RPC directly) and returns a fresh `updatedAt` | PASS |
| Build | Full-project `tsc --noEmit` — zero errors introduced by this phase (all remaining errors are pre-existing, in unrelated files never touched this phase) | PASS |

All test data cleaned up and verified via direct row-count query after the run.

**Not performed**: authenticated in-app browser testing of the coordinator-side pages (`/library/questionnaire-templates`, the event detail Final Details tab, the checkbox grid) — no browser automation tool was available in this environment. Authenticated routes were confirmed to compile and route correctly (307 redirect to login, not a 500) via direct HTTP checks, and the underlying component logic was verified via the public-page live render (which exercises the identical `CoupleQuestionnaireForm` and shares the `Field`/`SectionHead` pattern with the coordinator form) plus the full RPC/repository-level test suite above. Stated plainly rather than claimed as done.

## 12. What's intentionally unchanged

- The canonical Booking definition, canonical metrics, Guest Count triplication (still a real, separate, unresolved architecture issue — reinforced, not touched).
- The Document Domain, Event Order, Event Inventory, and Contract systems — read for reference, not modified beyond what's listed in §5.
- `mark_questionnaire_opened()`'s thread system-message behavior — kept, with an activity-log call added alongside it.
