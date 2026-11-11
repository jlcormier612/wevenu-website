# Lead visibility — new / unreviewed indicator

**Status: SANDBOX GREEN**  
**Date:** 2026-10-14

---

## Root cause (from audit)

The Leads sidebar badge already counted venue-unseen open leads (`venue_seen_at IS NULL` + non-terminal stage via `isUnseenLeadAttention`), but the All list had **no per-row cue**, so the pink badge number looked disconnected from visible cards.

## Implementation (approved)

| Change | Detail |
|--------|--------|
| Eligibility | Reuses `isUnseenLeadAttention` / `leads.venue_seen_at` — no new state |
| UI | Pink `bg-destructive` dot + **New** label beside lead name (`LeadUnseenIndicator`) |
| Clear | Unchanged: lead detail calls `markLeadVenueSeen` (venue-shared) |
| Badge / stages | Unchanged routes, counts, and stage-chip semantics |
| Unseen filter | Calls `isUnseenLeadAttention` explicitly (same rules as badge) |

## Files changed

- `components/leads/lead-unseen-indicator.tsx` (new)
- `components/leads/lead-list.tsx`
- `lib/leads/lead-unseen-indicator.test.ts` (new)
- `lib/navigation/leads-all-population.test.ts`
- `docs/qa/lead-new-unreviewed-indicator-audit/verify-browser.mts`
- This STATUS + browser evidence

## Tests

```bash
npx tsx --test \
  lib/leads/lead-unseen-indicator.test.ts \
  lib/navigation/attention.test.ts \
  lib/navigation/leads-all-population.test.ts
```

**Result:** 43 pass / 0 fail

## Deploy / serving

| Item | Value |
|------|-------|
| Commit | `bf541623241f4b6c61be9250163c0d6de29d6845` |
| Deploy run | https://github.com/jlcormier612/wevenu-website/actions/runs/38497835204 (**success**) |
| Serving commit | `bf541623241f4b6c61be9250163c0d6de29d6845` (ECS image tag match) |
| Production | Untouched |

## Browser evidence (Sandbox GREEN)

Command: `EXPECTED_SHA=bf541623… npx tsx docs/qa/lead-new-unreviewed-indicator-audit/verify-browser.mts`  
**ALL PASS** — see `browser-results.json`, screenshots `leads-all-1280.png`, `leads-after-seen-1280.png`, `leads-all-390.png`.

| Check | Result |
|-------|--------|
| Serving expected SHA | PASS |
| Unseen open lead shows pink dot + NEW | PASS (`Manual T1077` / `87bee850-…`) |
| Seen open lead has no indicator | PASS |
| Sidebar unseen aria present | PASS |
| Open detail sets `venue_seen_at` | PASS (`2026-10-14T01:59:00.766Z`) |
| Indicator cleared after mark-seen | PASS |
| Narrow 390 no page overflow | PASS |

## Explicit non-changes

- No new DB fields, no per-user read state, no Inbox indicator work, no sales-stage changes.
