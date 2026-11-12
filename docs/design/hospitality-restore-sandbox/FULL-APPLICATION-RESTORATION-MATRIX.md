# Full-application restoration matrix (authoritative ledger)

**Verdict:** RESTORATION IN PROGRESS — not FULLY RESTORED / GREEN  
**Serving Sandbox (preserved):** `df1aa331` — Production untouched.  
**Combined candidate (undeployed):** draft PR [#33](https://github.com/jlcormier612/wevenu-website/pull/33) @ `939c8f07` (#30+#31+#32).  
**Release plan:** `SANDBOX-RELEASE-MANIFEST.md`  
**Evidence wave:** `recovery-evidence/matrix-wave/` (56 route PNGs + corrected-path follow-up)

Disposition: **PASS** · **FAIL** · **BLOCKED** · **NOT APPLICABLE**

## Definitive baselines

| Concern | Reference | Notes |
| --- | --- | --- |
| Hospitality shell / CRM presentation | `f22b8c14` + Wave G / Phase 11 on `main` | Class markers ≠ sole proof; screenshots required |
| Reporting KPIs / charts / Saved Reports | Live on Sandbox `df1aa331`; #32 adds grain/Period net/doughnut | Post-deploy baseline refresh required for reporting-overview |
| Newer booking / billing / contracts / Stripe | Current `main` | Must remain |
| Visual baselines for CI | PR #30 approved PNGs + pixel compare | Live Sandbox capture still dispatch-only |

## Matrix

| Area | Approved reference | Current implementation | Visual parity | Functional parity | Evidence | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| Reports Overview KPI tiles | hospitality / marketing | Restored tones on Sandbox | Verified after #29 + matrix reporting shots | Charts + Saved Reports | Sandbox + `matrix-wave/reporting-overview__*` | PASS |
| Chart Day/Week/Month | Product brief | Local rebucket on candidate (#32) | Candidate ~60ms; Sandbox still pre-#32 | Functional | #32 tests | PASS |
| Event-type humanize | Display contract | On `main` | N/A | Functional | unit/display | PASS |
| Global shell / botanical tokens | `f22b8c14` | On Sandbox | Dashboard d/m hospitality shell | Nav works | `matrix-wave/dashboard-shell__*` | PASS |
| Dashboard / Coming Up | hospitality + affordance | Coming Up on #30 tip | Desktop/mobile after shots | Actionable rows + tests | `recovery-evidence/coming-up/` | PASS |
| Today’s Focus / attention deep-links | prior QA | Attention API 200 | Desktop+mobile | Deep-link click matrix incomplete | `evidence.json` attention-dashboard | BLOCKED |
| Leads / Clients lists | hospitality tip | On Sandbox | d/m hospitality shell | List loads | `matrix-wave/leads-list__*` / `clients-list__*` | PASS |
| Lead / Client relationship photos | hospitality + photos | Avatar imgs; photo editor nodes=0 | Desktop shot | Photo editor affordance not observed | `deep-evidence.json` | FAIL |
| Tours | hospitality tip | On Sandbox | d/m hospitality shell | Loads | `matrix-wave/tours__*` | PASS |
| Calendar | hospitality tip | On Sandbox | Visual hospitality shell (screenshot); `.htc-hospitality-page` count=0 | Month grid + schedule panel works | `matrix-wave/calendar__*` | PASS |
| Contracts / Packages | hospitality + commercial | On Sandbox | d/m hospitality shell | Lists load | `matrix-wave/contracts__*` / `packages__*` | PASS |
| Proposals (top-level `/proposals`) | — | No top-level route (404) | N/A | Lives on lead commercial workspace | `matrix-wave/proposals__*` 404 | NOT APPLICABLE |
| Invoices / Payments | hospitality tip | On Sandbox | d/m hospitality shell | Preserve Stripe | `matrix-wave/payments__*` | PASS |
| Vendors | hospitality tip | On Sandbox | d/m hospitality shell | List loads | `matrix-wave/vendors__*` | PASS |
| Inbox / Automations | hospitality tip | On Sandbox | d/m hospitality shell | Inbox + series load | `matrix-wave/messaging-inbox__*` / `automations__*` | PASS |
| Reporting Saved Reports | reporting line | On Sandbox | Earlier verify | Interactive matrix YELLOW | reporting docs | PASS |
| Timeline / Floor Plan / Questionnaire / EO template lists | f22 + later | On Sandbox | d/m hospitality shell on list routes | Lists load | `matrix-wave/*-templates__*` | PASS |
| Event Order template **editor** density | hospitality working surface | Edit route `workingCard=5` | Dense working-card presentation | Editor loads | `wave-editors` event-order-edit | FAIL |
| Floor Plan Working Layout toggles | Launch UX | Optimistic + races on candidate | N/A | Local ~17–57ms; races 9/9; Sandbox pre-deploy | `floor-plan-toggle/*` | PASS |
| Documents (`/documents` + `/library/documents`) | hospitality tip | Both routes serve Documents | Visual shell PASS; library route has hospitality class | Library loads | `matrix-wave/documents__*` + `library-documents__*` | PASS |
| Tasks | hospitality tip | Task Center | d/m hospitality shell | Loads | `matrix-wave/tasks__*` | PASS |
| Guides (`/guide`) | hospitality tip | Venue Guide | d/m hospitality shell | Loads | `matrix-wave/guide__*` | PASS |
| Help / Guidance | product | `/help` | d/m hospitality shell | Loads | `matrix-wave/help__*` | PASS |
| Wedding websites / RSVP staff surface | product | No dedicated staff list route found in nav | Incomplete | Portal/event-scoped — path inventory incomplete | guessed `/wedding-websites` 404 | BLOCKED |
| Event settings / release controls | product | Event-scoped | Incomplete staff-list probe | Incomplete | — | BLOCKED |
| Setup Hub | hospitality tip | `/setup-hub` | d/m hospitality shell | Loads | `matrix-wave/setup-hub-canonical__*` | PASS |
| Setup Profiles | hospitality tip | `/settings/leads/setup-profiles` | d/m hospitality shell | Loads | `matrix-wave/setup-profiles__*` | PASS |
| Venue settings / branding / spaces | hospitality tip | `/settings/business` + `/settings/availability` | d/m hospitality shell | Loads | `matrix-wave/settings-business__*` / `availability__*` | PASS |
| Staff / permissions / multi-venue | hospitality | `/settings/team` + venue switcher | d/m shots | Switcher present; permission persistence = #31 candidate | `settings-team__*` + multi-venue-header | PASS |
| Subscription / billing / onboarding | Stripe shared | `/settings/billing` | d/m hospitality shell | Preserve Stripe — no config change | `matrix-wave/billing__*` | PASS |
| Client / vendor portals | product | Portal routes exist | Incomplete staff-matrix coverage | Preserve portal rules | — | BLOCKED |
| Branch protection on `main` | Ops | Ruleset: PR + venue-app build required | N/A | Active | ruleset `27077187` | PASS |
| Visual compare required check | Ops / #30 | Workflow green on #30/#33 | N/A | **Not** a required status check yet | ruleset vs hospitality-visual-smoke | BLOCKED |
| Deploy SHA + digest verification | Ops | `deploy-sandbox.yml` verify | N/A | Runs on Sandbox deploy | workflow ~546–575 | PASS |

## Counts

| Verdict | Count |
| --- | --- |
| PASS | 27 |
| FAIL | 2 |
| BLOCKED | 5 |
| NOT APPLICABLE | 1 |
| **Total areas listed** | **35** |

Prior seed: 24 BLOCKED. After matrix-wave + corrected paths: **5 BLOCKED**, **2 FAIL**. Still not FULLY RESTORED.

## Confirmed FAILs (repair in focused follow-ups — do not silently expand this release)

1. **Relationship photo editor affordance** — lead/client deep capture shows no photo editor / relationship photo nodes.
2. **Event Order template editor density** — `workingCard=5` on edit route.

## Remaining BLOCKED

1. Today’s Focus / attention **deep-link** click matrix  
2. Wedding websites / RSVP staff surface path inventory  
3. Event settings / release controls  
4. Client / vendor portals visual+functional matrix  
5. Visual smoke jobs **not required** on `main` ruleset  

## Floor-plan toggle

See `FLOOR-PLAN-TOGGLE-LATENCY.md` and `recovery-evidence/floor-plan-toggle/` (timing + `race-acceptance.json` 9/9). Sandbox still serves pre-fix until approved combined deploy.

## Next controlled batches (no merge/deploy without approval)

1. Keep combined candidate as the only merge vehicle (draft PR #33).  
2. Add visual smoke jobs as **required** checks when you authorize ruleset change.  
3. Finish the five BLOCKED rows; repair the two FAILs in focused PRs after release decision.  
