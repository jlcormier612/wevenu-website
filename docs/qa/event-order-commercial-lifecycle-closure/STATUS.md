# Event Order commercial lifecycle closure — STATUS

**Workstream verdict: CONDITIONAL** until Choices edge deploy is tip-verified; QBO now VERIFIED on Daisy Sandbox.

| Stream | Verdict |
|--------|---------|
| Commercial lifecycle (share / Accept / invoice / incremental / payments) | **GREEN** (preserved; prior greenfield) |
| Couple Choices (matrix + live min/max + stale-draft edge) | **IN PROGRESS → deploy required** for hydration/portal UX tip proof |
| QuickBooks Online live sync | **GREEN / VERIFIED** (Daisy Sandbox Company US 1ff4) |

**Prior serving tip:** `38b2d591f2ee7a0cad3a96a8124424dbe6837549`  
**Production:** Untouched

---

## A. Couple Choices

### Capability matrix

See `CHOICES-CAPABILITY-MATRIX.md`.

### Fresh matrix (multi + conditional) on tip `38b2d591`

```bash
EXPECTED_SHA=38b2d591f2ee7a0cad3a96a8124424dbe6837549 \
  npx tsx docs/qa/event-order-commercial-lifecycle-closure/verify-choices-matrix.mts
# → 22/22 PASS
```

### Edge cases (min/max + venue option change during draft)

Code + harness added:
- Portal shows min/max rules; validation errors use `portal-choices-error` alert styling
- Template structural drift re-freezes on venue list/get/send with answer prune
- Harness: `verify-choices-edge.mts`

Must run against the **post-deploy** serving SHA that includes these commits.

```bash
EXPECTED_SHA=<new-serving> \
  npx tsx docs/qa/event-order-commercial-lifecycle-closure/verify-choices-edge.mts
```

### Units

```bash
npx tsx --test \
  lib/client-choices/validate-answers.test.ts \
  lib/event-order-templates/selection-definition.test.ts
# → pass (incl. min/max messages + hydration drift)
```

---

## B. QuickBooks Online — GREEN / VERIFIED

**Venue:** Sweet Daisy Barn & Farm (`5c84e74e…`)  
**Company:** Sandbox Company US 1ff4 (Intuit Sandbox; CompanyInfo confirmed)  
**Connection:** refreshed OAuth access token; `last_health_check_ok=true` after live invoice sync

### Evidence

| Artifact | Result |
|----------|--------|
| `qbo-daisy-probe.json` / probe script | Token refresh + CompanyInfo OK |
| `qbo-live-sync-results.json` | **15/15 PASS** |
| External invoice Id | `156` |
| Local invoice | `74da8a02-…` · DocNumber `QMVROF1966ED179` · status `synced` |
| Idempotent retry | same Id `156`, remoteCount=1 |

```bash
# Requires /tmp/htc-qbo-probe/env (QUICKBOOKS_* + SENSITIVE_FIELD_ENCRYPTION_KEY from Secrets Manager)
npx tsx docs/qa/event-order-commercial-lifecycle-closure/verify-qbo-live-sync.mts
```

Fancy Venue still has zero connections — Daisy was the authorized healthy Sandbox path used for sync proof. No Production company was written.

---

## C. Preserved commercial acceptance

Prior greenfield remains commercial lifecycle proof; tip changes for Floor Plans / Choices edge do not rewrite EO Accept semantics.
