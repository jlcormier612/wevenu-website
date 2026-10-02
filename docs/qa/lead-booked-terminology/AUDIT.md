# Lead → Booked terminology cleanup — Forensic Audit

**Date:** 2026-10-02  
**Scope:** Lead workspace labels/navigation only. Do not redesign bookClient / Client / Event model.

## 1. "Return to Booked" on Lead detail

| Item | Finding |
|------|---------|
| Component | `components/leads/lead-detail.tsx` |
| Visibility | `previouslyConverted && (relationshipCancelled \|\| (!isBookingStarted && currentStage !== "lost"))` where `previouslyConverted = !!lead.linkedClientId` |
| Why Miss Piggy shows it | Lead already has a linked client (from Start booking file / commercial path) but `sales_stage` is not `booked` |
| Handler | `returnLeadToBookedAction` → `returnLeadToBooked` → **`bookClient(..., source: "manual")`** |
| Modal copy today | Explicitly admits: "same booking transition as Mark as Booked" |
| After success | `toast` + `router.refresh()` only — **does not open Client workspace** |

**Verdict:** Mislabel. Action IS Mark as Booked. Rename + land in Client workspace.

## 2. "Open booking file →"

| Item | Finding |
|------|---------|
| Visibility | Any lead with `linkedClientId` |
| Destination | Plain `<Link href={`/clients/${lead.linkedClientId}`}>` |
| Distinct workflow? | **No.** Same Client workspace the product already treats as post-booking home. No separate "booking file" entity. |
| Conflict with locked model | Pre-booking work should stay on Lead (payment nav already corrected). Linking to Client as a parallel "booking file" competes with Lead/Client workspaces. |

**Verdict:** Remove from Lead action area. Do not invent a replacement "booking file" CTA.

## 3. Related labels (leave unless wrong)

| Surface | Label | Keep? |
|---------|-------|-------|
| Pipeline board / stage move | "Mark as Booked" + `PipelineBookedConfirmDialog` | Yes — already correct |
| Lead, never converted | "Start booking file" | Out of scope this pass (creates client without Booked); not renamed here |
| Event detail (cancelled) | "Return to Booked" | Semantically different (re-book cancelled event); leave |

## 4. Payment nav (must not regress)

- FE not Booked → Lead `?setupPayments=1#booking-journey-payments`
- Booked → `/clients/{id}?setupPayments=1`

## Implementation contract

1. Button: **Mark as Booked** (same visibility as today's Return to Booked).
2. Modal title/body/confirm per product copy.
3. On success: navigate to `/clients/{linkedClientId}` (prefer celebration path if `newlyBooked` available; otherwise client workspace). Prefer extending action to return `clientId` like pipeline booked move.
4. Remove **Open booking file →**.
5. Keep `returnLeadToBooked` / `bookClient` as the sole transition (no second path).
