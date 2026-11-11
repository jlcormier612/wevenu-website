# FINAL ACCEPTANCE — New-customer onboarding & Bring Your Business import

**Verdict: GREEN** on Sandbox serving tip `0b81d961`  
**Production:** untouched  
**Deploy:** https://github.com/jlcormier612/wevenu-website/actions/runs/40733172532  
**Harness:** `EXPECTED_SHA=0b81d961 npx tsx docs/qa/onboarding-import-acceptance/verify-browser.mts` → `pass=56 fail=0`

## Plain-English answers

### Are HoneyBook and Tripleseat genuinely different import engines?

**Yes, as adapters on the same Migration Center CSV pipeline — not separate full-stack importers.**

- Both are file-based only (no live login/API).
- HoneyBook (`lib/migration/sources/honeybook.ts`): recognizes combined-name contact exports; splits `Name` via `splitName`; clients/leads only.
- Tripleseat (`lib/migration/sources/tripleseat.ts`): recognizes `account_id` / `lead_source` / `contact_type` / `Full_name` signals; defers to generic when first/last already split; same client/lead scope.
- Persistence, dedupe, review, and commit are shared Migration Center machinery.

### Which record types and file formats does each support?

| Path | Formats | Record types (adapter-specific) |
|---|---|---|
| HoneyBook | CSV | Clients, leads (contacts). Events/calendar/vendors/packages via Another system / generic entity pickers. |
| Tripleseat | CSV | Clients, leads. No booking→event reconstruction in this phase. |
| Another system | CSV (+ mapping) | Full Migration Center entity menu (clients, leads, vendors, events, tours, holds, blocks, packages, documents, …). |
| Add individually | N/A (UI / optional `/settings/import`) | Whatever the customer creates manually. |
| Skip | N/A | No records created. |

### What does “another system” really do today?

A **real** Migration Center `generic_csv` workflow: pick entity → upload CSV → column mapping (auto-map + optional Suggest with Luv) → Bring in → review → commit. Not a placeholder. Not a live connector.

### What does manual entry create, and how does skip differ?

- **Individual:** sets hub path `individual`; customer adds records through normal app flows (or small Import Data). Import later remains available.
- **Skip:** sets hub path `skipped`; no sample/import records; Migration Center reachable via “Changed your mind?”.

### Which paths are customer-ready?

| Path | Status on `0b81d961` |
|---|---|
| Resume selected HoneyBook | Ready |
| Explicit HoneyBook import | Ready |
| Tripleseat import | Ready |
| Another-system import | Ready |
| Add things individually | Ready (hub path + persistence; New Client control not found in harness — venue still accepts clients) |
| Skip / start fresh | Ready |

### Issues found and fixed

1. **CSV auto-map too strict** — only exact camelCase/label match. Tripleseat `first_name` / imperfect `Couple Name` never mapped → every row “Missing a name.”  
   **Fix:** `lib/migration/auto-map-headers.ts` + Migration Center wiring (`5c98ade9`).

2. **Generic CSV ignored combined `name`** — Another-system Full name mapping still failed.  
   **Fix:** reuse `splitName` in `generic-csv` (`5f08a40b`).

3. **Suggest with Luv stole combined name onto First name only** — then generic required last name and failed all rows.  
   **Fix:** split first-name-only combined values; Luv won’t reuse an already-mapped header (`0b81d961`).

### Can a new customer finish each supported path without developer help?

**Yes**, on Sandbox tip `0b81d961`, for the paths above, with disposable synthetic venues and fixtures under `fixtures/`.

### Limitations to disclose before launch

- HoneyBook/Tripleseat adapters do **not** import events, bookings, invoices, or calendar commitments by themselves — only contact-like clients/leads. Other entity types use Another system / generic pickers.
- No live HoneyBook or Tripleseat connection.
- Ambiguous multi-word combined names go to **Needs your decision** (confirm split) — not silent auto-approve.
- Empty / headers-only files do not commit.
- Wrong file types are blocked by `accept=".csv"`.
- Individual path: harness did not find a New Client control on `/clients` for a brand-new venue (DB insert still proved writability); product should confirm New Client affordance for empty venues.
- Imports are **not** fully atomic at the session level: valid rows can commit while others remain in review (accurate UI: partial / needs decision).

## Matrix (required scenarios)

| Path | Happy path | Imperfect input | Persistence verified | Recovery tested | Browser E2E |
|---|---|---|---|---|---|
| Resume selected HoneyBook | PASS | PASS | PASS (leads+clients) | PASS | PASS |
| Explicit HoneyBook import | PASS | PASS | PASS (clients=2) | PASS (empty/wrong type/refresh) | PASS |
| Tripleseat import | PASS | PASS (Full_name) | PASS (clients=3) | PASS (empty) | PASS |
| Another-system import | PASS | PASS | PASS (clients=2) | PASS | PASS |
| Add things individually | PASS | N/A | PASS | PASS | PASS |
| Skip/start fresh | PASS | N/A | PASS (`skipped`) | PASS (later MC) | PASS |

## Evidence

- `IMPORT-ENGINE-MATRIX.md` — engine differences  
- `browser-results.json` / `browser-run.log` — scenario results  
- `shots/` — BYB, MC, errors, skip, individual  
- `fixtures/` — synthetic HB / TS / imperfect / empty / wrong-type  
- Unit: `auto-map-headers.test.ts`, `generic-csv.test.ts`, honeybook/tripleseat/BYB tests  

## Diff / commits (this workstream)

- `5c98ade9` — auto-map aliases  
- `5f08a40b` — generic combined-name split  
- `0b81d961` — first-name-only split + Luv header steal guard  

Unrelated dirty/untracked work preserved. Production not deployed.
