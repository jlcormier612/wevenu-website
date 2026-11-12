# Dashboard Coming up — interaction restoration

**Overall hospitality status:** still IN PROGRESS — LAUNCH BLOCKER  
**Sandbox:** unchanged (`df1aa331` / `:1172`) — **not deployed**  
**Branch tip:** local fix prepared for PR #30 review

## 1. Regression determination (evidence-based)

| Question | Finding |
| --- | --- |
| Were rows previously clickable and lost? | **No.** `f22b8c14`, `dea957d2`, and live Sandbox all render Coming up via `<Link href={…}>` (`ClassifiedRow`). Live before probe: `plainLinksInComingUp: 6`. |
| Did navigation exist without interactive styling? | **Yes.** Links had only `hover:bg-muted/40` — no chevron, no `htc-record-link` / `htc-record-card-link`, no `data-testid`. Visually read as static text. |
| Was actionable list never intended? | **No.** Spec §1.3: “Data / hrefs \| Preserve.” Architecture treats Coming up as navigable awareness rows. |
| Why every row said “Event”? | **Previously incomplete, not a late regression.** `classifyUpcomingItems` hardcoded `detail: "Event"` since the Decision Engine introduction; `events.event_type` was never selected into `DashboardEvent`. |

**Classification:** interaction/type **gap relative to hospitality list patterns** (and incomplete type wiring) — **not** a lost-click regression from Phase 11B/11D.

## 2. Fix implemented

- `ComingUpRow`: whole-row semantic `Link`, record-card/record-link styles, hover + focus-visible wash, understated `ChevronRight`, `data-testid="coming-up-item-link"`.
- Pale-blue `htc-surface-guidance` shell preserved; no Focus urgency styling.
- Load `event_type`; display via `eventTypeLabel` (fallback `"Event"` only when absent).
- Prefer `/clients/[clientId]` booking workspace; keep `/events/[id]` when `clientId` null.
- 30-day window / ordering / events-only rules unchanged.
- Today’s Focus dismiss remains a sibling control outside its link.

## 3. Verification

| Check | Result |
| --- | --- |
| Classifier + ComingUpRow + dashboard page tests (scoped) | Pass (new assertions). Two pre-existing `dashboard-page.test.ts` checks still fail on unrelated payments/counts drift — not introduced by this change. |
| Before (live Sandbox) | 6 plain links; all details `"Event"`; no chevrons |
| After (local `:3000`) | 6 `coming-up-item-link`s; types Cocktail Hour / Private Event / Corporate Event / Birthday Party; hrefs `/clients/<uuid>`; click lands on matching booking |
| Focus audit | Focus links + dismiss still present; dismiss not nested in link |

## 4. Evidence paths

- Before: `before-coming-up-section__{desktop,mobile}.png`
- After: `after-coming-up-section__*`, `after-coming-up-hover__desktop.png`, `after-coming-up-focus__desktop.png`, `after-coming-up-nav-destination__desktop.png`
- Approved baseline: `docs/design/hospitality-visual-baselines/approved/dashboard-coming-up__{desktop,mobile}.png`
