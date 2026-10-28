# Event Order Choices — capability matrix (serving `38b2d591`)

| Behavior | Supported? | Evidence on tip | Notes |
|----------|------------|-----------------|-------|
| Single-select radio | Yes | Prior depth 19/19 on `5959df8c`; tip units + matrix parent radios | Wedding Reception + Ceremony+Reception Dinner service |
| Multi-select checkbox | Yes | **Fresh matrix 22/22** `choices-matrix-results.json` | Ceremony enhancements / Optional rentals |
| Required vs optional | Yes | Live “Pick one · required” / “Pick many · optional”; unit validate-answers | |
| Conditional dependsOnOptionIds | Yes | Live plated→child, buffet switch hides plated; unit 12/12 conditional-groups | Ceremony+Reception template |
| Change before submit | Yes | Multi uncheck/recheck; radio change in depth | |
| Draft save without submit | Yes | matrix `draft_save_persists_without_submit` | status `in_progress` |
| Submit + persist optionIds | Yes | matrix + depth | UI only — not seeded |
| Refresh / return | Yes | matrix + depth | |
| No duplicate packets | Yes | matrix + depth | |
| Venue summary (human labels) | Yes | `choices-submission-summary` shows Arbor SELECTED etc. | |
| EO share/accept untouched | Yes | matrix + depth | |
| Min/max hard rejects live | Partial | Unit validate-answers; live incomplete-submit not exhaustively forced | Remaining: explicit disabled-Submit reason UX check |
| Stale/unavailable options | Partial | Unit orphan answers rejected | Live venue-change-during-draft not re-run this tip |

**Verdict (Choices complete coverage):** GREEN for supported types exercised on `38b2d591` via Ceremony+Reception matrix + preserved single-select depth evidence; remaining gaps are non-blocking partials listed above (P3/verification depth), not unsupported product claims.
