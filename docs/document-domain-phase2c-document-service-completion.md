# Document Domain — Phase 2C: Document Service (API Reshape)

**Date:** 2026-08-07
**Phase:** 2C, redefined mid-phase. The original Phase 2C brief asked for Contract Integration (a shadow-write from the real `contracts` table into the Canonical Document Domain). Before any Contract code was touched, that brief was withdrawn and replaced with this one: reshape Phase 2B's already-shipped integration layer into an explicit, named-method "Document Service," and validate it — no producer connected, no Contract subsystem change, no UI.

---

## Why this phase exists, not a Contract adapter

Discovery for the original Contract-integration brief was completed first (schema, real lifecycle states, representation/signature mechanics — see the "what was traced" section below, kept because it's still accurate and will matter whenever a real Contract adapter is eventually built). Before writing any Contract-touching code, the phase was redirected: the concern raised was that a Contract-only shadow-write would validate only one lifecycle moment (signing), while Contracts today have no versioning, no representation, and no amendment/supersession — meaning a Contract-only integration would exercise almost none of what the Document Domain actually manages. The redirect asked instead for the *service itself* to be reshaped into a clearer public API, still validated generically, still with zero producers connected.

**No Contract-subsystem file was read for writing, and no Contract-subsystem file was modified.** The only artifact from the discovery pass is knowledge, not code — captured below for whenever Contract integration is actually built.

## What changed

`lib/document-domain/integration/contract.ts`'s interface — previously `BusinessObjectIntegration`, exposing `createInitialDocument` / `finalizeVersion` / one generic `publishEvent(eventType)` dispatcher for six of the ten canonical events — is now `DocumentService`, exposing:

| Method | Was |
|---|---|
| `publishDocument()` | `createInitialDocument()` |
| `requestNewVersion()` | (unchanged) |
| `finalizeDocument()` | `finalizeVersion()` |
| `generateRepresentation()` | (unchanged) |
| `createReference()` | (unchanged) |
| `shareDocument()` | `publishEvent({eventType: 'document_shared', ...})` |
| `archiveDocument()` | `publishEvent({eventType: 'document_archived', ...})` |
| `supersedeDocument()` | `publishEvent({eventType: 'document_superseded', ...})` |
| `deleteDocument()` | `publishEvent({eventType: 'document_deleted', ...})` |
| `expireDocument()` | `publishEvent({eventType: 'document_expired', ...})` |
| `recordDocumentViewed()` | `publishEvent({eventType: 'document_viewed', ...})` |
| `getCurrentRepresentation()` / `getVersionHistory()` / `getAuditHistory()` | (unchanged) |

`createDocumentService(client)` (was `createBusinessObjectIntegration`) is the one shared implementation, in `integration/service.ts`. The six named lifecycle methods share one private helper (`emitLifecycleEvent`) internally rather than six copy-pasted bodies — each is a one-line call fixing its event type and (where applicable) its certified Status.

**Nothing about the underlying mechanics changed.** Every repository call, every event-derivation rule in `event-translation.ts`, the `STATUS_FOR_EVENT` mapping, and the two real bugs found and fixed during Phase 2B's own validation (the `is_current` clear in `repository.createVersion`, and routing four lifecycle methods through the certified status-transition trigger) are all still exactly as they were. This was a rename and an API-shape change, not a behavior change — so Phase 2B's validation report (`docs/document-domain-business-object-integration-validation-report.md`, now annotated with a naming note at its top) remains valid evidence for the mechanics; it was not re-run from scratch, since nothing it tested changed. `npx tsc --noEmit` is clean across `lib/document-domain/` and no other file in the repo references the old names (`BusinessObjectIntegration`, `createBusinessObjectIntegration`, `PublishableEventType`, `PublishEventRequest`, `CreateInitialDocumentRequest`, `FinalizeVersionRequest`) — confirmed by a repo-wide grep, zero matches outside this module's own now-updated docs.

## What was traced but not acted on (Contract subsystem — for the future Contract adapter)

Kept here so the next attempt at Contract integration doesn't have to re-derive it:

- **Real lifecycle:** `draft → sent → signed`, with a `cancelled` off-ramp from `draft`/`sent` only. `expired` is a schema-only CHECK value never reached by any code path. There is no `finalized` distinct from `signed`, no revision/versioning concept (draft edits overwrite `contracts.content` in place, with only a `contract_activities` log entry — no history retained), and no amendment/supersession mechanism — `docs/contract-lifecycle-design.md` proposes all of that (`issued`/`client_signed`/`executed`, amendments, clones) but states plainly it is "not yet implemented."
- **No representation exists today:** no PDF, no file, no external e-signature integration. The couple reads `contracts.content` as raw text on the signing page. "Signed" is a real, guarded, forensically-logged status flip (IP, user-agent, explicit consent checkbox, server timestamp) via the `sign_contract()` SECURITY DEFINER RPC — but a typed name, not a captured signature artifact.
- **A real architectural gap surfaced, unresolved:** the sign flow (`app/sign/[token]`) runs with no authenticated session at all — not venue, not client — which is exactly why `sign_contract` is a SECURITY DEFINER RPC in the first place. Checked live: `canonical_documents` and every related table grant `service_role` only `REFERENCES`/`TRIGGER`/`TRUNCATE` — no `INSERT`, deliberately, per Phase 2A's own validation report ("granting service_role broad table access just to make a demo script convenient would loosen security posture beyond what the actual framework design needs"). That reasoning was sound for a validation script; it does not resolve a real, product-shipped anonymous write path. Any future Contract (or Questionnaire, or other anonymous-flow) adapter that needs to write at a moment with no session will hit this directly and will need a real decision — narrowly scoped `service_role` grants used only via the admin client, mirroring how `triggerAutoComplete` already does it for the same flow — not something to resolve implicitly inside an adapter. Flagged here rather than worked around.
- **Owner resolution for Contracts, per the pre-existing (not-yet-executed) adapter plan** (`docs/document-domain-adapter-plan.md` §1): `owner_type = 'relationship'` via `contracts.client_id`. In the real UI/action layer, `clientId` is a required field at contract creation (`components/contracts/new-contract-form.tsx` validates it), even though the DB column is nullable — so this should hold in practice, with a documented fallback needed for the rare row where it doesn't.
- **Exact hook points**, if/when a Contract adapter is built: `lib/contracts/service.ts` — `createContract` (create), `updateContractContent_` (draft revision, in place), `sendContract` (→ `shareDocument`), `signContractByToken` (→ `finalizeDocument`, the one anonymous-context call), `cancelContract` (→ `archiveDocument`), `deleteContract_` (→ `deleteDocument`, draft/cancelled only).

## Success Criteria Check

| Criterion | Status |
|---|---|
| No Contract subsystem file modified | **Confirmed** — zero writes to any file under `lib/contracts/`, `app/(app)/contracts/`, `app/sign/`, or any `contracts`-related migration. |
| No producer connected | **Confirmed** — `DocumentService`/`createDocumentService` have no callers anywhere in the repo (grep, zero matches outside `lib/document-domain/`). |
| No UI built | **Confirmed** — zero files under `app/` (non-document-domain) or `components/` touched. |
| Every future producer can perform its required lifecycle exclusively through this service | **Unchanged from Phase 2B, still true** — the nine write operations and three reads are a superset-with-renaming of what Phase 2B validated against all 7 named producer types with zero producer-specific branches; nothing about that validation's mechanics changed. |
| The Adapter Framework remains an infrastructure detail | **True by construction** — `repository.ts` is still the only module touching `canonical_document_*` tables; `service.ts` calls only `repository.ts`. |
