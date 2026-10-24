# Event Order selection request vs Event Order share

## Status

**GREEN for selection-email isolation** on serving `4ef14218`  
(`digest sha256:f3ba33aadb64461398c690cda13085b5a7456db80641ebf6f5da8f25b29c8902`).

**NOT GREEN for full workflow-correction harness** — **59/61** on the same image.

## Isolation (closed)

`verify-selection-email-isolation.mts` → **GREEN 10/10** against `4ef14218`.

Sending **Send selection request** emails a secure Choices link. It does **not** share, finalize, or accept the Event Order. Booking timestamps unchanged.

## Full journey outstanding (2 failures)

`verify-browser.mts` on `4ef14218`:

| Check | Result | Note |
| --- | --- | --- |
| `preview-dialog` | FAIL | Staff preview did not show `#artifact-review-title` + `choices-definition-view` together |
| `selection-form-shows-offering-context` | FAIL | Couple Choices shows “Your Choices” but missing Included/Pick/fieldset offering context |

All other full-journey checks passed (send isolation, invoice reconcile, portal payable, documents EO, booking unchanged, session restore).

**Next action:** Fix staff EO send-preview overlay surface and couple Choices offering-context presentation (or align harness selectors to the shipped UI), then re-run `verify-browser.mts` with `EXPECTED_SHA=<serving>`.

## Build / deploy (this closure)

| Item | Value |
| --- | --- |
| PricingModel TSC fix | `e4b4849f` |
| docs exclude + handoff | `c4530c3a` → `4ef14218` |
| Deploy | https://github.com/jlcormier612/wevenu-website/actions/runs/40065359281 **success** |
| Production | untouched |

## Evidence

- `isolation-browser-run.log`, `selection-email-isolation-results.json`
- `browser-run.log`, `browser-results.json` (59/61)
