# Launch hospitality restoration inventory (working)

**Status:** IN PROGRESS — LAUNCH BLOCKER (not GREEN).  
**Serving Sandbox (preserved — no new deploy this wave):** `df1aa331` · ECS `htc-sandbox-venue-app:1172` · digest `sha256:5a109d1376e6a38d6090ccd03d285713f2ad4889aacee66511a26a07951f2f9e`.  
**Approved hospitality reference tip:** `f22b8c14` (+ Phase 11 reporting tones via PR #29).  
**Safeguards PR:** [#30](https://github.com/jlcormier612/wevenu-website/pull/30) — visual pixel-compare + deploy identity (awaiting merge/deploy approval).

Disposition keys: **RESTORED AND VERIFIED** · **ALREADY PRESENT AND VERIFIED** · **PARTIAL — NEEDS DEEPER PROOF** · **UNRESOLVED — LAUNCH BLOCKER** · **SUPERSEDED**

## Reporting KPI root cause (confirmed, closed on Sandbox)

| Item | Detail |
| --- | --- |
| Symptom | Overview “How the business moved” showed plain white outlined boxes |
| Approved | Softly colored `htc-report-metric-tile` period + cohort tiles |
| Cause | `40c7bb55` replaced hospitality `BusinessFunnel` with plain borders |
| Fix | PR #29 → Sandbox `df1aa331` — colored KPIs verified vs marketing `reporting.png` |

## Safeguards (this wave)

| Gate | Status | Evidence |
| --- | --- | --- |
| Deploy SHA + ECR digest verification | Present on PR #30 (`deploy-sandbox.yml`); fails if running image tag ≠ `github.sha` or ECR digest missing | Workflow step `Record and verify venue-app image SHA + digest` |
| Visual guard = pixel compare vs approved baselines | **Implemented** — capture alone is not a pass; mutated PNG → `diffRatio 1.0` → exit 1 | `scripts/qa/compare-png-baselines.mts` + `.test.ts` (5/5) |
| CI jobs | Source guards + Screenshot vs approved baseline compare (PR); live Sandbox capture+compare on `workflow_dispatch` | `.github/workflows/hospitality-visual-smoke.yml` |
| Branch protection / ruleset on `main` | Still required for permanent merge gates | Prior ruleset work; confirm required checks include visual compare job after #30 merges |
| Approved baseline matrix | 20 PNGs: 10 routes × desktop/mobile locked under `docs/design/hospitality-visual-baselines/approved/` | Captured from live Sandbox `df1aa331` |

## Exhaustive area ledger

| Area | Approved source | Live Sandbox / code | Disposition | Visual evidence |
| --- | --- | --- | --- | --- |
| Reports Overview KPI strip | Phase 11B / marketing PNG | Colored tiles on `df1aa331` | **RESTORED AND VERIFIED** | `reporting-overview__desktop/mobile.png` |
| Chart Day/Week/Month | Product brief | Present post-#29 | **RESTORED AND VERIFIED** | reporting verify set (prior wave) |
| Event type labels | Canonical humanize | Fixed display-only | **RESTORED AND VERIFIED** | prior wave |
| Saved Reports density | Hospitality compact | Compact rows | **RESTORED AND VERIFIED** | prior wave |
| Global shell / sidebar botanical | `f22b8c14` | File-identical hospitality markers; live shell matches | **ALREADY PRESENT AND VERIFIED** | all baseline shots show shell |
| Dashboard hospitality + focus | `f22` / Phase 10–11 | Today’s Focus + toned snapshot tiles live | **ALREADY PRESENT AND VERIFIED** | `dashboard__desktop/mobile.png` |
| Dashboard **Coming up** interactions | Phase 11B/11D + `f22` Decision Engine | **Not a lost-click regression:** rows were always `<Link>`s (plain `hover:bg-muted/40`, no chevron / `htc-record-*` affordance). Spec said “Data / hrefs \| Preserve.” **Previously incomplete:** `detail` hardcoded `"Event"` (never read `events.event_type`); href used `/events/[id]` redirect hop. Fixed on branch: `ComingUpRow` whole-row link + chevron + record styles; type labels via `eventTypeLabel`; direct `/clients/[id]` when `clientId` present. | **RESTORED pending Sandbox deploy verify** | before: `recovery-evidence/coming-up/before-*`; after (local): `after-coming-up-section__*`, hover/focus/nav; approved: `dashboard-coming-up__*` |
| Leads / Clients lists | `f22` | Hospitality toolbar/page live | **ALREADY PRESENT AND VERIFIED** | `leads__*`, `clients__*` |
| Templates hub | `f22` | File-identical; live hospitality hub | **ALREADY PRESENT AND VERIFIED** (hub) | `templates__desktop/mobile.png` |
| Communication / message templates list | `f22` | Live hospitality list + starters | **ALREADY PRESENT AND VERIFIED** (list) | `communication-templates__*` |
| Timeline / questionnaire template lists | `f22` | Live hospitality lists | **ALREADY PRESENT AND VERIFIED** (lists) | `timeline-templates__*`, `questionnaire-templates__*` |
| Template **editors** (timeline / EO / floor plan / questionnaire) | Wave G2 tests + `f22` | Timeline, EO, floor-plan, questionnaire **edit** surfaces live with hospitality + phase12 markers | **ALREADY PRESENT AND VERIFIED** (edit surfaces) · **PARTIAL** (document workspace still needs dedicated shots) | `timeline-template-edit__*`, `event-order-edit__*`, `floor-plan-edit-real__*`, `questionnaire-edit-real__*` |
| Billing / subscription cards | `f22` + billing components | Live Subscription & Billing + pricing cards | **ALREADY PRESENT AND VERIFIED** (page) | `billing__desktop/mobile.png` |
| Organization settings hub | `f22` | Settings card grid live | **ALREADY PRESENT AND VERIFIED** | `org-settings__*` |
| Multi-venue switcher | venue-switcher in shell header | Live “The Willow Grove” switcher in header | **ALREADY PRESENT AND VERIFIED** (switcher chrome) | all desktop headers; `multi-venue-header__*` |
| Multi-venue **switch behavior** / membership edge cases | product | Not exercised (switch + persist + RLS) in this wave | **PARTIAL — NEEDS DEEPER PROOF** | — |
| Attention navigation (Today’s Focus + nav badges) | attention service + sidebar | Today’s Focus live; Leads `99+` badge live; `/api/navigation/attention` → 200 | **ALREADY PRESENT AND VERIFIED** (dashboard focus + badge) | `dashboard__*`, recovery `attention-dashboard__*` |
| Attention **inbox deep-link / dismiss** flows | prior QA | Needs end-to-end click-through proof beyond dashboard list | **PARTIAL — NEEDS DEEPER PROOF** | — |
| Relationship photos (avatar/editor on lead/client) | relationship-photos components | Lead detail shows avatar (initials fallback when no upload); client/event header monogram present; `data-testid=relationship-photo-avatar` added for guards | **ALREADY PRESENT AND VERIFIED** (avatar chrome + initials) · **PARTIAL** (uploaded-photo + editor flows still need shot matrix) | `recovery-evidence/lead-detail-photo__*`, `client-detail-photo__*` |
| Contracts / Payments lists | `f22` | Live hospitality list pages verified | **ALREADY PRESENT AND VERIFIED** (lists) | `contracts__*`, `payments__*` |
| Calendar | `f22` (heading, not page wrapper) | Live botanical calendar; matches f22 class pattern | **ALREADY PRESENT AND VERIFIED** | `calendar__desktop/mobile.png` |
| Vendors / Packages lists | `f22` | Live hospitality lists | **ALREADY PRESENT AND VERIFIED** (lists) | `vendors__*`, `packages__*` |
| Invoices / Tours / document workspace editors | `f22` | Source present; shot matrix incomplete | **PARTIAL — NEEDS DEEPER PROOF** | — |
| Vendor portal hospitality | later fixes on main | Out of staff-app matrix; keep tracked | **PARTIAL** | — |
| Source parity `f22` hospitality files | 122 files | 121 identical; 1 improved (`vendor-event-workspace` gained `htc-hospitality-page`) | **ALREADY PRESENT** (code) | scan 2026-11-11 |
| Permanent branch-protection requiring visual job | Ops | Not fully accepted until #30 merged + required | **UNRESOLVED — LAUNCH BLOCKER** | — |

Do **not** treat CSS class presence, green builds, or a handful of screenshots as full parity. Editors, photo matrix, attention deep-links, multi-venue switch persistence, and remaining CRM routes still block declaring GREEN.

## Pixel-compare proof (this wave)

1. Mutate `current/reporting-overview.png` → solid red → `compare-png-baselines` exit **1** (`diffRatio 1.0000`).
2. Restore file → compare exit **0** (20/20 pairs).
3. Unit suite `scripts/qa/compare-png-baselines.test.ts` — 5/5 including intentional regression failure.

## Next before complete restoration can be accepted

1. Merge PR #30 **only after** CI shows both source-guards **and** Screenshot vs approved baseline compare green (no Sandbox deploy until explicit approval — preserve `df1aa331`).
2. Remaining shot matrix: document workspace, invoices, tours, relationship **uploaded-photo** + editor, attention dismiss → destination.
3. Exercise multi-venue switch end-to-end on Sandbox demo org (persist + data scope).
4. Promote key recovery-evidence routes into locked `approved/` baselines; require visual compare job on `main` ruleset.
5. Only then request Sandbox deploy of any net-new restoration commits.

## Overall

**IN PROGRESS — LAUNCH BLOCKER.** Reporting wave closed on Sandbox. Safeguards upgraded to real screenshot-vs-baseline failure. Priority hubs (templates, billing, org settings, multi-venue chrome, attention dashboard) visually confirmed on live `df1aa331`, but editor/photo/deep-link/remaining-route parity is not yet complete enough to accept full restoration.
