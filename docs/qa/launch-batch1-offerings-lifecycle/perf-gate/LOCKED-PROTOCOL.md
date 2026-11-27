# Locked performance acceptance protocol — Batch 1 / launch preservation

**Locked at:** 2026-11-27 (before dual full-suite runs)  
**SHA under test:** `154301bb761f359833d91f3e88b4c51f81ae9a20` (Sandbox)  
**Product changes during measurement:** none authorized for Dashboard/Task Center/header.

---

## 1. Measurement definitions (locked)

| Metric | Definition | Role |
|---|---|---|
| **firstPaintMs** | Click → destination path match + nav-pending overlay cleared + app-equivalent usable shell: workspace slot text ≥48 chars AND (`.htc-hospitality-heading` OR `[data-testid$="-streaming-root"]`) | **Primary** customer-visible readiness (matches `navigation-pending` clear intent) |
| **meaningfulReadyMs** | firstPaint conditions met AND slot text ≥120 chars AND main has no `aria-busy="true"` on a status region that is the only content | Meaningful module content beyond shell/fallback |
| **interactionReadyMs** | meaningfulReadyMs met AND `document.readyState === "complete"` | Interaction readiness proxy |
| **useful80Ms** | Click → path match + overlay cleared + slot text ≥80 (established harness) | **Historical reference only** — not compared as equivalent to firstPaint |
| **blankUncoveredMs** | Accumulated ms when slot text &lt;40 and overlay not covering | Blank-main regression signal |

Do **not** treat useful80 and firstPaint as interchangeable.

---

## 2. Navigation sequence and from-route

- **Sequence:** fixed sidebar order (Dashboard → Leads → Clients → Vendors → Calendar → Tours → Inbox → Automations → Templates → Documents → Contracts → Payments → Task Center → Requests → Setup → Settings → Guidance → Venue Guide → Reports → Help & Feedback).
- **Warm cycles:** 5 full passes after one cold pass (cold recorded separately; warm is scoreboard).
- **From-route:** each hop is from the previous label in that sequence (same as `nav-speed-baseline-all-sidebar.mts`).
- **Method:** real sidebar link click (soft-nav), not `page.goto`.

---

## 3. Venue and authentication

- Staff: `jennifer@hellotocheers.com` via magic-link session cookies.
- Venue: Jen's Fancy Venue `a415ac52-cd74-42a6-8df7-7a8f6e71d080`.
- **Required:** `set_active_venue` RPC success before browse (cookie alone insufficient).
- Read-only browse; no starter restore; no fixture mutation intended.

---

## 4. Browser / cache / warmup / prefetch

- Playwright Chromium, headless, viewport **1400×900**.
- One browser context per run; cookies set once.
- Warmup: cold pass through all labels once, then 5 warm cycles.
- Prefetch: production app behavior as-is (no disabling Link prefetch). Contending `_rsc` is real customer-adjacent risk — disclose outliers; do not strip prefetch to beautify numbers.

---

## 5. Sample count

- Per label per run: **5 warm** samples (plus 1 cold, not in warm median).
- **Two equivalent full-suite runs** (Run A, Run B), identical protocol.
- Retain **every** sample. No selective page re-runs.

---

## 6. Historical comparison limitations

- Nov 21 Fancy table = warm **useful80** medians on Sandbox tip `99251794` (recovered remasure).
- Dashboard Nov 21 useful80 is **not like-for-like** after founder-approved sync header removal — reference only; **no header restore**.
- useful80 vs firstPaint must never be scored as one delta.

---

## 7. Objective acceptance criteria (no invented ms thresholds)

| Result | When |
|---|---|
| **PASS** | Both runs: blank median 0 on every label; firstPaint medians **reproducible** between Run A and Run B for every label (see stability rule); no blank-main regression |
| **UNRESOLVED** | Any label’s firstPaint median differs between Run A and Run B by **>25% and >150 ms** (stability rule for reproducibility only — not a historical SLA) |
| **FAIL** | Blank-main median &gt;0 on any label in either run, OR reproducible firstPaint failure mode that leaves customer without destination shell |

**Reference appendix (not pass/fail alone):** useful80 medians vs Nov 21 table, with Dashboard caveat and all outliers listed.

**Application-change recommendation:** only if PASS/FAIL evidence shows a **reproducible customer-visible defect** on firstPaint/meaningfulReady — not useful80 noise alone, not Dashboard header.

---

## 8. Outlier / contention policy

- Never drop samples.
- If a sample is &gt;3× that label’s median within the same run, flag as **outlier** but keep in median.
- Attribute likely prefetch storms in notes when resource log shows burst `_rsc` — does not delete the sample.
