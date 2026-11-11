# Launch hospitality restoration inventory (working)

**Status:** IN PROGRESS — not GREEN.  
**Serving baseline before this work:** Sandbox `54bb95a5` / ECS `:1171`.  
**Approved KPI reference:** marketing `features-showroom/reporting.png` + hospitality tip prior to `40c7bb55`.

## Reporting KPI root cause (confirmed)

| Item | Detail |
| --- | --- |
| Symptom | Overview “How the business moved” showed plain white outlined boxes |
| Approved | Softly colored `htc-report-metric-tile` period + cohort tiles (Phase 11B/11D) |
| Cause | `40c7bb55` (“Integrate latest reporting onto the finished hospitality application”) replaced hospitality `BusinessFunnel` with main’s plain bordered strip from the reporting line |
| Classification | **A** — approved presentation overwritten during reporting integration |
| Fix wave | Restore metric-tile tones; remove redundant `ComparisonCardGrid` on Overview |

## Exhaustive area ledger (seed — expand with screenshot evidence)

Disposition keys: **RESTORED AND VERIFIED** · **ALREADY PRESENT AND VERIFIED** · **SUPERSEDED** · **UNRESOLVED — LAUNCH BLOCKER**

| Area | Approved source | Current (`main` / Sandbox) | Disposition | Notes |
| --- | --- | --- | --- | --- |
| Reports Overview KPI strip | `dea957d2` / marketing reporting.png | Plain borders on `54bb95a5`; restored on this branch | RESTORED pending visual verify | Wave in progress |
| Reports Overview duplicate KPI grid | N/A (regression) | ComparisonCards duplicated funnel | RESTORED pending visual verify | Removed duplicate grid |
| Chart Day/Week/Month control | Product brief | Auto day/week/month only | RESTORED pending visual verify | Defaults aligned to brief |
| Event type doughnut vs list | Canonical display | Unknown tokens → “Not recorded” | RESTORED pending visual verify | Display-only humanize |
| Saved Reports density | Hospitality density | Oversized white cards | RESTORED pending visual verify | Compact rows |
| Global shell / sidebar | hospitality tip | Present on Sandbox | ALREADY PRESENT — needs visual proof | Class markers ≠ parity |
| Dashboard | hospitality tip | Present | ALREADY PRESENT — needs visual proof | |
| Leads / Clients lists | hospitality tip | Present | ALREADY PRESENT — needs visual proof | |
| Contracts / Payments | hospitality tip | Present | ALREADY PRESENT — needs visual proof | Partial marker gaps historically |
| Templates / document manager | f22 + later | Files present | UNRESOLVED — LAUNCH BLOCKER | Needs screenshot parity |
| Billing / org cards | f22 + later | Files present | UNRESOLVED — LAUNCH BLOCKER | Needs screenshot parity |
| Multi-venue shell | hospitality work | Unknown | UNRESOLVED — LAUNCH BLOCKER | Inventory |
| Attention navigation | prior QA | Unknown | UNRESOLVED — LAUNCH BLOCKER | Inventory |
| Relationship photos | prior design | Unknown | UNRESOLVED — LAUNCH BLOCKER | Inventory |
| Branch protection on `main` | Ops requirement | **None** (API 404 / empty rulesets) | UNRESOLVED — LAUNCH BLOCKER | Admin enforce required |
| Visual regression suite | Ops requirement | Not yet enforced | UNRESOLVED — LAUNCH BLOCKER | In progress |
| Deploy integrity recording | Ops requirement | Partial in Deploy Sandbox | UNRESOLVED — LAUNCH BLOCKER | Extend verify job |

Do not treat CSS class presence as visual acceptance.

## Next waves (ordered)

1. Land reporting polish PR (this branch) after build + tests + screenshot evidence; Sandbox only with explicit approval.
2. Screenshot matrix vs approved captures for shell + top CRM routes (desktop + mobile).
3. Restore remaining presentation gaps adapted to current architecture — no blind cherry-picks.
4. Enforce GitHub ruleset + visual CI + deploy SHA/digest verification.
