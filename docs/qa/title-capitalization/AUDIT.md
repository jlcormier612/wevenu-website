# Title capitalization audit (Title Case for UI titles)

**Convention (evidence):** Setup Hub stage titles already use Title Case (`Your People`, `Bring Your Business`, `Calendar & Availability`). Marketing/help already use `Online Payments`. Apply Title Case to comparable headings, buttons, and view controls. **Do not** change sentence-case body/helper copy.

## Corrections

| Current | Corrected | Location | Scope |
|---|---|---|---|
| `Online payments` | `Online Payments` | `components/setup-hub/setup-hub-overview.tsx` (stage card title) | Local UI title |
| `Online payments` | `Online Payments` | `lib/setup-hub/help-crosswalk.ts` (`title`) | Shared stage title source |
| `Add document` | `Add Document` | `components/library/library-documents-manager.tsx` (button) | Shared library CTA |
| `Board view` | `Board View` | `app/(app)/leads/page.tsx` (button) | Local view control |
| `List view` | `List View` | `app/(app)/leads/pipeline/page.tsx` (pair of Board View) | Local view control |

## Explicitly not changed (sentence / body / errors)

- `Online payments aren't configured.` / similar Stripe/checkout messages
- Stripe connect helper paragraph
- Operational readiness / setup-concierge / Luv portal-context sentences
- Help article prose (already Title Case where titled)
- Generic sentence helpers (`Add a phone number…`, etc.)

## Tests to update

- `lib/documents/library-documents-surface.test.ts` — `/Add Document/`
- `lib/library/templates-landing.test.ts` — `/Add Document/`
