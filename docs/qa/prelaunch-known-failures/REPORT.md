# Prelaunch Known Test Failures — Investigation Report

**Date:** 2026-11-19  
**Branch / worktree:** `fix/prelaunch-known-test-failures` @ `.worktrees/prelaunch-known-failures`  
**Baseline compared:** clean `origin/main` `59b06831` (`.worktrees/prelaunch-test-baseline`)  
**Wave 7A compared:** `.worktrees/nav-perf-wave7a` (dirty streaming foundation)  
**Sandbox:** `c1b993f6` (read-only verify)  
**No commit / push / merge / deploy**

Desktop: `~/Desktop/HTC-PRELAUNCH-KNOWN-FAILURES/`

---

## Failure A — TimelineView empty TemplatePicker

### 1. Exact failing test and assertion
- File: `lib/playbooks/prepare-booking-planning-ux.test.ts`
- Test: `empty TimelineView mounts exactly one TemplatePicker with Add First Entry`
- Failed assertion: `assert.ok(afterEmpty > emptyStart)` where `afterEmpty` searched for  
  `TimelineSummaryBar itemCount={totalCount}` immediately after the empty branch.

### 2. Baseline vs Wave 7A
- **Fails on clean `origin/main`** and **fails identically on Wave 7A**.
- `timeline-view.tsx` empty branch is **byte-identical** between baseline and Wave 7A (no Wave 7A diff).

### 3. Root cause
**Incorrect / outdated source-contract test.**  
Product empty branch uses `itemCount={0}`; populated return uses `itemCount={totalCount}`. The test used the populated marker as the empty-branch end fence, so the slice never resolved and never reached the real TemplatePicker assertions.

Actual product empty state (confirmed in source + Sandbox):
- “No timeline yet”
- **Add First Entry**
- Exactly **one** `<TemplatePicker />`
- No duplicate header picker (`existingEntryCount` only on populated toolbar)

### 4. Customer impact
**None.** Empty Timeline UX works for venue users. Failure was test-only.

### 5. Changes
- Corrected empty-branch fence + tightened assertions (`itemCount={0}`, “No timeline yet”, no populated `existingEntryCount` in empty branch).
- No application code change.

### 6. Verification
- Unit test PASS after correction.
- Sandbox: empty timeline fixture shows “No timeline yet” + Add First Entry + template chrome (`sandbox-verify.json` allOk).

### 7. Adjacent
Populated toolbar TemplatePicker contract still PASS. No Timeline sync/rule changes.

### 8. Disposition
**TEST-STALE-TIMELINE-EMPTY** — GREEN/CLOSED · P2 · not launch-blocking · not Wave 7A.

---

## Failure B — booking-assignment questionnaires-tab

### 1. Exact failing test and assertion
- File: `lib/team/booking-assignment.test.ts`
- Test: `keeps the other planning tabs`
- Failed: expected `TabsTrigger value="questionnaires"` inside the **first** `<TabsList>` only.

### 2. Baseline vs Wave 7A
- **Fails on clean `origin/main`** and **fails identically on Wave 7A**.
- `event-detail.tsx` tab rows identical; Wave 7A did not change questionnaire nav.

### 3. Root cause
**Incorrect / outdated test vs accepted P2-A product.**  
Authoritative contract `lib/events/workspace-tab-nav-p2a.test.ts` already requires:
- Row 1: overview / playbook / timeline / floorplan / vendors
- Row 2: documents / invoice / messages / activity / notes / luv (**no Questionnaires**)
- Questionnaires remain `TabsContent` + Overview card (`open-questionnaires-card`)

The assignment test still expected the pre-P2-A single TabsList inventory.

### 4. Customer impact
**None for assignment/completion/permissions.** Questionnaires remain available via Overview card and `#questionnaires`. Staff assignment logic (the rest of this file) was already PASS.

### 5. Changes
- Updated tab assertions to P2-A rows + require `TabsContent` + open card.
- Adjacent stale contracts updated: `booked-workspace-tabs-luv.test.ts`, setup-copy line in `workspace-tab-nav-p2a.test.ts`, multiline Lead Luv trigger assert.
- No application / questionnaire business-rule changes.

### 6. Verification
- Related unit suites PASS (37/37 in focused run).
- Sandbox: Questionnaires **not** on tab rows; Overview card present; click opens `event-questionnaires-tab` with `#questionnaires`.

### 7. Adjacent
Discovered and closed same-class stale tests (TEST-STALE-TAB-LUV, TEST-STALE-SETUP-COPY, TEST-STALE-LEAD-LUV-ASSERT).

### 8. Disposition
**TEST-STALE-Q-TAB** — GREEN/CLOSED · P2 · not launch-blocking · not Wave 7A.

---

## Wave 7A release implication

These failures **do not block** Wave 7A progressing toward a future Sandbox release. They existed on `main` before Wave 7A and do not indicate a Wave 7A product regression.

Wave 7A itself remains founder-gated (local foundation; Sandbox still `c1b993f6`; NAV-PERF OPEN).

---

## Safety

Sandbox-only verify · no payments · no outbound communications · OpenAI 0 · Production untouched · no commit/push/deploy without founder approval.
