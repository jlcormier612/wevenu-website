# HTC Master Release Reconciliation Ledger

**OVERALL RELEASE:** NOT GREEN

**Ledger opened:** 2026-10-05  
**Branch:** `feat/spaces-booking-e1-smart-fields`  
**Repo HEAD:** `2431c217b5837fe3e0f6ee173c6261ff644c11c2`  
**Production:** untouched (no `htc-production` stack, no production deploy workflow)

This ledger does **not** treat “code exists,” “tests pass,” “GHA success,” or “ECS healthy” as GREEN. GREEN requires exact-runtime + browser + DB proof on the sole RUNNING Sandbox venue-app.

## Authoritative live runtime (verified 2026-10-05 after `9449b2fe`)

| Field | Value |
|---|---|
| RUNNING SHA / image tag | `9449b2fe9b98f1d2084f0b6a45ca56c4fa24ee7b` (contains `d2b03d22`) |
| Image | `405254329873.dkr.ecr.us-east-1.amazonaws.com/htc-sandbox-venue-app:9449b2fe9b98f1d2084f0b6a45ca56c4fa24ee7b` |
| RUNNING DIGEST | `sha256:a5b8e5e9fb9e8c8b3623429c3f4b0a87f704ada8e79bde02dd240e02d3ddd733` |
| TASK DEFINITION | `htc-sandbox-venue-app:577` |
| TASK ID | `f45e5bdbed164666b913b0a959717073` |
| desired/running/pending | 1/1/0 |
| PRIMARY | COMPLETED (sole deployment) |
| HEALTH | `https://app.sandbox.hellotocheers.com/api/health` HTTP 200 `{"ok":true,"checks":{"env":"ok","supabase":"ok"}}` |
| Deploy | https://github.com/jlcormier612/wevenu-website/actions/runs/37262045937 |
| Cluster | `htc-sandbox` only |

This image does **not** contain the TourOrigin CloudFormation wiring. `TOUR_ORIGIN_SIGNING_SECRET` is still absent. Workstream G remains BLOCKED until Phase 2.

## CloudFormation / secrets (live)

| Stack | Status |
|---|---|
| `htc-sandbox` | `UPDATE_ROLLBACK_COMPLETE` |
| `htc-sandbox-ecr` | `UPDATE_COMPLETE` |
| `htc-github-oidc` | `UPDATE_COMPLETE` |

- `htc/sandbox/tour-origin-signing-secret`: **does not exist**
- Task rev 576 secrets: **no** `TOUR_ORIGIN_SIGNING_SECRET`
- Rollback cause: `TourOriginSigningSecret` CREATE_FAILED — `htc-sandbox-cfn-execution` lacks `secretsmanager:GetRandomPassword` (required by `GenerateSecretString`)

## In-flight / recent Sandbox deploys

| Run | SHA | Conclusion |
|---|---|---|
| [37262045937](https://github.com/jlcormier612/wevenu-website/actions/runs/37262045937) | `9449b2fe` (`d2b03d22` + compile-only typecheck; **no** TourOrigin CFN) | IN FLIGHT |
| [37261254883](https://github.com/jlcormier612/wevenu-website/actions/runs/37261254883) | `d2b03d22` | **failure** — venue-app typecheck `reject: true` |
| [37260888063](https://github.com/jlcormier612/wevenu-website/actions/runs/37260888063) | `2431c217` | **cancelled** after CFN rollback |
| [37259626013](https://github.com/jlcormier612/wevenu-website/actions/runs/37259626013) | `634d819c` | **failure** — same typecheck |

`9449b2fe` is on `deploy/rehearsal-dinner-event-type` only (not `feat/spaces-booking-e1-smart-fields` HEAD).

---

## Workstream board

Statuses used: `GREEN` · `IN FLIGHT` · `NEEDS PROOF` · `OPEN DEFECT` · `BLOCKED` · `CLOSED`

| WORKSTREAM | CURRENT CODE SHA | IMPLEMENTATION STATUS | FOCUSED TEST STATUS | BROADER TEST STATUS | DEPLOYMENT RUN | DEPLOYED IMAGE | RUNNING IMAGE | RUNNING SHA | RUNNING DIGEST | TASK DEFINITION | TASK ID | SECRET/ENV PROOF | HEALTH PROOF | BROWSER PROOF | DB/PERSISTENCE PROOF | KNOWN DEFECTS | BLOCKER | FINAL STATUS |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A. Luv / Intelligent Venue Partner | `06e2423c` + later Luv commits on HEAD (`1fe28553`, `dc1b3d87`, `6c67f533`, …) | Implemented in repo | Prior suites recorded; not re-run this ledger open | Not re-run | Last success `37257420354` is `c007d343`, not a Luv-proof SHA | `c007d343` | `c007d343` | `c007d343` | `sha256:4d429c16…` | `:576` | `6d39a83a…` | n/a | 200 on **old** image | Prior proofs stale vs current image | Proposal-sent must be `commercial_proposals.status=sent AND offered_at` | Stage-as-evidence lock; customer-facing must not use internal notes | Current runtime ≠ Luv proof SHA | NEEDS PROOF |
| B. Setup Concierge / Texting | `58b61e2f` + `db007f3c` | Implemented in repo | Texting human-facing 39/39 historically | Not re-run | Not on current running image as proven | `c007d343` | `c007d343` | `c007d343` | `sha256:4d429c16…` | `:576` | `6d39a83a…` | n/a | 200 on **old** image | Pending clean pre-grad venue | — | Fake “Ask Luv about texting” removed in later code; must prove on runtime | No pre-grad proof on current image | NEEDS PROOF |
| C. Setup Profile | `f5e7c887` + `45cb9145`/`48bb8948` | Implemented in repo | 42/42 historically (`f5e7c887`); 27/27 accepted-types | Not re-run | Prior exact runtime `:573` **replaced** | `c007d343` | `c007d343` | `c007d343` | `sha256:4d429c16…` | `:576` | `6d39a83a…` | n/a | 200 on **old** image | Pending | Migration `20261412200000` claimed; not re-proven this open | Included ≠ configured ≠ applied | Current runtime replaced proof runtime | NEEDS PROOF |
| D. Automatic Reminders | `c5421c6f` + `05aea616` | Implemented in repo | 75/75 historically | Not re-run | Prior `:574` **replaced** | `c007d343` | `c007d343` | `c007d343` | `sha256:4d429c16…` | `:576` | `6d39a83a…` | n/a | 200 on **old** image | Incomplete | Do not backfill old 08:00Z rows | False green banner if dueNow>0 | Proof incomplete; runtime replaced | NEEDS PROOF |
| E. Dashboard Today's Focus dismissal | `d4cb7e15` + `19072992` | Implemented in repo | Prior focused | Not re-run | Contained in later images; current is `c007d343` (contains these SHAs) | `c007d343` | `c007d343` | `c007d343` | `sha256:4d429c16…` | `:576` | `6d39a83a…` | n/a | 200 | Not proven on `:576` | RPC venue-scoped; not Luv | Dismissal ≠ complete | Exact-runtime browser not done on `:576` | NEEDS PROOF |
| F. Rehearsal Dinner Only event type | `d2b03d22` contained in `9449b2fe` | Implemented | 54/54 focused this pass | Not full regression | [37262045937](https://github.com/jlcormier612/wevenu-website/actions/runs/37262045937) (GHA may still wrap; ECS/CFN complete) | `9449b2fe` | `9449b2fe` | `9449b2fe9b98f1d2084f0b6a45ca56c4fa24ee7b` | `sha256:a5b8e5e9fb9e8c8b3623429c3f4b0a87f704ada8e79bde02dd240e02d3ddd733` | `:577` | `f45e5bdbed164666b913b0a959717073` | n/a (no dedicated secret required) | 200 | Settings: “Rehearsal Dinner Only” opt-in, not Default; Wendy/Cindy/RDProof space prefs Ceremony/Reception/Cocktail Hour/Rehearsal Dinner; no “Only” in prefs; Reception Only remains event type | Cindy + RDProof `event_type=rehearsal_dinner`; 0 orphans; Fancy accepted now includes `rehearsal_dinner` after opt-in; spaces still `rehearsal_dinner` use | — | — | GREEN |
| G. Public tour attach + Leads All | `634d819c` + `a842ae20` + `2431c217` | Implemented; hardened signing only `TOUR_ORIGIN_SIGNING_SECRET` | 28/28 origin/attach this session | Not re-run | All hardened deploys failed/cancelled | none | `c007d343` | `c007d343` | `sha256:4d429c16…` | `:576` | `6d39a83a…` | Secret **missing**; not injected | 200 on **old** image | Jessica/Justin **not** run | Migration `20261412400000` dispatched earlier; not re-proven | No fallback allowed | CFN `GetRandomPassword` on `htc-sandbox-cfn-execution` | BLOCKED |
| H. Portal activation milestone | `c5f7f549` | Implemented in repo | 14/14 historically | Not re-run | Not proven on `:576` | `c007d343` | `c007d343` | `c007d343` | `sha256:4d429c16…` | `:576` | `6d39a83a…` | n/a | 200 | Pending | invited ≠ opened; write-once stamp | first invite telemetry historically null | Exact runtime replaced | NEEDS PROOF |
| I. Event → Client date sync | `38556e64` | Implemented in repo | Prior focused | Not re-run | Not proven on `:576` | `c007d343` | `c007d343` | `c007d343` | `sha256:4d429c16…` | `:576` | `6d39a83a…` | n/a | 200 | Prior fixture cancelled | Invite must use `clients.email` | Stale 2025/2028 fixture | Need clean Sandbox scenario | NEEDS PROOF |
| J. Contracts / booking / payments / event orders | Prior closeout SHAs | Do not reopen unless touched | Prior | Prior | Historical GREEN on older images | `c007d343` (supersedes old proof images) | `c007d343` | `c007d343` | `sha256:4d429c16…` | `:576` | `6d39a83a…` | n/a | 200 | Historical; not re-opened | Historical | — | Do not disturb unless a later change touches them | CLOSED |

## Phase order (locked)

1. Finish current `9449b2fe` deploy → exact runtime proof  
2. Fix Sandbox `GetRandomPassword` + wire `TOUR_ORIGIN_SIGNING_SECRET`  
3. Rehearsal Dinner browser/DB acceptance on a runtime containing `d2b03d22`  
4. Leads All + public tour attach on hardened runtime  
5. Luv privacy/factuality  
6. Setup Concierge / texting  
7. Setup Profile  
8. Automatic Reminders  
9. Today's Focus dismissal  
10. Portal activation  
11. Event → Client date sync  
12. Cross-system regression  
13. Final release gate  

## Rules in force

- Do not enable Fancy `rehearsal_dinner` until the new image is live.  
- Do not restore signing fallbacks.  
- Do not browser-test `c007d343` for event-type or tour-attach.  
- Production remains untouched.
