# Event Order commercial lifecycle closure — STATUS

**Workstream verdict: GREEN** for Choices + QBO on serving `553a7aaf` (Floor Plans separately GREEN on prior tip evidence).

| Stream | Verdict |
|--------|---------|
| Commercial lifecycle (share / Accept / invoice / incremental / payments) | **GREEN** (preserved; prior greenfield) |
| Couple Choices (matrix + live min/max + stale-draft edge) | **GREEN** |
| QuickBooks Online live sync | **GREEN / VERIFIED** (Daisy Sandbox Company US 1ff4) |

**Serving Sandbox SHA:** `553a7aaf044f1e605965e0c4df21f088fc03a96b`  
**Deploy:** https://github.com/jlcormier612/wevenu-website/actions/runs/40638522789 (`success`)  
**Production:** Untouched

---

## A. Couple Choices — GREEN

### Capability matrix

See `CHOICES-CAPABILITY-MATRIX.md`.

### Fresh matrix (multi + conditional)

```bash
EXPECTED_SHA=553a7aaf044f1e605965e0c4df21f088fc03a96b \
  npx tsx docs/qa/event-order-commercial-lifecycle-closure/verify-choices-matrix.mts
# Evidence: choices-matrix-results.json (re-run on tip)
```

Prior tip `38b2d591` also 22/22.

### Live edge cases on tip `553a7aaf` — **20/20**

```bash
EXPECTED_SHA=553a7aaf044f1e605965e0c4df21f088fc03a96b \
  npx tsx docs/qa/event-order-commercial-lifecycle-closure/verify-choices-edge.mts
# → 20/20 PASS · UX blockers/p2=0
# Evidence: choices-edge-results.json, choices-edge-run.log, choices-edge/
```

Observed UX:
- Min 0 / min 1 → alert “requires at least 2 selections.” Submit blocked.
- Max 3 selected → alert “allows at most 2 selections.” Submit blocked.
- Rules copy: “Pick many · required · choose exactly 2”
- Venue removed option C via template trash UI; hydrate pruned definition + draft answers; couple no longer sees C; final submit A+B only; venue summary matches; no duplicate packets.

### Units

```bash
npx tsx --test \
  lib/client-choices/validate-answers.test.ts \
  lib/event-order-templates/selection-definition.test.ts
```

---

## B. QuickBooks Online — GREEN / VERIFIED

**Venue:** Sweet Daisy Barn & Farm (`5c84e74e…`)  
**Company:** Sandbox Company US 1ff4 (Intuit Sandbox; CompanyInfo confirmed)  
**Connection:** OAuth token refreshed; `last_health_check_ok=true` after live invoice sync

| Artifact | Result |
|----------|--------|
| `qbo-live-sync-results.json` | **15/15 PASS** |
| External invoice Id | `156` |
| Local invoice | `74da8a02-…` · DocNumber `QMVROF1966ED179` · `synced` |
| Idempotent retry | same Id `156`, remoteCount=1 |

Fancy still has 0 connections — Daisy was the authorized healthy Sandbox path. No Production company written.

---

## C. Preserved commercial acceptance

Prior greenfield remains commercial lifecycle proof.
