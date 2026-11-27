# Offerings provisioning correction — local acceptance

**Status:** Implemented locally in worktree — **NOT committed / NOT deployed** (awaits founder authorization).

## Defect
`ensureOfferingStartersForCurrentVenue()` could return `ok: false` while `venue_starter_provisioning` remained `complete` because offerings were outside durable STEPS. Callers ignored soft-fail → false-complete risk.

## Fix (no schema migration)
1. `seedOfferingStarters(venueId, client)` shared seed in `lib/offerings/provision.ts`.
2. `offerings` added to `STEPS` in `lib/provisioning/starters.ts`.
3. Complete-venue gap-fill (like `public_forms`): if `offerings` missing from `seeded_steps`, seed once; on failure persist **`incomplete`** with `failed_steps`, not complete.
4. Early-return when `offerings` already recorded — no unnecessary reseed of existing venues.
5. Concurrency 23505 still treated as present; no overwrite/delete of customizations.

## Local tests
```
npx tsx --test lib/provisioning/starters.test.ts lib/offerings/category-identity.test.ts lib/library/commercial-library-ia.test.ts
→ 23/23 pass
```

## Not done (requires founder auth)
Commit, PR, merge, Sandbox deploy, live disposable-venue failure/recovery browser proof.
