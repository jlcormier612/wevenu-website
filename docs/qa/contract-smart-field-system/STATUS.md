# Contract Smart Field System

**Status:** CODE COMPLETE — deploy + live browser pending  
**Branch:** `fix/contract-send-two-signer-freeze` (includes two-signer freeze + Smart Field system)  
**Production:** untouched

## What shipped

1. Every `MERGE_FIELDS` key always resolves (value or honest fallback) — never raw `{{token}}`.
2. Fixed `event_spaces` empty-clear bug that left raw tokens.
3. Aligned code starter + Sandbox Library Wedding Venue Agreement.
4. Kept two-signer Send freeze from persisted `contract_signers` names.
5. Payments remain non-inventing (schedule/balance honest when absent).

See `AUDIT.md` for full inventory.
