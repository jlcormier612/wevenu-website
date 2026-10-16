# Luv Noticed stale follow-up (Betty Boop)

**Status:** Fix implemented locally; Sandbox deploy + Betty lead verification required for GREEN.

## Root cause

The Overview “Luv noticed” card for Betty was the **legacy** `followup-*` observation (`lib/luv/observations.ts` §6), not S3:

| Fact | Betty (`14eedef3-…`) |
|---|---|
| Copy | “Betty Boop reached out **2 days ago** — they might appreciate hearing from you.” |
| Age clock | `leads.created_at` only (`2026-10-13`) |
| Eligibility | `last_contacted_at IS NULL` only |
| Live activity | Confirmed tour + `venue_staff` outbound + inbound reschedule minutes ago |

S3 correctly excluded Betty (`hasVenueFirstResponseEvidence`: tour + venue_staff). Legacy is only suppressed when S3 **fires** for the same lead (`shouldSuppressLegacyFollowupObservation`). When S3 correctly stays silent, legacy incorrectly still urged follow-up.

## Fix (smallest)

1. Gate legacy `followup-*` on the same first-response evidence as S3 (`hasVenueFirstResponseEvidence` via `loadUnattendedInquiryContactEvidence`).
2. Recency uses latest **prospect inbound** when newer than `created_at` (inbound advances age; venue outbound never becomes “they reached out”).
3. After authoritative conversation send on the lead, `router.refresh()` so Noticed recomputes without an unrelated reload.

## Evidence

- `betty-evidence.json` — live Sandbox contact evidence; legacy+S3 both `null` after fix; pre-fix would show (age 2 days).
- Focused tests: `lib/luv/legacy-no-followup-freshness.test.ts`

## Preserve

Production / DNS / Resend untouched. Unrelated dirty tree preserved.
