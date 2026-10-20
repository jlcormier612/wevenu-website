# Import cleanup — owner control, safe overrides & actionable exceptions

**Decision:** Option B hardened — venue owner is the authority; warnings inform; hard blocks only for real integrity/auth constraints.

| Item | Value |
|------|-------|
| Prior product SHA (failed deploy) | `929bd817` — TypeScript error; never served |
| This delivery HEAD | *(set after commit)* |
| Prior serving (unchanged until new deploy) | `e6541f57` / TD `:809` |
| Deploy run (failed) | https://github.com/jlcormier612/wevenu-website/actions/runs/39494692584 |
| Production | untouched |
| Dirty tree | preserved |

---

## 1. Baseline of failed deploy

Run `39494692584` **failed** at venue-app TypeScript:

`session-cleanup.ts` — unreachable `entityType !== "vendor"` after vendor early-return.

Sandbox remained on `e6541f57`. Feature was **NOT GREEN**. Baseline verify against `929bd817` could not run on a live serving build.

---

## 2. Owner-control policy (locked in code)

| Outcome | Disposition | Examples | Behavior |
|---------|-------------|----------|----------|
| **A** | `eligible` | Unchanged attributed client/lead/vendor/… | Included in confirm delete |
| **B** | `overridable` | Edited after import; floor-plan document without seating | Checkbox + consequences; owner opts in |
| **C** | `blocked` | Active Commitment; signed contract / paid lines; Event (no standalone delete); tour hard-delete guard; floor-plan doc with seating | Reason + next step; **no** override checkbox |
| — | `already_gone` | Previously removed | Reported; retry-safe |

**Not overridable:** financial history (`previewDeleteClient` / AC), tour hard-delete when linked to a real customer, seating history on plans using the imported file, missing delete path (Event), unauthorized/cross-tenant (venue-scoped deletes).

**Floor plan attribution:** MC `created_entity_id` is the **Documents** SoR id (`floor-plan-commit.ts`), not `floor_plans.id`. Cleanup deletes via `deleteDocument` after seating check on linked plans.

---

## 3. UI wording

- Ready / Your choice / Will remove / Blocked / Gone  
- Edited: “This record has changed since it was imported…”  
- Financial: “linked to a signed contract or collected payments…” + next step  
- Partial: `Cleanup completed for N… remain because they need additional review…`

---

## 4. Tests

- `lib/migration/session-cleanup.test.ts` — 11/11 owner-control contract  
- With AC / historical / accounting: **26/26** pass  

---

## 5. Runtime evidence

*(Filled after Sandbox deploy of this HEAD + `EXPECT_SHA=… npx tsx docs/qa/exclusion-forensic/verify-import-cleanup.mts`)*

| Field | Value |
|-------|-------|
| Serving dpl | |
| Task definition | |
| Disposable venue | |
| Browser matrix | |
| Persist / side effects | |
| Verdict | pending deploy + verify |
