# Forensic Audit — Three Accepted Migration Exclusions

**Date:** 2026-10-20  
**Branch:** `feat/spaces-booking-e1-smart-fields`  
**Start HEAD:** `d1449f84` · dirty ~881 · Sandbox serving `df26942e` / TD `:808`  
**Code fix HEAD / serving:** `e6541f57` · TD `:809` · dpl match  
**Deploy:** https://github.com/jlcormier612/wevenu-website/actions/runs/39489672873 — success  
**Post-deploy verify:** `verify-document-guard-results.json` — **7/7 PASS** (guard + UI callout screenshot + payment/key_date not selectable)  
**Prior certs preserved:** final 36/36 (`d62f4260`); specialized (`df26942e`)  
**Production:** untouched

---

## Area A — Standalone payments & `key_date`

### Payments

| Question | Evidence |
|----------|----------|
| Domain model | `payment_schedules` + `payment_line_items` (+ invoices / event_orders). Not a free-floating `payments` import table. |
| Supported import | **Active commitment** only (`lib/migration/active-commitment.ts` → EO → invoice → schedule → `markItemPaid` for already-paid lines with `HISTORICAL_PAYMENT_PROVENANCE`). |
| Standalone `payment` entity | Normalize **rejects** (`generic-csv.ts`); **not** in `COMMITTABLE_ENTITIES` select. Label exists only as type vocabulary redirect copy. |
| Import Data wizard | Entity vocabulary is couples/leads/vendors/inventory/packages only — no payment CSV. |
| Side effects | Historical mark uses offline `markItemPaid` + provenance notes; schedule notes say “not processed by Hello to Cheers.” Does not collect via Stripe/QuickBooks on import. |
| Silent omission? | Choosing Active commitment with schedule lines persists amounts/dates/methods. Orphan payment CSV cannot commit. Payments omitted only if operator never runs Active commitment (operator choice, not silent success of a payment file). |

**Classification:** **SUPPORTED ELSEWHERE** (Active commitment) / **UNSUPPORTED BY DESIGN** as standalone MC `payment` rows.

### Key dates

| Question | Evidence |
|----------|----------|
| Semantics | Freeform `client_key_dates` product — **retired**. Migration `20261368000000_retire_client_key_dates.sql` drops table + portal RPC. Sandbox: table absent. |
| Distinct from | Event dates, timeline entries, holds, calendar blocks, `clients.rehearsal_date` (Client Info — preserved). |
| Import | Normalize + commit refuse with retired message (`generic-csv.ts`, `service.ts`). Not in `COMMITTABLE_ENTITIES`. |
| Alternatives | Event, Calendar, Tasks, Financials, Client Info rehearsal date (message in commit error). |

**Classification:** **UNSUPPORTED BY DESIGN** (product retired).

**Verdict A:** **GREEN** for launch scope — not a missing payment ledger; use Active commitment. Key dates must not be reintroduced without a product decision.

**Change required:** None for A.

---

## Area B — Committed-import recovery

### What exists

| Mechanism | Scope | Guarantee |
|-----------|-------|-----------|
| Cancel / abandon before commit | Preview session | No domain writes |
| Review dispositions | approve / reject / historical | Per-record |
| Retry / resume | `retryOwnRecord`, session `needs_review` / `partially_committed` | Re-attempt failed rows; does not undo committed |
| Mid-commit compensate | Active commitment `compensate()`; `compensateUntrackedImportRow` when batch stamp fails | Best-effort reverse of **this attempt’s** creates |
| `rollbackImportBatch` | Import Wizard entity types with `import_batch_id` (couples/leads/vendors/packages) | Window-limited: refuses if `updated_at` moved after stamp |
| Rollback UI | **None** — `rollbackImportBatchAction` exists; no component calls it | API-only today |
| MC `BATCH_ENTITY` | Only client/lead/vendor/package | Events, tours, documents, guests, AC, timeline, assignments, floor plans are **not** on import_batches rollback |

### What does not exist

- Session-level “undo this Migration Center commit”
- Safe automatic delete of specialized/relationship-heavy entities after edit/link
- Undo that reverse side effects that never happened (quiet import has none to reverse)

**Reliable recovery today:** retry failed rows; mid-commit compensation on AC failure; manual repair using session history + `created_entity_id` / `[migration:…]` notes; optional future wiring of Import Wizard batch undo UI for the four batched entity types.

**Classification:** **DOCUMENTED OPERATIONAL LIMITATION** — matches intentional “confirm before, don’t undo after” design (`lib/import/batches.ts`). Building full session undo is a **product/architecture decision**, not a small safe patch.

**Verdict B:** **PARTIAL** — usable with tested limits; not a silent integrity bug. Do not claim one-click MC session undo.

**Change required:** None in this package (no speculative undo framework).

---

## Area C — Document CSV without pre-staged files

### Behavior before fix

| Case | Result |
|------|--------|
| Missing `storagePath`/`storageUrl` | Normalize **rejects** — clear error |
| Fabricated path (object absent) | Commit could **insert documents row**; download fails — **false complete** |
| Pre-staged path | Works (prior specialized cert) |
| Alternatives | AC Smart Import (upload file); Floor plan uploader; Library Documents (venue-level, different scope) |

Probe: `docs/qa/exclusion-forensic/document-probe-results.json` — DB row created without object; download “Object not found”.

### Correction (`e6541f57`)

1. `assertMigrationDocumentStorageExists` via signed-URL probe before `insertDocument` (MC document commit + AC attached docs).
2. Partial AC document fields no longer silently `continue` — require all three or none.
3. Migration Center callout when Documents entity selected — upload-first prerequisite explicit.

**Classification after fix:** **SUPPORTED WORKFLOW, PREREQUISITE CLEAR** (plus alternatives).

**Verdict C:** **GREEN** — Sandbox `e6541f57`/:809 verified (guard rejects missing object; accepts existing; UI callout visible in `document-ui-callout.png`).

---

## Migration completeness implications

A white-glove venue can migrate:

- People, calendar, packages, events, tours, guests, vendor assignments, timelines, floor plan files, financial commitments **including historical paid/remaining lines** via Active commitment.
- Documents **when files are staged** (or via AC Smart Import / floor uploader).

Still manual / unsupported:

- Freeform retired Key Dates table (use Event/Calendar/Tasks/Client Info).
- Orphan payment CSV without a commitment context.
- One-click undo of a fully committed MC multi-entity session.

---

## Safety

- Production untouched.
- Prior 36/36 and specialized cert evidence preserved.
- Unrelated dirty tree preserved (~881).
- No invitations/enrollments triggered by forensic probes (disposable venues).
