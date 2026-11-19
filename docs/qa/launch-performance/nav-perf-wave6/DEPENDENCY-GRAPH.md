# NAV-PERF Wave 6 — Shared layout bootstrap dependency graph

Documented **before** code changes. Serving baseline SHA for comparison: `83569a10`.

## Layout critical path (blocks first byte)

```
isSupabaseConfigured
    │
    ▼
createClient("venue") + auth.getUser          [AUTH — required]
    │
    ├──────────────────────────────────────────┐
    ▼                                          ▼
headers() → pathname                         bootstrapActiveVenueContext (React cache)
    │                                          │
    │                                          ▼
    │                                   auth.getUser (again)
    │                                          │
    │                                          ▼
    │                                   consumeOnboardingHandoff
    │                                   (may WRITE active venue + cookie)
    │                                          │
    │                                          ▼
    │                                   clear_stale_active_venue_context
    │                                   (may CLEAR invalid active venue)
    │                                          │
    │                          ┌───────────────┴───────────────┐
    │                          ▼                               ▼
    │               list_my_venue_memberships        current_user_venue_id
    │               (read memberships)               (read active venue id)
    │                          │                               │
    │                          └───────────────┬───────────────┘
    │                                          ▼
    │                                   classifyActiveVenueCase (sync)
    │                                          │
    │                          ┌───────────────┼───────────────┐
    │                          ▼               ▼               ▼
    │                     D_none          B_keep_valid    A_auto_single / C/E
    │                     clear cookie    sync cookie     setActiveVenue or picker
    │                                          │
    └──────────────────────┬───────────────────┘
                           ▼
                  getCurrentVenue (cache)
                  getUser + venues row via current_user_venue_id
                           │
                           ▼
          Promise.all([ enrollment, getActiveVenueMembership, getCurrentUserRole ])
                           │
                           ▼
                  ownership / WG / suspended gates (may await ownerCount)
                           │
                           ▼
                  return WorkspaceShell + children   ← FIRST BYTE can start
```

## Ordering constraints (must preserve)

| Step | Depends on | Why |
|------|------------|-----|
| `getUser` | — | Fail closed without session |
| `consumeOnboardingHandoff` | Authenticated user | May **set** DB active venue before classification; no client venue id |
| `clear_stale` | Handoff complete | Must run **after** handoff writes; clears invalid membership context before read |
| `list_memberships` | `clear_stale` (and auth) | Classification input; safe **after** clear |
| `current_user_venue_id` | `clear_stale` (and auth) | Must observe post-clear (and post-handoff) DB state |
| `classify` | Both memberships + venue id | Sync; no I/O |
| `setActiveVenue` (Case A) | classify = A_auto_single | Membership-checked write |
| `getCurrentVenue` | bootstrap `ready` | Uses DB active venue; React `cache` |
| enrollment / membership / role | `getCurrentVenue` | Venue-scoped; already parallel |
| `ownerCount` | enrollment + membership + ownership gate path | Only when needed |

## Safe parallelization opportunities

1. **After `clear_stale`:** `list_my_venue_memberships` ∥ `current_user_venue_id` — **safe** (both reads; both require post-clear state; neither mutates).
2. **Do not** parallelize handoff with `clear_stale` or with venue-id read.
3. **Do not** parallelize `clear_stale` with membership/venue-id reads.
4. Layout `headers()` is independent of bootstrap I/O but cheap; optional micro-parallel after auth not required for meaningful gain.
5. Duplicate `getUser` inside bootstrap / `getCurrentVenue` / membership: React `cache` on venue helpers limits repeat venue fetches; auth `getUser` may still repeat — **out of scope** unless a request-scoped auth cache already exists (do not invent a second session authority).

## Explicit non-goals this wave

- Booking workspace Suspense split
- ECS sizing
- Wave 5 companion deferral
- Weakening clear_stale / handoff / membership checks
