# Document Domain — Adapter Plan (Conceptual Only)

**Date:** 2026-08-07
**Phase:** 4 — Foundation. This is a plan, not an implementation. No adapter below is built in this phase; nothing here writes to or reads from any existing table.

For each of the seven existing document-producing systems identified in Phase 1, this plan states: what it is today, what it becomes in the canonical model, how the migration would proceed, what could go wrong, and roughly how hard it is — in that order, so the hardest, highest-value system (Contracts) is planned first, matching the sequencing already committed to in the certified architecture's own conceptual Migration Strategy.

---

## 1. Contracts

| | |
|---|---|
| **Current source** | `contracts` (+ `contract_templates`, `contract_activities`) |
| **Canonical destination** | `canonical_documents` (owner=relationship, behavior=negotiated, type='contract') with one `canonical_document_versions` row per draft revision, culminating in a locked version whose `canonical_document_representations` row is the signed artifact |
| **Migration strategy** | Additive first: on `sign_contract()`, also write a `canonical_documents` + locked `canonical_document_versions` row, with a `canonical_document_references` row (`reference_type='contract', role='produced_by'`) pointing back to the original `contracts.id`. Existing `contracts` table and its own sign flow keep working entirely unchanged — this is a shadow write, not a cutover, for as long as needed to build confidence. Only once the shadow write has run in production long enough to trust does read traffic (the couple portal's Documents tab) switch to reading the canonical row instead of the `contracts` row directly. `contract_activities` maps directly onto `canonical_document_audit` with no structural change needed. |
| **Risk** | Low-moderate. The signing flow (`sign_contract`, anonymous-token-based) is the one piece of this whole landscape already proven correct (Phase 1) — the risk is entirely in not disturbing it, not in the mapping itself, which is clean. The one real risk: `contracts_sign_read`'s known, "intentionally preserved" anonymous-by-UUID read gap (Phase 1) must not be silently inherited by the canonical table's own RLS — the canonical foundation's RLS (this phase) does not grant any anonymous read path at all, which is correct and stricter; the adapter must not weaken it to match the old behavior. |
| **Complexity** | Moderate. Shadow-write is one new call site inside `signContractByToken`; no schema risk since canonical tables are already additive and live. |

## 2. Invoices

| | |
|---|---|
| **Current source** | `invoices` / `invoice_line_items` |
| **Canonical destination** | `canonical_documents` (owner=relationship, behavior=venue_authored, type='invoice') — the Invoice Business Object stays exactly where it is; only its PDF-equivalent representation becomes canonical |
| **Migration strategy** | Since no PDF generation exists today (Phase 1/3 finding, confirmed), there is no artifact to migrate yet — this adapter is really "build PDF generation for the first time, targeting the canonical model directly" rather than a migration of existing data. Lowest-regret order: implement invoice PDF generation as a Generated-behavior canonical Document from day one; never build a second, non-canonical invoice-PDF system first. |
| **Risk** | Low — there is nothing existing to break, since no generator exists. The only risk is sequencing: if a future team builds "quick" ad hoc invoice PDF generation before this foundation is adopted, that becomes an eighth parallel system exactly like Phase 1 warned against. |
| **Complexity** | High, but for reasons outside this plan's scope — PDF rendering itself (a real templating/rendering pipeline) is new work, not an adapter problem. |

## 3. Vendor Library Documents

| | |
|---|---|
| **Current source** | `vendor_library_documents` (+ `share_vendor_document_to_event`'s copy into `documents`) |
| **Canonical destination** | `canonical_documents` with `owner_type='vendor'` for the reusable library item; when shared to an event, a **second** canonical Document is created with `owner_type='event'` and a `canonical_document_references` row (`reference_type='vendor_library_source', role='cloned_from'`) pointing to the first — this is the one existing system whose real-world behavior (a one-time copy, not a live link) already matches the canonical model's Cloning relationship (architecture §2) exactly, with no conceptual change needed, only a table change. |
| **Migration strategy** | Straightforward table-for-table swap: `vendor_library_documents` rows become `canonical_documents` rows (`owner_type='vendor'`); the `share_vendor_document_to_event` RPC is rewritten to insert into `canonical_documents`/`canonical_document_references` instead of `documents`, preserving its exact external signature so no caller (the vendor portal UI) needs to change in the same commit. |
| **Risk** | Low. This is the cleanest adapter of the seven — the existing design already anticipated the canonical model's Cloning relationship by accident. |
| **Complexity** | Low. |

## 4. Legacy Documents (`documents` + `couple_documents`)

| | |
|---|---|
| **Current source** | `documents` (the existing "universal" table) and `couple_documents` (self-declared legacy, Phase 1) |
| **Canonical destination** | `canonical_documents`, owner resolved from whichever of `lead_id`/`client_id`/`event_id`/`vendor_id` is set on the legacy row (mapping directly to `relationship`/`event`/`vendor`; `lead_id`-owned rows need a policy decision — Leads are not one of the five certified owner types, see Open Question below) |
| **Migration strategy** | This is the highest-volume, lowest-risk system to migrate mechanically (the existing `documents` table is already the closest match to the canonical model, per the certified architecture's own §1.1) — a straight column-mapping backfill, run once, is realistic here, unlike Contracts where a shadow-write period is warranted. `couple_documents` rows fold in as `canonical_documents` with `source='uploaded'`, `owner_type='relationship'`, tagged via a `canonical_document_references` row noting their legacy origin for audit purposes. |
| **Risk** | Moderate — this is the table five other migrations already bolted columns onto (`is_couple_visible`, `uploaded_by_type`, `source_library_document_id`, `shared_with_vendors`), so the backfill mapping needs to account for all five, not just the original schema. The `documents_one_entity` constraint's `lead_id` case has no corresponding canonical owner type — a real open question (below), not a mapping detail to gloss over. |
| **Complexity** | Moderate — mechanical, but with more columns to reconcile than any other adapter. |

**Open question this plan surfaces rather than resolves:** `documents.lead_id` is a real, populated owner path today, and "Lead" is not one of the five certified owner types (architecture §3). Before this adapter is built, a decision is needed: does a Lead-owned document become Relationship-owned once the lead converts to a client (the common case), or does the canonical model need a sixth owner type for pre-relationship documents? This is exactly the kind of gap this planning phase exists to surface early, per the Final Rule of the certification phase.

## 5. Floor Plans

| | |
|---|---|
| **Current source** | `floor_plans` / `floor_plan_objects` |
| **Canonical destination** | Not migrated at all — remains a Structured Record permanently (certified architecture §1). Only its **export**, if and when export/print capability is confirmed or built, becomes a `canonical_documents` row (`owner_type='event'`, `behavior='generated'`). |
| **Migration strategy** | None needed for the editor data itself. If/when a floor plan export exists, it writes directly to `canonical_documents` from day one, the same "don't build a second system first" logic as Invoice PDFs. |
| **Risk** | None for the editor. |
| **Complexity** | None for this phase; export generation itself is new work, not a migration. |

## 6. Message Attachments

| | |
|---|---|
| **Current source** | `conversation_message_attachments` |
| **Canonical destination** | Remains a separate, lighter-weight Attachment concept permanently (architecture ADR-5) — not migrated. A new "promote to Document" action, additive, lets a specific attachment become a real `canonical_documents` row (with a `canonical_document_references` row, `reference_type='message', role='attached_to'`) on explicit request. |
| **Migration strategy** | No bulk migration, ever — promoting years of casual chat attachments into a full audit/lifecycle-bearing Document model would be exactly the over-reach the certified architecture deliberately avoided. Only the promotion action is new, additive capability. |
| **Risk** | None — this system is intentionally left alone. |
| **Complexity** | Low, whenever the promotion action itself is built (not part of this phase). |

## 7. Questionnaires

| | |
|---|---|
| **Current source** | `event_questionnaires` |
| **Canonical destination** | `canonical_documents` (`owner_type='event'`, `behavior='collaborative'`) — each questionnaire becomes a Document; each edit-and-resubmit cycle becomes a new `canonical_document_versions` row; a submission becomes a locked version with a snapshot `canonical_document_representations` row |
| **Migration strategy** | Shadow-write on submission first (same pattern as Contracts) — write a canonical row alongside the existing `event_questionnaires` write, without removing or changing the existing table, until the reopening/versioning behavior (Type Matrix §6, §12) has been exercised in production and trusted. |
| **Risk** | Low-moderate — the "reopened questionnaire" edge case (Type Matrix §12) is real, already-supported-by-design behavior for the canonical model, but has no equivalent test today in the legacy table to compare against; needs its own dedicated verification pass before cutover, not just a schema mapping check. |
| **Complexity** | Moderate. |

---

## Sequencing Summary

1. **Vendor Library Documents** — cleanest mapping, lowest risk, do first to prove the adapter pattern itself works end-to-end on something low-stakes.
2. **Legacy Documents (`documents`/`couple_documents`)** — highest volume, mechanical, but resolve the Lead-ownership open question *before* starting, not during.
3. **Contracts** — highest-value, most mature existing lifecycle; shadow-write, verify, then cut reads over.
4. **Questionnaires** — same shadow-write pattern as Contracts, applied to a genuinely different Behavior (Collaborative vs. Negotiated) to prove the model generalizes, not just that it worked once.
5. **Invoices, Floor Plan Export** — net-new generation work targeting the canonical model from day one; not migrations, and lowest priority precisely because there's nothing at risk of breaking.
6. **Message Attachments** — never bulk-migrated; only the promotion action is ever built, whenever it's needed.

Nothing in this plan is implemented in this phase.
