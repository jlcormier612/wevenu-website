# Contract resend recipients — STATUS

**Environment:** Sandbox only  
**Overall:** IN PROGRESS (implementation ready to commit; deploy + browser pending)

## Root cause

Resend UI used `ShareDialog` with only `requiredClients[0]`, so a two-signatory contract showed Nicole alone. Server `sendContractInviteEmails` already emailed every required client signer.

## Fix

- `ContractResendDialog` lists every required client signatory with checkboxes (default all selected).
- `resendContract(id, message, selectedSignerIds)` validates ids against this contract and sends only to the selection.
- Per-recipient delivery outcomes; activity notes recipients.
- Does not mutate content, status, version, or signatures.

## Deploy / tip

| Item | Value |
|---|---|
| Tip | _pending commit_ |
| Deploy | _pending_ |
