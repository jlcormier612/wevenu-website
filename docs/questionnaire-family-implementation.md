# Questionnaire Family Implementation

Hello to Cheers — finished product for the three customer-facing planning forms.

**Status:** Implemented against the existing D5D questionnaire architecture (no generic form-builder).

## Questionnaire Family

| Customer-facing name | Kind | Timing | Purpose |
|---|---|---|---|
| Client Planning Questionnaire | `client_planning` | After booking | Begin the planning relationship |
| Final Details | `final_details` | Closer to the event | Confirm / collect execution details (~20 questions) |
| Post-Event Feedback | `post_event_feedback` | After the event | Relationship feedback + optional public review |

There is **no** generic Starter Library item named simply “Questionnaire.”
There is **no** Pre-Booking Questionnaire starter — Inquiry remains the pre-booking path.

## Customer Journey

```
Before booking → Inquiry
After booking  → Client Planning Questionnaire
Closer to event → Final Details
After event    → Post-Event Feedback
```

## Approved Content

Canonical wording lives in:

`lib/questionnaire-family/definitions.ts`

Welcome copy and question labels match the product brief exactly (including Final Details Q12 guest-care wording and the Post-Event Feedback rating scale).

Do not rewrite customer-facing copy in UI components — read from the masters.

## Source-of-Truth / Field Matrix

Principle: **Use what we know. Ask only for what we don't know, what has changed, or what the customer needs to confirm.**

Narrative answers that are not owned by another domain persist in `event_questionnaires.additional.family`.

| Question / field | Existing source? | Source | Confirm only? | Editable? | Destination | New capability? |
|---|---|---|---|---|---|---|
| Event date (display) | Yes | `events.event_date` | Display | Via existing event edit if supported | Display only | No |
| Venue / package | Yes | Booking | Don't ask | No | — | No |
| Guest count | Yes | `events.guest_count` | Yes when present | Yes → authoritative | `events.guest_count` + `final_guest_count` | Confirm UI |
| Ceremony / reception timing | Partial | Questionnaire columns / Timeline / Event Order | Yes | Timing notes + column updates | Columns + family notes | Confirm UI |
| Ceremony notes (early) | Context | Ceremony presence on event | No | Narrative | `additional.family` | No |
| People / day-of / emergency | Partial | Client + contacts | Pre-fill when known | Yes | Columns + family; venue links to contacts | No parallel people DB |
| Vendors on file | Yes | `event_vendor_assignments` | Review | Notes for gaps | Display list + `additional.family` / `vendor_notes` | Vendor review UI |
| Dietary / meals | Operational | Questionnaire `meal_notes` | No | Yes | Column (feeds day-sheet) | No catering system |
| Songs / special moments | Operational | Questionnaire song columns + family | No | Yes | Columns + family | No music platform |
| Payments | Yes | Payment Plan / Invoices | Don't ask | No | — | No |
| Public review link | Venue config | `venues.public_review_url` | N/A | Venue settings | Shown only if Yes + URL set | Settings field |
| Feedback ratings / recommend | No | — | N/A | Yes | `additional.family` | Feedback kind |

### Intentionally not duplicated

- Second guest count, second event date, second vendor DB, payment collection inside questionnaires.
- Generic survey builder / nested schema engine / new relationship system.

## Conditional Logic

Supported in the couple form (`CoupleFamilyQuestionnaireForm`):

- Choice → follow-up (vendors selected, food & beverage, other coordinator, public review).
- Guest count confirm → update input when “No” or when no count exists.
- Timing / ceremony confirm → optional change notes + limited column edits.
- Vendor review → shows Vendor Network assignments for the event.

## Template Model

- Masters are **code fixtures** (`QUESTIONNAIRE_FAMILY_MASTERS`), never editable DB rows.
- Venue Library rows are independent copies with `source_master_key` (`QST-CP` / `QST-FD` / `QST-PE`) and `kind`.
- Provisioning: `lib/questionnaire-family/provision.ts`
  - On new venue create (`seedQuestionnaireFamily`)
  - On Library visit (`ensureQuestionnaireFamilyForCurrentVenue`)
  - “Add starter again” never overwrites a customized copy
- Existing same-named templates are preserved (not silently converted).

## Working Item Model

- Table: `event_questionnaires`
- Unique: `(event_id, kind)` — up to three working forms per celebration
- Snapshot on apply/send: `included_fields`, `required_fields`, `kind`, optional `template_id`
- Editing a Library template does not change in-flight / completed working forms
- Editing a working form does not change the template
- Duplicate template creates independent content (`source_master_key` cleared)

## Couple Experience

- Route: `/questionnaire/[key]`
- Portal: multi-form switcher (`components/portal/questionnaire-section.tsx`)
- Behaviors preserved from D5D: autosave, partial progress, reopen, optimistic concurrency (`expectedUpdatedAt`), RLS via SECURITY DEFINER RPCs, venue notification on submit
- Family RPCs:
  - `save_questionnaire_family_draft_as_couple`
  - `submit_questionnaire_family_as_couple`
  - Enriched `get_questionnaire_for_couple` / `get_questionnaire_for_portal`

## Venue Experience

- Booking workspace → Planning forms panel (`QuestionnaireFamilyPanel`)
- Per form: apply Library template, send/resend, preview as client, reopen, read answers
- Final Details retains coordinator draft/submit for operational columns
- Answers render from columns + `additional.family` with human labels
- Library: `/library/questionnaire-templates` (titled **Planning Forms**)

## Permissions

Uses existing venue RLS / role model. Couple access remains token/`access_key` SECURITY DEFINER — no permission weakening.

## Notifications

On family submit, venue notification type `questionnaire_submitted` with kind-specific title (Client Planning / Final Details / Post-Event Feedback). Existing activity log rows retained.

## Migration Notes

`supabase/migrations/20261269000000_questionnaire_family.sql`

- `venues.public_review_url`
- `questionnaire_templates.kind`, `source_master_key`
- `event_questionnaires.kind`; unique `(event_id, kind)` (legacy one-per-event dropped)
- Existing working rows → `final_details` (no data destruction)
- Relaxes six-field-only template inclusion check

### Existing questionnaire migration policy

- Do **not** overwrite venue-customized templates.
- Do **not** silently convert a customized form into a starter.
- Legacy Final Details column data remains authoritative for operational fields.
- Legacy couple RPC submit path kept for back-compat; family path is the product for the three kinds.

## Validation Matrix

| Area | Check | Result (local) |
|---|---|---|
| Schema | `kind`, unique `(event_id,kind)`, family RPCs, `public_review_url` | Applied on local `supabase_db_wevenu-website` |
| Masters | Exact welcome + question copy in definitions | Present |
| Template isolation | Master code → venue rows; edit template ≠ edit working | By design + provision skip-if-exists |
| Working isolation | One row per kind; upsert `onConflict: event_id,kind` | Implemented |
| Couple UX | Family form + autosave + conditionals | Implemented |
| Portal | Multiple forms listed by customer name | Implemented |
| Guest count SoT | Submit can update `events.guest_count` | In family submit RPC |
| Vendors | Review list from `event_vendor_assignments` | Public page enrichment |
| Review link | Settings field; no hardcoded destination | Implemented |
| Concurrency | Stale `updated_at` rejected | Family draft/submit RPCs |
| Regression | Legacy Final Details / day-sheet columns still map | Preserved |

### Gaps that are intentional (not deferred product)

- Vendor “selected” answers that identify a new vendor still go through the existing Vendor Network workflow for the venue to link — no questionnaire-only vendor database.
- Timeline structural edits remain in Timeline / Event Order; questionnaire collects confirmation + change notes.
- Contact relationship creation from free text is venue follow-up, not a new CRM write path invented here.
- No Pre-Booking Questionnaire starter (Inquiry owns that).
- Stopped after Questionnaire Family (no Contract / BEO / Inventory / Timeline starters in this package).

## Key Files

| Path | Role |
|---|---|
| `lib/questionnaire-family/definitions.ts` | Approved masters + field registry |
| `lib/questionnaire-family/provision.ts` | Seed / ensure / add-again |
| `lib/questionnaire-templates/service.ts` | Library CRUD + apply-by-kind |
| `lib/events/questionnaire.ts` | Multi-kind working-item domain |
| `components/form/couple-family-questionnaire-form.tsx` | Couple UI |
| `components/events/questionnaire-family-panel.tsx` | Venue UI |
| `components/portal/questionnaire-section.tsx` | Portal multi-form |
| `supabase/migrations/20261269000000_questionnaire_family.sql` | Schema + RPCs |
| `docs/questionnaire-family-implementation.md` | This document |

## Product Standard Check

Couples should feel: *“They already know so much about our event.”*  
Venues should feel: *“Answers help run the event — they don’t sit in a silo.”*

Use what we know. Ask only what we need. Put answers where they belong.
