# Client portal — global contrast and dropdown discoverability

**Status:** IN PROGRESS (code + unit tests; awaiting Sandbox deploy + browser)

## Forensic inventory

| Surface | Symptom | Root cause | Intended fix |
|---|---|---|---|
| Couple questionnaire | Labels/helpers illegible in dark theme | Hardcoded `text-gray-*`, `border-gray-*`, `bg-gray-*` ignore theme tokens | Semantic tokens (`text-foreground`, `text-muted-foreground`, `border-input`, `bg-background`, `bg-muted/40`) + `inkOn(primary)` on submit |
| Support Access duration + other portal `<select>`s | Look like empty text boxes until focused | Native selects had no chevron / `appearance` reset | Shared `.htc-native-select` + `HTC_NATIVE_SELECT_CLASS` on all portal native selects |
| Documents: Event insurance / Share with venue / Upload | Near-invisible labels; black checkbox squares | `text-gray-500` labels; unchecked checkbox styling without theme border/accent | `text-foreground` labels, bordered accent checkboxes, outline upload button with token ink |

## Shared components / paths changed

- `app/globals.css` — `.htc-native-select` chevron + disabled/focus
- `lib/ui/native-select.ts` — `HTC_NATIVE_SELECT_CLASS`
- `components/form/couple-family-questionnaire-form.tsx`
- `components/portal/couple-documents-section.tsx`
- Portal native selects: `portal-shell`, `guest-section`, `seating-section`, `timeline-section`, `website-editor`
- Vendor venue switcher also uses the same class (`vendor-venue-hero.tsx`) — shared discoverability, not a venue redesign

## Select inventory (search-based)

| Family | Files | Mechanism |
|---|---|---|
| Native `<select>` + `HTC_NATIVE_SELECT_CLASS` | portal-shell (todos, invite role/access, support duration), guest-section, seating-section, timeline day picker, website-editor | Shared CSS chevron |
| Radix / shadcn `SelectTrigger` | Already has `ChevronDown` | Unchanged |
| Vendor venue switcher | `vendor-venue-hero.tsx` | Same native class |

## Automated tests

- `lib/portal/client-portal-contrast.test.ts`
- `lib/ui/native-select.test.ts`
- Existing `lib/theme/public-form-surface.test.ts` (inkOn AA)

## Contrast method

Representative pairs via `contrastRatio` / `inkOn` in unit tests (WCAG 2.2 AA 4.5:1 for body text on brand primary submit). Live browser measurements recorded after Sandbox deploy.

## Deploy / browser

_Filled after Sandbox deploy._

## Production / marketing

Not deployed. Sandbox only.
