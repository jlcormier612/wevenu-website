# Recovery wave — visual guards + priority area evidence

**Date:** 2026-11-11  
**Overall:** IN PROGRESS — LAUNCH BLOCKER  
**Sandbox preserved:** `df1aa331` / ECS `:1172` / digest `sha256:5a109d1…` — **no new deploy**  
**Production:** untouched  
**PR:** [#30](https://github.com/jlcormier612/wevenu-website/pull/30)

## 1. Visual guard is now a real compare

| Check | Result |
| --- | --- |
| Source-only guards | Still run (KPI/funnel/theme) — **not** sufficient alone |
| Pixel compare module | `scripts/qa/compare-png-baselines.mts` (pngjs channel diff, dim+red overlay) |
| Intentional regression | Mutate reporting baseline → **FAIL** `diffRatio 1.0000` exit 1 |
| Restore + compare | **PASS** 20/20 desktop+mobile pairs |
| Unit suite | `npx tsx --test scripts/qa/compare-png-baselines.test.ts` → **5/5** |
| Harness | Capture then compare; `--update-baselines` only path that skips fail gate |
| CI | Job **Screenshot vs approved baseline compare** on PR; live Sandbox capture on `workflow_dispatch` |

Approved baselines locked at:

`docs/design/hospitality-visual-baselines/approved/*__{desktop,mobile}.png` (20 files).

## 2. Deploy SHA/digest verification

`deploy-sandbox.yml` step **Record and verify venue-app image SHA + digest**:

- Fails if running task-def image tag ≠ `github.sha`
- Fails if ECR cannot resolve digest for that tag
- Writes `DEPLOY_IDENTITY sha=… task=… image=… digest=…` + job summary

CI also greps this step so it cannot be silently removed.

## 3. Priority area visual evidence (live Sandbox)

| Area | Desktop | Mobile | Verdict |
| --- | --- | --- | --- |
| Templates hub | `approved/templates__desktop.png` | `…__mobile.png` | Hospitality hub OK |
| Message templates list | `communication-templates__*` | same | Hospitality list OK |
| Timeline template **editor** | `recovery-evidence/timeline-template-edit__desktop.png` | `…__mobile.png` | Hospitality + working cards OK |
| Event Order / Floor plan / Questionnaire editors | `event-order-edit__*`, `floor-plan-edit-real__*`, `questionnaire-edit-real__*` | same | Hospitality editors OK |
| Contracts / Payments / Calendar / Vendors / Packages | `contracts__*`, `payments__*`, `calendar__*`, `vendors__*`, `packages__*` | same | Live hospitality lists/calendar OK |
| Billing / subscription | `billing__*` | same | Cards + heading OK |
| Org settings | `org-settings__*` | same | Settings card grid OK |
| Multi-venue chrome | header “The Willow Grove” on all shots | same | Switcher chrome OK |
| Attention (Today’s Focus + badges) | `dashboard__*` | same | Focus list + Leads `99+` OK |
| Relationship photo avatar | `lead-detail-photo__*` (initials TD) | same | Avatar chrome OK; upload/editor still partial |
| Client/event detail | `client-detail-photo__*` | same | Hospitality event workspace OK |
| Inbox | `inbox-attention__*` | same | Hospitality + attention API 200 |

## 4. Source parity note

Against `f22b8c14` hospitality-marked files: **121/122 identical**; `vendor-event-workspace.tsx` **gained** `htc-hospitality-page` on current (improvement, not loss).

## 5. Remains before complete restoration acceptance

1. PR #30 CI green on **both** jobs; merge only with deploy approval separate (preserve current Sandbox image until approved).
2. Shot matrix for remaining editors (EO, floor plan, questionnaires authoring, document workspace).
3. Relationship **uploaded photo** + editor flows (not just initials).
4. Multi-venue **switch persistence** exercise.
5. Attention dismiss → destination deep-links.
6. Expand baselines: contracts, payments, calendar, tours, vendors, packages.
7. Ruleset must require the screenshot-compare job on `main`.

**Not GREEN.** Do not treat class markers, builds, or partial screenshots as full parity.
