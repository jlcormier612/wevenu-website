# Template / Library UI Consistency — STATUS

**Verdict: NOT GREEN** — Sandbox deploy in progress; browser verification pending on exact image `0ade8153`.

| Item | Value |
|---|---|
| Commit | `0ade8153b0728acc69447977e5ecfdaf27848d66` |
| Branch | `feat/luv-contextual-intelligence` |
| Deploy | https://github.com/jlcormier612/wevenu-website/actions/runs/36663296990 |
| Deploy status | in_progress (build matrix started) |
| Task definition | _(pending deploy)_ |
| Image tag | `0ade8153b0728acc69447977e5ecfdaf27848d66` (expected) |
| Digest | _(pending deploy)_ |
| Health | _(pending)_ |
| Production | untouched |

## Root causes (forensic)

| Issue | Cause |
|---|---|
| Calendar Add Schedule Item outline | Button lived in `CalendarView` toolbar as `variant="outline"`; Print lived near header — primary create looked secondary |
| Questionnaires missing ← Templates | Page never used `CollectionBackLink` (Contract / Timeline did) |
| Inventory two create buttons | PageHeader had outline “Add inventory item” **and** section had green “+ New Inventory Item” |
| Inventory / Offerings / Packages / Forms / QR / Brochures missing back link | Catalog pages under `/library` hub never wired `CollectionBackLink` |
| Public Forms / QR create on left | Create CTA lived inside list components below guidance, not in `PageHeader.actions` |
| Offerings header CTA wrong | Header showed “Available Inventory” outline instead of green create |
| “Add ___ again” starters | Legitimate **starter re-insert** (fresh venue-owned copy; never overwrites/custom Duplicate). Copy said “again”, overlapping Duplicate mentally |

## Starter semantics (preserved)

- **Duplicate** = copy **this** venue-owned template row.
- **Hello to Cheers starters** = insert a protected master as a new venue-owned row (`source_master_key` set; unique name if needed).
- Repeated insertion **is intentional** for Message / Questionnaire / Contract (toast: customizations left alone).
- UI now: missing → `Add {name}`; already present → `Add another copy of {name}` via `starterInsertLabel`.
- Planning already used hide-when-present + overflow `Add another copy` — unchanged.
- Timeline / EO “Restore starters” (missing-only) — unchanged.

## Shared pieces changed

- `CollectionBackLink` reused (no new giant abstraction)
- `PageHeader.actions` for primary CTAs
- `starterInsertLabel` in `components/library/labels.ts`
- Thin page clients where create state must live with the list: Calendar / Offerings / Public Forms / QR
- `headerCreate={false}` pattern extended to questionnaires, offerings, public forms, QR, brochures

## Pages corrected

- Calendar
- Questionnaires & Feedback
- Message Templates (starter labels + presentKeys)
- Contract Templates (starter label only)
- Available Inventory
- Offerings
- Packages
- Brochures
- Public Forms
- QR Campaigns

## Tests

- `lib/library/collection-header-consistency.test.ts` (new)
- Updated `lib/calendar/venue-schedule-catalog-2a22.test.ts`
- Existing IA / planning / public-forms suites green (50 pass in targeted batch)
- `tsc --noEmit` clean

## Browser verification

Pending sole RUNNING task on image `0ade8153` after deploy completes.
