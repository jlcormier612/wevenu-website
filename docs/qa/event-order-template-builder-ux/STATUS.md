# Event Order Template Builder UX — STATUS

**Verdict: OPEN** — implementation committed; awaiting Sandbox deploy + browser acceptance on serving tip.

## Root cause
Workspace labeled fixed lines as **“Included in …”** and framed couple choices as **“major choices from Offerings catalog,”** conflating package placement with pricing and catalog hierarchy with EO choice groups. The data model already supports the A/B/C workflow; labels and empty states hid it.

## Changes (no schema)
- Package items zone: “Items always on this package” + truthful price treatment
- Choices zone: “Choices couples make” + prominent primary-question CTA
- Catalog vs template-only clarified at point of action; redundant Inventory essays reduced
- Review / landing / detail intro aligned

## Next
Deploy tip SHA → `EXPECTED_SHA=<sha> npx tsx docs/qa/event-order-template-builder-ux/verify-browser.mts`

## Production
Untouched. Unrelated dirty work preserved.
