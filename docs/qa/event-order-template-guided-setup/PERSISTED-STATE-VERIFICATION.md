# Persisted-state verification

**Serving:** `20a5d08c…`  
**Template:** `d73d9734-98d9-46a0-b54b-dccadb036150` (Fancy existing configured template)

| Check | Before → After | Result |
|-------|----------------|--------|
| Sections | 5 | Preserved through wizard navigation |
| Groups | 7 → 7 | **PASS** |
| Options | 5 → 5 (same ids) | **PASS** |
| Offering FK links | 0 → 0 | **PASS** (template-only options retained) |

Source: `browser-results.json`, `persisted-state.json`, `browser-run.log`.

Wizard open → categories → configure → review → preview → reload did **not** rewrite option identities or invent Offering links.
