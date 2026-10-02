# Lead Space Preferences UX — STATUS

**STATUS:** OPEN — audit complete; implementation landed locally; awaiting commit / Sandbox deploy / exact-runtime browser proof

## Audit
See `docs/qa/lead-space-preferences-ux/AUDIT.md`

## Implementation (local)
- Compact horizontal Ceremony / Reception (no “Venue space” intermediate; no generic Event Space in multi)
- Single mode: Event Space field only
- Booked multi: read-only from `event_space_assignments` + Additional residual when present
- `planned_event_space_id` synced from venue-space prefs (reception→ceremony) for occupancy/`p_space_id`
- Unit: `lib/leads/space-preferences.test.ts` occupancy + UI coupling PASS

## Remaining for GREEN
1. Commit + deploy Sandbox
2. Verify sole RUNNING image = this commit
3. Browser: Fancy multi (Miss Piggy) — Ceremony|Reception side-by-side; no Event Space; no Venue space label
4. Browser: booked with additional (Jane or cocktail fixture) — Additional column; no Ceremony/Reception duplicate
5. Confirm planned_event_space_id still set for occupancy
6. Ledger update

Production untouched. Overall HTC release not GREEN from this alone.
