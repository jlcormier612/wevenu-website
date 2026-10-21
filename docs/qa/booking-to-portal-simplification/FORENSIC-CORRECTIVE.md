# Forensic audit — booking-to-portal corrective (2026-10-21)

## Preflight

| Item | Value |
|------|-------|
| Branch | `feat/spaces-booking-e1-smart-fields` |
| HEAD | `76cca695` (evidence commit; product code at `db43eff7`) |
| Sandbox serving | `db43eff778a69b5cf4cad06b9f41c65a7f885c8f` (confirmed via `dpl=` font preload) |
| Latest deploy | https://github.com/jlcormier612/wevenu-website/actions/runs/39641996104 success |
| Dirty paths | ~897 preserved |

## Why prior GREEN was insufficient

The acceptance harness verified **persisted drafts after booking** and that **Start draft CTAs were absent when drafts already existed**. It did **not** prove:

1. Event Setup never exposes separate Inventory / Event Order preparation actions when drafts are missing (recovery still used `Prepare "…" inventory draft` / `Prepare "…" Event Order draft` nextActions wired to `startProfileDraft`).
2. Inventory / Event Order **section panels** are editors only — empty states still present full “Start Event Inventory / Start Event Order” wizards with profile-suggested templates.
3. Event Setup does not embed per-component apply wizards (`BookingSetupCard`, `TimelineSetupCard`) as a second setup path.
4. Vendors tab does not present a second recommendation system (`EventVendorRecommendationsSection`) alongside Vendor Network classifications.
5. Questionnaire UX is scheduling-oriented — current model remains prepare-draft + manual Send; no delivery-timing configuration in Setup Profiles.
6. “Prepare and release portal” is the **only** recovery path for missing included drafts — prior UI still offered component-level prepare buttons.

## Root causes (code)

| Symptom | Cause |
|---------|--------|
| Separate Prepare Inv/EO buttons | `readiness-detail.ts` nextActions literally named `Prepare "…" inventory/Event Order draft`; panel routes those to `startProfileDraft` / `ensure*Action` |
| Start draft still in SetupTool | `event-setup-panel.tsx` SetupTool returns Start inventory/EO buttons when `!hasEventInventory` / `!hasEventOrder` |
| Section-level start wizards | `event-inventory-panel.tsx` `StartInventory`; `event-order-panel.tsx` empty start UX |
| Vendor duplication | `event-detail.tsx` still mounts `EventVendorRecommendationsSection`; inherit still copies `recommendedVendorIds` |
| Questionnaire feels manual | Profile + family panel are draft/apply/send; no schedule fields in `SetupTemplateRefs` |
| Harness false confidence | Asserted `event_setup_no_start_draft_ctas` only after successful book-time ensure; never opened Inv/EO tabs; never forced missing-draft recovery UI |

## What already works (keep)

- Book-time `ensureEventInventory` / `ensureEventOrder` when Included + template ref (`inherit.ts`)
- Venue checklist event-type fallback
- `prepareAndReleasePortal` ensures drafts, releases client planning, shares timeline, does not invite/send questionnaires/invoice
- Profile Vendor Network copy (no second recommendation picker on Setup Profiles)

## Required corrective direction

1. Remove component-level Prepare/Start draft CTAs from Event Setup normal path; missing included drafts → outstanding → **Prepare and release portal** only.
2. Treat Inventory / Event Order tabs as editors when a draft exists; when empty with a profile template, do not present a parallel setup wizard as the Event Setup path (recover via prepare/release).
3. Stop promoting event-level vendor recommendation curation as a setup requirement; surface Vendor Network classifications.
4. Questionnaires: keep separate from portal release; frame as configured for scheduled/authorized send (honest about current send model until a schedule engine exists).
5. Replace harness assertions that greenwashed the above.
