# HTC launch performance remediation

**Status:** Wave B+C2 accepted on PR #34; C1 **optimize** on isolated branch — **no merge / no deploy**  
**Date:** 2026-11-12  

| Stream | Head | Notes |
| --- | --- | --- |
| PR #33 | `ee22f319` | Untouched |
| PR #34 | `6f5973e4` | Wave B + C2 + acceptance docs |
| C1 deferral prototype | `10429dc4` | Historical; modest Overview gain |
| **C1 optimize + hardening** | `perf/wave-c1-lead-hardening` (from optimize `c8b1305a`) | Meaningful Lead gains — see `WAVE-C1-OPTIMIZATION-RESULTS.md` |
| Sandbox serving | `df1aa331` | Unchanged |

---

## A. Executive summary

Deferral-only C1 moved wait onto Documents without removing the dominant Overview cost (**venue-wide contracts** + serial RSC waves). Optimize branch scopes contracts, parallelizes loads, prefetches deferred packs after paint, and adds immediate nav pending (~24 ms).

Local n=10 Overview useful median: **2337 → 1276 ms** vs PR #34; Documents first median restored to **~310 ms** (was ~1475 ms on deferral-only).

---

## Decision table

| Item | Verdict |
| --- | --- |
| PR #34 Wave B + C2 | **KEEP** (after #33 Sandbox accept) |
| C1 deferral-only as release | **REVERT** as sufficient fix |
| C1 optimize (scoped contracts + parallel + prefetch + nav pending) | **KEEP** pending review |
| Client EventDetail conversion | **REVISE** — design only (`WAVE-C1-CLIENT-WORKSPACE-DESIGN.md`) |

---

## Release coordination

1. Accept/deploy **PR #33** to Sandbox from `main` only.  
2. Re-measure soft-nav + Dashboard on serving Sandbox.  
3. Merge **PR #34**.  
4. Review/merge **C1 optimize + hardening** as follow-up (not folded into #33/#34 without coordination).  
5. Client conversion only after Lead KEEP approval.

**No merge. No deploy. Production / Stripe / demo data untouched.**

Full evidence: `WAVE-C1-OPTIMIZATION-RESULTS.md`, `WAVE-C1-PROTOTYPE-RESULTS.md`, `PERFORMANCE-CHANGE-MANIFEST.md`.
