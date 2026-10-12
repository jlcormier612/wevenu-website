# Audit — Contract resend recipient visibility

**Date:** 2026-10-12  
**Environment:** Sandbox

## Root cause

| Layer | Behavior |
|---|---|
| UI (`contract-detail` → `ShareDialog`) | Single `recipient` from `requiredClients[0]` only |
| Server (`resendContract` → `sendContractInviteEmails`) | Loops **all** required client signers and sends each their `signToken` link |
| Result | Dialog shows Nicole only; Resend still emailed every required signer |

## Signatory source

`contract_signers` rows with `signer_type = 'client'` and `is_required = true`. Each has `id`, `signer_name`, `signer_email`, `signer_role`, recipient-specific `sign_token`.

## Delivery history

`recordExternalClientOutbound` with `source_type: contract_invite` records acceptance at the provider, not inbox delivery. No per-signer selection was persisted on resend activity beyond a generic "Contract resent" title.

## Fix direction

Dedicated resend dialog listing every required signatory with checkboxes; server accepts only validated signer ids for this contract and sends only to the selection.
