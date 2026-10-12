# Counterfactual usage & growth forecast

**Type:** Evidence-based reconstruction + provisional forecast. Distinguishes **observed facts**, **estimates**, **projections**, **assumptions**, **unknowns**.  
**Project:** Sandbox `wvpsldwwjqdannqasrdf`  
**Observation (UTC):** 2026-10-12T02:28Z (capacity + alerting closure pass)  
**Sources:** Owner prior-cycle meters (`USAGE-FORENSICS.md`), Auth storm forensics (`ROOT-CAUSE-VERDICT.md`), ALB CloudWatch (7d Sum **201,462** ≈ **28.8k**/day), Auth/CRM re-verify, Resend `GET /usage` (API), service-role row counts, official Supabase pricing docs (2026-10-11).  
**No invoice fabrication. No Spend Cap assumed. No Management Usage API access. Current-cycle Supabase GB still owner-only. Resend limits/usage are API-verified.**

---

## 1. Two incidents (same project, related amplifiers)

| Incident | When | Primary signature | Cause class |
|---|---|---|---|
| **A — Auth amplification storm** | 2026-09-28 ~05:00–08:59 UTC | 10,278 `AuthRetryableFetchError`; 409 refresh races; 429 rate limits | App defect: 3× `auth.getUser` per matched request (incl. health) — fixed `efd12db6` |
| **B — Free egress Fair Use lockout** | 2026-10-11 ~18:38–18:58 UTC | HTTP 402 `exceed_egress_quota` | Prior-cycle egress **~14.777 GB** vs Free **5 GB**; cleared by owner **Pro** upgrade |

**Shared pattern:** Sandbox request intensity (QA + health + authenticated browsing) × chatty Auth/API/Postgres platform logging. Auth defect amplified (A) and contributed to cumulative cycle meters that tripped Free egress (B). CRM full-store conflict/`40001` hang was a **same-day reliability/log amplifier** (fixed `459d63fc` + migrations 145–148), not the named restriction string.

---

## 2. Observed incident meters (facts)

| Metric | Value | Period | Allowance then | Source | Confidence |
|---|---|---|---|---|---|
| Egress | **14.777 GB** | Previous cycle (owner Pro UI, Sandbox selected) | Free 5 GB / Pro 250 GB | Owner screenshot | HIGH |
| Cached egress | 1.208 GB | Previous cycle | Pro 250 GB cached | Owner | HIGH |
| Log ingestion | **289.808 GB** | Previous cycle | Free 1 GB / Pro 20 GB included | Owner | HIGH |
| Log query | **99.732 GB** | Previous cycle | Free 100 GB | Owner | HIGH |
| Storage | 0.041 GB | Previous cycle | — | Owner | HIGH |
| DB size | ~66–81 MB | Incident window | — | Privileged metrics / UI | HIGH–MED |
| MAU | 62–82 | Cycle / metrics | — | Owner / privileged | HIGH |
| ALB RequestCount | ~27k/day avg (~835k / ~30d) | ~2026-09-11→10-10 | n/a | CloudWatch | HIGH |
| AuthRetryable (Sept 28) | 10,278 | ~4h UTC | n/a | CW Insights | HIGH |
| AuthRetryable (closure pass, 24h) | **0** | 2026-10-11 | n/a | CloudWatch Sum | HIGH |
| Last 7d ALB Sum (closure) | ~201.5k (≈**28.8k**/day) | 2026-10-05→11 window | n/a | CloudWatch | HIGH |
| Auth users (admin count) | **114** | 2026-10-12 | n/a | Auth admin API | HIGH |
| Venues / clients / events | **108 / 131 / 55** | 2026-10-12 | n/a | REST count | HIGH |
| Resend daily / monthly | **33/100**, **2263/3000** | 2026-10-12 | Free-like | Resend `/usage` | HIGH |
| Current-cycle Supabase Usage GB | **UNKNOWN** | Current billing cycle | Pro allowances | Owner Dashboard / Mgmt PAT | — |
| Spend Cap | **UNKNOWN** | Current | On by default on Pro (docs) | Owner Cost Control | — |

**Unknown:** exact billing cycle calendar dates; service-level ingest split; current-cycle GB after Pro; Spend Cap state; org multi-project share.

---

## 3. Attribution (qualitative + quantified where supported)

| Category | Role | Quantified evidence | Byte attribution |
|---|---|---|---|
| Auth 3× amp (pre-`efd12db6`) | Confirmed defect | Health alone ~8.6k/day × 3 Auth calls until Sept 28 deploy; storm day 10k+ AuthRetryable | **Not byte-split** |
| QA / automation / ALB | Abnormal vs paying customers | ~27–28.7k req/day sustained; peaks 40–52k | Dominant request volume — **HIGH** |
| Normal product activity | Present but minority of Sandbox | 65 venues / ~82 users / small tables | Intensity per venue **not** Production-proven |
| Background jobs | Ongoing | Scheduler `*/10` automations HTTP 200 post-fix | Modest vs ALB |
| CRM conflict hang | Log/latency amplifier when storming | 125s → ~80 ms after fix | Contributed when storming; **not** sole 290 GB proof |
| Unattributed platform logging | Residual | Service split still missing | **HIGH uncertainty** on ingest |
| AWS ECS CloudWatch | Ruled out for Supabase ingest | ~0.058 GB / 30d | Not the meter |

---

## 4. Three scenarios

**Official Pro pricing (docs verified 2026-10-11):** base from $25/mo; egress 250/250 GB then $0.09/$0.03; log ingest **20 GB** then $0.50/GB; Spend Cap **default On** on Pro. Log-ingest overage billing subject to provider Fair Use / grace messaging — treat $0.50/GB as the published overage rate when Spend Cap is Off.

### A. Observed incident (facts)

| Dimension | Value |
|---|---|
| Egress | 14.777 GB |
| Log ingest | 289.808 GB |
| Log query | 99.732 GB |
| DB / storage | ~66 MB / 0.041 GB |
| Plan at outage | Free → restricted on egress |
| Charges | **Unverified** (no invoice in evidence). Restriction was Fair Use, not a recorded overage line item here. |

### B. Reconstructed normal baseline (estimate — bounds)

**Question:** What would usage most likely have been without the Auth amplification defect and without abnormal Sandbox QA intensity?

**Method (transparent):**

1. Treat ALB ~28k/day as ~70–85% QA/engineering (assumption; health alone ≈31%).  
2. Auth amp removed ~⅔ of Auth network calls on matched traffic for ~17 pre-fix days of a ~30-day cycle (structural fact of 3×→1×).  
3. Log ingest correlates with platform Auth/API/Postgres activity under request volume (probable; service split unknown).  
4. Do **not** treat 1 AuthRetryable ≈ 1 billable egress byte.  
5. Closure pass did **not** obtain Usage-by-service — **do not tighten** central log bounds beyond prior defensibility.

| Dimension | Low (optimistic) | Expected (central) | High (pessimistic) | Uncertainty |
|---|---|---|---|---|
| Egress GB / cycle | **3–5** | **5–8** | **8–12** | MEDIUM — may have stayed under Free 5 GB in low case |
| Log ingest GB / cycle | **40–80** | **80–140** | **140–200** | **HIGH** — no service split; wide bounds required |
| Log query GB | Scales with ingest exploration | — | Near Free 100 GB historically was explorer/query load | HIGH |
| DB / storage | ~same (~66 MB / 0.04 GB) | same | same | LOW change |
| Applicable plan | Free *might* have held on egress in low case; log ingest still ≫ Free 1 GB | Pro still justified for log/API headroom | Pro | — |

**Point estimate not claimed** for log ingest: missing Usage-by-service. Central egress ~6 GB is a **reconstructed estimate**, not a meter.

### C. Conservative operational scenario (post-fix, routine QA)

Assumes: tip includes Auth+CRM fixes; ALB continues ~15–30k/day Sandbox QA; Pro plan; Spend Cap **unknown**.

| Dimension | Low | Expected | High |
|---|---|---|---|
| Egress GB / month | 4 | 10–20 | 40 |
| Log ingest GB / month | 30 | 60–120 | 200 |
| vs Pro included | Egress inside 250 | Log ingest **often above** 20 GB included | Cost/warning risk when overages bill or Spend Cap On |
| Variable cost (illustrative, Spend Cap Off) | — | Logs: max(0, ingest−20)×$0.50 | Egress overage unlikely at <50 GB |

**Current-cycle meters still OPEN** — these are operational envelopes, not verified October current-cycle facts.

---

## 5. Growth forecast — 100 / 250 / 500 active venues

**Do not** scale 82 MAU linearly to venue count. Sandbox MAU includes engineers/QA fixtures.

### Measured Sandbox intensity (facts)

| Signal | Value |
|---|---|
| Venues | **108** (was 65 in earlier forensics — fixture growth) |
| Clients / leads / events | 131 / 108 / 55 |
| Auth users | **114** |
| ALB | ~28.8k req/day last 7d (mostly non-customer) |
| Resend | Free-like **100/day**, **3000/month**; monthly **75%** used |

### Assumptions (labeled)

| Assumption | Value | Kind |
|---|---|---|
| Staff seats / venue | 2–4 (central 3) | Assumption |
| Active booked clients / venue | 5–15 (central 8) | Assumption |
| Portal opens / client / month | 2–10 | Assumption |
| API+Auth requests / venue / day (healthy product) | 80–400 (central 180) | Provisional — needs Production telemetry |
| QA overhead in Production | Near-zero vs Sandbox | Assumption |
| Log GB ≈ k × request volume | k calibrated loosely from Sandbox post-fix envelopes | **Weak** until meters exist |

### Request & usage projection (central)

| Active venues | Est. staff MAU | Est. portal MAU | Req/day (central) | Egress GB/mo (L/E/H) | Log ingest GB/mo (L/E/H) | Central logs overage $ (Spend Cap Off) |
|---|---|---|---|---|---|---|
| 100 | ~300 | ~800 | ~18k | 8 / 20 / 45 | 25 / 70 / 160 | ≈ (70−20)×$0.50 ≈ **$25**/mo |
| 250 | ~750 | ~2,000 | ~45k | 15 / 45 / 100 | 50 / 150 / 350 | ≈ **$65**/mo |
| 500 | ~1,500 | ~4,000 | ~90k | 25 / 80 / 180 | 80 / 280 / 650 | ≈ **$130**/mo; egress usually ≤250 |

**Interpretation:**

- Egress at 500 venues **expected** still inside Pro 250 GB if chatty defects stay fixed; **high** case approaches overage.  
- Log ingest at 250–500 venues **likely exceeds** 20 GB included — **first bottleneck**.  
- If old ~290 GB ingest recurred: ≈ (290−20)×$0.50 ≈ **~$135**/cycle logs alone (Spend Cap Off), or Fair Use restriction risk if Spend Cap On.  
- Model is **provisional** until current-cycle meters + ≥14 days Production (or Sandbox dogfood) daily egress/ingest with known venue counts.

### Pro sufficiency answers

| Question | Answer | Confidence |
|---|---|---|
| Is Pro a reasonable starting plan? | **YES** for egress/DB/MAU at measured Sandbox scale | MEDIUM |
| Supports 100 / 250 / 500? | **100:** plausible; **250–500:** expect log overage or Spend Cap pressure | LOW–MEDIUM (absolute GB) |
| First Supabase bottleneck | **Logs Ingest (20 GB)** | HIGH (shape) |
| First email bottleneck (current Resend allowances) | **Monthly 3000** (already 75% in Sandbox QA month) | HIGH |
| Review trigger | Current-cycle ingest **>15 GB** or +20% WoW; egress **>100 GB**; Fair Use email; Auth/CRM alarms; Resend monthly ≥70% | — |
| Conditional on owner evidence? | **YES** for Supabase cost GREEN — Spend Cap + current-cycle GB | — |

### Resend send-volume sketch (assumption-labeled)

Assumes ~8–20 transactional emails / active venue / month (central **12**) for bookings, tours, contracts — **not** measured Production.

| Active venues | Central emails/mo | vs 3000 Free-like | Confidence |
|---|---|---|---|
| 100 | ~1,200 | Inside | LOW |
| 250 | ~3,000 | At ceiling | LOW |
| 500 | ~6,000 | **Exceeds** — needs higher plan (authorization required) | LOW |

---

## 6. Answer to the counterfactual question

**Most likely without identified defects and abnormal testing:** egress on the order of **~5–8 GB/cycle** (possibly under Free’s 5 GB in the optimistic bound), and log ingestion still **tens to low hundreds of GB** under residual Sandbox engineering traffic — **far below** the observed **289.808 GB** if QA intensity and Auth amp are both removed, but **not** proven to fit Free’s 1 GB log allowance. Exact point estimates are **not supportable** without Usage-by-service; the tables above are the defensible bounds.

**Minimum additional measurement:** owner Usage-by-service for the ~289.8 GB prior cycle (`OWNER-EVIDENCE-CHECKLIST.md` B9) plus current-cycle B3–B6.
