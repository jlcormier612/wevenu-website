# Couple Tasks Gap Closure 1 — Verified Insurance Completion (INVESTIGATION ONLY)

**Date:** 2026-08-09  
**Repo:** `wevenu-website`  
**Mode:** READ-ONLY investigation — **no product code, schema, UI, tests, seed, or data mutations** beyond this report.  
**Prior SoT:** Final audit PASS with intentional Insurance gap (`docs/qa/couple-task-verified-completion-final-acceptance-audit.md`); Impl 1–4 (`5657066`, `0ad64af`, `fc843dc`, `358153b`, `56e98a4`); `docs/qa/couple-task-verified-action-completion-investigation.md`, Impl 1 / 3 / 4 reports.

**Product rule:**  
`TASK → CTA → domain action → verification → auto complete → one-time Luv (only when newly completed)`.  
Only celebrate what the system can prove. Nav / open / select / generic upload without insurance classification is **not** enough.

**Scope protection:** No Collections / WW Studio / Photo Styles / RSVP / Couple Home hierarchy / Payments / Vendor redesign / Share Timeline / unrelated Tasks. Luv for insurance is **plan-only**, after a durable signal exists.

---

## Verdict (investigation)

**Insurance is not couple-verifiable today.** The playbook task is trigger-backed and Mark-complete is correctly blocked, but the only fire path for `document_uploaded_insurance` is **venue** `saveDocument` with `category === "insurance"` on an **event-scoped** `documents` row. Couple portal upload writes a different table (`couple_documents`), never classifies insurance, never calls `triggerAutoComplete`, and currently cannot even accept typical COI file types (PDF) via `/api/portal/upload`.

**Smallest truthful closure is feasible without a new table**, but requires an explicit product choice between two SoT options (see §7–§10). One option is STOP/NO-GO without a larger document-architecture decision.

---

## 1. Current insurance task lifecycle

### 1.1 Creation

| Item | Detail |
| --- | --- |
| Seed template | `STANDARD_CLIENT_PLANNING_TASKS` in `lib/playbooks/constants.ts` |
| Title | `Purchase event insurance` |
| Owner / visibility | `ownerType: "couple"`, `visibility: "client_owned"` |
| Category | `document` |
| Trigger | `autoCompleteTrigger: "document_uploaded_insurance"` |
| Instantiation | Copied onto `event_tasks` when Client Planning playbook is applied / released (same path as other checklist tasks) |

**Related non-couple task (same trigger value):** Venue Planning seed includes coordinator-only `Vendor COIs in file` with the **same** `autoCompleteTrigger: "document_uploaded_insurance"`. `autoCompleteTrigger` in `lib/playbooks/repository.ts` completes **all** pending/blocked/overdue `event_tasks` for that event matching the trigger string — no owner/uploader filter.

### 1.2 Couple presentation (Impl 1–3)

| Layer | Behavior | Code |
| --- | --- | --- |
| Portal tasks RPC | Exposes `autoCompleteTrigger`; `canComplete = false` when trigger set | `supabase/migrations/20261231000000_portal_verified_task_completion.sql` (`get_portal_tasks`) |
| Manual complete | Rejected with `domain_verified_use_workspace` | same migration (`complete_portal_task`) |
| Tasks CTA | **Upload insurance** | `lib/portal/unified-tasks.ts` `TRIGGER_WORKSPACE.document_uploaded_insurance` |
| Destination | `#documents` | section `documents` |
| Focus / hash | **`focus: null`** (no `#documents/insurance`) | intentional Impl 3 limitation |
| Home | Compact **Review** navigate-only (`5657066`) — never completes | unchanged |
| Completable here | **false** (trigger-backed / not stranded in the Mark-complete sense) | `venueTaskPresentation` |

**Classification for attention:** Trigger-backed, workspace-navigate. Not an acknowledgment/manual task. Not completable in-place. Risk of **operational stranding** for the couple: CTA lands on Documents, but couple work cannot earn the trigger (see §5). Escape today = venue coordinator complete/waive, or venue uploading an event `documents` row with `category = 'insurance'`.

### 1.3 Completion / celebration today

| Path | Fires `document_uploaded_insurance`? | Couple Luv? |
| --- | --- | --- |
| Venue `saveDocument` on event + `category === "insurance"` | **Yes** | **No** — `celebrationTypeForVerifiedTrigger("document_uploaded_insurance")` returns `null` (Impl 4 intentional) |
| Vendor `share_vendor_document_to_event` with category insurance | **No** (insert only; no `triggerAutoComplete`) | No |
| Couple portal upload | **No** | No |
| Couple Mark complete | Blocked | N/A |

Emma seed observation from final audit: insurance checklist row may appear `complete` via **non-couple** path — that does **not** prove couple upload verification.

---

## 2. Current couple upload lifecycle

### 2.1 UI

**File:** `components/portal/couple-documents-section.tsx` (`UploadRow`)

1. Optional checkbox **Share with venue** (`shareWithVenue`, default **false**).
2. File pick → `POST /api/portal/upload` (multipart: `file`, `token`; also sends unused `category` / `visibility` fields the upload route ignores).
3. On success URL → `POST /api/portal/documents` JSON:
   - `name` (filename stem)
   - `fileUrl`, `fileSize`, `mimeType`
   - `shareWithVenue`
   - **`sourceType: "upload"` hardcoded**

There is **no** insurance category picker, no forced-share for insurance, no task deep-link focus control. `DOC_META` includes an `insurance` display type only so **venue/vendor-shared** `documents.category = 'insurance'` rows (via `get_couple_documents`) can render a badge — not because couple uploads set it.

### 2.2 Storage upload API

**File:** `app/api/portal/upload/route.ts`

- Validates portal session; stores under bucket **`client-media`**.
- Accepts files only through `resolveImageFile` (`lib/storage.ts`) — **images only** (JPG/PNG/GIF/WEBP/HEIC/…).
- **PDFs and other COI-typical mime types are rejected.**
- Does not persist document metadata; returns public URL only.

### 2.3 Metadata API

**File:** `app/api/portal/documents/route.ts`

- Resolves `client_id` via `_resolve_portal_ids`.
- Inserts into **`couple_documents`** only.
- Fields written: `name`, `file_url`, `file_size`, `mime_type`, `uploaded_by: "couple"`, `share_with_venue`, `source_type` (defaults `"upload"`).
- **No** call to `triggerAutoComplete`, playbook RPCs, or `documents` table insert.
- **No** `event_id` stamped on the row (client-scoped only).

### 2.4 Read path

`GET /api/portal/documents` → RPC `get_couple_documents` unions:

1. Couple-visible **contracts**
2. Couple-visible **invoices**
3. Venue/vendor **`documents`** with `is_couple_visible` (docType ← `documents.category`, so insurance from venue/vendor can show as Insurance)
4. All **`couple_documents`** for the client (docType ← `source_type`, almost always `upload`)

Mounted from `components/portal/portal-shell.tsx` Documents section.

---

## 3. Current document data model

### 3.1 `couple_documents` (couple-initiated SoT today)

Created in `supabase/migrations/20260703140000_sprint75_couple_docs_venue_info.sql`:

| Column | Notes |
| --- | --- |
| `id`, `client_id` | Client-scoped; **no `event_id`** |
| `name`, `file_url`, `file_size`, `mime_type` | File pointers into (typically) `client-media` |
| `uploaded_by` | CHECK `couple` \| `venue` |
| `share_with_venue` | boolean, default false — **flag only** |
| `source_type` | **unconstrained text** (comment: `'upload' \| …`); currently always `"upload"` from portal POST |
| `source_id` | optional; unused by portal upload |
| Status / verification / category / expires | **None** |

RLS: venue staff may RW via policy, but **no venue app UI/service queries `couple_documents`** (repo search: only portal route + `get_couple_documents`). Practically, `share_with_venue=true` does **not** surface the file in Document Workspace / event `documents` lists.

### 3.2 `documents` (venue/vendor event file SoT)

| Aspect | Detail |
| --- | --- |
| Categories | CHECK includes **`insurance`** (`lib/documents/types.ts`, migrations) |
| Entity | Exactly one of lead/client/event/vendor (`documents_one_entity`) |
| Couple visibility | `is_couple_visible` |
| Uploader | `uploaded_by_type` CHECK **`venue` \| `vendor` only** — **no `couple`** |
| Auto-complete | Only app `saveDocument` (`lib/documents/service.ts`) after insert when `entityType === "event"` |

Venue UI upload: `saveDocumentAction` / Document Workspace upload → `saveDocument` → on insurance category fires `document_uploaded` **and** `document_uploaded_insurance`.

Vendor share: RPC `share_vendor_document_to_event` can write `category = 'insurance'` into `documents` **without** firing the playbook trigger.

### 3.3 Canonical / Document Workspace

`canonical_documents` foundation and Document Workspace are **out of couple portal upload path**. Not required to invent for this WP unless product chooses full document-domain unification (larger than gap closure).

### 3.4 Can the existing model represent “couple uploaded required insurance”?

| Requirement | Representable today? |
| --- | --- |
| File exists for client | Yes — `couple_documents` row |
| Classified as insurance | **No durable couple write** (could reuse `source_type = 'insurance'` without migration; not written today) |
| Shared / visible to venue ops | Flag exists; **venue ops UI SoT is `documents`, not this flag** |
| Linked to event for playbook complete | Indirect via portal session → `event_id` at complete time; row itself is client-scoped |
| Couple authorship | Yes — `uploaded_by = 'couple'` |
| Venue-held insurance on event | Yes — `documents` where `event_id` + `category = 'insurance'` (uploader venue/vendor today) |

**Prefer no new table.** Prefer not to invent a parallel “insurance_completed” boolean on `event_tasks`. Document row (classified) should remain SoT; task completion is derived via existing trigger.

---

## 4. Existing insurance-related signals

| Signal | Where | Proves “couple uploaded required insurance”? |
| --- | --- | --- |
| `document_uploaded_insurance` | Playbook trigger; fired only from venue `saveDocument` + category insurance | Proves **an insurance-category event document was saved by venue app path** — **not** couple authorship |
| `document_uploaded` | Same `saveDocument` (any category on event) | Too broad; not insurance-specific |
| `documents.category = 'insurance'` | Venue/vendor rows | Proves classified event file; author may be venue/vendor |
| `couple_documents.source_type` | Unconstrained text | **Could** store `"insurance"`; portal hardcodes `"upload"` |
| `couple_documents.share_with_venue` | Boolean | Intent to share; **not** wired to trigger; weak venue delivery |
| UI `DOC_META.insurance` | Display only | Not a write path |
| Vendor profile `insurance_expiry` | Vendor health / Luv observations | Unrelated to couple event insurance task |
| Luv celebration types | `lib/luv/celebrations.ts` | **No insurance type**; verified map explicitly excludes this trigger |
| Filename / title match | — | **Must not invent** |
| Nav to `#documents` / open upload / Share checkbox alone | — | **Insufficient** without classification + commit rules |

**Conclusion:** No existing couple-facing signal currently proves the durable fact the product wants. The closest durable classified fact is venue/vendor `documents.category = 'insurance'`, which intentionally differs from couple upload and can complete the couple task **without the couple acting**.

---

## 5. Exact gap preventing verified completion

```
Couple task "Purchase event insurance"
  auto_complete_trigger = document_uploaded_insurance
  Mark complete BLOCKED (correct)
  CTA → #documents (no insurance focus)
        ↓
Couple UploadRow
  sourceType always "upload"
  shareWithVenue optional (default false)
  storage via /api/portal/upload → images only
        ↓
couple_documents insert
  NO triggerAutoComplete
  NO documents.category
  NO venue Document Workspace surfacing
        ↓
Task stays pending (unless venue/escape path fires trigger)
```

**Gap components (all must be closed for truthful verified completion):**

1. **No couple write of insurance classification** (hardcoded `sourceType: "upload"`).
2. **No couple path → `triggerAutoComplete(..., "document_uploaded_insurance")`.**
3. **Two-table split:** trigger SoT lives on venue `documents`+`saveDocument`; couple writes `couple_documents`.
4. **Upload mime gap:** COI PDFs blocked by image-only portal upload.
5. **Shared trigger breadth (pre-existing):** same trigger completes couple insurance **and** coordinator Vendor COIs; any venue insurance save can complete the couple task without couple upload.
6. **No Luv type** (correct until couple path proves completion).

---

## 6. Recommended smallest truthful implementation

### 6.1 Product commit definition (recommended)

Treat completion as proven only when **all** of:

1. A durable document row exists for this client/event context.
2. It is **classified** as insurance (explicit UI + persisted field — not filename inference).
3. It is **committed to the venue** (not private draft) under a single chosen SoT (below).
4. That commit calls `triggerAutoComplete(eventId, "document_uploaded_insurance", …)`.
5. UI celebration only if a new one-shot Luv insert returns `celebrated === true` (optional follow-on; not required to unblock auto-complete).

### 6.2 Recommended option — **A (smallest app change, couple_documents classification)**

1. **UX (minimal):** When CTA is Upload insurance (or explicit “This is event insurance” control on Documents), set classification `insurance` and **require** Share with venue (or auto-check + confirm). Do not redesign Documents.
2. **Persist:** `couple_documents.source_type = 'insurance'` (no migration required; column already free text). Keep `share_with_venue = true` as commit gate.
3. **Signal:** In `POST /api/portal/documents` (or a tiny portal service helper), after successful insert, if `source_type === 'insurance' && share_with_venue`, resolve `event_id` / `venue_id` from portal token and call `triggerAutoComplete(..., "document_uploaded_insurance", "couple_document", id)`.
4. **Upload:** Extend portal document upload to accept PDF (+ existing images) for document uploads — required for real COIs; without this, “verified insurance” is mostly theoretical.
5. **Optional UX:** `#documents` focus anchor on insurance upload control (`PortalWorkspaceFocus` + Impl 3 pattern) — presentation only.
6. **Luv:** Add celebration type **only after** signal ships; map trigger → type with one-shot insert; UI gated on `celebrated === true`. Deferred OK for first slice.

**Honesty caveat for Option A:** Venue Document Workspace still will not list the file unless a follow-on mirrors into `documents` or adds venue UI for `couple_documents`. Auto-complete can be truthful for “couple uploaded & marked shared,” while venue ops discovery remains a **separate** gap. Do not claim “venue has insurance in Documents” unless Option B or a mirror is shipped.

### 6.3 Alternate option — **B (align with existing trigger SoT: write `documents`)**

Couple insurance commit inserts (via SECURITY DEFINER RPC / service role) an **event-scoped** `documents` row with `category = 'insurance'`, then reuses the same auto-complete call site as venue `saveDocument` (or calls shared helper).

**Requires architectural decisions / likely schema:**

- Extend `uploaded_by_type` to include `couple` **or** accept stamping as venue (misleading).
- Storage: `documents` bucket path vs `client-media`.
- RLS / portal write path (couples do not use venue `saveDocument` session).
- Whether private couple drafts exist at all.

**Closer to “venue can see insurance in Document Workspace”** and to the historical trigger definition — **larger than a gap-closure WP** unless product already prioritizes document unification.

### 6.4 Explicitly reject

| Anti-pattern | Why |
| --- | --- |
| Complete on navigate to `#documents` / open upload | Violates verified model |
| Complete on any couple upload | No insurance proof |
| Complete on Share with venue alone | Unclassified |
| Filename contains “insurance” / “COI” | Invented signal |
| Unlock Mark complete while trigger remains | Trust regression |
| Celebrate before durable proof + one-shot flag | Impl 4 rule |

---

## 7. Whether schema changes are actually required

| Need | Schema change? |
| --- | --- |
| Classify via `couple_documents.source_type = 'insurance'` | **No** (text unconstrained) |
| Gate on `share_with_venue` | **No** |
| Fire trigger from portal API | **No** (app-level `triggerAutoComplete`) |
| Accept PDF uploads | **No DB schema** — API/storage validation change |
| Venue ops SoT = `documents` + couple authorship (Option B) | **Likely yes** — e.g. `uploaded_by_type` includes `couple`; possibly RPC |
| Split couple insurance vs Vendor COIs triggers | **Optional product decision** — new trigger value would need template/playbook updates (not strictly required for first couple path) |
| New table | **Not preferred / not required** |
| Luv insurance celebration | New `celebration_type` value in app + durable `luv_celebrations` insert (same pattern as Impl 4; confirm CHECK/enum if any — currently app-driven text) |

**Minimum for Option A:** no migration.  
**Minimum for honest venue-visible Option B:** migration/RPC likely — treat as potential STOP for “gap closure only.”

---

## 8. Exact files / tables / RPCs that would need changing (plan only)

### Option A (recommended smallest)

| Area | Touch (plan) |
| --- | --- |
| UI | `components/portal/couple-documents-section.tsx` — insurance classify + share commit UX; optional focus id |
| Upload API | `app/api/portal/upload/route.ts` (+ possibly `lib/storage.ts`) — non-image document mime for document uploads |
| Documents API | `app/api/portal/documents/route.ts` — accept `sourceType: "insurance"`; gate + `triggerAutoComplete` |
| Trigger helper | `lib/playbooks/service.ts` `triggerAutoComplete` (call only; likely unchanged) |
| Routing (optional) | `lib/portal/unified-tasks.ts`, `lib/portal/workspace-routing.ts` — focus `insurance` or reuse a new focus key |
| Tests | `lib/portal/unified-tasks.test.ts`, workspace-routing tests; new API/unit coverage for classify+share→trigger |
| Luv (later) | `lib/luv/celebrations.ts`, `lib/luv/verified-domain-celebrations.ts`, migration/RPC pattern from `20261234000000_*` only when celebrating |
| Tables | `couple_documents` (writes only); `event_tasks` (via existing auto-complete) |
| RPCs | None new if trigger stays in TS; alternatively security-definer RPC for atomic insert+complete |

### Option B (venue `documents` SoT)

| Area | Touch (plan) |
| --- | --- |
| Migration | `documents.uploaded_by_type` CHECK; possibly couple portal insert RPC |
| RPC | New e.g. `upload_couple_event_insurance` (insert `documents` + auto-complete) |
| Service | Share logic with `lib/documents/service.ts` trigger block |
| Portal UI/API | Point insurance commit at new RPC; storage path strategy |
| Read path | Existing `get_couple_documents` already surfaces couple-visible/`event` docs |

### Do not change (this WP)

Payments, Vendor Share Timeline, WW Studio/Collections/Photo Styles/RSVP, Couple Home hierarchy, generic Document Workspace redesign, inventing payment/insurance celebrations before signal.

---

## 9. Completion flow after change (couple path)

### Option A flow

```
Playbook task pending (document_uploaded_insurance)
  → CTA “Upload insurance” → #documents[/focus]
  → Couple selects file + commits as Insurance + Share with venue
  → Storage accepts PDF/image
  → INSERT couple_documents (source_type=insurance, share_with_venue=true, uploaded_by=couple)
  → triggerAutoComplete(event, document_uploaded_insurance, couple_document, id)
  → Matching event_tasks → complete (system)
  → (optional) luv_celebrations insert onConflict do nothing → celebrated?
  → UI shows Luv only if celebrated === true
  → Refresh: task done; no Mark complete; no re-celebrate on refetch
```

**Non-completing actions:** open Documents, pick file without commit, private upload, generic `source_type=upload`, checkbox alone, navigation, refetch.

### Escape / other paths (unchanged unless product splits triggers)

- Venue `saveDocument` insurance still completes all matching trigger rows (couple + Vendor COIs).
- Coordinator waive/complete still available.

---

## 10. STOP / NO-GO conditions

**GO (Option A)** if product accepts:

- Proof fact = “couple uploaded a document classified insurance and shared with venue” on `couple_documents`.
- Venue Document Workspace may **not** show that file until a later mirror/UI WP.
- Existing shared trigger may also clear **Vendor COIs in file** when couple insurance fires (pre-existing venue-path coupling).

**STOP / NO-GO (needs architectural decision first)** if product requires any of:

1. **Venue Document Workspace / `documents` table is the only acceptable SoT** for “insurance on file” — choose Option B (schema/RPC), do not fake completeness on `couple_documents` alone.
2. **Couple insurance must not complete Vendor COIs** (and/or venue vendor COI must not complete couple purchase task) — need **split triggers** / uploader-aware complete before wiring couple fire.
3. **Venue staff verification / approval** before couple task completes — no such status model exists; would be new workflow, not a gap wire.
4. **Unify under canonical_documents** first — out of scope; defer insurance couple path.

**Soft STOP inside Option A:** shipping classify+trigger **without** PDF (or non-image) upload support is not a truthful real-world COI path — treat mime expansion as in-scope for the first implementation slice.

---

## Critical product answer (durable fact)

> Can we independently verify: “couple has uploaded insurance for this event”?

**Today: No.**

| Candidate | Independent? | Coupled to couple upload? |
| --- | --- | --- |
| `event_tasks.status = complete` + trigger | Incomplete proof | May be venue/escape |
| Venue `documents` insurance row | Independent of tasks | Not couple-proven |
| `couple_documents` insurance + shared | Would be couple-proven after Option A | Not written today |
| Nav / generic upload / share alone | No | — |

After Option A: **Yes** for “classified + shared couple upload,” queryable on `couple_documents`, with auto-complete as derived presentation — **if** product accepts that SoT.  
After Option B: **Yes** for “event insurance document authored/attributed to couple” on `documents`, aligned with venue ops visibility — with schema/RPC cost.

---

## Explicit confirmations

- [x] Investigation only — no implementation
- [x] No migrations / schema / UI / tests / seed / data changes (except this report file)
- [x] No push
- [x] No invented signals recommended
- [x] Luv planned only after proven signal; not required for first auto-complete slice
- [x] Scope protection respected
- [x] **Await approval before any implementation**

---

## Paste-ready summary for parent

### Verdict
Insurance remains an **intentional verified-completion gap**. Couple portal cannot earn `document_uploaded_insurance`. Only venue `saveDocument` + `category=insurance` fires the trigger. Manual complete is correctly blocked → couple strand risk unless venue escape.

### Lifecycle
Playbook creates `Purchase event insurance` with trigger `document_uploaded_insurance` → CTA Upload insurance → `#documents` (no focus) → couple generic upload to `couple_documents` (`source_type=upload`) → **no auto-complete**. Same trigger string also used by coordinator `Vendor COIs in file`.

### Couple upload
`UploadRow` → image-only `/api/portal/upload` → `POST /api/portal/documents` → `couple_documents`. Share-with-venue optional; **no venue UI consumes that table**.

### Model
`couple_documents`: no category column; free-text `source_type` unused for insurance; no verification status. Venue SoT `documents` has real `insurance` category and is what fires the trigger. Prefer no new table.

### Gap
Missing: couple insurance classification + venue-commit semantics + trigger fire + PDF-capable upload. Existing signal does not prove couple upload.

### Smallest truthful plan
**Option A:** persist `source_type=insurance` + require `share_with_venue` → `triggerAutoComplete`; expand upload mime for documents; optional focus; Luv later. **No migration.** Honesty: venue Document Workspace still blind unless Option B/mirror.

### Schema required?
**Option A: no. Option B (documents SoT + couple authorship): likely yes → STOP for tiny WP.**

### STOP if
Venue `documents` must be SoT, triggers must split couple vs Vendor COIs, approval workflow required, or canonical doc unification demanded first.

### Status
**STOP for approval — no implementation.**
