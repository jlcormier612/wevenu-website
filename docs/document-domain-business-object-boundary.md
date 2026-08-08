# Document Domain — Business Object / Document Domain Responsibility Boundary

**Date:** 2026-08-07
**Phase:** 6 (2B) — Business Object Integration Contract. This is the written boundary §3/§4 of this phase's brief requires: what stays inside a Business Object, what belongs to the Document Domain, and why there is no overlap.

---

## The rule

A Business Object owns everything about *why* content exists and *whether it's correct*. The Document Domain owns everything about *what happened to it as a record* — once content is worth keeping, the Document Domain is the only thing that tracks its identity, its history, and who can see it.

If a question can be answered by reading the content itself, it's the Business Object's. If a question can be answered without reading the content at all — *when* was this created, *who* signed it, *is* this the current version, *can* this person see it — it's the Document Domain's.

## Business Object Responsibilities (stay inside the producer)

| Producer | Owns |
|---|---|
| **Contract** | Negotiation (what the terms say), approvals (whose sign-off is required internally), signature workflow (who needs to sign, in what order, by when) |
| **Invoice** | Balances, payment state, line items, what's owed |
| **Questionnaire** | Collaborative editing — the actual back-and-forth of who answered what |
| **Floor Plan** | Spatial editing — shapes, positions, the layout itself |
| **Vendor Document (library)** | Which template this is, renewal cadence, vendor-side categorization |
| **AI Draft** | Generation prompt/context, model confidence, whether a human has reviewed the suggestion yet |

None of these concepts exist anywhere in the Document Domain's schema, and none of this phase's integration code reads or writes them. A Business Object never asks the Document Domain "is this contract's pricing correct" — that question doesn't cross the boundary at all.

## Document Domain Responsibilities (architecture §2, restated as a boundary, not just a list)

- **Identity** — a permanent id independent of what the content currently says.
- **Versions** — the sequence of content states a Document has had.
- **Representations** — the immutable files/snapshots those versions produced.
- **Audit** — who did what, when, regardless of producer.
- **References** — how a Document relates to the Business Object (and anything else) that produced or uses it.
- **Sharing** — who currently has visibility.
- **Lifecycle** — where a Document sits in the eight certified states.
- **Permissions** — who may act on it, by role.
- **Retention** — how long it must be kept.
- **Storage abstraction** — where the bytes live, deliberately hidden from every caller above it.

A Business Object never touches any of these directly — not because it's forbidden by convention, but because Phase 5 already made it structurally true: `lib/document-domain/repository.ts` is the only module in the codebase with a `.from("canonical_document_*")` call anywhere in it. The Document Service (`lib/document-domain/integration/contract.ts`'s `DocumentService` interface, implemented by `integration/service.ts`) is the *only* thing a Business Object is allowed to call, and it in turn calls only `repository.ts` — never a second path.

*Naming note (Phase 2C):* this interface was renamed from `BusinessObjectIntegration` to `DocumentService` and its `createInitialDocument`/`finalizeVersion`/`publishEvent` methods became `publishDocument`/`finalizeDocument`/six named lifecycle methods (`shareDocument`, `archiveDocument`, `supersedeDocument`, `deleteDocument`, `expireDocument`, `recordDocumentViewed`) — same underlying mechanics, more discoverable API. Every reference below to the old method names describes the same operation under its current name.

## Where the line actually falls, worked through the brief's own examples

- **"Contract finalized → request Final Representation."** The Contract decides *when* it's finalized (all required signatures collected — a Business Object question). The Document Domain decides *what happens once it's told*: lock the current Version, ensure a Representation exists, transition Status to `finalized`, and emit whichever canonical event that Document's Behavior implies (`document_signed` for Negotiated, in this case) — see `event-translation.ts`. The Contract never decides which canonical event fires; it only decides *that* finalization happened.
- **"Invoice issued → request PDF Representation."** Same shape, different Business Object, same integration call (`finalizeDocument`). The Invoice doesn't know or care that the same function is also what a signed Contract calls — that's the entire point of the boundary being generic.
- **"Questionnaire completed → request Snapshot Representation."** Same again. A Questionnaire is Collaborative behavior, not Negotiated — the event-translation layer derives `document_approved` instead of `document_signed` for it, purely from Behavior, with zero Questionnaire-specific code anywhere in the Document Domain.

## What "no overlap" actually forbids

- A Business Object must never write its own row into `canonical_document_audit`, `canonical_document_events`, or `canonical_document_references` — only the integration layer does, and only via `repository.ts`.
- The Document Domain must never store a Contract's signer name, an Invoice's balance, or a Questionnaire's answers — those stay exactly where they already are (`contracts.signer_name`, `invoices.balance_due`, `event_questionnaires`), untouched by this or any prior phase.
- Neither side re-derives the other's facts. The Document Domain doesn't recompute "is this invoice paid" from Representation metadata; the Business Object doesn't recompute "is this the current version" from its own data — it asks the integration layer.
