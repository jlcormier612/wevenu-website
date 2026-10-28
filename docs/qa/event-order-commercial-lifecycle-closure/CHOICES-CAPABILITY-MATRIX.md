# Event Order Choices — capability matrix

| Behavior | Supported? | Evidence | Notes |
|----------|------------|----------|-------|
| Single-select radio | Yes | Prior depth 19/19; tip matrix parent radios | Wedding Reception + Ceremony+Reception Dinner service |
| Multi-select checkbox | Yes | Fresh matrix 22/22 `choices-matrix-results.json` on `38b2d591` | Ceremony enhancements / Optional rentals |
| Required vs optional | Yes | Live “Pick one · required” / “Pick many · optional”; unit validate-answers | |
| Conditional dependsOnOptionIds | Yes | Live plated→child, buffet switch; unit conditional-groups | Ceremony+Reception template |
| Change before submit | Yes | Multi uncheck/recheck; radio change in depth | |
| Draft save without submit | Yes | matrix `draft_save_persists_without_submit` | status `in_progress`/`sent` |
| Submit + persist optionIds | Yes | matrix + depth | UI only — not seeded |
| Refresh / return | Yes | matrix + depth | |
| No duplicate packets | Yes | matrix + depth | |
| Venue summary (human labels) | Yes | `choices-submission-summary` | |
| EO share/accept untouched | Yes | matrix + depth | |
| Min/max hard rejects live | Yes (code + units; live edge harness post-deploy) | Units: at least N / at most N; portal alert + rules copy | `verify-choices-edge.mts` |
| Venue option change during unsent draft | Yes (re-freeze on drift + prune) | Units hydration drift; live edge harness post-deploy | Resend/list hydrates; couple sees review message |

**Product decision (stale draft):** When the linked Event Order Template’s selectable structure drifts (option/group ids or min/max/mode), venue list/get/send re-freezes the packet and prunes invalid draft answers. Couples are prompted to review before submit; unknown option ids cannot be submitted.
