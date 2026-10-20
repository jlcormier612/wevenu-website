# Import-scoped cleanup — recovery decision & delivery

**Decision:** Option B — safe bounded, reviewable import-scoped cleanup (not full Undo).

**Commit:** `929bd817`  
**Deploy:** https://github.com/jlcormier612/wevenu-website/actions/runs/39494692584 (Sandbox only)  
**Production:** untouched  
**Dirty tree:** preserved (unrelated local changes not staged)

---

## 1. Decision

Existing individual delete alone is **not** practical for hundreds of mistaken import rows.  
`rollbackImportBatch` remains **unsafe** after Active Commitment / paid lines and is **not** wired to Migration Center.

**Shipped:** Migration Center **Import cleanup** — preview + confirm delete for records attributed solely via `migration_records.created_entity_id` for the selected session, using existing product delete gates.

---

## 2. Actual recovery capability

| Capability | Behavior |
|------------|----------|
| Identify import | Open Migration Center history → committed / partly committed session |
| Review targets | “Review what can be removed” — eligible / review / already gone + warnings |
| Auto-delete | Only eligible, unchanged, attributed rows (dependency order) |
| Refused / flagged | Edited after import; Active Commitment; Events; floor plans; financial-blocked clients/leads; non-hard-deletable tours |
| Confirm | Explicit browser confirm; re-check at execute |
| Report | Per-entity deleted / review / already_gone / failed |
| Not claimed | Global one-click Undo of the entire session |

---

## 3. Implementation

| Item | Detail |
|------|--------|
| Engine | `lib/migration/session-cleanup.ts` |
| Actions | `previewImportSessionCleanupAction`, `executeImportSessionCleanupAction` |
| UI | Migration Center session panel — Import cleanup |
| Tests | `lib/migration/session-cleanup.test.ts` (8) + existing AC / historical / accounting suites |
| Verify script | `docs/qa/exclusion-forensic/verify-import-cleanup.mts` |

---

## 4. Safety results (contract)

- Pre-existing records: never targeted (no created_entity_id on session).  
- Edited: refused.  
- Financial / AC / paid: refused via previewDeleteClient + AC review disposition.  
- Events / floor plans: review-only.  
- No `rollbackImportBatch`.  
- No silent success on partial failure.  
- Retries safe (already_gone).  

Runtime browser + DB evidence: see `import-cleanup-results.json` after `EXPECT_SHA=929bd817 npx tsx docs/qa/exclusion-forensic/verify-import-cleanup.mts`.

---

## 5. Limitations (honest)

- Not a complete session Undo — only eligible attributed subset.  
- AC / paid / edited / Event / floor plan need manual follow-up.  
- Tours linked to real leads: review (hard-delete guard), not auto-deleted.  
- Attribution requires MC `created_entity_id`; Import Wizard batches still use separate (unsafe) rollback path for their entities only.
