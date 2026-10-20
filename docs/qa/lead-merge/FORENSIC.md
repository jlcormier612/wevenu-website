# Lead Merge — Phase 1 Forensic Audit

**Date:** 2026-10-20  
**Branch:** `feat/spaces-booking-e1-smart-fields`  
**HEAD (audit start):** `cfde1b7b`  
**Sandbox serving:** `803046b4` / TD `:810`  
**Production:** untouched  
**Dirty tree:** preserved (many unrelated QA/docs mods; not staged for this work)

---

## 1. Starting state

| Item | Value |
|------|-------|
| Merge feature today | **Does not exist** — no `mergeLead`, `merged_into`, or merge UI |
| Duplicate detection | **Exists** — warn-only; never merges |
| Venue guidance | Manual copy fields → delete duplicate (`possible-duplicate-banner.tsx`) |
| Lead delete + tours | **Proven** — cancel occupying tours then archive (`applyLeadRecordDeletion`); Sandbox GREEN in `docs/qa/duplicate-lead-tour-orphan/` |

---

## 2. Lead lifecycle (code + schema)

### Creation paths
- Staff / public intake → `ingestLead` / `createLeadCore` (`lib/leads/service.ts`, `lib/lead-intake/pipeline`).
- Tour booking RPC `book_tour_for_lead` attaches `tour_appointments.lead_id` (nullable FK, **ON DELETE SET NULL**).
- Relationship graph: `venue_customer_relationships` + `leads.relationship_id` (email dedupe at relationship layer; open leads still duplicate-warn).

### Duplicate review (current)
- Tables: `lead_duplicate_reviews` (`20261377000000_lead_duplicate_reviews.sql`).
- Detection: strong signals only — email, phone, partner_email, name_pair, inquiry_text (`lib/leads/duplicate-detection.ts`). Explicitly **never merges**.
- UI: banner + “Keep separate” / “Open existing” / manual consolidate guidance. **No Merge action.**

### Dependent entities (selected)
| Entity | FK to leads | On delete |
|--------|-------------|-----------|
| `tour_appointments` | `lead_id` | SET NULL |
| `lead_notes`, `lead_tasks`, `lead_activities` | `lead_id` | CASCADE |
| `conversations` / messaging | `lead_id` | CASCADE (messaging) |
| `documents` | `lead_id` | CASCADE |
| `date_holds` | `lead_id` | SET NULL |
| `tour_protection_requests` | `lead_id` | **RESTRICT** (blocks lead delete) |
| `clients` | `lead_id` | SET NULL |
| `lead_duplicate_reviews` | `lead_id` / `matched_lead_id` | CASCADE / SET NULL |
| `lifecycle_booking_events` | `lead_id` | SET NULL |
| Space prefs, SMS tokens, etc. | various | cascade / set null |

---

## 3. Tour lifecycle & slot release (evidence-backed)

### What occupies a tour slot
`lib/availability/repository.ts` loads tours with `.not("status", "eq", "cancelled")`.  
**Cancelled tours do not occupy.** Archived alone is insufficient if status stays `scheduled`/`confirmed` (prior orphan bug).

### Lead delete path (authoritative)
`applyLeadRecordDeletion`:
1. Block if `tour_protection_requests` exist.
2. Set occupying (`scheduled`/`confirmed`) tours → `status = cancelled`.
3. Cancel pending `task_reminders`.
4. Soft-archive tours (`is_archived = true`).
5. Delete lead (tour `lead_id` SET NULL).

Prior Sandbox E2E (`duplicate-lead-tour-orphan`): delete → cancelled + archived + capacity 0; confirm token not confirmable.

### Venue cancel path
`updateTourStatus(..., "cancelled")` sets status cancelled and cancels reminders. **Does not delete the row.** Slot released because occupancy ignores cancelled.

### Merge implications (design constraints)
- **Do not delete** secondary lead as default merge (would cancel its tours).
- **Reassociate** tours by updating `tour_appointments.lead_id` to primary when preserving appointments.
- **Two distinct tours:** keep both on primary; never silently drop a time.
- **Same appointment referenced twice:** impossible as single-row PK; prevent double-create only.
- Cancellation to free a slot must use cancel pathway (`updateTourStatus` or equivalent), then verify occupancy.

### Disposable Sandbox probe (2026-10-20) — GREEN 8/8

Script: `docs/qa/lead-merge/probe-tour-slot-release.mts`  
Results: `docs/qa/lead-merge/probe-tour-slot-results.json`  
Venue: `6ad57710-6e10-4711-a011-e860d84a6627`

| Check | Result |
|-------|--------|
| Cancel sets occupancy count to 0 | PASS |
| Same slot bookable after cancel | PASS (`ba6c6f24…`) |
| `lead_id` reparent keeps id/status/scheduled_at | PASS (`bfd594c4…` → primary, status confirmed) |
| Lead-delete path cancels + archives + nulls lead_id | PASS |

**Proven:** cancellation releases the slot; reparent is safe without cancel/recreate.

### Baseline tests (pre-implementation)
`lib/leads/duplicate-review|detection` + `lead-delete-tour-reconcile` + `tours/delete-guard` → **38/38 PASS**

---

## 4. Proposed merge design (smallest safe)

### Transaction shape
Server action `previewMergeLeads` / `confirmMergeLeads` (venue-scoped JWT):

1. Authorize both leads same `venue_id`; reject cross-tenant.
2. Default primary = earliest `created_at` (tie-break `id`); allow explicit override only when tied/ambiguous.
3. Preview: field diffs, notes/comms counts, tour list, blocked reasons (protection requests, booked client on secondary, etc.).
4. Confirm with: conflict choices map, tour decisions (keep both | cancel secondary tour via cancel path), stale-check versions/`updated_at`.
5. In one DB transaction (or ordered steps with compensation):
   - Fill empty primary fields from secondary (never overwrite conflicts without choice).
   - Re-point `tour_appointments.lead_id` secondary → primary (preserve id/status/time).
   - Re-point or keep notes/activities/tasks/documents/conversations per FK semantics (UPDATE `lead_id` where SET NULL/CASCADE-safe; do not cascade-delete by deleting secondary).
   - Mark secondary as merged: add nullable `merged_into_lead_id` + `merged_at` + `merged_by` **or** terminal `sales_stage` + activity — **narrow column preferred for redirect**.
   - Write `lead_activities` audit on primary (and secondary).
   - Resolve open `lead_duplicate_reviews` for the pair.
6. **Do not** trigger automations, tour confirmation emails, or intake webhooks on merge.
7. Rollback entire confirm if any required step fails; retries idempotent (already-merged secondary → no-op success).

### Schema (minimal if required)
`leads.merged_into_lead_id uuid null references leads(id) on delete set null`  
`leads.merged_at timestamptz null`  
Redirect: lead detail page if `merged_into_lead_id` set → link/redirect to primary.

### Explicit non-goals
- No generalized entity-merge framework.
- No `rollbackImportBatch` / migration cleanup involvement.
- No Production.

---

## 5. Regression risks & baseline tests

### Must remain unchanged
- Public inquiry + tour-request lead creation.
- Duplicate detection + keep-separate.
- Tour book / cancel / reschedule / occupancy.
- Tenant RLS.
- Lead delete tour reconciliation.

### Baseline (Phase 1)
```
lib/leads/duplicate-review.test.ts
lib/leads/duplicate-detection.test.ts
lib/records/lead-delete-tour-reconcile.test.ts
lib/tours/delete-guard.test.ts
→ 38/38 PASS
```

---

## 6. Product decisions

**None blocking** under the brief:
- Primary = earliest submission (specified).
- Soft-mark secondary + redirect (specified; not hard-delete).
- Two tours → both kept + venue decides (specified).
- Conflicts → explicit choice (specified).

Optional later (out of scope unless blocked): merge when secondary has `tour_protection_requests` (RESTRICT) — **hard-block merge** with clear next step until protection resolved.

---

## 7. Phase 1 → Phase 2 gate

Safe to implement bounded merge under above design. Next: disposable Sandbox cancel/reparent probe, then code + migration + UI + tests + Sandbox deploy.
