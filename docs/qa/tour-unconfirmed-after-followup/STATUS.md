# P1 — Tour became unconfirmed after follow-up save

**Status:** CODE FIX COMMITTED — repair skipped (record already healed) — Sandbox verify in progress  
**Environment:** Sandbox only  
**Production:** untouched

## Forensic (preserved)

Original read-only evidence (do not overwrite):
- `db-snapshot.json` — hybrid `status=scheduled` + `confirmed_at` set (12:00 PM ET slot)
- Prior forensic narrative in git history / chat; snapshot fields below remain authoritative for the defect.

| Field (forensic) | Value |
|---|---|
| Lead | `5d33fcbe-e6c7-4163-9b5e-29db3389efca` (Bindi Lulu) |
| Tour | `555060cd-a188-4e2a-ae42-f0da64396e50` |
| Forensic status | `scheduled` with `confirmed_at=2026-10-16T03:00:12.633152Z`, `confirmation_source=prospect_link` |
| Forensic slot | `2026-10-18T16:00:00Z` (12:00 PM ET) |
| Root cause | `updateRelationshipFields` → `applyLeadTourWrite` → `future_schedule` forced `status: "scheduled"` on unchanged slot |

## Code fix

**Behavior**
- **Unchanged slot + venueTimezone:** `resolveLeadTourWrite` → `noop` (does not rewrite status or confirmation metadata).
- **Genuine date/time change:** still `future_schedule` (existing reschedule path; does **not** silently keep `confirmed` for a different slot).
- **UI defense:** when `hideManualTourSummary` (appointments present), follow-up Edit hides Venue tour fields and pins prior tour fields on save.

**Files**
- `lib/leads/relationship-tour.ts` — `sameLeadTourSlot` + same-slot noop
- `lib/leads/repository.ts` — re-resolve `future_schedule` with `venueTimezone` before write
- `components/leads/relationship-card.tsx` — pin/hide tour fields when appointments own tour UI
- Tests: `lib/leads/relationship-tour.test.ts` (+ minor `single-follow-up-date.test.ts` save-shape assert)

## Bindi repair — STOP / reassess

Guarded repair **refused**: live row no longer matched forensic snapshot.

| Field | Forensic | Live at repair attempt |
|---|---|---|
| `status` | `scheduled` | **`confirmed`** |
| `scheduled_at` | `2026-10-18T16:00:00Z` (12:00 PM ET) | **`2026-10-18T19:00:00Z` (3:00 PM ET)** |
| `confirmed_at` | `2026-10-16T03:00:12.633152Z` | **`2026-10-16T03:13:51.193123Z`** |
| `confirmation_source` | `prospect_link` | `prospect_link` |

Evidence: `bindi-reassess.json`, `bindi-repair-before.json` (guard dump). Second `tour_confirmed` activity at 03:13:51 (“confirmed their tour online”) after the demoting follow-up at 03:02:52. **No repair applied.** Hybrid scan at reassessment: **0** rows.

## Tests (local)

Focused: `relationship-tour` + follow-up-first + tour-completion-default + tour-followup-card-layout → **pass**.

Unrelated pre-existing: `single-follow-up-date` `isDueToday` fails when local calendar day ≠ UTC day (ET evening).

## Remaining gates

- [ ] Commit SHA
- [ ] Sandbox deploy + serving image
- [ ] Browser: Bindi tour stays Confirmed after follow-up save/reload
- [ ] Post-browser DB confirm + hybrid scan
- [ ] LEDGER GREEN when all above pass
