# Step 2 — Browser Acceptance

**Server:** isolated candidate `http://127.0.0.1:3019` (worktree Next.js)  
**Auth:** existing Sandbox staff session via magic-link OTP (Jen’s Fancy Venue) — **no credential rotation**, **no DB writes** beyond auth token mint used by prior Phase scripts  
**Viewports:** desktop 1440×900 · mobile 390×844  
**Theme:** light  
**Artifacts:** `evidence/*.png` (32) · `browser-results.json` · `capture-acceptance.mts`

## Findings summary

| Surface | Desktop | Mobile | Notes |
|---|---|---|---|
| Library calm guidance | PASS `#EAF1F7` / dark text `#24332B` | PASS | |
| Inbox no-selection calm | PASS | PASS (element present; md+ layout) | |
| Communication Health calm | PASS | PASS | |
| Automations help calm | PASS `#EAF1F7` | PASS | Route `/communication/series` (not `/communication/automations`) |
| Setup Hub Phase 9 eucalyptus bands | PASS `#DCE8E0` “All set” | PASS | |
| Setup Hub Phase 4 welcome | N/A on this venue | N/A | Gate: `onboardingType === "white_glove"` — Jen’s Fancy Venue is not white-glove; class wired in source + Phase 4 tests |
| Settings icon wells | PASS | PASS | |
| Availability / Migration / Import calm | PASS | PASS | |
| Venue Guide orientation | PASS | PASS | |
| Contract template disclaimer | PASS | PASS | |
| Contracts hospitality intro/toolbar/table | PASS eucalyptus intro + white chrome | PASS | No accent / filter |
| Payments same | PASS | PASS | |
| Reporting Phase 10 absence | PASS (0 markers) | PASS | Baseline Reports chrome only |
| Documents Phase 10 absence | PASS | PASS | |
| Library Documents Phase 10 absence | PASS | PASS | |
| Horizontal overflow | none observed | none | |
| Colored body text issues | none observed | none | Dark readable text on calm/eucalyptus |

## Screenshot inventory

Under `evidence/`:

- `library-{desktop,mobile}.png`
- `messaging-inbox-{desktop,mobile}.png`
- `messaging-health-{desktop,mobile}.png`
- `automations-{desktop,mobile}.png`
- `setup-hub-{desktop,mobile}.png`
- `settings-{desktop,mobile}.png`
- `settings-availability-{desktop,mobile}.png`
- `settings-migration-{desktop,mobile}.png`
- `settings-import-{desktop,mobile}.png`
- `guide-{desktop,mobile}.png`
- `contracts-templates-{desktop,mobile}.png`
- `contracts-{desktop,mobile}.png`
- `payments-{desktop,mobile}.png`
- `reporting-absence-{desktop,mobile}.png`
- `documents-absence-{desktop,mobile}.png`
- `library-documents-absence-{desktop,mobile}.png`

## Notes

1. Initial automations capture used a wrong path (404); corrected to `/communication/series` and recaptured.
2. Contract builder agreement guidance and Task Center plate-clear are covered by Phase 4/5 unit tests; deep-link browser shots deferred (list/setup routes prioritized for visual smoke).
3. Payment schedule review banner remains unstyled by calm classes (Phase 4 exclusion) — verified by unit tests; not recolored in this candidate.
