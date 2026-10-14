# Lead visibility — new / unreviewed indicator

**Status: IMPLEMENTATION DEPLOYED — awaiting Sandbox browser verification**  
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
| Unseen filter | Now calls `isUnseenLeadAttention` explicitly (same rules as badge; equivalent to prior open+null gate when only `salesStage` is available) |

## Files changed

- `components/leads/lead-unseen-indicator.tsx` (new)
- `components/leads/lead-list.tsx`
- `lib/leads/lead-unseen-indicator.test.ts` (new)
- `lib/navigation/leads-all-population.test.ts` (expect `isUnseenLeadAttention`)
- This STATUS

## Tests

```bash
npx tsx --test \
  lib/leads/lead-unseen-indicator.test.ts \
  lib/navigation/attention.test.ts \
  lib/navigation/leads-all-population.test.ts
```

**Result:** 43 pass / 0 fail

## Deploy / serving

*(filled after commit + Sandbox deploy)*

| Item | Value |
|------|-------|
| Commit | TBD |
| Deploy run | TBD |
| Serving commit | TBD |
| Production | Untouched |

## Browser evidence required before GREEN

1. Unseen open lead shows pink dot + **New** without opening the lead.
2. After opening lead detail, indicator clears and sidebar unseen count drops (after refresh/revalidation).
3. Seen New Inquiry lead does **not** show indicator.
4. Stage chips and badge routes unchanged.

## Explicit non-changes

- No new DB fields, no per-user read state, no Inbox indicator work, no sales-stage changes.
