# Start booking file workflow — forensic audit

**Date:** 2026-10-16  
**Environment:** Sandbox read-only for Gina; code audit on current branch  
**Production:** untouched

## 1. Gina Palo & Rich Dude (reported example)

| Entity | Value |
|---|---|
| Lead | `26bd6fba-b10b-4db2-a97d-10df4719ab29` — Gina Palo / Rich Dude |
| Venue | Meadowbrook `05f16a15-…` |
| `sales_stage` | `tour_scheduled` (**not** Booked) |
| Client workspace | `132c1553-9738-4ef6-9538-e83fcb863641` — `status=booking` |
| Floor plans / vendors on client | none yet |
| Preferred date | 2027-11-06 (preference only) |

Evidence: `gina-readonly.json`

## 2. Disappearing entry point — root cause (proven)

**Path:** Lead detail → `Start booking file` → `startBookingFileAction` → `convertLeadToClient` → navigate `/clients/{clientId}`.

**CTA gate** (`components/leads/lead-detail.tsx`):

```ts
const previouslyConverted = !!lead.linkedClientId;
// Start booking file only when !previouslyConverted
```

Once the client exists, `linkedClientId` is populated (via `clients.lead_id` join in the lead repository). **Start booking file is hidden.**

**Prior intentional removal:** `docs/qa/lead-booked-terminology/AUDIT.md` removed **"Open booking file →"** because it competed with Mark as Booked terminology. Tests assert it stays gone (`booking-lifecycle.test.ts`).

**Result:** Workspace remains at `/clients/{id}` and is fully resumable, but the lead page no longer surfaces any continue/resume control. Leaving mid-setup looks like the entry point “disappeared.” Transient UI state is not required — this is a **missing CTA**, not lost data.

## 3. Workflow paths

| Surface | Path |
|---|---|
| Start (lead, no client) | `startBookingFileAction` → client `status=booking` — does **not** Book or reserve date |
| Pre-booking workspace | `app/(app)/clients/[id]/page.tsx` when not booked — FloorPlanWorkspace + EventVendorsSection with `planningClientId` |
| Booked event workspace | Same components with `eventId` on event detail / booked client |
| Explicit Booked | `returnLeadToBookedAction` / `bookClient` — separate from Start |

## 4. Floor plans & vendors (current vs improved)

**Floor plans:** `FloorPlanWorkspace` supports many independent plans per booking. New-plan sheet applies **one** template (or blank / duplicate) per submit, then opens the editor. Setup Profile multi-select is a different concept (couple layout **offers** at inherit), not multiple operational plans.

**Vendors:** `EventVendorsSection` assigns **one** vendor per form submit. Portal invite is separate. Same component used for pre-booking (`planningClientId`) and booked events.

**Gap vs user expectation:** both sheets are single-select; users want multi-select apply/assign in one operation without inventing new domain semantics (still N independent plans / N assignment rows).

## 5. Target behavior (locked for implementation)

1. Lead with linked client, not Booked, not Lost → **Continue setup** → same `/clients/{id}` (optional `?eventId=`).
2. Lead without client → **Start booking file** unchanged.
3. Mark as Booked remains explicit and separate.
4. Floor-plan Apply Template: multi-select templates → one independent plan per template (names default to template names when multi).
5. Vendor assign: multi-select vendors → one assignment each; skip already assigned; no portal invite.
6. Questionnaires remain Booked-only; no date reservation on Start/Continue.
