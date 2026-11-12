# Wave C1 hardening acceptance — Lead optimize

**Date:** 2026-11-12 (updated — release readiness closure)  
**Branch:** `perf/wave-c1-lead-hardening`  
**Parent optimize:** `c8b1305a`  
**No merge / no deploy**

Protected untouched tips: PR #33 `ee22f319`, PR #34 `6f5973e4`. Serving Sandbox: `df1aa331`.

Full release sequence: `PERFORMANCE-RELEASE-READINESS.md`.

---

## A. Executive verdict

**YELLOW → ready for integration review** after Sandbox #33 visual/performance gates.  
Contract/prefetch KEEP. Visual harness Coming Up restored. Mobile pending code hardened; live mobile pending proof blocked locally by legal gate / absent on pre-C1 Sandbox.

---

## B. Git state

| Stream | SHA |
| --- | --- |
| PR #33 | `ee22f319` |
| PR #34 | `6f5973e4` |
| C1 optimize | `c8b1305a` |
| C1 hardening tip | see `git rev-parse` on branch after readiness commit |

---

## C. Contract correctness

Unchanged PASS — fixture matrix + `lead-contract-scope` unit tests. Scoped ≡ legacy client-filtered journey selection. `getCurrentVenue` retained.

---

## D. Prefetch reliability

In-flight dedupe, gen guards, retry UI, idle 400 ms — KEEP. Cold Docs ~1 s without dwell; after dwell ~373 ms (prior).

---

## E. Performance

Prior local hardening medians retained as evidence (Overview 1375 vs PR34 1952). No new broad optimization this pass.

---

## F. Navigation feedback

- Desktop pending previously ~40–50 ms.  
- Min-visible 140 ms added for fast mobile soft-nav.  
- Clears on pathname change (after min window), popstate, 12 s safety.  
- Mobile sheet close PASS on Sandbox; C1 pending observation **BLOCKED** locally (`legal-unavailable`).

---

## G. Functional acceptance

Lead matrix unchanged PASS/N/A from prior hardening report.

---

## H. Visual acceptance (updated)

### Harness fix

- Capture `dashboard-coming-up__{desktop,mobile}` via `[data-testid="coming-up-section"]`.  
- Added `data-testid="coming-up-section"` on Dashboard Coming Up section.

### Sandbox vs approved (serving `df1aa331`)

| Result | Count |
| --- | ---: |
| PASS | 21 |
| FAIL | 1 (`dashboard-coming-up__mobile` 4.72%) |
| Baseline overwrite | **None** |

Reporting desktop: **identical** to approved on Sandbox.  
Local C1 Reporting 3.2% = content/footer chart pixels — not shell/nav.

Evidence: `raw/hospitality-visual-sandbox-compare.json`, `screenshots/c1-hardening/visual-evidence/`.

---

## I. Tests

Build SUCCESS (readiness rebuild). Contract + deferral tests PASS (12).

---

## J. Risks

1. Coming Up mobile crop vs approved on current Sandbox.  
2. Mobile C1 pending not proven live yet.  
3. Local legal gate flaked acceptance environment.

---

## K. Recommendation

**YELLOW** — proceed to **PR #33 Sandbox** authorization first; then #34; then C1.  
Do not expand to Client/EventDetail.
