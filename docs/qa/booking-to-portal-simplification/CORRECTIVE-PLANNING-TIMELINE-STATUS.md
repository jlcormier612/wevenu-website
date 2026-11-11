# Corrective pass — Planning venue inheritance, template Cancel, Timeline replace

## Status

**GREEN / CLOSED**

Settings and Setup Profiles unchanged. Production untouched. Phase 5 Vendors product remains serving-compatible; this pass fixes Planning/Timeline defects on top of `0ed74ba5…` / evidence `81159a10…`.

## Preflight

| Item | Value |
|------|-------|
| Branch | `feat/spaces-booking-e1-smart-fields` |
| Starting HEAD | `81159a10556ef3ef2d473b59c8bd3431a27be116` |
| Serving at start | `0ed74ba57d25d482d9377beb3331191c43d4d055` |
| Dirty tree | ~899 unrelated paths preserved |

## Root causes

### A — Venue checklist missing

Venue inheritance called session-bound `applyPlaybookToEvent` / `getTemplate` and ignored non-throwing `ok: false` results. Client Planning could still appear (or attach separately) while the venue application was silently skipped. Events whose book-time snapshot lacked `venuePlanningPlaybookTemplateId` also never recovered unless prepare/release ran with that ref present.

### B — No Cancel on template selection

Planning (client + venue) and Timeline template paths had Apply only; leaving required Overview return or re-apply.

### C — Timeline template replace failure

`replaceEventTimelineFromTemplate` deleted/added each row through separate `withVenue` service round-trips (N+M). Large templates timed out → page error / return to Overview; UI still labeled the profile starting template so the journey looked unchanged.

## Fixes (product `cb44fc21…`)

1. Inherit applies venue playbooks via `repo.applyPlaybookToEvent` on the booking supabase client.
2. Venue editor recovers from inherited `preferredVenueTemplateId` when the application is missing; Cancel on client/venue/timeline template paths.
3. Timeline replace: one bulk `deleteVenueOwnedEntriesForEvent` + inserts on a single client; action try/catch; editor stays open on success.

## Serving

| Item | Value |
|------|-------|
| Product commit | `cb44fc21d843013119f42b13677faf782fdb3530` |
| Deploy | [39699401900](https://github.com/jlcormier612/wevenu-website/actions/runs/39699401900) **success** |
| Serving SHA | `cb44fc21d843013119f42b13677faf782fdb3530` (`data-dpl-id`) |

## Tests

```bash
node --import tsx --test lib/event-setup/*.test.ts lib/timeline-templates/*.test.ts lib/vendors/directory-vs-assignment.test.ts
```

**194/194 PASS**

## Browser acceptance

```bash
EXPECTED_SHA=cb44fc21d843013119f42b13677faf782fdb3530 \
  npx tsx scripts/qa/booking-to-portal-simplification-acceptance.mts
```

**94/94 PASS** against serving `cb44fc21…`

Fixture: event `bb3cb6bd-…` / client `54eabb8a-…` / tag `B2P-1792629481859-388f`

### Persisted-state proof (highlights)

- Venue application at book: `b2808150…` Standard Wedding — Venue Planning; venue tasks ≥ 7.
- Editor empty state not shown; Cancel left application unchanged.
- Timeline Cancel: entry count 40→40.
- Timeline replace to Reception Only: venue-owned entries 28 (= template item count); editor remained open; prior QA custom item removed.
- Invite separate; prepare did not invite/send Q/create invoice.
- Setup Profile template_refs unchanged.

## Screenshots

- `03d-venue-planning-setup-editor-1280.png`
- `03e-timeline-setup-editor-1280.png`
- `03e2-timeline-template-replaced-1280.png`
- Plus refreshed Phase 1–5 suite screenshots / `browser-results.json` / `browser-run.log`

## Limitations

- Events booked **before** the profile stored `venuePlanningPlaybookTemplateId` keep a frozen snapshot without that ref. Opening Change can still Apply a chosen Library template; this pass does **not** mass-backfill live profile refs onto old snapshots.
- When the inherited venue ref is present but the application is missing, the venue editor auto-applies once (idempotent).

## Production

Untouched. Unrelated dirty work preserved.
