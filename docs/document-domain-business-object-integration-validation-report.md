# Document Domain — Business Object Integration Contract Validation Report

**Date:** 2026-08-07
**Phase:** 6 (2B) — Business Object Integration Contract. Every claim below was tested against the live local database or verified by direct code trace — not asserted from reading the code.

**Naming update (Phase 2C, same day):** the interface this report validates (`contract.ts`) was renamed from `BusinessObjectIntegration` to `DocumentService`, and reshaped from one generic `createInitialDocument`/`finalizeVersion`/`publishEvent(eventType)` dispatcher to nine named methods (`publishDocument`, `finalizeDocument`, and six explicit lifecycle methods replacing `publishEvent`) — see `docs/document-domain-phase2c-document-service-completion.md`. The underlying repository calls, event derivation, and every result below are unchanged; only the TypeScript surface changed. Read `createInitialDocument` as `publishDocument`, `finalizeVersion` as `finalizeDocument`, and `publishEvent(eventType: 'document_shared', ...)` as `shareDocument(...)` (etc.) throughout this report.

---

## What was built

| Deliverable | Location |
|---|---|
| Business Object Integration Contract (§2's nine capabilities) | `lib/document-domain/integration/contract.ts` |
| Integration Interfaces (request/response shapes) | `lib/document-domain/integration/types.ts` |
| Shared Integration Service (the one implementation) | `lib/document-domain/integration/service.ts` |
| Event Translation Layer (§6) | `lib/document-domain/integration/event-translation.ts` |
| Reference Integration Layer (§7) | `service.createReference()` → `repository.addReference()`, unchanged |
| Representation Request Layer (§8) | `service.generateRepresentation()` / the `representation` argument to `finalizeVersion()` → `repository.createRepresentation()`, unchanged |
| Business Object / Document Domain responsibility boundary (§3, §4) | `docs/document-domain-business-object-boundary.md` |
| New read operations (§2: retrieve current Representation / version history / audit history) | `repository.getCurrentRepresentation()`, `getVersionHistory()`, `getAuditHistory()` |

No producer (Contract, Invoice, Vendor Document, Questionnaire, Floor Plan, Attachment, AI Document) was migrated or connected, per §10. No Contract subsystem file was touched. No PDF generation, no UI.

---

## Validation §9: the contract is generic enough for all seven named producers, with zero producer-specific branches

Ran the exact sequence `service.ts` executes for `createInitialDocument → requestNewVersion → publishEvent(document_shared) → finalizeVersion → createReference → publishEvent(document_viewed)`, against the live local database, once per producer, varying **only** `source`/`behavior`/`owner` — the same certified, closed vocabularies every producer already maps onto, never a producer name. Full script and output: `phase6_validation.sql` (available in this session's scratchpad).

| Producer | Source | Behavior | Initial event | Finalize event | Representation created |
|---|---|---|---|---|---|
| Contract | negotiated | negotiated | `document_generated` | `document_signed` | yes |
| Invoice | generated | generated | `document_generated` | `document_generated` | yes |
| Vendor Document | uploaded | submitted | `document_uploaded` | `document_approved` | no |
| Questionnaire | generated | collaborative | `document_generated` | `document_approved` | yes |
| Floor Plan | generated | venue_authored | `document_generated` | `document_generated` | yes |
| Attachment | uploaded | reference | `document_uploaded` | `document_shared` | no |
| AI Document | ai_generated | generated | `document_generated` | `document_generated` | yes |

Every value in the last two columns was produced by `event-translation.ts`'s pure Source/Behavior-driven logic and `canonical_document_behavior_capabilities()` (Phase 4, reused, not reimplemented) — never by a branch naming any of the seven producers, which do not appear anywhere in `event-translation.ts`, `contract.ts`, or `service.ts` except as comments.

Two pairs of results specifically demonstrate genericity rather than coincidence:
- **Invoice and AI Document** share Behavior `generated` despite different Sources and being unrelated producers — both finalize to `document_generated`, identically, with no code aware that one is an Invoice and the other an AI Document.
- **Vendor Document and Attachment** share Source `uploaded` despite different Behaviors (`submitted` vs. `reference`) and being unrelated producers — both get `document_uploaded` on creation, identically, proving the initial-event derivation truly reads only Source, not Behavior or producer identity.

Representation creation tracked `generates_representation` exactly: 1 for the five Behaviors where it's `true` (negotiated, generated, collaborative, venue_authored — Questionnaire included, since Collaborative carries both `approvable` and `generates_representation`), 0 for the two where it's `false` (submitted, reference).

Every one of the seven Documents ended with 2 versions, 2 references, 5 audit rows, and 5 events — the same shape regardless of producer, confirming the audit trail and reference mechanism are as producer-agnostic as the event derivation.

## Validation: reads are correct and generic (§2's remaining three capabilities)

`getCurrentRepresentation`, `getVersionHistory`, and `getAuditHistory` are plain, typed `SELECT`s added to `repository.ts` (no new tables, no new RPCs) — verified by the row counts above (2 versions, correct current-representation-per-version, 5-row audit trail) matching what each producer's actual sequence of writes should have produced, for all seven producers identically.

## A gap this phase's own validation found in itself — in Phase 5's certified code, not Phase 6's

`repository.createVersion()` (built in Phase 5, "Adapter Framework remains unchanged" being this phase's own stated success criterion) inserted every new version with `is_current` defaulting to `true` but never cleared it on the version being superseded. `canonical_document_versions_one_current` (Phase 4's own partial unique index) then rejects any second version for the same Document outright — meaning `requestNewVersion` would have failed for every producer, on every second revision, unconditionally. This is not a Phase 6 design gap: the certified Version model already means "a new version supersedes the current one," and the code simply never enacted the "supersede" half.

Fixed directly in `repository.createVersion()` — an `UPDATE ... SET is_current = false` scoped to the document, run only when `sequenceNumber > 1`, immediately before the new version's insert — with the reasoning stated in the code before the change, per the FINAL RULE. Re-verified after the fix: all seven producers created a second version successfully (see table above). This mirrors the exact precedent Phase 5's own validation report set when it found and fixed a Phase 4 gap (`reference_type`'s CHECK enum): a correction to match the certified design, not a change to it.

## A second gap: no path out of `draft` was reachable through the contract as first designed

`canonical_document_validate_status_transition()` (Phase 4, certified) does not allow `draft → finalized` directly — only `shared` or `pending_action → finalized`. But §2 lists no "transition status" capability, and the first draft of `finalizeVersion()` called `transitionStatus(documentId, 'finalized')` unconditionally. A freshly created Document, using only the nine listed capabilities, would have had no legal way to reach `finalized` at all.

Resolved within §2's own vocabulary rather than by adding a tenth capability: four of `publishEvent`'s six publishable events already name a certified Status 1:1 (`document_shared`→`shared`, `document_superseded`→`superseded`, `document_archived`→`archived`, `document_deleted`→`deleted`); `publishEvent` now also performs that transition when applicable, reusing the same certified trigger for validation (an illegal attempt, e.g. sharing an already-finalized Document, is rejected by that trigger and surfaces as the existing `InvalidTransitionError` — no new validation logic). `document_viewed` and `document_expired` remain event-only, correctly, since neither names a Status. Re-verified: all seven producers reached `finalized` via `draft → (publishEvent document_shared) → shared → (finalizeVersion) → finalized`, the same three-call sequence, identically.

---

## Success Criteria Check (§12)

| Criterion | Status |
|---|---|
| The Document Domain remains unchanged | **Confirmed** — zero changes to any table, trigger, index, or function from `20261213000000_document_domain_foundation.sql`. No new migration was written this phase. |
| The Adapter Framework remains unchanged | **True, with one explained, non-architectural correction** — `repository.createVersion()`'s missing `is_current` clear, fixed for the reason stated above. No Phase 5 function signature, table access pattern, or tested behavior from Phase 5's own Validation Report regresses; re-ran that report's idempotency check conceptually via this phase's own multi-producer test and it still holds. |
| No producer has migrated | **Confirmed** — no Contract, Invoice, Vendor Document, Questionnaire, Floor Plan, Attachment, or AI Document code exists or was touched; the seven rows in this report's validation were raw SQL standing in for a producer, run inside a transaction that rolled back, never application code. |
| Every Business Object can integrate through the same contract | **Demonstrated** — all seven named producers, identical call sequence, correct and distinct outcomes, zero branches. |
| Exactly one architectural path from a Business Object into the Document Domain | **True by construction** — `repository.ts` remains the only module with `.from("canonical_document_*")` calls anywhere in the codebase (a new `getDocumentIdForVersion` read was added there, not in `service.ts`, specifically to preserve this); `service.ts` calls only `repository.ts` and `base-adapter.ts`; a Business Object would call only `contract.ts`'s interface. |
| If implementing this contract required changing the certified architecture, stop and explain first | **Not triggered** — both gaps found were implementation bugs in prior phases' own code failing to fully enact the already-certified design (one current version; status-driven lifecycle), not gaps in the design itself. Both were explained before being fixed, consistent with every prior phase in this engagement. |

Zero rows remain in any `canonical_document_*` table. `documents` (8 rows) and `contracts` (2 rows) are unchanged. `npx tsc --noEmit` is clean across `lib/document-domain/` (the only repository-wide errors are pre-existing, unrelated `.mts` smoke-script import issues under `shared/email/` and `shared/relationships/`, present before this phase began).
