# Event Order selection request vs Event Order share

## Status

**GREEN** — full workflow-correction harness **61/61** on serving Sandbox.

Previously failing checks now pass:
- `preview-dialog`
- `selection-form-shows-offering-context`

## Serving (verified)

| Item | Value |
| --- | --- |
| Product commit (EO fix) | `5642f30c3fc4276ce65715c8a3f4782c8243acb2` |
| Serving image tag | `18b8964a7d46aa764b4657ec7dc31eb80b8fc342` (includes EO fix + later floor-plan confirm) |
| Image digest | `sha256:fe3b44cfe081689a972ed5ea331a559fbc2a535ee43ff5ae4274a0a1d973e774` |
| EO deploy | [40214423634](https://github.com/jlcormier612/wevenu-website/actions/runs/40214423634) **success** @ `5642f30c` |
| Later deploy (serving tip) | [40215221981](https://github.com/jlcormier612/wevenu-website/actions/runs/40215221981) **success** @ `18b8964a` |
| Harness | `EXPECTED_SHA=18b8964a… verify-browser.mts` → **GREEN 61/61** |
| Production | untouched |

## Isolation (still GREEN)

`verify-selection-email-isolation.mts` remains GREEN from the prior closure. Selection send does not share/finalize/accept the Event Order.

## Fix summary

Legacy `client_choices.definition` packets froze sections without `fixedLines`. Product now re-freezes incomplete EO-sourced packets on list/get/send; staff overlay keeps unique `choices-definition-view`; couple form shows frozen “Included with your event” context.

## Financial regression (this run)

Payable still reconciles to **$2,266.31** (billable $2,133 + tax $133.31). Booking unchanged. Portal sessions restored.

## Evidence

- `browser-run.log`, `browser-results.json` (61/61)
- `persisted-state.json`
- `shots/preview-1280.png`, `shots/selection-link-1280.png`, …
