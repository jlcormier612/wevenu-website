# Client-owned guest-list import/export — audit only

**Date:** 2026-10-20  
**Scope:** Read-only audit of what clients can actually do. No new features built.

---

## Summary

| Capability | Confirmed? | Notes |
|------------|------------|-------|
| Import guests from file | **Yes (partial)** | Portal CSV: First Name, Last Name, Email, Household only |
| Export / download guest list | **Not found** | No download/export UI or API in portal guest section |
| Preserve RSVP / meals / dietary / plus-one / accessibility through import | **No for CSV import** | Batch CSV maps only name/email/household; richer fields exist on manual add/edit |
| Access only own authorized data | **Yes (by design)** | Portal token → SECURITY DEFINER RPCs |
| Recover / review failed import errors | **Partial** | Toast “Import failed. Check your CSV format.” — no row-level error report UI |

---

## Confirmed: portal CSV import

| Item | Evidence |
|------|----------|
| UI route | Couple portal Guest List → `GuestSection` (`components/portal/guest-section.tsx`) |
| Trigger | “Import CSV” file input; copy: `CSV format: First Name, Last Name, Email, Household` |
| Client path | `handleCSV` → `POST /api/portal/guests` with `{ token, guests: parsed }` |
| Server | `app/api/portal/guests/route.ts` → RPC `batch_add_couple_guests` |
| Permissions | Portal token validates couple ownership inside RPC (not venue JWT) |
| Field coverage | **Import:** firstName, lastName?, email?, household? only |
| Household | Resolved/created inside `batch_add_couple_guests` (household foundation migration) |
| Error UX | Empty parse → toast; RPC failure → generic toast; success → `${imported} guests imported` |

**Not claimed:** venue Migration Center-equivalent field coverage (RSVP, dietary tags, accessibility, plus-one, meal choice) on CSV import.

---

## Confirmed: portal manual management

| Item | Evidence |
|------|----------|
| Add / edit / delete guests | Same `GuestSection` + `/api/portal/guests` POST/PATCH/DELETE via RPCs |
| RSVP, dietary, accessibility, children, wedding party, invitations | Supported on forms / PATCH path (broader than CSV) |
| Households | `/api/portal/households` |

---

## Not found: client export/download

| Search | Result |
|--------|--------|
| `guest-section.tsx` Export / Download / CSV download | **No matches** |
| Venue archive | Explicitly **omits** guest lists (`lib/export/archive.ts`) |
| Couple-facing archive/export of `couple_guests` | **Not verified as present** in this audit |

**Gap (product follow-up, not built here):** Clients may lack a first-class export of their full guest list. Manual copy or screenshots are not a product feature.

---

## Test evidence available in repo

| Area | Evidence |
|------|----------|
| Portal RPCs / household foundation | Migrations + existing portal tests (not re-run as browser e2e in this task’s unit phase) |
| Venue MC guest_list removal | `lib/migration/venue-guest-list-import.test.ts` (does not replace portal e2e) |

Sandbox browser verification for this task confirms portal Guest List **still reachable** after MC removal — not a full CSV import e2e unless exercised in `STATUS.md`.
