# HTC Master Release Reconciliation Ledger

**OVERALL RELEASE:** NOT GREEN

**Ledger opened:** 2026-10-05  
**Branch:** `feat/spaces-booking-e1-smart-fields`  
**Repo HEAD:** `71296d2280878d641d626ee5015c4ee56d270602`  
**Production:** untouched (no `htc-production` stack, no production deploy workflow)

This ledger does **not** treat “code exists,” “tests pass,” “GHA success,” or “ECS healthy” as GREEN. GREEN requires exact-runtime + browser + DB proof on the sole RUNNING Sandbox venue-app.

## Authoritative live runtime (verified 2026-10-05 after `71296d22`)

| Field | Value |
|---|---|
| RUNNING SHA / image tag | `71296d2280878d641d626ee5015c4ee56d270602` |
| Image | `405254329873.dkr.ecr.us-east-1.amazonaws.com/htc-sandbox-venue-app:71296d2280878d641d626ee5015c4ee56d270602` |
| RUNNING DIGEST | `sha256:b8ae9cf983cb5aeb8822ac34667bbe7798cda362435170a3dd81b92afd968dd8` |
| TASK DEFINITION | `htc-sandbox-venue-app:578` |
| TASK ID | `750a21e7690e45c7ba6cc63e617d0317` |
| desired/running/pending | 1/1/0 |
| PRIMARY | COMPLETED (sole deployment) |
| HEALTH | `https://app.sandbox.hellotocheers.com/api/health` HTTP 200 `{"ok":true,"checks":{"env":"ok","supabase":"ok"}}` |
| Deploy | https://github.com/jlcormier612/wevenu-website/actions/runs/37262762218 SUCCESS |
| Cluster | `htc-sandbox` only |
| NEXT_DEPLOYMENT_ID | `71296d2280878d641d626ee5015c4ee56d270602` |

Contains: `d2b03d22` (Rehearsal Dinner Only), `634d819c` (Leads All + attach), `a842ae20`/`2431c217` (dedicated signing), `a80934c1` (TourOrigin CFN).

## CloudFormation / secrets (live)

| Stack | Status |
|---|---|
| `htc-sandbox` | `UPDATE_COMPLETE` |
| `htc-sandbox-ecr` | `UPDATE_COMPLETE` |
| `htc-github-oidc` | `UPDATE_COMPLETE` — `SecretsGenerateRandomPassword` live on `htc-sandbox-cfn-execution` |

- Secret `htc/sandbox/tour-origin-signing-secret` exists (`…Og6ynj`)
- Task def `:578` injects `TOUR_ORIGIN_SIGNING_SECRET` from `${TourOriginSigningSecret}:value::` only
- Not sourced from `CRON_SECRET` or `SUPABASE_SERVICE_ROLE_KEY`
- Not present in any `NEXT_PUBLIC_*` env
- App used the secret: staff “Copy scheduling link” produced `v1.{venueId}.{leadId}.{exp}.{sig}` on `/book/{key}?o=`

## In-flight / recent Sandbox deploys

| Run | SHA | Conclusion |
|---|---|---|
| [37262762218](https://github.com/jlcormier612/wevenu-website/actions/runs/37262762218) | `71296d22` | **success** — current runtime |
| [37262045937](https://github.com/jlcormier612/wevenu-website/actions/runs/37262045937) | `9449b2fe` | **success** — superseded |
| [37261254883](https://github.com/jlcormier612/wevenu-website/actions/runs/37261254883) | `d2b03d22` | **failure** — venue-app typecheck `reject: true` |
| [37260888063](https://github.com/jlcormier612/wevenu-website/actions/runs/37260888063) | `2431c217` | **cancelled** after CFN rollback |

---

## Workstream board

Statuses used: `GREEN` · `IN FLIGHT` · `NEEDS PROOF` · `OPEN DEFECT` · `BLOCKED` · `CLOSED`

| WORKSTREAM | CURRENT CODE SHA | IMPLEMENTATION STATUS | FOCUSED TEST STATUS | BROADER TEST STATUS | DEPLOYMENT RUN | DEPLOYED IMAGE | RUNNING IMAGE | RUNNING SHA | RUNNING DIGEST | TASK DEFINITION | TASK ID | SECRET/ENV PROOF | HEALTH PROOF | BROWSER PROOF | DB/PERSISTENCE PROOF | KNOWN DEFECTS | BLOCKER | FINAL STATUS |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A. Luv / Intelligent Venue Partner | `06e2423c` + later on `71296d22` | Implemented | Prior suites; CASE 1/3/6 proven live | Not full | 37262762218 | `71296d22` | `71296d22` | `71296d22` | `sha256:b8ae9cf9…` | `:578` | `750a21e7…` | n/a | 200 | CASE 1 Grace draft does not claim proposal sent; CASE 3 Jessica draft/Thoughts omit celebrity-security internal note; CASE 6 discard deletes UI+row | Grace `proposal_sent` + 0 `commercial_proposals`; Jessica draft `b70b47c0` deleted; Fancy has **zero** `status=sent` proposals | CASE 2 needs a real `markProposalSent` send; CASE 4/5/7 incomplete | — | NEEDS PROOF |
| B. Setup Concierge / Texting | `db007f3c` on `71296d22` | Implemented | 39/39 historical | Not re-run | 37262762218 | `71296d22` | `71296d22` | `71296d22` | `sha256:b8ae9cf9…` | `:578` | `750a21e7…` | n/a | 200 | `/settings/communications`: no “Ask Luv about texting”; Help Guide + Communication Health present | — | No clean pre-grad venue session yet | Need pre-grad venue | NEEDS PROOF |
| C. Setup Profile | `f5e7c887` on `71296d22` | Implemented | 42/42 historical | Not re-run | 37262762218 | `71296d22` | `71296d22` | `71296d22` | `sha256:b8ae9cf9…` | `:578` | `750a21e7…` | n/a | 200 | Pending apply/browser | `event_setup_states.inherited_template_refs` present; samples `{}` | Need new-event apply proof | — | NEEDS PROOF |
| D. Automatic Reminders | `c5421c6f` on `71296d22` | Implemented | 75/75 historical | Not re-run | 37262762218 | `71296d22` | `71296d22` | `71296d22` | `sha256:b8ae9cf9…` | `:578` | `750a21e7…` | n/a | 200 | Settings shows “1 reminder waiting to send”; Next listed `Mon, Oct 5 at 4:00 AM` (likely old 08:00Z row, not rewritten) | Do not backfill old 08:00Z | Need clean new-row 10:00 proof | — | NEEDS PROOF |
| E. Dashboard Today's Focus dismissal | `d4cb7e15` on `71296d22` | Implemented | Prior focused | Not re-run | 37262762218 | `71296d22` | `71296d22` | `71296d22` | `sha256:b8ae9cf9…` | `:578` | `750a21e7…` | n/a | 200 | Dashboard: “Nothing urgent today”; no stale “New inquiry N days old” copy visible | Dismissals not exercised per item type | Need per-type dismiss proof | — | NEEDS PROOF |
| F. Rehearsal Dinner Only event type | `d2b03d22` in `71296d22` | Implemented | 54/54 | Not full regression | 37262762218 | `71296d22` | `71296d22` | `71296d22` | `sha256:b8ae9cf9…` | `:578` | `750a21e7…` | n/a | 200 | Event type “Rehearsal Dinner Only”; space prefs “Rehearsal Dinner”; public form options include Rehearsal Dinner Only | Cindy + RDProof `event_type=rehearsal_dinner`; 0 `rehearsal_dinner_only` orphans | — | — | GREEN |
| G. Public tour attach + Leads All | `634d819c`+`a842ae20`+`2431c217` in `71296d22` | Implemented; dedicated secret only | 25/25 this pass | Not full | 37262762218 | `71296d22` | `71296d22` | `71296d22` | `sha256:b8ae9cf9…` | `:578` | `750a21e7…` | `TOUR_ORIGIN_SIGNING_SECRET` → `htc/sandbox/tour-origin-signing-secret` `:value::` | 200 | Copy link `?o=v1…`; All=20; Unseen=1 (Missing TokenCreate); Show all → `/leads`; Jessica one card after cleanup | Token matrix 422 invalid/expired/other-venue; booked/lost “no longer valid”; missing token created `a5e7af1c`; valid attach RDProof `4b3c4f2c` tour `326543ac`; Jessica original `4ccec22f` + tour `24826219`; dup `d7f83bea` deleted | — | — | GREEN |
| H. Portal activation milestone | `c5f7f549` on `71296d22` | Implemented | 14/14 historical | Not re-run | 37262762218 | `71296d22` | `71296d22` | `71296d22` | `sha256:b8ae9cf9…` | `:578` | `750a21e7…` | n/a | 200 | Pending | invited ≠ opened; write-once | Need unique-client=3 proof | — | NEEDS PROOF |
| I. Event → Client date sync | `38556e64` on `71296d22` | Implemented | Prior focused | Not re-run | 37262762218 | `71296d22` | `71296d22` | `71296d22` | `sha256:b8ae9cf9…` | `:578` | `750a21e7…` | n/a | 200 | Pending | Fixture event `8ab4665e` still present; not re-proven | Need clean edit path | — | NEEDS PROOF |
| J. Contracts / booking / payments / event orders | Prior closeout | Do not reopen | Prior | Prior | 37262762218 image supersedes old proof images | `71296d22` | `71296d22` | `71296d22` | `sha256:b8ae9cf9…` | `:578` | `750a21e7…` | n/a | 200 | Not re-opened | — | — | Do not disturb | CLOSED |

## Phase order (locked)

1. Finish current deploy → exact runtime proof — **done (`71296d22`)**
2. Fix Sandbox `GetRandomPassword` + wire `TOUR_ORIGIN_SIGNING_SECRET` — **done**
3. Rehearsal Dinner browser/DB — **GREEN (re-spot-checked on `71296d22`)**
4. Leads All + public tour attach on hardened runtime — **GREEN**
5. Luv privacy/factuality — **in progress (CASE 1/3/6 live; 2/4/5/7 open)**
6. Setup Concierge / texting — **partial (no fake Ask Luv; need pre-grad)**
7. Setup Profile — **column present; apply path unproven**
8. Automatic Reminders — **need clean 10:00 new-row proof**
9. Today's Focus dismissal — **need per-type dismiss**
10. Portal activation — **unproven**
11. Event → Client date sync — **unproven**
12. Cross-system regression
13. Final release gate

## Rules in force

- Do not restore signing fallbacks.
- Do not print/commit the signing secret.
- Production remains untouched.
