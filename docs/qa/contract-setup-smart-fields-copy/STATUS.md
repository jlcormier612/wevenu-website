# Contract setup copy — Smart Fields (not “tokens”)

**STATUS:** IMPLEMENTED locally — awaiting commit + Sandbox deploy for runtime proof  
**Production:** untouched  
**Scope:** Copy-only on Contract setup CardDescription

## Change

| Field | Value |
|-------|--------|
| File | `app/(app)/contracts/new/page.tsx` |
| Old | Select a template and client, then edit with Smart Fields. Preview is display-only. Tokens resolve when you send. |
| New | Select a template and client, then personalize your contract with Smart Fields. Preview your contract before sending. Smart Fields fill in automatically when you send. |

## Verification

- Focused test: `lib/contracts/contract-setup-copy.test.ts` — **1/1 PASS**
- Diff: one string in page + regression test; no behavior/API/DB changes
- Serving Sandbox still `2bfe4cde…` (pre-this-copy) until commit/deploy authorized

## Ledger

Recorded in `docs/qa/master-release-closeout/LEDGER.md`
