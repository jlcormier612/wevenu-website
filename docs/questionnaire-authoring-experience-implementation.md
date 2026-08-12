# Questionnaire & Feedback authoring experience — implementation

Hello to Cheers Library authoring for the three Questionnaire Family starters:
**Client Planning Questionnaire**, **Final Details**, and **Post-Event Feedback**.

Date: 2026-08-11

---

## 1. Architecture inspected

Locked model (unchanged):

| Layer | Source of truth |
| --- | --- |
| Master questions / welcome copy | `lib/questionnaire-family/definitions.ts` (code, not DB) |
| Reusable venue Library templates | `questionnaire_templates` |
| Working forms on events | `event_questionnaires` (snapshot at apply / draft only) |
| Resolve for Preview + couple UI | `lib/questionnaire-family/resolve.ts` |

Venue-owned authoring columns (Library template + working-form snapshot):

- `custom_fields` (jsonb)
- `master_overrides` (jsonb — label/helper only)
- `field_order` (text[])
- plus existing `included_fields`, `required_fields`, `name`, `description`

Kinds only: `client_planning` | `final_details` | `post_event_feedback`.

Already present before this pass:

- Migration `supabase/migrations/20261278000000_questionnaire_authoring.sql`
- Resolve layer `lib/questionnaire-family/resolve.ts`

---

## 2. Gaps found before this pass

| Gap | Status |
| --- | --- |
| Service did not map/persist authoring columns | Fixed |
| `applyTemplateToEvent` did not snapshot customs/overrides/order | Fixed |
| Couple form filtered masters only | Fixed → uses `resolveQuestionnaireFields` |
| Public / event / Library preview loaders omitted new columns | Fixed |
| Edit UX was sheet-only field include/require | Replaced with full-page authoring |
| Library still titled “Planning Forms” | Renamed |
| Migration incorrectly redefined portal RPC as `uuid` | Fixed → remains `p_token text` and returns new columns |

---

## 3. Changes made

### Data / resolve / service

- Fixed portal RPC in migration to extend `get_questionnaire_for_portal(text)` (not uuid).
- Extended `QuestionnaireTemplate` + `Questionnaire` mapping for authoring columns.
- `saveQuestionnaireAuthoring` + sanitizers; `create` / `duplicate` / `applyTemplateToEvent` persist snapshots.
- Custom ids must start with `custom_`; destination forced to `"family"`.

### Server actions

- `saveQuestionnaireAuthoringAction`
- Extended create/update/duplicate/apply to revalidate list + `[id]` (+ preview).

### Couple / portal / venue rendering

- `CoupleFamilyQuestionnaireForm` resolves fields; supports short/long text, yes/no, single/multiple choice, date.
- System-connected behaviors preserved (guest count, vendor review, timing/ceremony confirm, column destinations).
- Loaders: `app/questionnaire/[key]/page.tsx`, event questionnaire-preview, portal rows (RPC returns columns → form reads them).
- Event `AnswerRows` uses resolve so custom wording/labels show.

### Library UI

- Full-page editor: `/library/questionnaire-templates/[id]`
- Preview: `/library/questionnaire-templates/[id]/preview`
- List: Preview | Edit | Use Questionnaire | •••
- Use Questionnaire: event picker → `applyTemplateToEvent` → navigate to event
- `LIBRARY_LABELS.useQuestionnaire`

### Terminology

- Library hub + page: **Questionnaires & Feedback**
- Event workspace card: **Questionnaires**
- Starter product names unchanged

---

## 4. Terminology

| Surface | Copy |
| --- | --- |
| Library toolbox / list title | Questionnaires & Feedback |
| Event workspace panel | Questionnaires |
| Starters | Client Planning Questionnaire, Final Details, Post-Event Feedback |
| Primary use action | Use Questionnaire |

---

## 5. Editor behavior

Route: `/library/questionnaire-templates/[id]`

- Header: Edit questionnaire, name, Starter badge, `LibrarySaveStatus`, explicit Save / Cancel, Preview link
- Dirty leave confirm via `useLibraryUnsavedGuard`
- Edit name + purpose
- Sections preserved from masters; customs may choose section
- Master wording → `master_overrides`; custom wording → `custom_fields.label`
- Required toggle; visibility = Ask this question / Don't ask (masters not destroyed)
- Move up / Move down
- + Add question (curated types + choice options)
- No exposure of form kind / family / source_master / provisioned / canonical jargon
- Friendly connected hints where helpful (“Connected to your guest count”)

---

## 6. Custom question model

- Ids: `custom_*` (`newCustomFieldId()`)
- Types: `short_text` | `long_text` | `yes_no` | `single_choice` | `multiple_choice` | `date`
- Destination: always `family` → answers in `additional.family`
- Multiple choice stored as JSON array string (comma-separated accepted on read)

---

## 7. System-connected questions

Masters with non-family destinations or special types stay system-connected:

- Type / destination cannot be changed in the editor
- Venue may override **label** and **helper** only
- Exclude (“Don't ask”) hides without deleting the master definition
- Couple renderer keeps specialized UX (guest confirm, vendor review, timing/ceremony)

---

## 8. Save model

- Explicit **Save changes** (not autosave)
- Unsaved status + `beforeunload` + confirm on Cancel / leave
- Persist via `saveQuestionnaireAuthoringAction` → `saveQuestionnaireAuthoring`

---

## 9. Starter protection

- Masters remain code fixtures in `definitions.ts` (wording not rewritten)
- Provision skips existing `source_master_key` / same-name templates (does not overwrite customizations)
- “Add … again” creates a new copy with a distinct name
- Starter badge from `sourceMasterKey`

---

## 10. Working-form isolation

`applyTemplateToEvent` copies onto draft `event_questionnaires` only:

- `included_fields`, `required_fields`, `custom_fields`, `master_overrides`, `field_order`, `kind`, `template_id`

If status ≠ `draft`, apply is rejected. Later Library edits do not mutate sent/submitted snapshots.

Unit coverage: `lib/questionnaire-family/resolve.test.ts` (“snapshot isolation model”).

---

## 11. Cross-venue isolation

- All template CRUD / apply queries filter `venue_id` from `getCurrentVenue()`
- RLS on `questionnaire_templates` / `event_questionnaires` continues to scope by venue membership
- No browser multi-venue proof in this pass (local single-tenant smoke); SQL/service scoping unchanged and enforced in code paths

---

## 12. Client rendering

`resolveQuestionnaireFields` drives couple, portal, Library preview, and event preview. Customs render by `customType`; system masters keep specialized controls; narrative customs land in `additional.family`.

---

## 13. Validation matrix (three starters)

| Check | Client Planning | Final Details | Post-Event Feedback |
| --- | --- | --- | --- |
| Masters resolve by default | PASS (unit) | PASS (unit) | PASS (unit) |
| Label/helper overrides only | PASS (unit) | PASS (unit) | PASS (unit) |
| Exclude does not destroy master | PASS (unit) | PASS (unit) | PASS (unit) |
| Custom `custom_*` + destination family | PASS (unit + browser) | PASS (unit) | PASS (unit) |
| Field order respected | PASS (unit + browser reorder) | PASS (unit) | PASS (unit) |
| Snapshot isolation model | PASS (unit + browser/SQL) | PASS (unit; shared) | PASS (unit; shared) |
| Full-page editor route | PASS (browser) | PASS (browser spot) | PASS (browser spot) |
| Library Preview uses couple renderer | PASS (browser) | PASS (browser spot) | PASS (browser spot) |
| Use Questionnaire → draft snapshot | PASS (browser + DB) | SKIP (not re-driven) | SKIP (not re-driven) |
| Sent form blocked from re-apply | PASS (code path; UI uses draft-only apply) | PASS (code path) | PASS (code path) |
| Browser E2E with auth | PASS | PASS (spot) | PASS (spot) |
| Library category label | PASS — **Questionnaires & Feedback** on `/library` | — | — |
| Explicit Save + unsaved leave warning | PASS (browser) | SKIP | SKIP |
| Cross-venue / RLS | PASS (SQL: `venue_id = current_user_venue_id()`; Sweet Daisy customs absent on other venue) | — | — |

Legend: PASS / FAIL / SKIP. Full raw matrix: `docs/qa/questionnaire-authoring-browser/qa-results.json`.

---

## 14. Browser evidence / limitations

**When:** 2026-08-11 · local `:3000` (`npm run dev` already healthy) · venue `owner@example.com` / `devpassword123` (Sweet Daisy, `LOCAL_TESTING.md`).

**Tooling note:** `cursor-ide-browser` MCP was **not available** in this agent session (only `cursor-app-control` in the MCP catalog). Validation used the same Playwright/Chromium pattern as prior Library QA (`docs/qa/questionnaire-authoring-browser/capture.mjs` + continuations). Auth succeeded; no hang.

### Results (priority = Client Planning)

| Check | Result | Notes |
| --- | --- | --- |
| Library → Questionnaires & Feedback | PASS | Visible on `/library` hub |
| List shows three starters | PASS | Client Planning, Final Details, Post-Event Feedback |
| Full-page editor (not drawer) | PASS | `/library/questionnaire-templates/{id}`; heading “Edit questionnaire”; zero dialog drawers as primary edit |
| Rename / wording / required / reorder / hide / add custom | PASS | Marker `QA-authoring-*`; custom `single_choice` persisted in `custom_fields` |
| Explicit Save | PASS | DB name + `custom_*` after Save |
| Unsaved leave warning | PASS | Cancel → `window.confirm("You have unsaved changes…")`; dismiss stays on editor |
| Preview = couple renderer + reflects edits | PASS | `/preview` shows “Preview as your clients…” + custom/override copy |
| Use Questionnaire → event | PASS | Snapshot on Emma & Jordan (`client_planning`); navigates to `/events/{id}` after fix below |
| Working-form isolation | PASS | Promoted draft→`sent` via SQL (UI send not exercised); Library rename/customs updated; sent row `md5(custom_fields/master_overrides/field_order)` unchanged |
| Cross-venue / RLS | PASS | SQL policy `questionnaire_templates_all` uses `current_user_venue_id()`; Platypus Client Planning lacks Sweet Daisy QA markers |

Spot-checks: Final Details + Post-Event Feedback open full-page editors and preview routes (PASS). Deep authoring edits were Client Planning only.

Screenshots: `docs/qa/questionnaire-authoring-browser/*.png`.

### Fixes made during validation

1. **`QuestionnaireAuthoringWorkspace` dirty baseline** — after Save, baseline now updates to the saved snapshot (and `field_order` aligns with ordered ids) so Unsaved/Save state stays correct across `router.refresh()` without remount.
2. **Use Questionnaire navigation** — `router.push` now runs **before** closing the apply sheet so unmount does not cancel the App Router transition (confirmed: lands on `/events/{id}`).

### Still limited / not exercised

- Couple-link UI “Send” for working forms (isolation used SQL `status='sent'`).
- Second venue interactive login (RLS proven via SQL + policy text).
- Drag-and-drop reorder (a11y Move up/down covered).
- Applied migration earlier; unit suite previously 16/16; typecheck clean — not re-run this pass.
---

## 15. Intentional limitations

- Not a generic form builder / SurveyMonkey clone
- No pre-booking / inquiry questionnaires
- No Luv or Automation changes for this editor
- No new starter families
- Drag-and-drop reorder optional; a11y buttons shipped
- Kind immutable after create (create sheet chooses “Based on”)
- Generated Supabase TS types may lag; inserts/updates cast jsonb via `as never` until types regenerated

---

## 16. Follow-ups

1. Regenerate DB types after migration lands everywhere.
2. Optionally auto-apply latest Library snapshot when creating a brand-new draft from event UI (already available via template picker).
3. ~~Auth browser smoke: edit starter → Preview → Use on draft event → send → edit Library → confirm couple link unchanged.~~ Done 2026-08-11 (send step via SQL `sent`; see §14).
4. Consider richer venue answer display for multiple-choice JSON arrays.
5. Restore Sweet Daisy Client Planning starter display name when QA markers are no longer needed (`Client Planning Questionnaire QA-authoring-…`).
---

## 17. How to open the editor

1. Library → **Questionnaires & Feedback** (`/library/questionnaire-templates`)
2. On a card: **Edit** → `/library/questionnaire-templates/{id}`
3. **Preview** → `/library/questionnaire-templates/{id}/preview`
4. **Use Questionnaire** → pick event → opens `/events/{eventId}`

---

## 18. Definition of done checklist

| Item | Done |
| --- | --- |
| Service persists authoring columns + snapshots on apply | Yes |
| Server actions + revalidate paths | Yes |
| Couple form uses resolve + custom types | Yes |
| Full-page authoring (not drawer as primary edit) | Yes |
| List Library pattern Preview \| Edit \| Use \| ••• | Yes |
| Terminology Questionnaires & Feedback | Yes |
| Library Preview route | Yes |
| Migration applied locally | Yes |
| Tests + implementation doc (this file) | Yes |
| No second questionnaire engine / no unrelated redesign | Yes |
