# Document Management System — Architecture Certification (Phase 1)

**Date:** 2026-08-07
**Scope:** Architecture certification only. No code, schema, or UI changes were made. Every claim below is sourced from a direct read of migrations, service/repository code, and RLS policies — not inferred from naming or assumed from convention. Where something could not be directly verified, it is stated as unverified rather than assumed.

**Method note:** four parallel research agents were launched to build the initial inventory and all four failed mid-run (hit the session's API usage limit). No result was taken from them. Everything in this report was traced personally, directly, against the actual migrations and code, sequentially, after that failure — consistent with the "trace the actual implementation, do not assume" mandate. Coverage is deep on schema, storage, permissions, automation, and financial integration (all read directly); coverage on pixel-level UI walkthroughs and exhaustive reporting-surface search is narrower than a full second pass would give — flagged explicitly where that boundary matters.

---

## 1. Current Architecture

There is no single Document model. There are **at least seven** distinct, independently-evolved systems that each store what a user would call "a document," plus **eight** separate storage buckets. One later migration partially stitched three of them together for one specific read path (the couple portal's Documents tab) — nothing else was unified.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         "Documents" as experienced                   │
│                    by a couple in their portal today                 │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                    get_couple_documents(token)  — UNION ALL of:
        ┌─────────────┬──────────────┬──────────────┬────────────────┐
        │              │              │               │                │
   contracts       invoices       documents      couple_documents
   (own table,     (own table,    (the "universal"  (separate table,
   own lifecycle,  line items,    doc table —       couple's own
   own sign flow,  no file,       the ONLY one       uploads, marked
   fileUrl=null    fileUrl=null)  with a real file)  "legacy, kept for
   in this view)                                     backward compat")

        Meanwhile, NOT reachable through that RPC at all:
        ┌────────────────────┬───────────────────┬─────────────────────┐
   vendor_library_documents  floor_plans /    conversation_message_
   (vendor's own table,      floor_plan_objects  attachments
   copied into `documents`   (structured editor   (message/portal
   only when explicitly      data, own bucket,    attachments, own
   shared to an event)       own everything)       table)
```

Eight storage buckets exist: `documents`, `uploads`, `floor-plans`, `client-media`, `couple-messages`, `inventory`, `request-uploads`, `vendors` (vendor logos). At least five of these (`documents`, `uploads`, `floor-plans`, `client-media`, `couple-messages`) can plausibly hold document-like content for overlapping purposes; nothing routes them through a common access layer.

### 1.1 The `documents` table (the closest thing to a canonical model)

`public.documents` — created Sprint 25, explicitly billed in its own migration comment as *"A universal document system supporting Leads, Clients, Events, and Vendors. One table, one storage bucket, one reusable component."* This is the only genuinely general-purpose, category-driven, multi-entity document table in the platform.

- **Owner columns:** exactly one of `lead_id` / `client_id` / `event_id` / `vendor_id` (originally required exactly one; later relaxed to *at most* one, to support venue-level template documents with none set — traced in `20260728000000_planning_templates_ux_rebuild.sql`).
- **Category enum:** `contract`, `insurance`, `inspiration`, `floor_plan`, `menu`, `permit`, `questionnaire`, `invoice_copy`, `other` — note `contract` and `floor_plan` and `invoice_copy` are categories here, even though contracts, floor plans, and invoices *also* each have their own separate, fully independent table and lifecycle elsewhere. A user could genuinely end up with a "contract" as a `documents` row with category=`contract` *and* a real, separate `contracts` row for the same agreement, with no link between them.
- **Provenance columns added over time** (five separate migrations touched this table after its creation): `is_couple_visible`, `uploaded_by_type`/`uploaded_by_id`, `source_library_document_id`, `shared_with_vendors`. This is organic, incremental growth, not a redesign — each addition is narrow and well-commented, but the table has accreted five different sharing/visibility dimensions independently.

### 1.2 `contracts` / `contract_templates` / `contract_activities`

A complete, independent subsystem: draft → sent → signed/cancelled/expired lifecycle, a real e-signature flow (`sign_contract(token, signer_name)`, anonymous-callable via a secret `sign_token`), and its own audit log (`contract_activities`). This is the most mature lifecycle system in the whole document landscape — and it has no `document_id` and is not a row in `documents`. Its "content" is resolved template text, not a stored file — a signed contract has no downloadable PDF artifact anywhere (see §6, "Missing Architecture").

### 1.3 `invoices` / `invoice_line_items`

Structured financial data (subtotal, tax, line items, `balance_due`), not a file. No `storage_path`/`storage_url` columns exist on `invoices` at all. In the one place invoices are shown to a couple as a "document" (the portal aggregation RPC), `fileUrl` is hard-coded `null`.

### 1.4 `couple_documents`

A separate table, created for the couple's *own* uploads, predating the `documents`-table integration into the portal entirely. As of the most recent migration touching the portal Documents view, its own comment states it is *"kept for backward compatibility, not the primary venue share path going forward."* It is still live, still queried, still unioned into the couple's Documents tab today. This is a confirmed, self-declared legacy system that was never actually retired.

### 1.5 `vendor_library_documents`

A vendor's own reusable template library (COI, W-9, rate card), independent of any venue, because a vendor works with many venues. When a vendor shares a library document onto a specific event, the row is **copied** into `documents` (via `share_vendor_document_to_event`) with `source_library_document_id` pointing back — a one-time copy, not a live reference. If the vendor later updates their master COI in the library, every previously-shared copy is now silently stale, with nothing to detect or flag that.

### 1.6 `floor_plans` / `floor_plan_objects`

A fully structured visual editor (shapes, objects, its own dedicated `floor-plans` storage bucket) — a fundamentally different representation from "a file." A floor plan can *also* exist as a `documents` row with `category='floor_plan'` (e.g., an uploaded PDF instead of the editor), meaning two structurally unrelated things both legitimately answer "where's the floor plan?"

### 1.7 `conversation_message_attachments`

A separate table for files attached to messages (three migrations: core, portal variant, vendor variant), with its own `couple-messages` storage bucket. Not reachable from any of the above.

### 1.8 `legal_documents`

Platform-wide, versioned Terms of Service / Privacy Policy / etc. — genuinely a different domain (legal content text, not operational venue/event files) and not a competing "Document Center" candidate. Noted for completeness per the inventory instruction, not counted as fragmentation.

---

## 2. Strengths

- The `documents` table itself is reasonably well-designed and has evolved sensibly: category-driven, multi-entity, correctly-constrained ownership, and its RLS was properly broadened from "literal owner only" to "any active team member" in the team-collaboration migration, with a *separate, correctly role-gated* restrictive policy limiting **delete** specifically to `owner`/`manager` (an assistant can view/upload but not delete) — a genuinely mature, deliberate permission model, not an oversight.
- **Automation is real and correctly wired**, not just declared. Traced every call site of `triggerAutoComplete` in the codebase: `contract_signed` fires from the actual signing flow (`lib/contracts/service.ts`), `document_uploaded` and `document_uploaded_insurance` fire from the actual upload path (`lib/documents/service.ts`, the insurance sub-trigger firing specifically when `category === 'insurance'`), and `floor_plan_created` fires from all three floor-plan-creation call sites (`lib/floor-plans/service.ts`). Playbook task templates ("Sign your contract," "Vendor COIs in file") genuinely auto-complete on these events. This is a real strength worth preserving in any redesign.
- The vendor-document extension (`vendor_library_documents` + `share_vendor_document_to_event`) is a thoughtful design for a genuine constraint (a vendor serves many venues, so their reusable documents can't be venue-scoped) — the *pattern* is reasonable even though the sync-back gap (§5) is real.
- The one place multiple document sources genuinely were unified — the couple portal's Documents tab — was unified with real content (line items, sign tokens, real file URLs where they exist), not stub rows; the migration that did this explicitly documents the broken prior state it replaced.

## 3. Weaknesses

- **No canonical Document model.** At least seven independently-evolved storage systems (documents, contracts, invoices, couple_documents, vendor_library_documents, floor_plans, conversation_message_attachments) each implement their own idea of "a file with an owner." Only one read path (couple portal) stitches three of them together, and only for display — not for storage, permissions, or lifecycle.
- **Storage-level access control does not match the apparent intent of any of the table-level RLS.** Every storage bucket checked (`documents`, `floor-plans`, `uploads`, `couple-messages`) grants `SELECT` to `anon` (unauthenticated) gated only by `bucket_id` — meaning any file's public URL is downloadable by anyone who has or guesses it, regardless of which venue/client/event it belongs to. This is consistent across the whole storage layer, not a documents-specific oversight — it's the platform's established security posture (security-through-unguessable-URL rather than per-object RLS). Worth an explicit decision before this becomes "the platform's core trust system," not a silent inheritance.
- **Contract read-by-anon is broader than the sign token.** `contracts_sign_read` allows any unauthenticated request to read a contract by row ID (not by `sign_token`) as long as its status is `sent` or `signed`. The migration comment marks this "intentionally preserved" — a conscious tradeoff (UUID-as-bearer-secret), not an oversight, but worth a real decision rather than continued inheritance into a permanent Document Center.
- **No activity/audit trail for generic documents.** `contracts` has `contract_activities`. `documents` — the table meant to be the universal one — has no equivalent. No record of who uploaded, replaced, or viewed a generic document exists anywhere.
- **No versioning anywhere.** A "new version" of any document (contract, generic upload, vendor library item) is a brand new row/file with no supersession link, except the one-directional, no-sync-back `source_library_document_id` on vendor-shared copies.

## 4. Duplicate Systems

| Concept | Competing implementations |
|---|---|
| "A document with an owner and a category" | `documents` (the universal one) vs. `couple_documents` (couple's own uploads, self-declared legacy) |
| "A contract" | `contracts` table (real lifecycle/signing) vs. `documents` rows with `category='contract'` (no link between them) |
| "A floor plan" | `floor_plans`/`floor_plan_objects` (structured editor) vs. `documents` rows with `category='floor_plan'` (an uploaded file) |
| "An invoice as a document" | `invoices` (structured data) vs. `documents` rows with `category='invoice_copy'` |
| "A vendor's document" | `vendor_library_documents` (vendor-owned template) vs. its one-time-copied instance in `documents` once shared |
| Generic file storage | 8 separate storage buckets, at least 5 of which can hold document-like content |

## 5. Dead / Legacy Systems

- **`couple_documents`** — explicitly self-declared as legacy in the migration that partially superseded it, still live, still queried, never removed or migrated forward.
- **Vendor-library-to-event sync** — not dead, but a confirmed dead-end: the copy made at share time never updates again; there is no mechanism to detect drift.

## 6. Missing Architecture

- **No PDF generation exists anywhere in the codebase.** Confirmed by direct search (no puppeteer, jsPDF, react-pdf, pdf-lib, or equivalent). A "signed contract" has no downloadable file artifact — it is rendered from stored text on demand. If "generated PDFs" is a real product requirement for the Document Center, it does not exist today in any form, not even a rough one.
- **No approval workflow** for generic documents. `documents` has no status/approval field; nothing distinguishes "uploaded" from "reviewed" from "approved."
- **No expiration/retention automation.** `documents.expires_at` exists as a column (used for COIs/permits) but nothing was found that reads it — no reminder, no task, no report. It is captured and then unused.
- **No reporting surface found** that can answer "which events have unsigned contracts / expired insurance / missing floor plans" — this was checked via targeted search (no dedicated `app/**/reports` document-status view found), not a full UI walkthrough; flagged as **unverified-absence** rather than confirmed-absence, since a narrower, embedded version could exist inside another dashboard view this pass didn't fully enumerate.
- **No guest-facing document capability found** — no evidence of any guest role interacting with documents at all.

## 7. Release Risks

1. Building a permanent Document Center on top of `documents` alone, without first deciding what happens to `contracts`, `invoices`, `couple_documents`, `vendor_library_documents`, and `floor_plans`, will produce an eighth parallel system rather than a consolidation.
2. The bucket-wide-public-read storage pattern, inherited unexamined, becomes a much bigger liability once this is positioned as "one of the core trust systems of VenueOS" — worth a conscious decision now, not an inherited default.
3. The contract-by-UUID anonymous read path is a known, conscious tradeoff today; it should be an explicit, documented decision in the Document Center's threat model, not silently carried forward.
4. No audit trail on generic documents means a "core trust system" cannot currently answer "who touched this and when" for the majority of file types it would hold.

## 8. Root Cause Analysis

| Question | Verdict |
|---|---|
| Is there one canonical Document model? | **FAIL** — at least seven independent systems, one partial read-time union for one surface. |
| Is there one canonical storage model? | **FAIL** — eight buckets, no common access layer, uniform-but-broad public-read RLS inherited by convention, not decided per-system. |
| Is there one canonical lifecycle? | **FAIL** — contracts have a real lifecycle (draft/sent/signed + activity log); generic documents have none; invoices have a payment-status lifecycle unrelated to either. |
| Is there one canonical permissions model? | **PARTIAL** — the `documents` table itself has a genuinely coherent, role-aware model (team-scoped access, owner/manager-gated delete). It is not shared by `contracts` (separately but consistently defined), `couple_documents`, or `vendor_library_documents` (each independently defined, not provably consistent with each other). |
| Is there one canonical activity model? | **FAIL** — only `contracts` has one. |
| Is there one canonical automation model? | **PASS** — genuinely verified: `contract_signed`, `document_uploaded`, `document_uploaded_insurance`, `floor_plan_created` all fire correctly from their real source-of-truth actions into one shared `triggerAutoComplete` playbook mechanism. This is the one area of the whole landscape that is already unified and working as designed. |
| Is there one canonical reporting model? | **FAIL / UNVERIFIED** — no document-status reporting surface was found; this pass's search was targeted, not exhaustive, so treat as a strong signal rather than a certainty. |

## 9. Recommendation

**ARCHITECTURE REQUIRES REFACTOR BEFORE BUILDING**

The automation layer is a genuine, working exception — proof that unification is achievable here, not a hypothetical. Everything else — storage, ownership, lifecycle, activity history, and permissions — is fragmented across seven independently-evolved systems, one legacy table that was explicitly meant to be retired and wasn't, and eight storage buckets sharing a security posture that was never a deliberate decision for a system meant to hold contracts and insurance certificates. Building a Document Center directly on today's `documents` table would add an eighth parallel system rather than resolve the existing seven — precisely the mistake this certification exists to prevent repeating.

Before implementation begins, the refactor should decide, explicitly: which of the seven existing systems become the Document Center's actual storage (most likely `documents`, given its relative maturity and correct automation wiring); what happens to `couple_documents` (retire, don't just keep unioning); whether `contracts` and `floor_plans` remain separate specialized systems that *reference* the Document Center for their file artifacts, or fold in entirely; and a conscious, documented decision on storage-level access control before this becomes a system holding signed contracts and insurance certificates for years.
