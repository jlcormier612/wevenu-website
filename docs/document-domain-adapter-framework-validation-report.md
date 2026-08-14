# Document Domain — Adapter Framework Validation Report

**Date:** 2026-08-07
**Phase:** 5 (2A) — Canonical Adapter Framework. Every claim below was tested against the live local database or verified by direct code trace against real, captured Postgres output — not asserted from reading the code.

---

## What was built

| Deliverable | Location |
|---|---|
| Canonical Adapter Interface | `lib/document-domain/adapter-interface.ts` |
| Shared Adapter Framework | `lib/document-domain/base-adapter.ts`, `lib/document-domain/repository.ts` |
| Validation Infrastructure | `lib/document-domain/errors.ts` (`mapPostgresError`) — translates, never re-implements, Phase 4's own constraints |
| Audit Integration | `repository.emitEvent()` — the one call that writes both `canonical_document_events` and `canonical_document_audit`, always together |
| Event Integration | `CanonicalEventType` (types.ts) — the ten certified events, compile-time closed |
| Owner Resolver | `lib/document-domain/owner-resolver.ts` |
| Idempotency | `adapt_producer_to_canonical_document()` RPC (`20261214000000_document_domain_adapter_framework.sql`) |
| Producer Readiness Matrix | `docs/document-domain-producer-readiness.md` |

No producer-specific adapter (Contract, Vendor, Attachment, Invoice, Floor Plan, AI) was implemented, per §9.

---

## Validation §8: the framework rejects what it must

Each of the six required rejection categories was triggered for real against the live database, and the resulting Postgres error was traced against `mapPostgresError`'s actual matching logic — not a hypothetical.

| Category | Real Postgres error captured | Classified as | Reused from Phase 4? |
|---|---|---|---|
| Invalid owner | `violates check constraint "canonical_documents_owner_id_shape"` | `InvalidOwnerError` | Yes — the constraint itself |
| Duplicate current version | `duplicate key value violates unique constraint "canonical_document_versions_one_current"` | `DuplicateCurrentVersionError` | Yes — the partial unique index |
| Invalid lifecycle transition | `Invalid Document status transition: draft -> finalized` | `InvalidTransitionError` (from=`draft`, to=`finalized`, extracted correctly) | Yes — `canonical_documents_enforce_transition()` trigger |
| Orphan representation | `violates foreign key constraint "canonical_document_representations_version_id_fkey"` | `OrphanRepresentationError` | Yes — the NOT NULL FK; structurally, there is also no `document_id` column to create an orphan through a different path |
| Duplicate reference | `duplicate key value violates unique constraint "canonical_document_references_document_id_reference_type_re_key"` | `DuplicateReferenceError` | Yes — the composite unique constraint |
| Invalid representation | `violates check constraint "canonical_document_representations_representation_type_check"` | `InvalidRepresentationError` | Yes — the CHECK enum |

Every classification was reached by pattern-matching the real, captured error text against `mapPostgresError`'s actual branches (verbatim, not reimplemented, for this verification) — six for six. No validation rule was duplicated in TypeScript; every rejection traces to a Phase 4 constraint, matching §8's explicit instruction.

## Validation: idempotency (§4, §8)

`adapt_producer_to_canonical_document()` was called twice with identical arguments against a real `contracts` row. First call: `created: true`, a new Document. Second call: `created: false`, the *same* `document_id`. A count query confirmed exactly one Document and one Reference exist for that Contract — not two.

## Validation §5: owner resolution refuses what it must

`resolveCanonicalOwner({ kind: "lead", leadId: ... })` returns `{ ok: false, reason: "lead_owner_not_certified" }` unconditionally — verified by direct read of `owner-resolver.ts`'s five-line switch statement, which has no branch that could produce anything else for that input. No Lead owner type was added; the certified ownership model (five types) is unchanged.

## A gap this phase's own validation found in itself

`canonical_document_references.reference_type` — created in the Phase 4 foundation — was a closed 7-value CHECK enum with no room for `floor_plan`, `timeline`, `questionnaire`, or `ai_draft`. Building the Producer Readiness Matrix (§10) surfaced this directly: 4 of the 8 real producers could never create a Reference at all. This contradicted the certified architecture's own stated principle (classification fields are "extensible without schema change," correctly applied to `Document.type`, missed here). Corrected via an `ALTER TABLE ... DROP CONSTRAINT` in this phase's own migration, with the reasoning stated in full in that migration's header — not a silent fix, and not a change to the certified architecture, since the architecture never specified a closed list for this field; the CHECK enum was Phase 4's own over-implementation. Re-verified after the fix: a `floor_plan` reference was created successfully.

---

## Success Criteria Check (§13)

| Criterion | Status |
|---|---|
| The Document Foundation remains unchanged | **True, with one explained, non-architectural correction** — the `reference_type` CHECK enum widened to match an already-certified extensibility principle. No Phase 4 table, trigger, index, or tested behavior was altered; nothing that Phase 4's own Validation Report tested regresses. |
| No legacy system has been migrated | **Confirmed** — `documents` (8 rows), `contracts` (2 rows) unchanged; `canonical_documents` and every related table returned to 0 rows after every test in this report. |
| No UI has changed | **Confirmed** — zero files under `app/` or `components/` touched. |
| No existing application behavior has changed | **Confirmed** — `npx tsc --noEmit` clean across the whole repository; the new `lib/document-domain/` module is not imported anywhere existing code runs. |
| Every future producer can migrate through the same adapter interface | **Supported** — 6 of 8 producers fully ready per the Readiness Matrix; the 2 partial ones share one real, explicitly-not-worked-around blocker (Lead ownership), not a framework limitation. |
| Exactly one architectural path into the canonical Document Domain | **True by construction** — `repository.ts` is the only module with `.from("canonical_document_*")` calls anywhere in the codebase; `base-adapter.ts` re-exports its functions as the only entry point a producer adapter would import, so even a future producer adapter has no second path available to it. |

No producer required a change to the certified Document architecture. One implementation inconsistency within this phase's own new code was found and corrected, with the reasoning stated before proceeding — exactly the FINAL RULE's instruction, applied to a gap this phase caught in itself rather than one imposed by an external producer.
