# White Glove Setup Completion

| Field | Value |
| --- | --- |
| **Status** | **NOT ACCEPTED** — code committed; Sandbox browser E2E pending serving SHA |
| **Branch** | `feat/spaces-booking-e1-smart-fields` |
| **Baseline serving** | `f07b838f…` (Offering-images deploy 40808769549 failed earlier; unrelated) |
| **Production** | Untouched |

## Evidence already confirmed (Sandbox DB / storage)

- `documents` bucket **private**
- Legacy material `public_url` → HTTP **400**
- Same object via `createSignedUrl` → HTTP **200**
- Path: `onboarding/{venueId}/…`

## Implemented

1. HQ signed download `/api/admin/onboarding/materials/[id]/file` (`requireAdminUser` + path prefix)
2. Upload validation + null `public_url` + orphan cleanup on metadata failure
3. Resumable waiting page (list / add materials / edit intake via `?edit=1`)
4. Prefill venue name + WG package known copy; identity/login boundary copy
5. Same-name space capacity update (deterministic)
6. CRM checklist → Product HQ workbench link; access not granted by CRM
7. Import Wizard seeds from received material (no re-upload) for packages/inventory hints
8. Unit tests: `lib/onboarding/materials.test.ts`, `intake-spaces.test.ts`, existing WG access/handoff suites

## Gaps / follow-ups

- Message-template auto-import pathway not fully wired (packages path prioritized)
- Planning materials: guidance + open Planning Templates; no auto-apply playbook from PDF
- Fresh purchase → welcome email E2E not run in this turn
- Browser acceptance on serving SHA still required after deploy
