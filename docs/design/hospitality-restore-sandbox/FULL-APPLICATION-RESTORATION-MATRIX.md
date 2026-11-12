# Full-application restoration matrix (authoritative ledger)

**Verdict:** RESTORATION IN PROGRESS — LAUNCH BLOCKER  
**Do not declare FULLY RESTORED / GREEN.**  
**Serving Sandbox (preserved):** `df1aa331` — Production untouched.  
**Combined candidate (undeployed):** `integrate/sandbox-release-candidate` @ `d78c137e` (#30+#31+#32).  
**Release plan:** `SANDBOX-RELEASE-MANIFEST.md`

Disposition: **PASS** · **FAIL** · **BLOCKED** · **NOT APPLICABLE**

## Definitive baselines

| Concern | Reference | Notes |
| --- | --- | --- |
| Hospitality shell / CRM presentation | `f22b8c14` + Wave G / Phase 11 on `main` | Class markers ≠ visual proof |
| Reporting KPIs / charts / Saved Reports | Live on Sandbox `df1aa331`; #32 adds grain/Period net/doughnut | Post-deploy baseline refresh required for reporting-overview |
| Newer booking / billing / contracts / Stripe | Current `main` | Must remain |
| Visual baselines for CI | PR #30 approved PNGs + pixel compare | Live Sandbox capture still dispatch-only |

## Matrix

| Area | Approved reference | Current implementation | Visual parity | Functional parity | Evidence | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| Reports Overview KPI tiles | hospitality / marketing | Restored tones on Sandbox | Verified after #29 | Charts + Saved Reports | Sandbox + reporting docs | PASS |
| Chart Day/Week/Month | Product brief | Local rebucket on candidate (#32) | Sandbox current slower; candidate ~60ms | Functional | #32 tests + reporting-final-quality | PASS |
| Event-type humanize | Display contract | On `main` | N/A | Functional | unit/display | PASS |
| Global shell / botanical tokens | `f22b8c14` | On Sandbox + baselines | Approved shell PNGs present; live matrix incomplete for all routes | Nav works | PR #30 baselines | BLOCKED |
| Dashboard / Coming Up | hospitality + affordance | Coming Up link/chevron/event types on #30 tip | Desktop/mobile after shots | Actionable rows + tests | `recovery-evidence/coming-up/` | PASS |
| Today’s Focus / attention deep-links | prior QA | Attention API 200; hospitality dashboard | Desktop+mobile shots | `needsAttentionText` false on capture — deep-link matrix incomplete | `evidence.json` attention-dashboard | BLOCKED |
| Leads / Clients lists | hospitality tip | On Sandbox | Partial baselines | List nav historical | PR #30 baselines partial | BLOCKED |
| Lead / Client relationship photos | hospitality + photos | Avatar imgs present; `relationshipPhotoNodes=0`, `photoEditor=0` | Desktop shot | Photo editor affordance not observed | `deep-evidence.json` lead/client | FAIL |
| Tours | hospitality tip | On Sandbox | Incomplete d/m | Incomplete | inventory | BLOCKED |
| Calendar | hospitality tip | On Sandbox | `hospitality=0` on capture | Heading only | `wave-remaining` / `wave-editors` calendar | FAIL |
| Contracts / Proposals / Packages | hospitality + commercial | On Sandbox | Desktop hospitality shell PASS for contracts/packages | Lifecycle must stay | `wave-remaining` contracts/packages | BLOCKED |
| Invoices / Payments | hospitality tip | On Sandbox | Desktop hospitality shell PASS | Preserve Stripe | `wave-remaining` payments | BLOCKED |
| Vendors | hospitality tip | On Sandbox | Desktop hospitality PASS | Incomplete mobile/func | `wave-remaining` vendors | BLOCKED |
| Inbox / Automations | hospitality tip | Messaging hospitality=1; attention API 200 | Desktop deep shot | Unread/badge observed | `deep-evidence` inbox | BLOCKED |
| Reporting Saved Reports | reporting line | On Sandbox | Earlier verify | Interactive matrix YELLOW | reporting docs | PASS |
| Timelines templates | f22 + later | Edit path hospitality=1 phase12=1 | Preview path previously hospitality=0 | Editor loads | `deep-evidence` timelineEdit; `evidence` timeline preview gap | BLOCKED |
| Event Orders templates | product | Edit hospitality=1 but `workingCard=5` | Dense working-card presentation | Editor loads | `wave-editors` event-order-edit | FAIL |
| Floor Plans workspace presentation | hospitality + phases | Edit-real hospitality=1 workingCard=1 | Preview path hospitality=0 earlier | Permissions rules | `wave-editors` floor-plan-edit-real | BLOCKED |
| Floor Plan Working Layout toggles | Launch UX | Optimistic + race controller on candidate | N/A | Local ~17–57ms; races 9/9; Sandbox still pre-deploy | `floor-plan-toggle/*` | PASS |
| Questionnaires templates | hospitality tip | Edit-real hospitality=1 | Preview path hospitality=0 earlier | Editor loads | `wave-editors` questionnaire-edit-real | BLOCKED |
| Tasks / Documents / Guides | hospitality tip | On Sandbox | Incomplete d/m | Incomplete | — | BLOCKED |
| Wedding websites / RSVP | product | On Sandbox | Incomplete | Incomplete | — | BLOCKED |
| Event settings / release controls | product | On Sandbox | Incomplete | Incomplete | — | BLOCKED |
| Setup Hub / Setup Profiles | hospitality tip | On Sandbox | Incomplete | Incomplete | — | BLOCKED |
| Venue settings / branding / spaces | hospitality tip | On Sandbox | Incomplete | Incomplete | — | BLOCKED |
| Staff / permissions / multi-venue | hospitality | Venue switcher present | Desktop+mobile header shots | Persistence of toggles = #31 candidate | `evidence` multi-venue-header | BLOCKED |
| Subscription / billing / onboarding | Stripe shared | Billing hospitality shell | Desktop+mobile | Preserve Stripe — no config change | `evidence` billing-cards | BLOCKED |
| Client / vendor portals | product | On Sandbox | Incomplete | Preserve portal rules | — | BLOCKED |
| Branch protection on `main` | Ops | Ruleset: PR required + venue-app build required | N/A | Active | GitHub ruleset `27077187` | PASS |
| Visual compare required check | Ops / #30 | Workflow exists + green on #30 | N/A | **Not** a required status check yet | ruleset vs hospitality-visual-smoke | BLOCKED |
| Deploy SHA + digest verification | Ops | `deploy-sandbox.yml` verify records tag+digest | N/A | Runs on Sandbox deploy | workflow lines ~546–575 | PASS |

## Counts

| Verdict | Count |
| --- | --- |
| PASS | 9 |
| FAIL | 3 |
| BLOCKED | 20 |
| NOT APPLICABLE | 0 |
| **Total areas listed** | **32** |

Prior seed had 24 BLOCKED; evidence from PR #30 recovery waves converted 4 → PASS and 3 → FAIL (confirmed gaps), leaving **20 BLOCKED**. Still not FULLY RESTORED.

## Confirmed FAILs (repair required — separate focused PRs after release decision)

1. **Calendar hospitality presentation** — capture shows `hospitality=0`.
2. **Relationship photo editor affordance** — lead/client deep capture shows no photo editor / relationship photo nodes.
3. **Event Order template editor density** — `workingCard=5` on edit route (presentation regression vs hospitality working surface).

## Floor-plan toggle

See `FLOOR-PLAN-TOGGLE-LATENCY.md` and `recovery-evidence/floor-plan-toggle/` (timing + `race-acceptance.json` 9/9). Sandbox still serves pre-fix until approved combined deploy.

## Next controlled batches (no merge/deploy without approval)

1. Finish mobile + functional pairs for remaining BLOCKED rows against live Sandbox `df1aa331`.
2. Keep combined candidate as the only merge vehicle (`integrate/sandbox-release-candidate`).
3. Add visual smoke jobs as **required** checks on `main` when you authorize ruleset change.
4. Repair the three FAILs in focused follow-up PRs (do not silently expand this release).
