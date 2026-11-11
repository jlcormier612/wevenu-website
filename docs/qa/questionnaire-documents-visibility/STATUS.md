# Questionnaire submission → client Documents visibility

## Status

**GREEN** on serving Sandbox `4ef14218` (digest `sha256:f3ba33aadb64461398c690cda13085b5a7456db80641ebf6f5da8f25b29c8902`).

Harness: `verify-browser.mts` → **14/14 PASS** (`EXPECTED_SHA=4ef14218c5379f6e443a5b68e8e83689f90c979a`).

## Root cause (closed)

| Question | Answer |
| --- | --- |
| Response persisted? | **Yes** — fixture `e055c612-…`, status `complete` |
| Client Documents card? | **Yes** — real title (Client Planning Questionnaire) + Review CTA |
| Open shows submitted Q&A? | **Yes** — `questionnaire-submitted-review` read-only with answers |
| Wrong form opened? | Fixed by Documents→Questionnaire `sessionStorage` handoff (`DOCS_QUESTIONNAIRE_HANDOFF_KEY`) so Review opens the selected questionnaire, not the first open form |
| Unauthorized token? | Denied — expired/inactive link |
| Reload reopen? | Pass |

## Commits

1. `b54fcf3b` — read-only submitted Q&A review; Documents lists by real title  
2. `c26af6a5` — `?view=documents` / `?view=questionnaire` deep links  
3. `4ef14218` — Documents card hands questionnaire id to Questionnaire section  

## Evidence

- `browser-results.json`, `browser-run.log`
- Shots: `shots/documents-1280.png`, `shots/submitted-review-1280.png`
- Deploy: https://github.com/jlcormier612/wevenu-website/actions/runs/40065359281
