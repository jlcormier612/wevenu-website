# Date hold expansion layout

**Status: IN PROGRESS — final alignment + control heights**

| Field | Value |
|-------|--------|
| Prior fix (form below row) | `4be903b9` |
| Prior serving | `9a3ea2793187521381256a682b67794a1f3247fd` |
| Prior deploy | [38506338564](https://github.com/jlcormier612/wevenu-website/actions/runs/38506338564) **success** |
| This follow-up | form full-width left alignment + collapsed control heights → platform `h-8` |
| Target | Sandbox only |

## Prior state (serving `9a3ea279`) — incomplete

Form sat below the control row (`contents` + `basis-full`) but `max-w-xl` capped width (~612px on ~896px row), leaving a large empty band and a right-stranded look.

Collapsed Sales owner select / Edit·Save / Place hold used `h-11` (~46.8px). Platform references on the same lead page:

| Control | Height |
|---------|--------|
| Schedule Tour (`schedule-tour-action`) | **34px** (`size="sm"` + `h-8`) |
| Tour appointment Edit | **34px** |
| Tour follow-up Edit | **34px** |
| Place Hold (before fix) | **46.8px** (`h-11`) |
| Edit/Save (before fix) | **46.8px** (`h-11`) |

Baseline: `control-height-baseline.json`

## Root cause (this follow-up)

1. **Form offset/width:** compact form class still used `max-w-xl` after the row-break fix.
2. **Oversized controls:** compact StaffAssignmentField + Place hold explicitly forced `h-11` instead of the lead-page compact convention (`h-8` / ~34px).

## Fix (this follow-up)

- Form: `min-w-0 w-full max-w-full basis-full` (drop `max-w-xl`).
- Compact select / save / Place hold / active-hold chip: `h-11` → `h-8`.

## Evidence

- Prior: `collapsed-*.png`, `expanded-*.png`, `browser-results.json`
- Follow-up (post-deploy): `followup-align-heights-*`
