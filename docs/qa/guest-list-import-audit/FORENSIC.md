# Migration Center Guest List Import — Forensic Audit

**Date:** 2026-10-20  
**Branch:** `feat/spaces-booking-e1-smart-fields`  
**HEAD:** `487cb347`  
**Sandbox serving:** `c1247d09` / TD `htc-sandbox-venue-app:817`  
**Production:** untouched  
**Dirty tree:** preserved (~886)  
**Scope:** Read-only audit. No feature, permission, schema, or UI changes.

---

## Verdict

**NOT GREEN — PRODUCT DECISION REQUIRED**

Cross-venue destination checks and quiet-import behavior are implemented. The **ownership and authorization model for guest lists is not product-coherent**: the table is defined as Client-Owned, Migration Center writes it with service-role and forces venue visibility, and guests are **not** stored on an Event FK despite UI copy saying “on an active Event.”

Do not remove, further expose, or “fix” ownership without an explicit product decision (see §5).

---

## 1. End-to-end data flow (verified)

| Step | Location | Behavior |
|------|----------|----------|
| UI option | `components/settings/migration-center.tsx` | Entity `guest_list` labeled **“Guest list (operational couple guests on an active Event)”**; in `COMMITTABLE_ENTITIES` |
| CSV fields | Same file `FIELD_KEYS_BY_ENTITY.guest_list` | Requires clientEmail + eventDate (or optional eventId); guest PII + RSVP/dietary/accessibility |
| Normalize | `lib/migration/sources/generic-csv.ts` | Maps CSV → `NormalizedGuestListEntry` |
| Session | `app/(app)/settings/migration-actions.ts` + `lib/migration/service.ts` | Venue-scoped via `getCurrentVenue()` |
| Commit | `service.ts` `commitOneRecord` for `guest_list` | **`createAdminClient()`** then `commitOperationalGuest` |
| Persist | `lib/migration/operational-guest.ts` | Inserts `couple_guests` (+ optional `couple_households`) |
| Destination resolve | `lib/migration/resolve-refs.ts` `resolveEventForMigration` | Event must match **current venue_id**; else clientEmail + eventDate on that venue |

```
MC CSV → normalize → review → commit (admin JWT)
  → resolveEventForMigration(venueId, eventId|clientEmail+eventDate)
  → reject if event date in the past
  → insert couple_guests { venue_id, client_id, …, visibility_to_venue: true, invitation_status: 'draft' }
```

**Critical:** `couple_guests` has **no `event_id` column** (Sandbox probe confirmed). Event is used only to prove an active/future booking exists and to derive `client_id`. Guests attach to the **client**, not to a specific Event row.

---

## 2. Ownership model (evidence)

### Product doctrine (foundational)

`supabase/migrations/20260629040000_couple_owned_data.sql`:

> couple_guests — their guest list (**venue does NOT see individual records**). The venue sees total count via events.guest_count. … **No coordinator RLS — these tables belong to the couple.**

`20260629060000_couple_engagement.sql`: `visibility_to_venue` defaults **false**; couples opt in to share.

`20260825000000_guest_household_foundation.sql`: Restores Client-Owned stance — **drops** venue SELECT policy on `couple_guests`; households have **no** authenticated policies.

Venue export (`lib/export/archive.ts`): Guest lists are **omitted** from venue export as couple planning data.

### What Migration Center does instead

| Behavior | Evidence |
|----------|----------|
| Service-role DML grant | `20261326000000_active_business_continuity.sql` |
| Commit bypasses venue JWT RLS | `service.ts` comment + `createAdminClient()` |
| Forces `visibility_to_venue: true` | `operational-guest.ts` insert |
| Sets `invitation_status: 'draft'` | Quiet; no invite send |
| Prior cert treated path GREEN after admin-write fix | `docs/qa/mc-specialized-cert/STATUS.md` |

### “Operational couple guests” meaning in code

Not a separate table. It means: write into the **same** `couple_guests` table the couple portal uses, for a client that has a **future/active** Event, without sending invitations. Naming is marketing/ops language over Client-Owned storage.

### Who manages the list day-to-day?

| Actor | Path |
|-------|------|
| Couple | Portal SECURITY DEFINER RPCs (`add_couple_guest`, CSV batch, etc.) |
| Venue staff (normal JWT) | Historically SELECT-only / later tightened to **no table SELECT policy** (household foundation). Writes require migration admin path or RPCs |
| Venue staff (ops aggregates) | `get_wedding_day_ops` SECURITY DEFINER reads dietary from `couple_guests` by **client_id** (not gated on `visibility_to_venue` in the 20260911 version) |

There is **no** separate “venue operational guest list” entity distinct from the couple’s list.

---

## 3. Authorization (venue-focused)

### Enforced today

- MC actions require authenticated session + current venue (`getCurrentVenue`).
- `resolveEventForMigration` always filters `events.venue_id = venueId` → **cross-venue eventId rejected**.
- Client resolve also scoped to venue.
- Past Events rejected for guest_list commit.
- Multiple Events same client+date → must set `eventId` explicitly.
- Quiet import: invitation stays `draft`; specialized cert measured invites=0.

### Not a complete “venue may manage guest lists” model

- Normal venue JWT **cannot** insert guests (by design); MC uses **admin** to bypass that.
- Import **forces** venue visibility without couple consent.
- Guests are not Event-partitioned; wrong client association is the real risk (mitigated by email/id resolution, not by Event FK).
- Team capability matrix for “guest list import” is not a separate permission — any staff who can open Migration Center for the venue can run it (subject to Settings access).

### Client portal / client permissions

Couple portal owns create/edit via token RPCs. Audit did **not** find a client-facing “Migration Center.” This importer is **venue-facing only**.

---

## 4. Destination Event association

| Question | Answer |
|----------|--------|
| Must Event exist first? | **Yes** (resolve fails otherwise) |
| How chosen? | CSV `eventId` **or** `clientEmail` + `eventDate` (UI field list; no separate destination picker beyond entity + CSV columns) |
| Shown clearly before commit? | Review shows mapped rows; **no dedicated “Destination: Event X” confirmation card** beyond column values |
| Server validates venue? | **Yes** |
| Guests linked to Event FK? | **No** — only `client_id` + `venue_id` |
| Wrong Event among several for same client? | Mis-resolved client+date can attach guests to that **client’s** list (shared across that client’s events) |
| Past / missing Event | Rejected |
| Duplicates | Idempotent on sourceId marker / email / name+household |
| Partial success | Per-row migration record outcomes (existing MC session model) |

Sandbox probe (`probe-results.json`): insert with `visibility_to_venue: true`, `invitation_status: draft`, client match; **no event_id column**.

---

## 5. Supported fields & side effects

**Importable (confirmed):** first/last name, guest email/phone, household, RSVP, meal, dietary text/tags, accessibility tags/notes, child flags, plus-one, vendor meal, notes, sourceId; destination refs eventId / clientEmail / clientId / eventDate.

**Sensitive:** emails, phones, dietary, accessibility, ages — stored on couple-owned rows with forced venue visibility.

**Side effects:** invitations not sent (`draft`); specialized cert + probe saw no client_invitations for fixture. No evidence of sequence enrollment from this path.

**Visibility surfaces:** Couple portal guest UI; wedding-day dietary aggregates via SECURITY DEFINER; venue export **excludes** guest lists; no dedicated venue “Guest List” CRM page found that lists individuals (architecture notes underscored this).

---

## 6. Options (Phase 5)

| Option | Fit? |
|--------|------|
| **A — Safe as designed** | **No** — doctrine (Client-Owned, private by default) conflicts with MC admin write + forced visibility + “on an Event” copy that oversells Event binding. |
| **B — Guidance/safeguards only** | Possible *after* decision (e.g. clearer copy: client-scoped couple list; Event is prerequisite only; consent/visibility expectations). Insufficient alone while ownership is unresolved. |
| **C — Product decision required** | **Yes — current outcome.** |
| **D — Confirmed auth defect** | Cross-venue Event spoofing is already blocked. The issue is **intentional service-role write into Client-Owned data**, not an accidental IDOR in resolve. |

### Product decision required (precise)

1. **Is Migration Center allowed to seed `couple_guests` on the couple’s behalf during venue cutover?**  
   - If **yes**: document as an explicit cutover exception; decide whether `visibility_to_venue` must stay forced, default false, or require couple acknowledgment later; fix UI to say guests attach to the **client** (Event is a prerequisite for “active” cutover), not “on an Event” as a storage destination.  
   - If **no**: remove or gate the MC option; keep portal/couple import paths only.

2. **Should venue staff see individual imported guests?**  
   Align RLS, wedding-day ops, and `visibility_to_venue` with that answer.

3. **If Event-scoped guest lists are required**, that needs a **schema** decision (`event_id` or equivalent) — not copy alone.

---

## 7. Baseline tests (no feature change)

```
npx tsx --test lib/migration/operational-continuity.test.ts lib/migration/guest-list-admin-write.test.ts
```
→ **14/14 pass** (normalize/validate/admin-write contract only).

Prior specialized cert (historical): guest_list GREEN on disposable venue after admin-write fix — **does not** resolve ownership doctrine conflict.

---

## 8. What was not done

- No UI/schema/permission code changes.  
- No Production access.  
- No real customer guest inspection.  
- Full browser MC CSV commit not re-executed this audit (prior specialized cert + code/probe evidence sufficient for ownership verdict). Destination UX clarity remains a gap for any future Option B pass.
