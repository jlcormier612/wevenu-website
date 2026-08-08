# Document Domain — Foundation Validation Report

**Date:** 2026-08-07
**Phase:** 4 — Foundation implementation. Every claim below was tested against the live local database with real inserts, not asserted from reading the schema. Test data was created and then deleted; no residue remains (verified at the end of this report).

---

## 1. Documents own Versions

**Proven by:** a real `canonical_documents` row was created, then a `canonical_document_versions` row was inserted referencing it via `document_id`. A second attempt to insert a second **current** version for the same document was rejected:

```
ERROR:  duplicate key value violates unique constraint "canonical_document_versions_one_current"
DETAIL:  Key (document_id)=(099e79f8-...) already exists.
```

This is enforced structurally (a partial unique index on `(document_id) where is_current`), not by convention — a caller cannot violate "at most one current version per Document" even by mistake.

## 2. Versions own Representations

**Proven two ways.**

Structurally: `canonical_document_representations` has **no `document_id` column at all** — confirmed directly against `information_schema.columns`:

```
 id, version_id, representation_type, storage_provider, storage_path,
 storage_url, mime_type, byte_size, checksum, generated_by_type,
 generated_by_id, created_at
```

There is no path to associate a Representation with a Document except through its Version — the invariant can't be violated because there's no column to violate it with, which is stronger than a constraint that could theoretically be worked around.

Behaviorally: a real chain was built — Document → Version → (locked) → Representation — and the Document was successfully transitioned through `shared → pending_action → finalized`. The transition trigger explicitly checks that the Document's *current version* has a locked Representation path before allowing `finalized`, tying the Document's own lifecycle to facts that only exist at the Version level.

## 3. Business Objects reference Documents

**Proven with a real Business Object**, not a synthetic one: an actual row from the existing `contracts` table (`"Wedding Venue Agreement — Emma & Jordan"`, untouched, pre-existing data) was linked to a new `canonical_documents` row via `canonical_document_references`:

```
 document_name  | reference_type |             contract_title              |    role
----------------+----------------+-----------------------------------------+-------------
 Reference test | contract       | Wedding Venue Agreement — Emma & Jordan | produced_by
```

The join resolves cleanly in both directions. Critically, **the reference is one-directional and does not grant the Contract any ownership claim** — `contracts` was not modified, gained no new column, and nothing about the existing `contracts` table's own RLS, data, or behavior changed. The Document references the Business Object; the Business Object was never made aware of it.

## 4. No duplicate ownership exists

**Proven by direct schema inspection.** `owner_type`/`owner_id` exist on exactly one base table (`canonical_documents`) across the entire foundation. They also appear on the five reporting views (`canonical_documents_awaiting_signature`, `_expired`, `_recently_generated`, `_shared_today`, `canonical_document_completion_by_type`) — expected and correct, since a SQL view does not store data, it re-derives these columns from the one base table on every query. No other **table** (Version, Representation, Reference, Share, Audit, Event) carries its own independent owner column — each resolves ownership by joining back to `canonical_documents`, confirmed explicitly in every RLS policy on those six tables (`exists (select 1 from canonical_documents d where d.id = document_id and ...)`).

Two further checks, both passed:
- **Owner shape is enforced, not just documented.** `owner_type='system'` with a non-null `owner_id`, and `owner_type='venue'` with a null `owner_id`, were both attempted and both rejected by `canonical_documents_owner_id_shape`.
- **Visibility is not stored redundantly.** There is no `visibility` column anywhere — it is computed on demand from `canonical_document_shares` via `canonical_document_is_shared()`, so "is this shared" can never drift out of sync with the actual share grants, because there is only one place that fact lives.

## 5. No architecture rules were violated

Every certified property from `document-domain-canonical-architecture.md` §2 is present, with an explicit, tested mechanism — not just a column that exists unused:

| Certified property | Where it lives | Verified how |
|---|---|---|
| Identity | `canonical_documents.id` | Standard PK |
| Owner | `owner_type` + `owner_id` | Shape constraint tested (§4 above) |
| Source | `canonical_documents.source` | CHECK enum |
| Type | `canonical_documents.type` | Free text, extensible without migration |
| Status | `canonical_documents.status` | 8-state CHECK enum; transitions enforced by trigger, tested live (§6) |
| Visibility | Computed, not stored | `canonical_document_is_shared()` |
| Lifecycle | `canonical_document_validate_status_transition()` | Tested with 2 valid and 2 invalid transitions |
| Versioning | `canonical_document_versions` | One-current-per-document tested |
| Relationships | Owner (1) + `canonical_document_references` (0..n) | Tested with a real Contract |
| Storage | `canonical_document_representations` storage columns | Provider-agnostic; no bucket created (§9 requirement) |
| Metadata | `name`/`notes`/`tags`/`expires_at` | Present, unconstrained beyond type |
| Automation Events | `canonical_document_events` + `emit_canonical_document_event()` | Callable, confirmed **not** wired to any trigger (§6 requirement: infrastructure only) |
| Audit | `canonical_document_audit` | Append-only — see grants below |
| Sharing | `canonical_document_shares` | Distinct from Visibility (computed) |
| Retention | `canonical_documents.retention_policy` | Free-text policy pointer, no deletion logic attached (correctly out of scope) |
| Archiving | `status='archived'`, reversible per the transition table | `archived → draft` transition explicitly allowed (Type Matrix §12, Questionnaire reopening) |
| Deletion | `status='deleted'`, terminal | Transition table: no outbound transition from `deleted` |
| Generation / Signing / Approval / Expiry | `canonical_document_behavior_capabilities()` + `expires_at` | Derived from Behavior, not stored redundantly (avoids the exact duplication the Entity Model forbids) |

**One design decision is flagged, not silently made** (per the FINAL RULE's instruction to stop and explain rather than proceed quietly): whether Version should carry its own parallel lifecycle status, given this phase's own brief titles a section "VERSION TRANSITIONS." Resolved in the migration's own header comment — Document.status remains the single authoritative field (matching the architecture one-to-one); Version carries only the minimal facts (`is_current`, `locked_at`) that make Document-level transitions meaningful, avoiding the redundant, driftable duplicate state a second status enum would create. This is a clarification of an underspecified relationship between two already-certified properties, not a change to either property — no property was added, removed, or redefined.

**Immutability of Representations is enforced at the grant level, not just by convention.** `information_schema.role_table_grants` confirms `authenticated` has only `INSERT`/`SELECT`/`REFERENCES`/`TRIGGER` on `canonical_document_representations` — no `UPDATE`, `DELETE`, or `TRUNCATE`. The same applies to `canonical_document_audit` and `canonical_document_events` (append-only). One real gap was found and closed during this validation: `TRUNCATE` is granted to `authenticated` platform-wide by a default this migration does not control (confirmed present on the pre-existing `documents` table too, so not introduced by this phase) — `TRUNCATE` bypasses RLS entirely in Postgres, which would have silently defeated the immutable/append-only guarantee. Explicitly revoked on all three tables where that guarantee is a stated property; not revoked platform-wide, which is correctly out of scope for a foundation-only phase.

---

## Success Criteria Check

| Criterion | Status |
|---|---|
| No existing feature has changed | **Confirmed** — `documents` (8 rows), `contracts` (2 rows), `couple_documents` (0 rows) row counts identical before and after this migration. Zero `ALTER TABLE` statements against any pre-existing table. |
| No user-visible behavior has changed | **Confirmed** — zero application code (`.ts`/`.tsx`) was touched; `npx tsc --noEmit` is clean; nothing in `app/` or `components/` references any `canonical_document_*` table yet. |
| No migrations of legacy systems have occurred | **Confirmed** — see Adapter Plan (`document-domain-adapter-plan.md`); every adapter described there is planned, none implemented. |
| The canonical Document foundation exists | **Confirmed** — 7 tables, 5 reporting views, 5 functions, 1 trigger, all live in the local database, all tested with real inserts. |
| Every future document system can migrate onto it incrementally | **Supported by design** — the Adapter Plan sequences seven real systems onto this foundation via shadow-writes and additive changes, none requiring a breaking cutover. |

Test data was deleted after every test in this report; `select count(*) from canonical_documents` returns `0` as of this report's writing — the foundation exists, tested, and empty, exactly as Phase 4's brief requires.

No part of implementing this foundation required changing the certified architecture. One underspecified relationship between two certified properties (Document status vs. Version-level state) was clarified, documented, and resolved without altering either property — flagged per the FINAL RULE rather than decided silently.
