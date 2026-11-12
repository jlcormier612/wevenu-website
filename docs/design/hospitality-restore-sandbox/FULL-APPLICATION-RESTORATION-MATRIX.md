# Full-application restoration matrix (authoritative ledger)

**Verdict:** RESTORATION CANDIDATE GREEN (local + combined tip) — Sandbox runtime cutover still **pending explicit approval**  
**Serving Sandbox (preserved):** `df1aa331` — Production untouched.  
**Combined candidate (undeployed):** draft PR [#33](https://github.com/jlcormier612/wevenu-website/pull/33) @ `6718a4be` (#30+#31+#32 + closure fixes).  
**Release plan:** `SANDBOX-RELEASE-MANIFEST.md`  
**Evidence waves:** `recovery-evidence/matrix-wave/` · `recovery-evidence/closure/`

Disposition: **PASS** · **FAIL** · **BLOCKED** · **NOT APPLICABLE**

Green levels used below:

| Level | Meaning |
| --- | --- |
| **Local GREEN** | Implemented and validated in this workspace |
| **Combined candidate GREEN** | Validated against the integrated PR #33 tip |
| **Sandbox GREEN** | Deployed and verified on the serving Sandbox application |

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
| Today’s Focus / attention deep-links | prior QA | Attention API 200 | Desktop+mobile | 5/5 focus hrefs → invoice destinations 200 | `closure/closure-deep-links.json` + `attention-focus-verified__desktop.png` | PASS |
| Leads / Clients lists | hospitality tip | On Sandbox | d/m hospitality shell | List loads | `matrix-wave/leads-list__*` / `clients-list__*` | PASS |
| Lead / Client relationship photos | hospitality + photos | Avatar → `/edit` photo editor (`editHref`) on candidate | Local/candidate; Sandbox still pre-fix | Editor on edit route; discoverability via header avatar link | wiring.test + `closure/lead-photo-editor__*` | PASS |
| Tours | hospitality tip | On Sandbox | d/m hospitality shell | Loads | `matrix-wave/tours__*` | PASS |
| Calendar | hospitality tip | On Sandbox | Visual hospitality shell (screenshot); `.htc-hospitality-page` count=0 | Month grid + schedule panel works | `matrix-wave/calendar__*` | PASS |
| Contracts / Packages | hospitality + commercial | On Sandbox | d/m hospitality shell | Lists load | `matrix-wave/contracts__*` / `packages__*` | PASS |
| Proposals (top-level `/proposals`) | — | No top-level route (404) | N/A | Lives on lead commercial workspace | `matrix-wave/proposals__*` 404 | NOT APPLICABLE |
| Invoices / Payments | hospitality tip | On Sandbox | d/m hospitality shell | Preserve Stripe | `matrix-wave/payments__*` | PASS |
| Vendors | hospitality tip | On Sandbox | d/m hospitality shell | List loads | `matrix-wave/vendors__*` | PASS |
| Inbox / Automations | hospitality tip | On Sandbox | d/m hospitality shell | Inbox + series load | `matrix-wave/messaging-inbox__*` / `automations__*` | PASS |
| Reporting Saved Reports | reporting line | On Sandbox | Earlier verify | Interactive matrix YELLOW | reporting docs | PASS |
| Timeline / Floor Plan / Questionnaire / EO template lists | f22 + later | On Sandbox | d/m hospitality shell on list routes | Lists load | `matrix-wave/*-templates__*` | PASS |
| Event Order template **editor** density | hospitality working surface | Section `htc-working-card`s intentional; chrome spacing tightened on candidate | Candidate; Sandbox pre-fix | Editor loads; selections/pricing untouched | `closure/eo-editor__*` + detail/wizard diff | PASS |
| Floor Plan Working Layout toggles | Launch UX | Optimistic + races on candidate | N/A | Local ~17–57ms; races 9/9; Sandbox pre-deploy | `floor-plan-toggle/*` | PASS |
| Documents (`/documents` + `/library/documents`) | hospitality tip | Both routes serve Documents | Visual shell PASS; library route has hospitality class | Library loads | `matrix-wave/documents__*` + `library-documents__*` | PASS |
| Tasks | hospitality tip | Task Center | d/m hospitality shell | Loads | `matrix-wave/tasks__*` | PASS |
| Guides (`/guide`) | hospitality tip | Venue Guide | d/m hospitality shell | Loads | `matrix-wave/guide__*` | PASS |
| Help / Guidance | product | `/help` | d/m hospitality shell | Loads | `matrix-wave/help__*` | PASS |
| Wedding websites / RSVP staff surface | product | **No staff list by design** — couple portal Website Studio + Guest List/RSVP | Portal d/m screenshots | Portal `#website` + `#guests` load; guest data preserved (read-only) | `closure/portal-wedding-website__*` · `portal-guests-rsvp__*` · `closure-final-blocked.json` | PASS |
| Event settings / release controls | product | Event Setup panel + `/events/[id]/edit` | d/m | Setup panel + Preview portal visible; Release gated until decisions; **did not click Release/Invite** | `closure/event-setup-*` · `event-edit-settings__*` | PASS |
| Setup Hub | hospitality tip | `/setup-hub` | d/m hospitality shell | Loads | `matrix-wave/setup-hub-canonical__*` | PASS |
| Setup Profiles | hospitality tip | `/settings/leads/setup-profiles` | d/m hospitality shell | Loads | `matrix-wave/setup-profiles__*` | PASS |
| Venue settings / branding / spaces | hospitality tip | `/settings/business` + `/settings/availability` | d/m hospitality shell | Loads | `matrix-wave/settings-business__*` / `availability__*` | PASS |
| Staff / permissions / multi-venue | hospitality | `/settings/team` + venue switcher | d/m shots | Switcher present; permission persistence = #31 candidate | `settings-team__*` + multi-venue-header | PASS |
| Subscription / billing / onboarding | Stripe shared | `/settings/billing` | d/m hospitality shell | Preserve Stripe — no config change | `matrix-wave/billing__*` | PASS |
| Client / vendor portals | product | Client `/p/{token}` (legal gate) + Vendor jar `/vendor/*` | Client + Flora vendor d/m | Client tabs Home/Tasks/Timeline/Docs/Floor Plan/Payments/Messages/Guide/Vendors + Guests/Website; Flora dashboard/events/messages/documents | `closure/portal-tab-*` · `vendor-flora-*` | PASS |
| Branch protection on `main` | Ops | Ruleset `27077187` active | N/A | PR + 3 required status checks | gh ruleset API | PASS |
| Visual compare required check | Ops / #30 | Workflows + **required** on `main` | N/A | Required: `Hospitality presentation source guards` + `Screenshot vs approved baseline compare` | ruleset rename + required_status_checks | PASS |
| Deploy SHA + digest verification | Ops | `deploy-sandbox.yml` verify | N/A | Runs on Sandbox deploy | workflow ~546–575 | PASS |
| Reporting $114.9k vs $64.5k clocks | Reporting semantics | Breakdowns aligned to `events.booked_at` on candidate | Copy updated | Unintentional clock mismatch fixed; Period net vs AR preserved | `REVENUE-114900-VS-64500.md` + `revenue-breakdown-alignment.test.ts` | PASS |

## Counts

| Verdict | Count |
| --- | --- |
| PASS | 34 |
| FAIL | 0 |
| BLOCKED | 0 |
| NOT APPLICABLE | 1 |
| **Total areas listed** | **35** |

Prior: 27 PASS / 2 FAIL / 5 BLOCKED / 1 N/A. After closure wave: **34 PASS / 0 FAIL / 0 BLOCKED / 1 N/A**.

## Green-level summary for repaired / unblocked items

| Item | Local | Combined candidate | Sandbox (serving `df1aa331`) |
| --- | --- | --- | --- |
| Relationship photo discoverability | GREEN | GREEN (code + wiring tests) | PENDING post-deploy |
| EO editor density/chrome | GREEN | GREEN | PENDING post-deploy |
| Attention deep-links | GREEN | GREEN | GREEN (live href verify) |
| Wedding / RSVP path clarity | GREEN | GREEN | GREEN (portal read-only) |
| Event settings / release (read-only) | GREEN | GREEN | GREEN (no Release clicked) |
| Client + vendor portals | GREEN | GREEN | GREEN (legal gate + Flora cookie jar) |
| Visual smoke required on `main` | GREEN | GREEN | N/A (merge gate) |
| Reporting cohort alignment | GREEN | GREEN | PENDING post-deploy |

## Confirmed prior FAILs — closed on candidate

1. **Relationship photo editor affordance** — root cause: editor lives on `/edit`; detail headers lacked discoverable link. Fix: `editHref` on `RelationshipPhotoAvatar` for lead/client/event. Does not overwrite photos.
2. **Event Order template editor density** — `workingCard=5` are intentional section cards (`data-eo-section-card`); chrome spacing tightened only. No business-logic change.

## Prior BLOCKED — closed

1. Today’s Focus / attention deep-links — 5/5 invoice destinations verified.  
2. Wedding websites / RSVP — path inventory: couple portal, not staff list.  
3. Event settings / release — Event Setup + edit + Preview; Release not exercised.  
4. Client / vendor portals — client tab matrix + Flora vendor auth jar.  
5. Visual smoke required checks — now required on `main` ruleset `27077187`.

## Floor-plan toggle

See `FLOOR-PLAN-TOGGLE-LATENCY.md` and `recovery-evidence/floor-plan-toggle/` (timing + `race-acceptance.json` 9/9). Sandbox still serves pre-fix until approved combined deploy.

## Next controlled step (no merge/deploy without approval)

1. Approve draft PR #33 tip (closure commits included).  
2. Merge **only** the combined candidate → `main`.  
3. Deploy Sandbox **from `main` only**; verify SHA + ECR digest.  
4. Post-deploy: photo edit affordance, EO chrome, reporting cohort totals, floor-plan toggles, reporting-overview baseline refresh.
