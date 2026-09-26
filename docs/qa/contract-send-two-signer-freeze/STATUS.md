# Contract Send freeze — two-signer content

**Status:** FIX COMMITTED — deploy + browser pending  
**Commit:** (see git)  
**Base image:** `49793b28` (vendors/currency already live)  
**Production:** untouched

## Root cause

`sendContract` rebuilt merge signer context from `contract_signers.client_contact_id` only.

Relationship primary/partner seeds store `client_contact_id = null` (by design).
That emptied the selection → `resolveClientSignerSeeds` fell back to primary-only → frozen `contracts.content` lost Brian.

Preview passed UI `selectedSignerIds` (`relationship:primary` + `relationship:partner`) so Preview/Review were correct.
Invite emails used the full `contract_signers` rows, so both links still worked.

## Fix

- Send freezes via `requiredClientSignerNamesFromSigners(contract.signers)` — same SoT as invites.
- Amendment / Create New Version re-seed via `selectedIdsFromExistingSigners` (not contact-id-only).
