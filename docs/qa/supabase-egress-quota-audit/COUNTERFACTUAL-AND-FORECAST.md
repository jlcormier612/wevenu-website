# Counterfactual usage & growth forecast

**Type:** Evidence-based reconstruction + provisional forecast. Distinguishes **observed facts**, **estimates**, **projections**, **assumptions**, **unknowns**.  
**Project:** Sandbox `wvpsldwwjqdannqasrdf`  
**Observation (UTC):** 2026-10-11T23:20Z  
**Sources:** Owner prior-cycle meters (`USAGE-FORENSICS.md`), Auth storm forensics (`ROOT-CAUSE-VERDICT.md`), ALB CloudWatch (this pass + prior), CRM/Auth re-verify this pass.  
**No invoice fabrication. No Spend Cap assumed.**

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
| AuthRetryable (this pass, 24h) | **0** | 2026-10-11 | n/a | CW Insights | HIGH |
| Last 7d ALB Sum (this pass) | ~200k (≈28.6k/day) | 2026-10-04→10 | n/a | CloudWatch | HIGH |

**Unknown:** exact billing cycle calendar dates; service-level ingest split; current-cycle GB after Pro; Spend Cap state; org multi-project share.

---

## 3. Attribution (qualitative + quantified where supported)

| Category | Role | Quantified evidence | Byte attribution |
|---|---|---|---|
| Auth 3× amp (pre-`efd12db6`) | Defect | Health alone ~8.6k/day × 3 Auth calls until Sept 28 deploy; storm day 10k+ AuthRetryable | **Not byte-split** |
| QA / automation / ALB | Abnormal vs paying customers | ~27k req/day sustained; peaks 40–52k | Dominant request volume — **HIGH** |
| Normal product activity | Present but minority of Sandbox | 65 venues / ~82 users / small tables | Intensity per venue **not** Production-proven |
| Background jobs | Ongoing | Scheduler `*/10` automations HTTP 200 post-fix | Modest vs ALB |
| CRM conflict hang | Log/latency amplifier when storming | 125s → ~80 ms after fix | Contributed when storming; **not** sole 290 GB proof |
| AWS ECS CloudWatch | Ruled out for Supabase ingest | ~0.058 GB / 30d | Not the meter |

---

## 4. Three scenarios

Pricing references (docs, not invoice): Pro egress included 250 GB then ~$0.09/GB; log ingest included 20 GB then ~$0.50/GB **after grace through start of 2027** (informational until then). Free allowances for incident comparison only.

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

1. Treat ALB ~27k/day as ~70–85% QA/engineering (assumption; health alone ≈31%).  
2. Auth amp removed ~⅔ of Auth network calls on matched traffic for ~17 pre-fix days of a ~30-day cycle (structural fact of 3×→1×).  
3. Log ingest correlates with platform Auth/API/Postgres activity under request volume (probable; service split unknown).  
4. Do **not** treat 1 AuthRetryable ≈ 1 billable egress byte.

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
| vs Pro included | Egress inside 250 | Log ingest **often above** 20 GB included | Cost/warning risk post-grace |
| Variable cost (illustrative post-grace, Spend Cap Off) | — | Logs: max(0, ingest−20)×$0.50 | Egress overage unlikely at <50 GB |

**Current-cycle meters still OPEN** — these are operational envelopes, not verified October current-cycle facts.

---

## 5. Growth forecast — 100 / 250 / 500 active venues

**Do not** scale 82 MAU linearly to venue count. Sandbox MAU includes engineers/QA fixtures.

### Measured Sandbox intensity (facts)

| Signal | Value |
|---|---|
| Venues | 65 |
| Clients / leads / events | 131 / 104 / 55 |
| Auth users | ~82 |
| ALB | ~27k req/day (mostly non-customer) |

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

| Active venues | Est. staff MAU | Est. portal MAU | Req/day (central) | Egress GB/mo (L/E/H) | Log ingest GB/mo (L/E/H) |
|---|---|---|---|---|---|
| 100 | ~300 | ~800 | ~18k | 8 / 20 / 45 | 25 / 70 / 160 |
| 250 | ~750 | ~2,000 | ~45k | 15 / 45 / 100 | 50 / 150 / 350 |
| 500 | ~1,500 | ~4,000 | ~90k | 25 / 80 / 180 | 80 / 280 / 650 |

**Interpretation:**

- Egress at 500 venues **expected** still inside Pro 250 GB if chatty defects stay fixed; **high** case approaches overage.  
- Log ingest at 250–500 venues **likely exceeds** 20 GB included once grace ends — primary cost/risk meter.  
- Model is **provisional** until Production (or Sandbox dogfood) exports daily egress + ingest for ≥14 days with known venue counts.

### Validation needed

1. Owner current-cycle meters (daily if possible).  
2. Service-level ingest split.  
3. Production ALB/Auth request rates per venue after launch.  
4. Spend Cap policy decision (restrict vs pay).

---

## 6. Answer to the counterfactual question

**Most likely without identified defects and abnormal testing:** egress on the order of **~5–8 GB/cycle** (possibly under Free’s 5 GB in the optimistic bound), and log ingestion still **tens to low hundreds of GB** under residual Sandbox engineering traffic — **far below** the observed **289.808 GB** if QA intensity and Auth amp are both removed, but **not** proven to fit Free’s 1 GB log allowance. Exact point estimates are **not supportable** without Usage-by-service; the tables above are the defensible bounds.
