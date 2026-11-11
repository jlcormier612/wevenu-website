# Space Preferences performance — forensic

## Surface

Lead detail Event setup / Overview: `LeadSpacePreferenceFields` (Ceremony, Reception, Cocktail Hour, Getting Ready, Rehearsal Dinner when multi-mode + wedding-relevant uses).

Spaces are **already props** — dropdowns do not fetch on open. Shared `Select` items are built client-side from `spacesEligibleForUse`.

## Measured bottlenecks (code + save path)

1. **Full `revalidateLead` after every preference save** — revalidated `/leads/{id}`, `/leads`, `/tasks`, `/dashboard`, `/tours`. Each checkbox/select change remounted the workspace.
2. **Controls `disabled={pending}` during save** — all five selectors blocked until the server round trip finished (felt like “dropdowns are slow”).
3. **Duplicate `getSpaces()`** — page `Promise.all` called `getSpaces()` while `getLeadSpacePreferences` called it again.
4. **Sequential upserts** — one DB round trip per use key on save.

Dropdown open itself does not issue network requests (verified by harness expectation `networkDuringOpen === 0`).

## Fixes

- Share one `spacesPromise` into `getLeadSpacePreferences(id, spaces)`.
- Parallel upserts on save.
- Narrow revalidation to `/leads/{id}` only.
- Keep checkboxes/selects interactive; show “Saving…” only.
