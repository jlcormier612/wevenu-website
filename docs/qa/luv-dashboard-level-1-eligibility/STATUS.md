# Luv Dashboard Level-1 eligibility

**Status:** IMPLEMENTING  
**Scope:** Harden `selectLuvDashboardEntry` so only Level-1 (globally pertinent) Luv items can occupy the one Dashboard card. Level-3 single-record intelligence relocates to lead/workflow surfaces — not deleted.

## Locked contract

- Ubiquity of capability ≠ ubiquity of interruption
- Dashboard: at most one Level-1 Luv card
- `tour-upcoming-*` and other single-record observations cannot win Dashboard
- V2 `tour_followup_pattern` / dismiss / cooldown unchanged
- Production untouched

## Implementation

- `lib/dashboard-system/luv-entry.ts` — Level-1 classifiers + selector gate
- Tests: `luv-entry.test.ts`, `tour-followup-pattern.test.ts`, `observation-dismiss.test.ts`
