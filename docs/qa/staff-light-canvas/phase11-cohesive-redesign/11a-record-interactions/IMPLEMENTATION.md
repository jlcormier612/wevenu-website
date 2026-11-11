# Phase 11A — Shared Record Interaction Consistency

**Date:** 2026-11-03  
**Branch:** `feat/spaces-booking-e1-smart-fields`  
**HEAD (pre/post, no commit):** `69cacab8508c40f4d4716b552f2b88e831816ca3`  
**Dirty tree:** preserved (~1665 paths at start; Phase 10 intact)  
**Release worktree:** untouched  
**Commit / push / deploy:** none  

## What shipped

Shared Pattern 13 interaction for staff record-name navigation:

| Token | Behavior |
|---|---|
| `.htc-record-link` | Charcoal (`var(--foreground)` / `#24332B`) at rest; underline on hover; underline + inset `focus-visible` ring |
| `.htc-record-card-link` | Whole-card record navigation (Invoices) — card hover wash retained; focus ring added |

No new routing abstractions. No `RecordNameLink` component (class-only to avoid forcing incompatible navigation shapes).

## Lists updated

| Surface | Change |
|---|---|
| Clients | `hover:underline` → `htc-record-link` (reference) |
| Leads | `hover:text-primary` → `htc-record-link` |
| Contracts | desktop + mobile titles → `htc-record-link` |
| Vendors | → `htc-record-link` |
| Payments | → `htc-record-link` |
| Events (`EventList`) | → `htc-record-link` (list component; `/events` route still redirects to Clients) |
| Requests | permanent `underline` → `htc-record-link` |
| Documents | title button → `htc-record-link` (Phase 10 mobile actions preserved) |
| Messaging history | name wrapper → `htc-record-link` |
| Invoices | card Link → `htc-record-card-link` |

## Intentionally unchanged

- Tours: action-dense rows; couple name remains plain text; lead affordance stays chevron `Button`/`Link` (see `EXCEPTIONS.md`).
- Lead stage/type filter chips: still `text-primary hover:underline` (not record titles).
- Pipeline board: whole-card `router.push` kanban cards (different interaction model).
- Clients soft-rose `data-attention` inset.
- Hospitality table row hover (warm canvas mix) — decorative, not blush-as-hover.
- No Phase 11B–11E workspace chrome work.

## Files touched (Phase 11A)

- `app/globals.css` — shared classes (**file also has large pre-existing hospitality CSS**)
- `components/clients/client-list.tsx`
- `components/leads/lead-list.tsx` (**pre-existing dirty**)
- `components/contracts/contract-list.tsx` (**pre-existing dirty**)
- `components/vendors/vendor-list.tsx` (**pre-existing dirty**)
- `components/payments/payment-schedule-list.tsx` (**pre-existing dirty**)
- `components/events/event-list.tsx`
- `components/requests/request-manager.tsx`
- `components/document-workspace/document-card.tsx` (**pre-existing dirty / Phase 10**)
- `components/messaging/message-history-list.tsx`
- `app/(app)/invoices/page.tsx`
- `lib/theme/phase11a-record-interactions.test.ts` (new)
- Docs under this folder + `capture-browser.mts`
