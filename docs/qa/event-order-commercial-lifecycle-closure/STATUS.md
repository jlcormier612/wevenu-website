# Event Order commercial lifecycle closure — STATUS

**Workstream verdict: CONDITIONAL GREEN** (Choices GREEN; QBO UNVERIFIED)

| Stream | Verdict |
|--------|---------|
| Commercial lifecycle (share / Accept / invoice / incremental / payments) | **GREEN** (preserved; prior greenfield) |
| Couple Choices (single + multi + conditional matrix) | **GREEN** (fresh on `38b2d591`) |
| QuickBooks Online live sync | **UNVERIFIED — ENVIRONMENT BLOCKER** |

**Serving Sandbox SHA:** `38b2d591f2ee7a0cad3a96a8124424dbe6837549`  
**Production:** Untouched

---

## A. Couple Choices — GREEN

### Capability matrix

See `CHOICES-CAPABILITY-MATRIX.md`. Supported: single-select, multi-select, required/optional, `dependsOnOptionIds` conditionals, change-before-submit, draft save, submit, refresh/return, venue receipt, EO isolation.

### Fresh matrix (multi + conditional) on tip

```bash
EXPECTED_SHA=38b2d591f2ee7a0cad3a96a8124424dbe6837549 \
  npx tsx docs/qa/event-order-commercial-lifecycle-closure/verify-choices-matrix.mts
# → 22/22 PASS · UX blockers/p2=0
# Evidence: choices-matrix-results.json, choices-matrix-run.log, choices-matrix/
```

Live: Ceremony + Reception template → couple checkbox multi-select + change → plated/buffet conditional reveal/switch → submit → venue summary matches persisted `answers.optionIds` (not DB-seeded).

### Prior single-select depth (still valid product path)

```bash
EXPECTED_SHA=5959df8c…  # prior tip; ancestor behavior unchanged for radio path
  npx tsx docs/qa/event-order-commercial-lifecycle-closure/verify-choices-depth.mts
# → 19/19 (inherited evidence; matrix re-proves multi/conditional on current tip)
```

### Units

```bash
npx tsx --test \
  lib/client-choices/portal-submit-contract.test.ts \
  lib/client-choices/selection-request-lifecycle.test.ts \
  lib/client-choices/validate-answers.test.ts \
  lib/client-choices/conditional-groups.test.ts
# → included in 149 combined pass
```

Remaining depth (non-blocking): explicit live min/max reject UX and venue-option-change-during-draft not exhaustively re-run this tip (unit coverage present).

---

## B. QuickBooks Online — UNVERIFIED — ENVIRONMENT BLOCKER

Evidence: `qbo-boundary.json` (inspected `2026-10-28T04:43:28Z`)

| Venue | State |
|-------|--------|
| Fancy (`a415ac52…`) | **0** connections |
| Daisy | 1 sandbox row `Sandbox Company US 1ff4`, `last_health_check_ok=false`, error “Waiting on Invoice sync.” |

**No live sync performed.** Automated QBO tests 47/47 prove queue/timeout/idempotency semantics only — not external sync.

### Prerequisite for GREEN / VERIFIED

1. Healthy Fancy (or explicitly authorized) Sandbox QBO connection (`last_health_check_ok=true`)  
2. Confirm Intuit Sandbox company (not production)  
3. Disposable invoice sync via product path → external id + local status  
4. Idempotent re-trigger + truthful failure path  

---

## C. Preserved commercial acceptance

Prior greenfield 39/39 on `5959df8c` remains the commercial lifecycle proof; tip `38b2d591` is a Floor Plans/Event Setup fix ancestor-compatible with EO Choices (no EO regression required for Choices matrix).
