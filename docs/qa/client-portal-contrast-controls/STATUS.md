# Client portal — global contrast and dropdown discoverability

**Status: GREEN**

## Forensic root causes

| Surface | Root cause |
|---|---|
| Questionnaire | Hardcoded `text-gray-*` / `border-gray-*` / `bg-gray-*` ignored theme tokens |
| Portal native `<select>`s (Support Access duration, invite role/access, guests, seating, timeline, website) | No chevron / `appearance` reset — looked like empty text boxes |
| Documents Event insurance / Share with venue / Upload | `text-gray-500` labels; unstyled checkboxes; outline button without token ink |

## Shared components changed

- `app/globals.css` — `.htc-native-select`
- `lib/ui/native-select.ts` — `HTC_NATIVE_SELECT_CLASS`
- `components/form/couple-family-questionnaire-form.tsx`
- `components/portal/couple-documents-section.tsx`
- Portal selects: `portal-shell`, `guest-section`, `seating-section`, `timeline-section`, `website-editor`
- Vendor switcher uses same class (discoverability only)

## Automated tests / build

- `lib/portal/client-portal-contrast.test.ts` — PASS
- `lib/ui/native-select.test.ts` — PASS
- `lib/theme/public-form-surface.test.ts` — PASS
- `npm run build` — PASS

## Commit / deploy / runtime

| Item | Value |
|---|---|
| Commit | `f276f919886b6ebb744b769138deb7cf94669009` |
| Workflow | https://github.com/jlcormier612/wevenu-website/actions/runs/38023347932 — success |
| Live `dpl` | `f276f919886b6ebb744b769138deb7cf94669009` |
| Health | `{"ok":true,"checks":{"env":"ok","supabase":"ok"}}` |
| Production / marketing | **Not deployed** |

## Browser acceptance (Sandbox, dark colorScheme + `.dark` class)

Evidence: `browser-results.json`, `documents-390-dark.png`, `documents-320-dark.png`, `documents-desktop-dark.png`, `support-access-390-dark.png`, `support-access-desktop-dark.png`, `invite-role-390-dark.png`, `questionnaire-390-dark.png`

| Check | Result |
|---|---|
| Runtime SHA | PASS (`f276f919`) |
| Documents labels (Event insurance / Share with venue) | PASS — readable, not Tailwind gray-500 |
| Upload document discoverable | PASS |
| Invite role chevron before focus (`htc-native-select`) | PASS |
| Support Access duration visible + chevron | PASS |
| Questionnaire surface no gray-500/700 | PASS (empty state when none waiting; no hardcoded gray) |
| Fixture cleanup | PASS |

## Contrast method

Unit: `inkOn` / `contrastRatio` ≥ 4.5:1 on brand primaries. Live: computed-style probes reject `rgb(107,114,128)` / `rgb(55,65,81)` / `rgb(156,163,175)`; require `htc-native-select` + CSS `background-image` chevron.

## Deferred / note

Portal chrome remains light-surfaced even when `colorScheme: dark` is requested (branded couple workspace). Fixes use semantic tokens so both light and dark contexts stay readable. Questionnaire empty state proven when no form is waiting; form token swap is covered by unit source assertions + build.
