# Couple Tasks — Implementation 5 — Verified Insurance Completion

**Date:** 2026-08-09  
**Repo:** `wevenu-website`  
**Source:** `docs/qa/couple-task-insurance-verified-completion-investigation.md` — **Option A APPROVED** subject to STOP checks.  
**Rule:** ONLY CELEBRATE WHAT THE SYSTEM CAN PROVE. No Mark complete restore for insurance.

**Must remain intact:** `5657066`, `0ad64af`, `fc843dc`, `358153b`, `56e98a4`, Studio commits.

---

## STOP condition answers (re-verified before code)

| # | Question | Answer | Verdict |
| --- | --- | --- | --- |
| 1 | Is `couple_documents` acceptable SoT for couple-uploaded insurance? | **Yes** — Option A approved. Proof = `source_type='insurance'` + `share_with_venue=true` + durable row. Venue Document Workspace may still not list the file (known honesty caveat). | **GO** |
| 2 | Can couple insurance be distinguished from vendor COI so couple trigger doesn't fire from vendor (and vice versa for couple task)? | **Yes for the critical direction.** Vendor `share_vendor_document_to_event` / vendor `documents` insert with `category=insurance` does **not** call `triggerAutoComplete` (live: pending couple task stayed pending after vendor insurance `documents` insert). Couple fire uses the shared trigger string and **can** complete coordinator `Vendor COIs in file` if that row exists (Emma seed has **no** Vendor COIs task). Product accepted this coupling for Option A. | **GO** |
| 3 | Does product require venue approval before complete? | **No.** No approval status model; Option A completes on classified+shared commit. | **GO** |
| 4 | Does upload path support PDF + image end-to-end? | **After this WP: Yes.** `type=document` accepts PDF+images; `client-media` allowlist includes `application/pdf`; website/`cover` path still image-only. | **GO** |

**No STOP.** Implementation proceeded.

---

## Signal / SoT / Trigger / Celebration

| Item | Value |
| --- | --- |
| **Completion signal** | Durable `couple_documents` with `source_type='insurance'` **and** `share_with_venue=true` → `triggerAutoComplete(..., "document_uploaded_insurance")` |
| **SoT** | `couple_documents` (Option A) |
| **Trigger** | Existing `document_uploaded_insurance` (no new trigger names) |
| **Celebration type** | `insurance_uploaded` via `luv_celebrations` (CHECK widened); UI only when `celebrated === true` |
| **PDF / image** | Both via `/api/portal/upload` when `type=document` |
| **Routing** | `#documents/upload` → `portal-focus-documents-upload` (Impl 3 pattern) |
| **Manual complete** | Still blocked for trigger-backed rows |

**Does not complete on:** navigate to Documents, generic `source_type=upload`, share alone, insurance without share, filename inference, vendor COI insert.

---

## Migration?

**Yes** — `supabase/migrations/20261238000000_couple_insurance_verified_completion.sql`:

1. Widen `luv_celebrations.celebration_type` CHECK → `insurance_uploaded`
2. `GRANT select, insert, update ON couple_documents TO service_role` (portal token → admin write)
3. Allow `application/pdf` on `storage.buckets` `client-media`

No new tables. No payments/schema changes.

---

## Files changed (this WP)

| File | Change |
| --- | --- |
| `supabase/migrations/20261238000000_couple_insurance_verified_completion.sql` | CHECK + grants + PDF mime |
| `lib/portal/couple-insurance-completion.ts` | Classify / share / trigger gates |
| `lib/portal/couple-insurance-completion.test.ts` | WP matrix 1–12 |
| `lib/storage.ts` | `resolvePortalDocumentFile` (PDF + images) |
| `lib/storage.test.ts` | PDF/image + images-only tests |
| `app/api/portal/upload/route.ts` | PDF when `type=document` |
| `app/api/portal/documents/route.ts` | Insurance commit → trigger + Luv insert |
| `components/portal/couple-documents-section.tsx` | Event insurance + required share UX; celebrate once |
| `lib/portal/unified-tasks.ts` | Focus `upload` for insurance CTA |
| `lib/portal/workspace-routing.ts` | Focus key `upload` |
| `lib/luv/celebrations.ts` | Type + copy |
| `lib/luv/verified-domain-celebrations.ts` | Map trigger → celebration |
| Tests for celebrations / routing / unified-tasks | Updated |
| `docs/qa/couple-task-insurance-verified-completion-implementation-5.md` | This report |
| `docs/qa/couple-task-insurance-verified-completion-impl5/*` | Live QA artifacts |

---

## Error states (as WP)

| State | Behavior |
| --- | --- |
| Insurance without share | `400 insurance_requires_share` — no insert, no trigger, no celebrate |
| Generic upload (± share) | Persists as `upload` — no insurance trigger |
| Partial / fail upload | Toast; task stays pending |
| Already celebrated | Second commit `celebrated: false` |

---

## Tests

```bash
npx tsx --test \
  lib/luv/celebrations.test.ts \
  lib/luv/verified-domain-celebrations.test.ts \
  lib/portal/unified-tasks.test.ts \
  lib/portal/next-steps.test.ts \
  lib/portal/workspace-routing.test.ts \
  lib/portal/couple-insurance-completion.test.ts \
  lib/storage.test.ts
```

**Result: 76/76 pass** (WP matrix + Impl 1–4 suites).

---

## Live QA (Emma & Jordan)

**Env:** `http://localhost:3000` · token `seedcoupleportal00000000000000000000000000000001` · local Supabase  
**Migration applied locally.**

| Probe | Result |
| --- | --- |
| Before: insurance task | Was `complete` via prior `completed_by=couple` / `source_type=manual` (not couple insurance proof) |
| Reopen + insurance w/o share | `400`; task stayed pending |
| Generic shared upload | No insurance complete |
| Vendor insurance `documents` insert (no trigger) | Couple task **stayed pending** |
| PDF upload (`type=document`) | OK |
| Image upload (`type=document`) | OK |
| Cover/PDF rejected | `400` images-only |
| First insurance+share commit | Task `complete` / `completed_by=system` / `source_type=document`; `celebrated: true` |
| Second commit | `celebrated: false` (one-shot) |
| After: durable row | One `couple_documents` insurance+shared kept; celebration row present |
| UI | `#documents/upload` focus element present; Event insurance control present |

Artifacts: `docs/qa/couple-task-insurance-verified-completion-impl5/`.

### Couple / vendor isolation

- **Vendor → couple task:** Safe. Vendor share/insert does not fire `document_uploaded_insurance`.
- **Couple → Vendor COIs:** Shared trigger may complete coordinator Vendor COIs if present (accepted). Emma has no Vendor COIs task.

---

## Intact / untouched

| Area | Status |
| --- | --- |
| Impl 1–4 commits | Intact (`0ad64af`…`56e98a4`) |
| Home Review `5657066` | Untouched |
| WW / Studio / Collections / Photo Styles / RSVP | Untouched |
| Payments schema / processing / attention | Untouched |
| Vendor architecture | Untouched |
| Verified completion rules beyond insurance | Untouched |
| Celebration architecture | Minimal: one CHECK value + couple path map |

---

## Limitations

1. Venue Document Workspace still does not consume `couple_documents` (Option A honesty).
2. Shared trigger may complete Vendor COIs when couple fires (pre-existing).
3. Venue `saveDocument` insurance path still can complete the couple task without couple upload (pre-existing escape).
4. Portal document insert requires service_role grant (shipped in migration).

---

## Paste-ready summary

**Commit:** `git rev-parse --short HEAD` on this branch — message `Couple Tasks – Implementation 5 – Verified Insurance Completion` (local, not pushed).  
**Migration:** Yes — celebration CHECK + `couple_documents` service_role grants + `client-media` PDF.  
**Signal:** `couple_documents.source_type=insurance` + `share_with_venue=true` → `document_uploaded_insurance`.  
**SoT:** `couple_documents` (Option A).  
**Trigger:** Existing `document_uploaded_insurance`.  
**Celebration:** `insurance_uploaded` (one-shot `luv_celebrations`).  
**PDF/image:** Yes end-to-end for document uploads.  
**Isolation:** Vendor cannot complete couple task; couple may complete Vendor COIs via shared trigger (accepted; not on Emma seed).  
**Tests:** 76/76.  
**Live QA:** Emma PASS (before/after + vendor isolation).  
**Impl 1–4 / WW Studio:** Intact.  
**STOP answers:** All GO (see table).
