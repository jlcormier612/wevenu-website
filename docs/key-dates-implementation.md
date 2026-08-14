# Key Dates — Implementation Report

**Date:** 2026-08-13  
**Repo:** `wevenu-website`  
**Source of truth:** `docs/key-dates-implementation-specification.md`  
**Scope:** Mount existing `KeyDatesSection` into Booking Workspace Overview; delete rows-affected guard. No commit/push.

---

## 1. Exact files changed

### Product
- `app/(app)/clients/[id]/page.tsx` — pass `client.keyDates` into `EventDetail`
- `components/events/event-detail.tsx` — `keyDates` prop; Overview second card mounts `KeyDatesSection`
- `lib/clients/repository.ts` — `deleteKeyDate` verifies rows affected (`.select("id")`)
- `lib/clients/service.ts` — propagate delete `ok:false` when zero rows deleted

### Tests
- `lib/clients/key-dates.test.ts` *(new)* — `validateKeyDateInput` + delete rows-affected

### QA (not product)
- `docs/qa/key-dates-browser-evidence/smoke.mjs`
- `docs/qa/key-dates-browser-evidence/*` (screenshots + `results.json` / `results-final.json`)

### This document
- `docs/key-dates-implementation.md`

---

## 2. Behavior implemented

### Coordinator Booking Workspace (Overview)
- `getClient()` already loads `keyDates`; page now passes them to `EventDetail`.
- Overview’s existing `lg:grid-cols-2` beside **Event summary** now has a second **Key Dates** card wrapping the existing `KeyDatesSection` (`clientId={event.clientId!}`, `initialKeyDates={keyDates}`).
- No new route, tab, nav item, or redesign. Add / list / delete UI is the pre-existing component.

### Delete safety
- `deleteKeyDate` now ends with `.select("id")`. If zero rows match (nonexistent id, wrong venue, or RESTRICTIVE owner/manager delete gate), returns `{ ok: false, message: "Only an Owner or Manager can delete a key date." }` instead of silent success.
- `deleteKeyDate_` returns that failure to the action/UI. Permissions, RLS, and UI chrome unchanged.

### Couple portal
- Unchanged. Existing “Next key date” card receives data once coordinators can create dates.

### Edit
- Existing stack has **add + delete only** (no update API / no edit UI). Not invented.

---

## 3. Verification

### Commands
- `npx tsc --noEmit` — clean
- `npx tsx --test lib/clients/key-dates.test.ts` — 8/8 pass
- `npm test` — 587/587 pass

### Browser / DB (`docs/qa/key-dates-browser-evidence/results-final.json`)

| Check | Result |
| --- | --- |
| Overview mounts Key Dates beside Event summary | **VERIFIED LIVE** |
| Load seeded key dates | **VERIFIED LIVE + DATABASE** |
| Create + persist (reload + DB row) | **VERIFIED LIVE + DATABASE** |
| Delete (real id) + persist | **VERIFIED LIVE + DATABASE** |
| Nonexistent delete → zero rows | **VERIFIED DATABASE** |
| Staff/Coordinator delete gate blocks | **VERIFIED DATABASE** |
| Couple portal “Next key date” shows coordinator-created date | **VERIFIED LIVE** |
| RLS policies still present (`client_key_dates`, count=2) | **VERIFIED DATABASE** |
| Form login path (password form) | **UNVERIFIED** — seed credentials work via Auth API; Playwright form submit hung on this session (HMR/websocket noise). Session cookie used for coordinator UI. |
| Dashboard / Calendar click-through | **UNVERIFIED** this pass (links already target `/clients/{id}`; Overview now has the card) |

---

## 4. Do-not-touch confirmation

Unchanged as required:
- Key Dates model / terminology / suggestion list / schema (no migration)
- Couple portal architecture / “Next key date” design (read-only verification only)
- Dashboard Decision Engine / Calendar
- Booking Workspace beyond Overview Key Dates card mount
- Nav, permissions/RLS (except app-layer delete rows-affected check)
- Notifications, Automations, Pipeline, Vendor, Event Order, Seating, Luv, Help, Library, Branding, Contracts, Payments, Wedding Website

---

## 5. STOP

Approved Key Dates work only. No commit. No push. No further domains.
