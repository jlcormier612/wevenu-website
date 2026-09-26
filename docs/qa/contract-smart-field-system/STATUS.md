# Contract Smart Field System

**Status:** NOT GREEN — code + tests complete; Sandbox deploy in progress  
**Commit:** `3d2892b400997866c02ce4f86630999630af0b1b`  
**Deploy:** https://github.com/jlcormier612/wevenu-website/actions/runs/36265787739  
**Branch:** `fix/contract-send-two-signer-freeze` (includes two-signer freeze + Smart Field system)  
**Production:** untouched

## What shipped

1. Every `MERGE_FIELDS` key always resolves (value or honest fallback) — never raw `{{token}}`.
2. Fixed `event_spaces` empty-clear bug that left raw tokens.
3. Aligned code starter + Sandbox Library Wedding Venue Agreement.
4. Kept two-signer Send freeze from persisted `contract_signers` names.
5. Payments remain non-inventing (schedule/balance honest when absent).

See `AUDIT.md` for full inventory.

## Tests

`npx tsx --test 'lib/contracts/*.test.ts'` → **142/142 pass**  
Typecheck: baseline only (cross-surface-contract TS2322, inbox-needs-response TS2345)

## Live gate

Blocked until ECS runs `3d2892b4`. Then browser Preview/Review/Send + DB content proof.
