# Event Order apply footer

**Status:** OPEN — runtime identity confirmed, sheet not exercised in the browser.

- Deploy [38934152259](https://github.com/jlcormier612/wevenu-website/actions/runs/38934152259) **success**
- Serving image `htc-sandbox-venue-app:bc6e8fb36ac90c8e69de56ac894aab6ffd045c25`
- Task definition `htc-sandbox-venue-app:777`
- Health HTTP 200. The health response did not include a `dpl` link header.

Browser: a disposable Fancy lead reached the pre-booking client workspace. The Event Order template control stayed `aria-expanded=false` after click and ArrowDown, so the apply sheet was not opened. Cancel / scroll / footer position were not measured. No Apply was clicked. Disposable leads were deleted by the harness.

Preview-copy test: `lib/event-order-templates/offerings.test.ts` still expects `not itself a client commitment`. Commit `a0c566c2` changed the preview to “the template is not a commitment” and did not update that assertion. The assertion was left as-is.
