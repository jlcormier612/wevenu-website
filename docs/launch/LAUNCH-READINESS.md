# Hello to Cheers — Launch Readiness Register

**Authoritative prelaunch register.**  
**Created:** 2026-11-18  
**Last updated:** 2026-11-19 (TS-001 GREEN/CLOSED on `main` via PR #103; docs-only required-check gate in flight; PR #102 pending that gate; NAV-PERF OPEN)  
**Sandbox serving SHA (verified):** `c1b993f6c6842bbda0f3c71ae6162eca53f9aa32` *(register row pending PR #102 docs refresh; `origin/main` tip includes TS-001 `e2389504` — re-verify ECS before next Sandbox claim)*  
**Rollback target:** ECS `htc-sandbox-venue-app:1231` / image `c1b993f6…`  
**Active workstream:** NAV-PERF (primary)  
**Production:** unauthorized — no Production customers, payments, or deploy.

This file is the permanent Launch Readiness Register for coordinated prelaunch.  
Historical trackers (`docs/launch/MASTER-READINESS-TRACKER.md`, older release-readiness docs) remain archival; **do not treat them as current status** without cross-checking evidence here.

---

## 1. Overall launch readiness summary

| Dimension | Status |
|-----------|--------|
| Sandbox product surface (onboarding, Practice Run, migration, portals, contracts/payments, reporting, Luv lifecycle/privacy/redundancy, messaging safeguards, approved marketing) | **Substantial Sandbox acceptance** — see §2 |
| Venue navigation performance | **ACTIVE** — Wave 6 on Sandbox `c1b993f6`; warm TTFB med **786** / p90 **1422**; Focus med **2377**; NAV-PERF OPEN (P1) |
| Production infrastructure / live Stripe / legal / ops | **OPEN** — Production gates not satisfied |
| Overall Production launch | **NOT READY** — Sandbox ≠ Production |

**Sandbox acceptance ≠ Production readiness.** GREEN rows below mean Sandbox (or documented local+DB) acceptance with evidence. They do **not** authorize Production.

---

## 2. Completed / accepted workstreams (Sandbox)

Preserve GREEN/CLOSED unless new regression evidence appears.

| ID | Workstream | Status | Environment | Evidence (summary) |
|----|------------|--------|-------------|-------------------|
| MS-B1…B3 / MS-INT | Bring Your Business import/migration | GREEN (Sandbox) | Sandbox on integrated release | MASTER tracker MS-B*/MS-INT; PR #78 / `deffb7d6` family; Willow smoke |
| MS-RPT | Reporting integrity | GREEN (Sandbox) | Sandbox | `~/Desktop/HTC-MS-RPT-acceptance/`; founder accepted 2026-11-17 |
| MS-C | Contract → booking → payment (historical import + native partials) | GREEN (Sandbox) | Sandbox | `~/Desktop/HTC-Phase-C-acceptance/`; founder accepted |
| MS-D | Planning materials import | GREEN (Sandbox) | Sandbox | `~/Desktop/HTC-Phase-D-acceptance/`; founder accepted |
| PM-01…PM-05 / ONB-FINAL | Onboarding / Setup Hub / Practice Run | GREEN (Sandbox) | Sandbox | `docs/qa/onboarding/onb-final/`; `~/Desktop/HTC-ONB-FINAL/`; PRs #80–#82 |
| LUV-FINAL | Luv lifecycle safety, Ask privacy, draft redundancy CTA | GREEN (Sandbox) | Sandbox `4787fbab` | PR #90/#91; lifecycle closure 2026-11-18; `~/Desktop/HTC-LUV-FINAL-PR91-ACCEPTANCE/`; unit matrix + live gates |
| PORTALS | Client and vendor portal (core) | GREEN (Sandbox) | Sandbox | Prior portal/vendor hospitality + Practice client portal evidence (ONB/PM); keep closed unless regression |
| REPORT-SUB | Reporting + SaaS subscription lifecycle (Test) | CONDITIONAL → Sandbox/Test | Sandbox / Stripe Test | Reporting GREEN via MS-RPT; SaaS Test WG checkout pass 2026-11-10 — **live Production Stripe not done** (see STRIPE-LIVE) |
| COMMS-SAFE | Communications / messaging safeguards | GREEN (Sandbox) with follow-ups | Sandbox | Luv never-sends + redundancy + A2P work landed in Sandbox; TWILIO-A2P / RESEND-SCALE remain for scale/identity |
| MKT-PAGES | Approved marketing website pages | GREEN (Sandbox marketing) | Sandbox marketing | Prior Getting Started / hospitality marketing acceptances; Production marketing cutover = LAUNCH-FINAL |

**Classification notes**

- LUV-FINAL Sandbox lifecycle/privacy/redundancy: founder-accepted on `4787fbab`. Residual **LUV-CONSENT** (consent at draft eligibility loader) is a separate non-blocking follow-up — not a reopen of LUV-FINAL.
- REPORT-SUB: do not mark Production subscription lifecycle GREEN.
- Do not invent GREEN for areas without acceptance evidence.

---

## 3. Remaining launch blockers & prelaunch follow-ups

### Priority definitions

- **P0:** Must resolve before accepting live customers or payments.
- **P1:** Must resolve before launch unless founder explicitly accepts a documented exception.
- **P2:** Can defer without compromising safety or core customer experience.

### Outstanding register

| ID | Description | Priority | Status | Owner | Acceptance criteria | Evidence / reference | Dependency |
|----|-------------|----------|--------|-------|---------------------|----------------------|------------|
| **NAV-PERF** | Venue navigation performance — required for launch acceptance | P1 | **OPEN** (Wave 6 on Sandbox; launch bar not yet met; Wave 5 not released) | Engineering | Founder-accepted launch feel after real-content remasure. Keep OPEN until accepted | Wave 6 PR [#98](https://github.com/jlcormier612/wevenu-website/pull/98) merge `c1b993f6`; deploy [44456487512](https://github.com/jlcormier612/wevenu-website/actions/runs/44456487512); image `htc-sandbox-venue-app:c1b993f6…` task `:1231`. Fancy remasure: warm TTFB med **786** / p90 **1422** (0× ≥3 s this window); Focus med **2377**; layout wall med **247** (CW, parallel mode). Functional PASS (Fancy venue, unauth→login, OpenAI 0). Wave 4 p90 class not reproduced here; Focus not at Wave 2/3 launch feel. Remaining: Focus/gates, booking SSR, ECS CPU amplifier. Evidence `docs/qa/launch-performance/nav-perf-wave6/AFTER-DEPLOY-REPORT.md`; Desktop `~/Desktop/HTC-NAV-PERF-WAVE6-AFTER/`. | None — **ACTIVE** |
| **LUV-CONSENT** | Channel consent not loaded into draft eligibility (`channelConsentOk` defaults true); send path intended to recheck | P1 | OPEN | Engineering | Draft eligibility + accept/send boundary use authoritative consent; unit + Sandbox proof; no paid AI | Lifecycle closure 2026-11-18; `relationship-lifecycle-loader.ts` | After NAV-PERF unless founder reprioritizes |
| **JOURNEY-FINAL** | Full new-venue Sandbox customer journey (provision → setup → book → portal → payments Test) | P1 | OPEN | Joint | Disposable-venue E2E harness PASS on current Sandbox tip; evidence package | MASTER JOURNEY-FINAL; ONB-FINAL closed | Prefer after NAV-PERF |
| **TS-001** | TypeScript baseline / typecheck debt | P1 | **GREEN/CLOSED** | Engineering | Venue/marketing/workspace `tsc --noEmit` exit 0 in CI without weakening `strict`; fail-closed PR gate | PR [#103](https://github.com/jlcormier612/wevenu-website/pull/103) merge `e2389504`. Venue **109→0**; marketing/workspace **0**. GitHub: `TypeScript check (tsc --noEmit)` SUCCESS then `next build` SUCCESS ([run 44474851778](https://github.com/jlcormier612/wevenu-website/actions/runs/44474851778)); hospitality checks SUCCESS. Evidence `docs/qa/ts-001/`; Desktop `~/Desktop/HTC-TS-001/`. | Closed |
| **TWILIO-A2P** | Legitimate venue identity + SMS A2P readiness for production messaging | P0 | OPEN | Joint | Approved A2P identity path; Sandbox/Prod config checklist; no unauthorized sends | A2P workstreams / prior Twilio PRs | Before live SMS |
| **RESEND-SCALE** | Email rate limits, retries, growth readiness | P1 | OPEN | Engineering | Documented limits/retries; failure modes safe; scale checklist | Prior Resend/retry work; email readiness docs | Before high-volume send |
| **PROD-INFRA** | Production app infrastructure and configuration | P0 | OPEN | Joint | Prod stack, secrets, env parity checklist complete; dry-run approved | AWS/GitHub deploy docs; marketing Production preflight CONDITIONAL | Before any Prod deploy |
| **STRIPE-LIVE** | Live SaaS checkout, webhooks, provisioning, subscription lifecycle | P0 | OPEN | Joint | Live-mode checkout + webhook + venue provision proven; Test evidence not sufficient alone | `docs/stripe-saas-subscription-provisioning.md`; WG Test pass ≠ Live | PROD-INFRA |
| **LEGAL-FINAL** | Entity info, Privacy, Terms, Vendor Services Agreement, Cookie Policy/preferences, AI + Stripe disclosures, retention/deletion | P0 | OPEN | Founder (+ Eng for wiring) | Counsel/founder-approved copy live on marketing + in-app where required | Legal register / marketing legal pages | Before live customers |
| **OPS-FINAL** | Monitoring, recovery, support, security/ops readiness | P0 | OPEN | Joint | Runbooks, alerts, backup/restore, support path documented and exercised | Ops/readiness docs | Before launch |
| **LAUNCH-FINAL** | End-to-end Production launch acceptance + marketing checkout cutover | — (umbrella gate) | OPEN | Joint | Founder-signed launch gate; marketing→live checkout; Production smoke PASS. Not a sixth independent P0 — rolls up the five P0s + required P1s | This register §6 | All P0s + NAV-PERF (+ other required P1s) |

### Non-blocking post-launch / deferred (P2 examples)

| ID | Description | Priority | Status | Owner | Notes |
|----|-------------|----------|--------|-------|-------|
| **LUV-PLAN-INTEL** | Richer post-booking planning intelligence (beyond safety gates) | P2 | DEFERRED | Engineering | Explicitly non-blocking after LUV-FINAL safety GREEN |
| **MKT-SCREENSHOTS** | Marketing screenshots of verified setup/migration/practice | P2 | OPEN | Joint | After JOURNEY-FINAL claims are frozen |
| **PERF-WAVE-LEGACY** | Historical C1 Lead optimize branches | P2 | DEFERRED | Engineering | Prior `docs/qa/launch-performance/*`; re-evaluate only under NAV-PERF |
| **TEST-STALE-TIMELINE-EMPTY** | Source contract looked for wrong empty-branch end marker (`itemCount={totalCount}` vs actual `itemCount={0}`) | P2 | **GREEN/CLOSED** | Engineering | Product empty state has Add First Entry + one TemplatePicker; Sandbox verified | `docs/qa/prelaunch-known-failures/`; Desktop `~/Desktop/HTC-PRELAUNCH-KNOWN-FAILURES/`; fix branch `fix/prelaunch-known-test-failures` | Not Wave 7A; not launch-blocking |
| **TEST-STALE-Q-TAB** | `booking-assignment` expected Questionnaires `TabsTrigger` on first TabsList; P2-A moved Q to Overview card + hash TabsContent | P2 | **GREEN/CLOSED** | Engineering | Questionnaires reachable via card; assignment/completion rules unchanged; Sandbox verified | Same evidence pack; aligned with `workspace-tab-nav-p2a.test.ts` | Not Wave 7A; not launch-blocking |
| **TEST-STALE-TAB-LUV** | `booked-workspace-tabs-luv` still asserted pre-P2-A 7×7 tab grid incl. questionnaires/inventory/event-order | P2 | **GREEN/CLOSED** | Engineering | Adjacent stale contract; updated to P2-A 5+6 rows; Luv remains on row 2 | Same pack | Discovered while triaging TEST-STALE-Q-TAB |
| **TEST-STALE-SETUP-COPY** | P2-A setup copy still required “Inventory & Event Order card”; product says “Celebration summary card” | P2 | **GREEN/CLOSED** | Engineering | Copy-only stale assertion; no product change | Same pack | Adjacent |
| **TEST-STALE-LEAD-LUV-ASSERT** | Lead Luv check required single-line `TabsTrigger value="luv"`; JSX is multiline | P2 | **GREEN/CLOSED** | Engineering | Lead Luv tab still present; assertion fixed | Same pack | Adjacent |

---

## 4. Current active workstream

**NAV-PERF — Venue navigation performance (P1, required for launch)**  
Wave 5 **not released**. Wave 6 layout first-byte + bootstrap parallelization **serving on Sandbox** `c1b993f6`. Remasure: warm TTFB med 786 / p90 1422; Focus med 2377 — launch bar still not met. Wave 7A booking streaming is **local-only** (not on Sandbox). Known test failures above were **pre-existing on `origin/main`**, not introduced by Wave 7A. **Keep NAV-PERF OPEN.**  
No Production changes.

---

## 5. Operating rules

1. One active workstream at a time.
2. Every discovered issue gets an ID and disposition (P0/P1/P2 + status).
3. Closing a workstream requires acceptance evidence.
4. Previously accepted GREEN stays closed unless new regression evidence.
5. New findings are classified — not automatically launch blockers.
6. No Production changes until relevant launch gates are approved.
7. Keep this register concise; link evidence rather than pasting full QA reports.
8. Distinguish Sandbox GREEN from Production readiness.

### 5a. Permanent prelaunch failure policy

Applies to every prelaunch investigation and CI/local failure:

1. **Record and triage** every observed failure, unexplained error, or suspected regression in this register (unique ID + disposition). Nothing may silently disappear.
2. **“Pre-existing” is not automatic acceptance.** Pre-existing failures must still be classified (product defect vs incorrect/outdated test vs fixture/environment) and either fixed or escalated for founder review.
3. **Do not weaken, skip, delete, or quarantine tests** merely to obtain a green CI/local result.
4. **Customer-impacting product defects** require a correct fix plus verification evidence before GREEN/CLOSED.
5. **Launch blockers** include security, data isolation, booking, contracts, payments, and data-integrity defects (typically P0; escalate immediately if discovered).
6. **Other defects** need documented severity (P0/P1/P2) and founder disposition when not fixed in-scope.
7. **Previously accepted GREEN** workstreams reopen only when new evidence demonstrates a problem.
8. Tests may be corrected only after verifying intended product behavior; fixtures must not fake away real defects.

---

## 6. Final Production launch gates

All must be GREEN (or founder-documented exception) before live customers/payments:

1. **PROD-INFRA** — Production stack + config  
2. **STRIPE-LIVE** — Live SaaS money path  
3. **LEGAL-FINAL** — Legal/disclosure surface  
4. **OPS-FINAL** — Monitoring/support/recovery  
5. **TWILIO-A2P** — if SMS is offered at launch (else documented deferral)  
6. **LAUNCH-FINAL** — E2E Production acceptance + marketing cutover  
7. **NAV-PERF** — founder-accepted performance bar for staff navigation (P1; exception requires written acceptance)  
8. **JOURNEY-FINAL** — Sandbox E2E journey still valid on release tip (P1)

---

## 7. Evidence gaps / classification questions (for founder)

1. **REPORT-SUB vs STRIPE-LIVE:** SaaS Test checkout is evidenced; Live remains OPEN — correctly split.  
2. **PORTALS:** Treated GREEN on Sandbox from ONB/PM/vendor hospitality evidence; a dedicated portal regression pack is not re-run on `4787fbab` — reopen only if new defects appear.  
3. **Consent (LUV-CONSENT):** Safety closure marked LUV-FINAL GREEN with this residual OPEN — confirm P1 (not P0) is acceptable given Luv never auto-sends.  
4. **NAV-PERF priority:** Listed P1 (feel / professionalism). Escalate to P0 only if founder judges current latency unacceptable for first customers.

---

## 8. Changelog

| Date | Change |
|------|--------|
| 2026-11-18 | Register created. Seeded from MASTER tracker + LUV-FINAL acceptance on `4787fbab`. Active workstream = NAV-PERF discovery. |
| 2026-11-18 | NAV-PERF Wave 1 coded on `perf/nav-perf-wave1` (sidebar prefetch off, attention slim scan + 60s TTL). LUV-CONSENT remains P1. LAUNCH-FINAL clarified as umbrella gate (five P0s). Sandbox still serves `4787fbab` without Wave 1. |
| 2026-11-18 | NAV-PERF Wave 1 merged PR #92 → `a3825094`, Sandbox deployed, before/after remasure + spot-checks. NAV-PERF remains **OPEN** (Wave 2 = dashboard SSR). Other GREEN/CLOSED rows preserved. |
| 2026-11-18 | Founder accepted Wave 1. Wave 2 coded on `perf/nav-perf-wave2` (light header, lean briefing contracts, layout parallel). Register updated; **no commit/deploy yet**. |
| 2026-11-18 | NAV-PERF Wave 2 merged PR #94 → `7191fffa`, Sandbox deployed, remasure + functional PASS. NAV-PERF remains **OPEN**. Other GREEN/CLOSED rows preserved. |
| 2026-11-18 | NAV-PERF Wave 3 coded on `perf/nav-perf-wave3` (lean Focus invoices/schedules/lines/requests + readiness candidate events; no date cutoff). Fancy Focus parity 0 mismatches; query bundle −64% bytes. **No commit/deploy yet.** NAV-PERF remains **OPEN**. Other GREEN/CLOSED rows preserved. |
| 2026-11-18 | NAV-PERF Wave 3 merged PR #96 → `83569a10`, Sandbox deployed, remasure + nav + functional. Cold TTFB −31%; Focus medians not improved vs Wave 2. NAV-PERF remains **OPEN**. Other GREEN/CLOSED rows preserved. |
| 2026-11-19 | Prelaunch known-failure triage (Timeline empty TemplatePicker + questionnaires tab). Both fail identically on clean `origin/main` and Wave 7A — **incorrect/outdated source contracts**, not product defects; not Wave 7A regressions. Adjacent stale tab/Luv/setup-copy assertions corrected. Sandbox verify PASS (`sandbox-verify.json`). Added §5a prelaunch failure policy. Branch `fix/prelaunch-known-test-failures` (uncommitted pending founder). NAV-PERF remains OPEN; Wave 7A not blocked by these tests. |
