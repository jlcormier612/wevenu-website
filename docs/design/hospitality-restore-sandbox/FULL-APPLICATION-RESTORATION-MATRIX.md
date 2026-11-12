# Full-application restoration matrix (authoritative ledger)

**Verdict:** RESTORATION IN PROGRESS — LAUNCH BLOCKER  
**Do not declare FULLY RESTORED / GREEN.**  
**Serving Sandbox (preserved):** `df1aa331` / ECS tip previously verified; Production untouched.  
**PR #30 (safeguards):** OPEN — https://github.com/jlcormier612/wevenu-website/pull/30 @ `875cb4cd` (checks green; not merged).  
**Floor-plan toggle fix:** separate branch `fix/floor-plan-toggle-latency` (not mixed into #30).

## Definitive baselines

| Concern | Reference | Notes |
| --- | --- | --- |
| Hospitality shell / CRM presentation | `f22b8c14` + Wave G / Phase 11 ports already on `main` | Class markers ≠ visual proof |
| Reporting KPIs / charts / Saved Reports | Restored after overwrite by `40c7bb55`; live on Sandbox `df1aa331` | Colored `htc-report-metric-tile` verified |
| Newer booking / billing / contracts / Stripe | Current `main` | Must remain |
| Visual baselines for CI | PR #30 approved `__desktop` / `__mobile` PNGs + pixel compare | Live Sandbox capture job skipped until deploy policy allows |

Disposition keys for this ledger: **PASS** · **FAIL** · **BLOCKED** · **NOT APPLICABLE**

## Matrix (seed — expand with screenshot evidence per area)

| Area | Approved reference | Current implementation | Visual parity | Functional parity | Evidence | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| Reports Overview KPI tiles | hospitality tip / marketing reporting.png | Restored tones on `main` / Sandbox | Verified on Sandbox after #29 | Charts + Saved Reports preserved | Sandbox browser + reporting docs | PASS |
| Chart Day/Week/Month | Product brief | Present on reporting pages | Sandbox verify | Functional | Reporting polish PR | PASS |
| Event-type humanize | Display contract | Humanize path on `main` | N/A (copy) | Functional | Unit/display | PASS |
| Global shell / botanical tokens | `f22b8c14` / globals.css | On `main` + Sandbox | Source + partial shots | Nav works | PR #30 baselines subset | BLOCKED |
| Dashboard / Coming Up | hospitality + Coming Up affordance work | Coming Up row/link/chevron on branch history | Partial evidence under recovery-evidence/coming-up | Nav + dismiss still inventory | coming-up evidence | BLOCKED |
| Today’s Focus / attention deep-links | prior QA | Attention nav QA docs present | Incomplete desktop/mobile matrix | Needs re-verify | docs/qa/attention-message-navigation | BLOCKED |
| Leads / Clients lists | hospitality tip | On `main` | Incomplete matrix | List nav works historically | PR #30 baselines partial | BLOCKED |
| Tours | hospitality tip | On `main` | Screenshot coverage incomplete | BLOCKED | inventory | BLOCKED |
| Calendar | hospitality tip | On `main` | Incomplete | BLOCKED | — | BLOCKED |
| Contracts / Proposals / Packages | hospitality + commercial | On `main` | Incomplete | Preserve lifecycle rules | — | BLOCKED |
| Invoices / Payments | hospitality tip | On `main` | Screenshot coverage incomplete | Preserve Stripe | — | BLOCKED |
| Vendors / relationships / photos | hospitality + photo flows | Files present; photo flows need evidence | Incomplete | BLOCKED | relationship-photos inventory | BLOCKED |
| Inbox / Automations | hospitality tip | On `main` | Incomplete | BLOCKED | — | BLOCKED |
| Reporting Saved Reports | reporting line | On Sandbox | Verified earlier | PASS | reporting docs | PASS |
| Timelines / Event Orders / Inventory | current product rules | On `main` | Incomplete visual | Functional rules must stay | — | BLOCKED |
| Floor Plans workspace presentation | hospitality + floor-plan phases | On Sandbox | Incomplete visual matrix | Permissions rules preserved | Carriage House Working Layout | BLOCKED |
| Floor Plan Working Layout toggles latency | Launch UX | Sandbox before avg **11.5s** visible; local optimistic **~17–57ms** visible + async persist | N/A (interaction) | Local verified; Sandbox still pre-fix until PR merge/deploy | floor-plan-toggle evidence | FAIL |
| Questionnaires / Tasks / Documents / Guides | hospitality tip | On `main` | Incomplete | BLOCKED | — | BLOCKED |
| Wedding websites / RSVP | product | On `main` | Incomplete | BLOCKED | — | BLOCKED |
| Event settings / release controls | product | On `main` | Incomplete | BLOCKED | — | BLOCKED |
| Setup Hub / Setup Profiles | hospitality tip | On `main` | Incomplete | BLOCKED | — | BLOCKED |
| Templates / template editors | f22 + later | Files present | Incomplete evidence | BLOCKED | templates recovery wave | BLOCKED |
| Venue settings / branding / spaces | hospitality tip | On `main` | Incomplete | BLOCKED | — | BLOCKED |
| Staff / permissions / multi-venue | hospitality + multi-venue work | Needs persistence verify | Incomplete | BLOCKED | multi-venue inventory | BLOCKED |
| Subscription / billing / onboarding | current Stripe shared config | On `main` | Incomplete | Preserve shared Stripe | — | BLOCKED |
| Client / vendor portals | product rules | On `main` | Incomplete | Preserve portal rules | — | BLOCKED |
| Branch protection on `main` | Ops | Ruleset still requires admin enforce | N/A | N/A | GitHub API | FAIL |
| Visual compare required check | Ops / PR #30 | Workflow green on PR; enforcement of required status pending | N/A | N/A | PR #30 checks | BLOCKED |
| Deploy SHA + digest verification | Ops | In deploy-sandbox workflow | N/A | N/A | workflow | BLOCKED |

## Counts (this seed)

| Verdict | Count |
| --- | --- |
| PASS | 4 |
| FAIL | 2 |
| BLOCKED | 24 |
| NOT APPLICABLE | 0 |
| **Total areas listed** | **30** |

Additional route-tree areas will be appended as the exhaustive inventory expands; unresolved items stay visible.

## Floor-plan toggle (launch defect — tracked)

See `FLOOR-PLAN-TOGGLE-LATENCY.md` and `recovery-evidence/floor-plan-toggle/`.

## Next controlled batches (no merge/deploy without approval)

1. Land floor-plan optimistic toggle PR (separate from #30) after measurements + tests.
2. Keep #30 open until safeguards (required checks / ruleset) are accepted.
3. Expand this matrix with desktop/mobile screenshot pairs per remaining BLOCKED area.
4. Repair confirmed FAILs only in focused PRs.
