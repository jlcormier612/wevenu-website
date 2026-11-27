# Performance testing & reporting accountability

**STOP FOR FOUNDER REVIEW**  
**Scope:** Reconcile Report 1 vs Report 2. No application changes. No Dashboard/Task Center changes. No harness changes. No infrastructure changes. No commits/merges/deploys. Production untouched.

**SHA under discussion (unchanged between reports):** `154301bb761f359833d91f3e88b4c51f81ae9a20`

---

## What the two reports actually were

| | Report 1 (promotion gate) | Report 2 (discrepancy forensic) |
|---|---|---|
| Written | `FOUNDER-REPORT.md` (~17:59Z / chat closeout) | `DISCREPANCY-FORENSIC.md` (~21:19Z) |
| Primary artifact | `fancy-forced-warm-nav.json` | `heading-vs-useful80.json` (+ `discrepancy-timing-probe.json`) |
| Protocol | Full primary sidebar, **5 warm cycles**, Fancy + `set_active_venue` | **Only** Dashboard / Task Center / Reports; hop from Leads; multi-metric timers |
| Scoreboard metric used in prose | harness **useful80** median vs Nov 21 table | Mixed: useful80 **and** heading / app-overlay-clear; narrative reframed |
| Verdict language | Material regressions; Prod promotion **NOT GREEN** | “Overstated”; loaders unchanged; TC ~608 ms |

**Critical accountability point:** Report 2 was **not** a second full-suite acceptance remasure. It was a **diagnostic** re-instrumentation on a subset of pages. Treating Report 2’s Task Center ~608 ms as if it replaced Report 1’s 1383 ms acceptance median without disclosing protocol change was incorrect reporting.

The approved Dashboard header removal is **not** a defect and is **not** proposed for restore. It is cited only where it affects **baseline comparability** of the Nov 21 Dashboard number.

---

## 1. Why Task Center measured 1383 ms then ~608 ms

Both numbers are **real useful80 samples** on the same SHA. They are **not** the same test.

### Report 1 — Task Center useful80 (full-suite)

Samples (ms): **1386, 1417, 779, 664, 1383**  
Median: **1383** · Max: **1417** · pathMedianMs: **408** · blank: **0**  
Snippet at useful: includes **“57 team items need attention…”** (body island content)

Distribution is **bimodal**: three samples ~1.38–1.42 s, two samples ~0.66–0.78 s. Median falls in the slow cluster.

### Report 2 — Task Center useful80 (isolated diagnostic)

Samples (ms): **796, 789, 607, 595, 608**  
Median: **608**

Same run also recorded **heading / app overlay-clear**: **318, 472, 312, 300, 314** → median **314** (not what Report 1 reported).

### Why useful80 differed between runs (same definition, different procedure/load)

| Factor | Report 1 | Report 2 |
|---|---|---|
| Pages exercised per session | **20 labels × 5 cycles ≈ 100 hops** before/around each TC sample | **3 labels × 5 hops**; TC always from Leads |
| Competing RSC / prefetch | Full-suite walk continuously primes Link prefetch / in-page `_rsc` (observed storms in later probes) | Far less concurrent navigation load |
| From-route | Prior sidebar neighbor in fixed order (Payments → Task Center → Requests…) | Always **Leads → Task Center** |
| Clock time | ~17:59Z | ~21:19Z |
| Metric | useful80 only | useful80 + heading (Report 2 prose emphasized favorable framing) |

**Conclusion for Q1:** 1383 vs 608 is **run-to-run variance under different session load/protocol**, not an intervening app change, and not solely “heading vs useful80.” Report 2’s **608** is useful80 under a lighter protocol; Report 1’s **1383** is useful80 under the full-suite protocol that matches the Nov 21 harness shape more closely.

Also: Report 2 Dashboard useful80 median was **1437** vs Report 1’s **1155** — Report 2 was **not** uniformly more favorable. Selective emphasis on Task Center 608 without that disclosure was a reporting failure.

---

## 2. Exact conditions / definitions / procedures that changed

| Dimension | Report 1 | Report 2 | Changed? |
|---|---|---|---|
| Deployed SHA | `154301bb…` | `154301bb…` | No |
| Venue | Fancy + `set_active_venue` | Fancy + `set_active_venue` | No |
| Viewport | 1400×900 | 1400×900 | No |
| useful80 definition | path match + `slotTextLen >= 80` + overlay gone | same for useful80 channel | No (for that channel) |
| **Additional metrics** | none | headingMs, appOverlayClearMs | **Yes — Report 2 added** |
| **Page coverage** | all Nov 21 primary nav labels | Dashboard, Task Center, Reports only | **Yes** |
| **Warm protocol** | full sidebar cycles (n=5) | isolated Leads→page hops (n=5) | **Yes** |
| **Verdict basis** | useful80 vs hist + invented materiality heuristic | reinterpretation + code archaeology | **Yes** |
| Harness product code | not modified | not modified | No |
| Application code | not modified | not modified | No |

Report 2 also introduced **explanatory** claims (header removal, loaders unchanged). Those can be true as engineering facts while still **not reconciling** why two useful80 medians disagree.

---

## 3. Raw samples — both runs — reconcile

### A. Report 1 full suite (`fancy-forced-warm-nav.json`, 2026-11-27T17:59:48Z)

Definition: **useful80**, Fancy-forced, warm cycles=5, blank median=0 all rows.

| Page | Hist | Samples (ms) | Median | Max | Δ vs hist |
|---|---:|---|---:|---:|---:|
| Reports | 295 | 300, 402, 299, 315, 318 | **315** | 402 | +20 (+7%) |
| Setup | 302 | 624, 409, 775, 349, 498 | **498** | 775 | +196 (+65%) |
| Vendors | 308 | 347, 362, 371, 407, **883** | **371** | 883 | +63 (+20%) |
| Dashboard | 345 | **1816**, 1155, 1115, 1210, 1112 | **1155** | 1816 | +810 (+235%) |
| Clients | 347 | 562, 374, 399, 407, 403 | **403** | 562 | +56 (+16%) |
| Leads | 349 | 513, 589, 318, 408, 369 | **408** | 589 | +59 (+17%) |
| Automations | 386 | 387, 439, 344, 341, 348 | **348** | 439 | −38 (−10%) |
| Payments | 415 | 418, 574, 562, **2222**, 594 | **574** | 2222 | +159 (+38%) |
| Templates | 522 | 360, 355, 342, 298, 310 | **342** | 360 | −180 (−34%) |
| Tours | 577 | 620, 577, 795, 771, 602 | **620** | 795 | +43 (+7%) |
| Documents | 607 | 399, 449, **982**, 516, 625 | **516** | 982 | −91 (−15%) |
| Settings | 620 | 853, 671, 676, 626, **1112** | **676** | 1112 | +56 (+9%) |
| Calendar | 626 | 939, 943, 615, 721, 569 | **721** | 943 | +95 (+15%) |
| Inbox | 654 | **1080**, 835, 640, 709, 672 | **709** | 1080 | +55 (+8%) |
| Task Center | 663 | **1386, 1417**, 779, 664, **1383** | **1383** | 1417 | +720 (+109%) |
| Contracts | 766 | 662, 729, 666, 627, 664 | **664** | 729 | −102 (−13%) |

**Outliers disclosed (Report 1):** Payments **2222**; Vendors **883**; Documents **982**; Settings **1112**; Inbox **1080**; Dashboard **1816**; Task Center cluster **~1400**.

### B. Report 2 diagnostic (`heading-vs-useful80.json`, 2026-11-27T21:19:07Z)

| Page | heading samples | heading med | useful80 samples | useful80 med |
|---|---|---:|---|---:|
| Dashboard | 1203, 1840, 1992, 1226, 1437 | **1437** | same | **1437** |
| Task Center | 318, 472, 312, 300, 314 | **314** | 796, 789, 607, 595, 608 | **608** |
| Reports | 318, **11213**, 353, 599, 751 | **599** | same | **599** |

**Outlier disclosed (Report 2):** Reports **11213 ms** (kept in median calculation → pulls median up).

### C. Reconciliation (not erasure)

- **Task Center useful80:** Report 1 median 1383 ≠ Report 2 median 608 → **unreproduced** under full-suite vs isolated protocol. Both retained.  
- **Task Center heading:** only measured in Report 2 (~314). Cannot rewrite Report 1’s 1383 as if it were heading.  
- **Dashboard useful80:** Report 1 1155; Report 2 1437 → still elevated vs hist 345 on **both** runs; Report 2 does not exonerate Dashboard useful80.  
- **Reports useful80:** Report 1 tight ~300 ms; Report 2 median 599 with an 11.2 s disaster sample → shows **acceptance fragility** under contention.

---

## 4. Why equivalence/reproducibility were not established before “material regression”

This was a process failure:

1. Declared **material application regressions** and **NOT GREEN** from a **single** full-suite run.  
2. Invented a materiality heuristic (>150 ms and >25%) without a locked threshold doc.  
3. Did not freeze and publish: definition (heading vs useful80), from-route, cycle structure, outlier policy.  
4. Did not require a **second independent full-suite** remasure before promotion-blocking language.  
5. Did not first prove Dashboard Nov 21 baseline remained comparable after the **approved** header removal (comparability question ≠ defect).  
6. Report 2 then **changed protocol and metrics** and used that to soften Report 1 — without labeling Report 2 as non-acceptance.

That sequence is why the two reports conflict in founder-facing language.

---

## 5. Why historical evidence was “unrecoverable” then “recovered”

| Attempt | What was searched | Result |
|---|---|---|
| Gate start | `~/Desktop/HTC-NAV-SPEED-SANDBOX/SANDBOX-REMEASURE.md`, Trash, this worktree docs | **Missing** on Desktop (folder later recreated empty/partial by client-open harness) |
| Gate Report 1 | Same + limited transcript grep in **this** worktree chat | Used founder-pasted Nov 21 table; stated Desktop file unavailable — **accurate at that time for Desktop** |
| Later forensic | Broader search across **other** Cursor project transcripts (`…/wevenu-website/agent-transcripts/ffdcfbf6-…`) | Found the agent turn that **wrote** the original `SANDBOX-REMEASURE.md` (post #127 / `99251794`) |

Recovery path: **transcript archaeology**, not Desktop restore. Numbers match the founder table. Saying “unrecoverable” without exhausting other project transcripts was incomplete diligence; recovering later without clearly saying “found in another chat transcript” looked like contradiction.

Copied recovery: `BATCH1-PERF-GATE/recovered-nov21/SANDBOX-REMEASURE.md`.

---

## 6. What evidence establishes which report matches customer experience?

**Neither report alone is a finished, trustworthy acceptance verdict.**

| Customer-experience question | Best available evidence | Limitation |
|---|---|---|
| Soft-nav “module identity” (heading / overlay clear) | Report 2 heading channel; app `mainHasUsableContent` | Not what Report 1 scored; not locked as scoreboard |
| Soft-nav harness useful80 (hist table method) | **Report 1 full suite** is the only complete like-protocol dataset on `154301bb` | Single run; high variance; TC/Payments/Dashboard sensitive to outliers/load |
| “Is the app’s optimized loader code changed?” | Git diff since remasure tip | True but **does not** settle which median customers feel |
| Approved Dashboard header | Founder-approved; current UI | Nov 21 Dashboard 345 ms is **not like-for-like** useful80 vs today’s Dashboard shell |

**Honest status:** Customer experience on this SHA is **not yet established to acceptance grade**. We have one full-suite useful80 snapshot with real unfavorable samples, plus diagnostics showing definition sensitivity and session-load sensitivity.

---

## 7. Setup, Payments, and all remaining nav — reconciled (no cherry-pick)

Using **Report 1** as the only full-suite scoreboard run (disclose outliers). Report 2 did **not** remeasure these pages (except Reports).

| Page | Hist | Report 1 median | vs hist | Outliers in samples | Report 2 | Assessment |
|---|---:|---:|---|---|---|---|
| Reports | 295 | 315 | ~flat | none in R1; R2 had **11213** | useful80 med 599 | R1 OK; R2 shows contention risk |
| Setup | 302 | **498** | elevated | 775 | not remeasured | Elevated on R1; #205 ensure on Setup is a **possible** contributor — not proven root cause; **no fix authorized** |
| Vendors | 308 | 371 | mild | **883** | — | Median OK-ish; outlier disclosed |
| Dashboard | 345 | **1155** | large | **1816** | useful80 **1437** | Elevated on **both** useful80 runs; hist not like-for-like after approved header removal; **not** authorized as header restore |
| Clients | 347 | 403 | mild | — | — | Within noise band for single run |
| Leads | 349 | 408 | mild | — | — | Within noise band |
| Automations | 386 | 348 | improved | — | — | OK |
| Payments | 415 | **574** | elevated | **2222** | — | Median up; one severe outlier; unreproduced |
| Templates | 522 | 342 | improved | — | probe ~362–786 | OK / improved |
| Tours | 577 | 620 | mild | — | — | Mild |
| Documents | 607 | 516 | improved | **982** | — | OK; outlier disclosed |
| Settings | 620 | 676 | mild | **1112** | — | Mild; outlier |
| Calendar | 626 | 721 | mild | 939/943 | — | Mild high |
| Inbox | 654 | 709 | mild | **1080** | — | Mild; outlier |
| Task Center | 663 | **1383** | large on R1 | ~1400 cluster | useful80 **608**; heading **314** | **Unresolved useful80 reproducibility**; do not collapse to 608 for acceptance |
| Contracts | 766 | 664 | improved | — | — | OK |

**Do not** promote “Task Center is fine at 608” as the acceptance truth while ignoring Report 1’s full-suite samples. **Do not** treat Setup/Payments elevations as closed because Dashboard/TC narrative changed.

---

## 8. How subsequent performance acceptance can be trusted

Minimum bar before any GREEN / NOT GREEN promotion language:

1. **Lock one scoreboard definition in writing** (founder):  
   - (A) harness useful80 as Nov 21 table, **or**  
   - (B) heading / app overlay-clear, **or**  
   - (C) both reported always, with promotion gated on the locked one.  
2. **Lock protocol:** Fancy + `set_active_venue`, viewport, warm cycles, full sidebar order, from-route rules, sample count.  
3. **Lock baseline comparability notes:** Dashboard post–approved-header-removal is not comparable to Nov 21 Dashboard 345 useful80 without an explicit founder waiver/rebaseline.  
4. **Two independent full-suite runs** on the same SHA; publish **all raw samples**; no discarding outliers.  
5. **Reproducibility gate:** if page median moves >X% between the two runs, status = **UNRESOLVED**, not GREEN/RED application verdict.  
6. **Separate** engineering explanation (git/data/env) from acceptance verdict.  
7. **No mid-gate metric switching** without labeling the new run non-acceptance.  
8. Historical artifacts: search Desktop **and** cross-project transcripts before “unrecoverable.”

Until that bar is met, the correct promotion performance status is:

### **UNRESOLVED — testing/reporting not acceptance-grade**

Not GREEN. Not a proven loader regression authorization. Not a license to optimize Dashboard/Task Center.

---

## Direct answers (short)

1. **1383 vs 608:** both useful80; different session protocol/load; R1 bimodal slow cluster; R2 lighter isolated hops — not an app change between reports.  
2. **What changed:** coverage, from-route, metrics reported, verdict framing — not SHA/app/harness file.  
3. **Raw samples:** §3 above; all retained.  
4. **Why early regression call:** single run + heuristic + no equivalence lock — process error.  
5. **Historical file:** missing on Desktop; later found in another project’s agent transcript.  
6. **Which is customer truth:** neither alone; R1 is the only full-suite useful80 dataset; R2 is diagnostic; acceptance still UNRESOLVED.  
7. **All pages:** §7 table; Setup/Payments remain elevated on R1; TC unreproduced; Dashboard elevated on both useful80 runs with baseline caveats.  
8. **Trust:** only after locked definition + dual full-suite reproducible runs with full sample disclosure.

---

**Production:** untouched (`a1543e26…`).  
**No** app/harness/infra/commits/deploys in this response.
