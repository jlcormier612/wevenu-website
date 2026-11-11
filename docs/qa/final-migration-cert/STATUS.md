# Final Migration Path Certification — STATUS

**Overall migration experience (launch promise):** **GREEN for advertised launch scope** — this package’s 36/36 core paths remain GREEN; specialized MC entities were certified in a follow-on package (`docs/qa/mc-specialized-cert/STATUS.md`, serving `df26942e` / TD `:808`) without reopening these 36/36 checks.

| Field | Value |
|-------|-------|
| Branch | `feat/spaces-booking-e1-smart-fields` |
| Serving commit | `d62f4260cbc77ed09858298ead614e141118fd23` |
| Deploy | https://github.com/jlcormier612/wevenu-website/actions/runs/39473027733 — **success** |
| ECS | `htc-sandbox-venue-app` **TD `:807`** · image tag exact · `dpl` match |
| Runtime | **36 passed / 0 failed** → `runtime-results.json` |
| Disposable venue | `86e607f2-…` (preserved) |
| Prior excellence | `3a5d63f9` / `:802` preserved; not reopened |
| Production | Untouched |

## Verdicts

| Track | Verdict | Notes |
|-------|---------|-------|
| **A. Migration Center** | **GREEN (8 CSV here; specialized in follow-on)** | GREEN for CSV paths: client, lead, vendor, package (+items), event, calendar_block, date_hold, tour — all 8 sessions `committed`, DB reconciled. Specialized entities certified in `docs/qa/mc-specialized-cert/`. OUT_OF_SCOPE: payment, key_date. No session-level rollback UI (batch compensation on failure only). |
| **B. Word import** | **GREEN** | `.docx` → mammoth → Luv/structure → preview → commit. WordAlice/WordBob persisted; past date → Event. |
| **C. PDF import** | **GREEN** | Text PDF extract + map/commit; PDF Florist + PDF DJ persisted. Empty/page-marker PDF surfaces scanned/unreadable message. Scanned image OCR not claimed. |
| **D. Luv-assisted** | **GREEN** | Freeform paste → structured rows (assisted) → quiet leads LuvPat/LuvQuinn; no invitations/enrollments. |

## Defects fixed in this package (commits)

| Commit | Fix |
|--------|-----|
| `27c11b3a` | MC package mapping exposes `includedItems` |
| `ccbdb5d6` | MC row staging before source-file retention (unblocks Working…); PDF page-marker normalize |
| `6520a4ae` | MC `toVendorInput` complete VendorInput (fixes `.trim()` crash) |
| `1bf82581` / `1aae85f1` | DOMMatrix polyfill for Node pdf-parse |
| `d62f4260` | Vendored `public/pdf-parse.worker.mjs` + `PDFParse.setWorker` for standalone SSR |

## MC entity matrix (this run)

| Entity/source | Fixture | Browser | Persisted | Side effects | Status |
|---------------|---------|---------|-----------|--------------|--------|
| client CSV | `mc-clients.csv` | commit | McPast+McFuture; past→Event | no invites | **PASS** |
| lead CSV | `mc-leads.csv` | commit | McLead Gamma | quiet | **PASS** |
| vendor CSV | `mc-vendors.csv` | commit | MC Photo Co relationship | — | **PASS** |
| package CSV | `mc-packages.csv` | commit | Gold 2 `package_items` | — | **PASS** |
| event CSV | `mc-events.csv` | commit | McPast Alpha Wedding | — | **PASS** |
| calendar_block | `mc-blocks.csv` | commit | MC Staff Day Off | — | **PASS** |
| date_hold | `mc-holds.csv` | commit | MC Soft Hold | — | **PASS** |
| tour | `mc-tours.csv` | commit | 1 tour_appointment | — | **PASS** |
| Word clients | `clients-word.docx` | Import Data | WordAlice/Bob + Event | no invites | **PASS** |
| PDF vendors | `vendors-pdf.pdf` | Import Data | PDF Florist + DJ | — | **PASS** |
| empty PDF | `empty-text.pdf` | error msg | n/a | — | **PASS** |
| Luv paste leads | `luv-paste-leads.txt` | Import Data | LuvPat/Quinn | quiet | **PASS** |

## Explicit exclusions

- Package ↔ inventory SKU FKs — out of launch scope  
- MC payment / key_date — not committable in UI  
- MC Word/PDF upload — CSV only; handoff to Import Wizard verified  
- Scanned/image PDF OCR — not supported; message verified  
- HoneyBook/Tripleseat accelerator E2E — not re-run (file recognition only)  
- guest_list / floor_plan / active_commitment / document / timeline / event_vendor_assignment — **closed in** `docs/qa/mc-specialized-cert/` (not re-run here)

## Automated tests run

```
npx tsx --test lib/import/pdf-extract.test.ts \
  lib/migration/source-retention-order.test.ts \
  lib/migration/vendor-input-complete.test.ts \
  lib/migration/package-items-mapping.test.ts
```

(plus prior migration-excellence / package-items suites)

## Launch decision

Safe to launch **Import Data (CSV/Excel/Word/PDF/Luv paste)** and **Migration Center** for the eight CSV entities certified here plus the specialized entities certified in `docs/qa/mc-specialized-cert/`, with the documented exclusions (OCR, inventory SKUs, seating auto-layout, standalone payment/key_date, session undo).

Unrelated dirty/untracked work preserved. Production untouched.
