# Persisted-state verification

**Status:** Pending browser harness on serving `20a5d08c`.

Harness: `verify-guided-setup.mts` records:

- Before snapshot: section / group / option counts, option ids, Offering FK links
- After wizard navigation + reload: same ids and Offering links must match (Scenario F)

Populate from `persisted-state.json` / `browser-results.json` after GREEN browser run.
