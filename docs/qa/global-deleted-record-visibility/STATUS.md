# Global Deleted-Record Visibility

**Status: IMPLEMENTING → Sandbox proof in progress**  
**Production:** untouched  

## Locked rule

Successful hard delete → the deleted entity must not surface in any **active** business surface.  
Failed delete → record remains; UI reports failure; never optimistic success.  
No soft-delete (`deleted_at`). No `exclude_from_business_reporting` overload.

Ellie forensic note (preserved): at investigation time Ellie was **not** successfully deleted; Focus showed a live overdue `lead_task`. Platform gap remains real for successful-delete + SET NULL / denormalized / RESTRICT paths.

---

## Deletion contract

### Lead (authoritative parent: `leads`)

| Aspect | Behavior |
|---|---|
| Mutation | Hard `DELETE` via `applyLeadRecordDeletion` (`lib/records/delete-record.ts`) |
| CASCADE | `lead_tasks`, notes, activities, lead-scoped docs, … |
| SET NULL | `clients.lead_id`, `tour_appointments.lead_id`, commercial lead refs, … |
| RESTRICT | `tour_protection_requests.lead_id` — **preflight blocks** with clear message |
| After success | Soft-archive tours for that lead; clear `luv_drafts` where `entity_type=lead`; clear client lifecycle stamps; remove lifecycle booking events |
| Surviving client / financials | Kept; must not present as that lead |
| Failure | Record intact; toast + dialog stay open |

### Client

| Aspect | Behavior |
|---|---|
| Preview refuse | Signed contracts or collected payments |
| Preflight | Linked lead tour-protection blockers before any destructive work |
| Events | Best-effort hard delete; failure aborts client delete |
| Linked lead | Goes through `applyLeadRecordDeletion` (same visibility side effects) |

### Tours

Active lists already filter `is_archived = false`. Lead delete now archives related tours so denormalized `contact_name` cannot keep the person in active Tours.

### Contracts / payments / invoices

Not deleted by lead delete. Historical financials remain. Active selectors load live entities only (hard-deleted lead cannot appear).

### Luv

Live observations read live tables. Lead-scoped drafts cleared on delete. Venue-level Phase 5 patterns re-sync from live populations on next recommendation load. L1 gate unchanged.

### Search

`search_global` queries live `leads` — successful delete removes hits.

---

## Architecture implemented

1. **`lib/records/deletion-contract.ts`** — failure copy + documented FK contract  
2. **`applyLeadRecordDeletion`** — RESTRICT preflight, tour archive, Luv draft clear, exact delete count, mapped FK errors  
3. **Dashboard / nav** — `leads!inner` on open `lead_tasks` / activities (active-entity read rule)  
4. **Delete UI** — failure keeps dialog open; never claims success  
5. **Revalidate** — `/dashboard`, `/tours`, lists, reporting on success  

No giant abstraction. No soft-delete. No reporting redesign.

---

## Surfaces audited

| Surface | Enforcement |
|---|---|
| Dashboard / Today's Focus tasks | CASCADE + `leads!inner` |
| Nav task badges | `leads!inner` |
| Leads list / detail | Hard delete removes row |
| Search | Live `leads` query |
| Selectors using `getLeads` | Live rows only |
| Tours (active) | Archive on lead delete |
| Clients kept after lead delete | SET NULL; workspace remains |
| Luv drafts | Cleared for lead entity |
| Luv Phase 5 / S1–S4 | Live data; L1 unchanged |
| Contracts / payments historical | Kept when financials exist |
| Reporting | Lead gone from counts; Booking history removed intentionally |

---

## Tests

- `lib/records/delete-record.test.ts` — contract, preflight/archive wiring, failure UX, `!inner`, revalidation, error copy  
- `tsc --noEmit` clean  

---

## Deploy / browser proof

_(filled after Sandbox deploy)_
