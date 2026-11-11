# Portal Docs — contract & invoice Open / Print / Download

**Environment:** Local only  
**Overall:** GREEN (local)

## Gap

Couple Docs Open/Print/Download existed only for file-backed uploads. HTC contracts (content, no `fileUrl`) and invoices only had Review/Details expand — no venue-parity viewer.

## Fix

| Surface | Path |
| --- | --- |
| Contract PDF (token auth) | `GET /api/portal/contracts/{id}/pdf?token=` |
| Invoice print page (token auth) | `/portal/invoices/{id}/print?token=` |
| Viewer | `CoupleDocumentViewerDialog` supports `file` / `pdf` / `page` |
| UI | Contract + Invoice cards always show **Open** when viewable |

Auth: portal token → `_resolve_portal_ids` → row must match `client_id` + `is_couple_visible`.  
Public path: `/portal/invoices` added to `PUBLIC_PATHS` (token still required by the page).

## Tests

`npx tsx --test lib/portal/couple-document-viewer.test.ts integrations/supabase/proxy-public-paths.test.ts` → **18/18 pass**

## Live local (Gertrude & Rudolph)

| Check | Result |
| --- | --- |
| Docs shows 4 Open controls | Pass |
| Contract Open → viewer + Print + Download PDF | Pass |
| Invoice Open → viewer + Print + Save as PDF (invoice body, not login) | Pass |
| Contract PDF API 200 `%PDF-` | Pass |
| Bad token → 401 | Pass |

Evidence: `01-docs.png`, `02-contract-viewer.png`, `03-invoice-viewer.png`, `browser-results.json`

## Scope

Venue Documents viewer unchanged. No migrations. No commit/deploy in this task.
