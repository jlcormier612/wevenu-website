# Phase 11B — Implementation plan (after product approval)

**Do not start until design is approved.** Smallest safe change set:

## Step 1 — Shared tone primitive
1. Add `tone?: "sales" | "bookings" | "money" | "owed" | "ops" | "neutral"` to `ComparisonCard`.  
2. Map tones to existing CSS variables (mirror `business-snapshot.tsx` class patterns).  
3. For `owed`, branch on `value > 0`.  
4. Add focused structural tests (class presence; Outstanding 0 vs >0; polarity text still present).

## Step 2 — Overview
1. Pass tones from `reporting/page.tsx`.  
2. Update `business-funnel.tsx` period + cohort tile classes to the same family map.  
3. Browser: Overview desktop/mobile vs approved mockups.

## Step 3 — Dedicated KPI pages
1. Bookings + Revenue + Events ComparisonCards.  
2. Sales mini-tile classNames (shared utility to avoid drift).  
3. Verify charts/tables remain white.

## Step 4 — Saved (optional polish)
1. Linen nest wrapper only if still desired after KPI review.  
2. No path-based coloring.

## Step 5 — Regression
1. Phase 10 reporting tests must stay green (intro/filter/tabs).  
2. Metric/service tests untouched.  
3. Visual QA: Overview, Revenue, Sales, Bookings, Events, Saved × desktop/mobile.  
4. Check Outstanding=0 venue or force fixture.  
5. Confirm no Phase 11A record-link regressions (unrelated).

## Explicit non-goals
- No metric definition changes  
- No Phase 10 chrome rewrite  
- No Calendar taxonomy reuse  
- No commit/deploy until separately authorized  

## Suggested PR isolation
Prefer a clean branch/cherry of only reporting + comparison-card + minimal CSS — avoid bundling dirty-tree Phase 10/11A unless releasing together.
