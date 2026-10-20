# Bulk Delete, Import Recovery & Historical Data Mapping

**Branch:** `feat/spaces-booking-e1-smart-fields`  
**HEAD (docs):** see git · **Serving:** `e6541f57` / TD `:809`  
**Disposable venue:** `b8e9b19a-…` (`recovery-experiment-results.json`)  
**Production:** untouched · dirty tree preserved (~881) · prior certs intact  
**Product code changes:** **none** (investigation + docs only)

---

## A. Initial state

| Item | Value |
|------|-------|
| Start HEAD | `ce3b5fe1` |
| Dirty count | ~881 preserved |
| Sandbox | `e6541f57` · TD `:809` |
| Prior evidence | `STATUS.md` exclusions forensic; specialized + final certs |

---

## B. Bulk-delete capability matrix

| Entity | Classification | Entry points / evidence |
|--------|----------------|-------------------------|
| **Clients** | **INDIVIDUAL DELETE ONLY** | UI: `DeleteClientRecordButton` → `deleteClientRecordAction` / `lib/records/delete-record.ts`. Hard delete. **Blocked** when signed contract or collected payments exist. **No list bulk select** (browser: `clients_list_no_bulk_select`). |
| **Leads** | **INDIVIDUAL DELETE ONLY** | UI: `DeleteRecordButton` on lead detail → `deleteLeadRecordAction`. No bulk select. |
| **Vendors** | **INDIVIDUAL DELETE ONLY** | `deleteVendorAction` / `vendor-detail.tsx` (relationship deactivate/delete path). No bulk. |
| **Packages** | **INDIVIDUAL DELETE ONLY** | `deletePackageAction` / `package-list.tsx` confirm dialog. |
| **Package items** | **INDIVIDUAL DELETE ONLY** | `package-inclusions-editor.tsx` per-line remove. |
| **Events** | **NO SUPPORTED DELETE** (standalone) | No event-level delete action found. Events removed as part of **client** delete cascade (`deleteClientRecord` loops events). |
| **Guests / households** | **INDIVIDUAL DELETE ONLY** | Couple portal `guest-section.tsx` Delete guest (not venue list bulk). |
| **Documents** | **INDIVIDUAL DELETE ONLY** | Library `deleteLibraryDocumentAction`; reference-aware storage retention. |
| **Event vendor assignments** | **INDIVIDUAL DELETE ONLY** | `event-vendors-section.tsx` Remove. |
| **Timeline entries** | **INDIVIDUAL DELETE ONLY** | `deleteEntryAction` / timeline view. |
| **Floor plans** | **INDIVIDUAL DELETE ONLY** | `deleteFloorPlanAction`. |
| **Calendar blocks** | **INDIVIDUAL DELETE ONLY** | `deleteBlockAction` / calendar. |
| **Date holds** | **INDIVIDUAL DELETE ONLY** | `deleteHoldAction`. |
| **Tours** | **INDIVIDUAL DELETE ONLY** | `deleteTourAction` / tour list. |
| **Import batch rollback** | **SERVER ACTION EXISTS, UI MISSING** (+ **UNSAFE** after financials) | `rollbackImportBatch` / `rollbackImportBatchAction` — **no UI caller**. Deletes by `import_batch_id` for couples/leads/vendors/packages/inventory only. Experiment: refuses when `updated_at` > stamp+2s; **does not check** contracts/payments — would orphan or wrongly wipe parents after Active commitment. |
| **MC session undo** | **NO SUPPORTED DELETE** | Migration Center history has no Undo (browser verified). |

**No entity has verified multi-select bulk delete in venue admin UI.**

---

## C. Recovery recommendation

### Provenance available today

| Mechanism | Coverage |
|-----------|----------|
| `import_batches` + `import_batch_id` | clients, leads, vendors, packages, inventory only |
| `migration_records.created_entity_id` | Per committed MC row (session-scoped) — **reliable attribution** when session exists |
| `[migration:sourceId]` notes | Guests, assignments, timeline (string marker, not FK) |
| Active commitment objects | EO / invoice / schedule / contract / docs — **no** `import_batch_id` |

### Experiment results (venue `b8e9b19a`)

1. Pre-existing ControlKeep client + ControlLead **intact** after deletes.  
2. ImportBen (no financials) **individually deleted**.  
3. ImportAda edited after import → batch rollback **would refuse** (touched).  
4. After Active commitment: paid lines + signed external contract → **client delete blocked** by product policy (`wouldBlock: true`).  
5. `rollbackImportBatch` without financial gates = **unsafe** for post-AC clients.  
6. Side effects: invites=0, enrollments=0.

### Choice: **Option D** (architecture for true import-scoped recovery) + **Option A** for limited cases

| Scenario | Supported procedure |
|----------|---------------------|
| Wrong lead / vendor / package / client **without** financials | Open detail → Delete (preview confirms impact). Use Migration Center history / `created_entity_id` to identify IDs. |
| Wrong multi-entity MC session with relationships | **Manual** ordered cleanup using session records + individual deletes. No bulk. |
| Wrong Active commitment / paid history | **Do not** use batch rollback or client delete. Review financial objects; void/adjust via financials UI or leave for accounting review. Full safe reverse needs product design. |
| Edited-after-import rows | Batch rollback already refuses; keep edited data or manual fix. |

**Do not ship** a generic “Undo import” that calls today’s `rollbackImportBatch` for white-glove AC venues.

**Smallest future enhancement (not implemented):** import-scoped delete that (1) lists `migration_records` for a session, (2) dependency-orders deletes, (3) refuses financial/touched rows with review flags — requires design + tests.

---

## D. Historical payment mapping

**Classification: SUPPORTED WITH EXPLICIT LIMITATIONS**

### Source → Active commitment (tested)

| Historical spreadsheet concept | Target field | Persisted evidence |
|--------------------------------|--------------|--------------------|
| Contract total $8500 | `contractedTotal` | EO + invoice totals |
| Package name | `packageName` → EO custom line | Full Day Wedding |
| Deposit paid $2000 on 2025-06-01 check CHK-1001 | `scheduleLinesJson` alreadyPaid line | `paid_amount=2000`, `paid_at=2025-06-01`, `method=check`, `ref=CHK-1001` |
| 2nd payment $3000 ACH ACH-88 | same | preserved |
| Final $3500 due 2026-11-01 | unpaid schedule line | `status=pending` |
| Provenance | `HISTORICAL_PAYMENT_PROVENANCE` notes | “Migrated payment — collected outside Hello to Cheers…” |
| Stripe / QB charge IDs | — | `stripe_*` **null** (no collection) |

Flat CSV supports one paid + remainingAmount1–4; **full multi-paid history** via `scheduleLinesJson`.

### Limitations (transparent)

- Model is **obligation schedule**, not a full processor transaction ledger.  
- Currency not mapped from CSV (schedule default).  
- Partial pay within one installment: product UI can mark partial; AC import marks whole line paid when `alreadyPaid=true`.  
- Does not fire Stripe/QuickBooks collection on import.

Artifact: `payment-mapping.json`.

---

## E. Legacy `client_key_dates`

**Legacy semantics** (foundation SQL): freeform per-client milestones — `label`, `date`, `note` (e.g. Rehearsal, Final guest count due).

| Legacy | Classification | Current destination |
|--------|----------------|---------------------|
| Rehearsal-like label + date | **MAPS TO CURRENT FEATURE** | `clients.rehearsal_date` (Client Info); collapse migration treated rehearsal rows as duplicates of this |
| Other milestone labels | **REQUIRES MANUAL REVIEW** | Timeline entry, Task, or Calendar item — operator chooses meaning |
| `note` | **NO CURRENT EQUIVALENT** | Fold into timeline/task/client notes manually |
| Freeform Key Dates product UI | **NO CURRENT EQUIVALENT** | Retired; table dropped in Sandbox |

Import must **not** silently invent Event/timeline rows from arbitrary labels. Process: report omitted freeform milestones; map rehearsal when clear; otherwise manual.

Artifact: `keydate-mapping.json`.

---

## F. Changes and verification

| Item | Result |
|------|--------|
| Product commits | **None** |
| QA / scripts | `recovery-payments-keydates.mts`, results JSON, screenshots, mappings |
| Tests run | Experiment runtime **30/31** (1 flake: welcome wall before client detail Delete label; financial gate proven via DB + `previewDeleteClient` logic) |
| Deploy | Not required |

---

## G. Final launch implications

White-glove can safely promise:

1. Historical **financial obligations + offline-paid history** via Active commitment (`scheduleLinesJson` for multi-paid).  
2. Recovery of **non-financial** mistaken imports via **individual** deletes guided by Migration Center session attribution.  
3. Explicit omission of retired freeform Key Dates (rehearsal → Client Info).

Cannot promise:

1. Venue-admin **bulk delete** of an entire import.  
2. Safe one-click undo after Active commitment / collected payments.  
3. Processor-level payment transaction history.  
4. Automatic remapping of arbitrary key-date labels.

### Verdicts

| Track | Status |
|-------|--------|
| Bulk delete as recovery | **PARTIAL** — individual delete only; no safe bulk/import-scoped UI |
| Import-scoped recovery | **BLOCKED / PRODUCT DECISION** for full session reverse; limited manual procedure documented |
| Historical payments via AC | **GREEN** (with explicit schedule/ledger limitations) |
| Legacy key dates | **PARTIAL** — rehearsal maps; freeform does not |

---

## Safety

- Production untouched  
- Certified MC paths unchanged  
- Unrelated dirty work preserved  
- Disposable venue only; no customer communications; no Stripe charges  
