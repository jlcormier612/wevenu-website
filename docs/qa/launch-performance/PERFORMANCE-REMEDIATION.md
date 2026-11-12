# HTC launch performance remediation

**Status:** Wave B + C2 **acceptance complete** on PR #34; C1 **thin prototype** on separate branch — **no merge / no deploy**  
**Date:** 2026-11-12  
**PR #33 tip:** `ee22f319` (hospitality + #30/#31/#32) — **untouched**  
**PR #34 tip:** `181aa3c7` (`perf/launch-remediation`)  
**C1 prototype branch:** `perf/wave-c1-lead-deferral-prototype` (see `WAVE-C1-PROTOTYPE-RESULTS.md`)  
**Serving Sandbox:** still `df1aa331`  
**Baseline:** `PERFORMANCE-BASELINE.md`

---

## A. Executive summary

| Wave | Status |
| --- | --- |
| **B** | Accepted — hospitality `loading.tsx`; soft-nav loading observed under RSC delay; a11y busy regions |
| **C2** | Accepted — Dashboard islands preserve greeting/KPIs/Focus/Coming Up/order; New Lead + Back OK |
| **C1** | Thin Lead prototype on **isolated** branch — documents + Luv deferred with warm-tab speed retained (**REVISE** before full rollout) |
| **C3 / Claire** | Stale UUID dead; Claire Nguyen/Abbott are **booked** (signed contracts) — not proposal→contract sellers. Use Avery/Ellie for open proposal demos |
| **D** | Not started |

---

## B. Code / PR map

| Artifact | Location |
| --- | --- |
| Wave B + C2 | PR [#34](https://github.com/jlcormier612/wevenu-website/pull/34) @ `181aa3c7` |
| C1 prototype | Branch `perf/wave-c1-lead-deferral-prototype` (not folded into #34) |
| #33 | Draft PR [#33](https://github.com/jlcormier612/wevenu-website/pull/33) @ `ee22f319` |

PR #34 diff vs #33 is loading shells + dashboard streaming/cache only (44 files). No hospitality visual baseline edits.

---

## C / D. Measurements & loading experience

### Soft-nav click→feedback (local PR #34 :3457, RSC delayed ~900 ms, 3 runs × 6 routes)

| | |
| --- | ---: |
| Samples with visible loading | n=13 |
| Median click→loading UI | **1209 ms** (dominated by intentional RSC hold; proves shell renders) |
| Warm useful content (mixed) | median **260 ms** |

Evidence: `raw/pr34-acceptance-latest.json`, `screenshots/acceptance/soft-*-loading__desktop.png`

**Note:** Soft-nav feedback under real networks should be faster than the delayed-RSC lab hold. Do not equate to Sandbox cold medians.

### Dashboard (C2)

Functional (local): greeting, Lead Flow / Booked / Cash / Outstanding, Today’s Focus, Coming Up, View Reports, dismiss control, Coming Up → client nav, browser Back, streaming root, section order greeting→KPI→Focus→Coming Up, New Lead control — **PASS**.  
Progressive + loaded shots: `screenshots/acceptance/dashboard-pr34-*`.  
Sandbox serving reference (not identical SHA): `dashboard-sandbox-serving__*`.

Request `cache()`: header + focus share one `getDashboardData`; snapshot separately cached — no intentional double assembly.

---

## E–G. C1 prototype

See **`WAVE-C1-PROTOTYPE-RESULTS.md`** (on C1 branch).

Summary: Lead workspace; defer Documents + Luv drafts; Overview critical path omits those queries (unit-proven); first deferred tab ~1 s with pending; warm return ~60 ms; rapid switches ~65–82 ms.

---

## H. Regression

| Check | Result |
| --- | --- |
| PR #34 `npm run build` | SUCCESS |
| hospitality-route-loading + dashboard forensic tests | PASS |
| C1 `npm run build` | SUCCESS |
| C1 `wave-c1-deferral.test.ts` | PASS |
| Approved hospitality PNG baselines | Not mutated |

---

## I. Risks

- Soft-nav loading can be skipped when flights finish before paint (fast paths).  
- Dashboard progressive islands may briefly show KPI skeleton beside greeting.  
- C1 initial URL `#hash` should be covered by automated hydrate tests before rollout.  
- Claire records unsuitable for proposal→contract sales demo.

---

## J. Recommendation

| Item | Verdict |
| --- | --- |
| Ship Wave B + C2 (PR #34) after #33 Sandbox accept | **GO** for review (still no merge until you approve) |
| Extend C1 to all Lead tabs / Client EventDetail | **REVISE** — expand packs only after hydrate tests + Client design |
| Full C1 rewrite now | **STOP** |

---

## K. Release coordination

1. Accept/deploy **PR #33** to Sandbox (`main` only); verify SHA/digest; hospitality + floor-plan + reporting.  
2. Re-measure soft-nav + Dashboard on serving Sandbox.  
3. Merge **PR #34** (B+C2) onto post-#33 `main` (or rebased candidate).  
4. Review C1 prototype → optional follow-up PR after REVISE items.  
5. Wave D later.

**No merge. No deploy. Production / Stripe / demo data untouched.**
