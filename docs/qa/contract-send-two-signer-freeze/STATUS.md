# Contract Send freeze — two-signer content

**Status:** NOT GREEN — fix committed; Sandbox deploy in progress; browser proof blocked on ECS  
**Commit:** `9e155a521c8c07865a62a11ea2d48526ddcb8e44`  
**Branch:** `fix/contract-send-two-signer-freeze`  
**Deploy:** https://github.com/jlcormier612/wevenu-website/actions/runs/36265218598  
**Base:** `49793b28` (vendors/currency already live on `:401`)  
**Production:** untouched

## Root cause

`sendContract` rebuilt merge signer context from `contract_signers.client_contact_id` only.

Relationship primary/partner seeds store `client_contact_id = null` (by design — no `client_contacts` row).
That emptied the selection → `resolveClientSignerSeeds` fell back to **primary-only** → frozen `contracts.content` lost Brian.

- Preview/Review passed UI `selectedSignerIds` (`relationship:primary` + `relationship:partner`) → correct.
- Invite emails used full `contract_signers` rows → both links worked.
- Freeze path ignored those rows' names → primary-only body.

## Fix

| Area | Change |
| --- | --- |
| `lib/contracts/signer-candidates.ts` | `requiredClientSignerNamesFromSigners()` |
| `lib/contracts/service.ts` | Send freezes via persisted signer names; amendment/version re-seed via `selectedIdsFromExistingSigners` |
| Tests | signer-candidates, preview-rendering, token-preserving-draft |

## Tests

62/62 focused contract suite pass. Typecheck: baseline only (cross-surface-contract TS2322, inbox-needs-response TS2345).

## Live proof

Blocked until ECS runs `9e155a52`. Prior signed contract `5a5f8117…` already has primary-only frozen content — need a **new draft** on the new image.
