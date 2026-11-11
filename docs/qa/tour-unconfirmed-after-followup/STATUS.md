# P1 — Tour became unconfirmed after follow-up save

**Status: GREEN** on Sandbox tip `7e7a9359`  
**Environment:** Sandbox only  
**Production:** untouched  
**Customer sends / Mark as Confirmed / confirmation resend:** none this pass

## Deploy / serving

| Item | Value |
|---|---|
| Commit | `7e7a93597788770bb467f5e6d8a09d0d77ebb762` |
| Deploy | [38844883770](https://github.com/jlcormier612/wevenu-website/actions/runs/38844883770) **success** |
| Serving image | `htc-sandbox-venue-app:7e7a93597788770bb467f5e6d8a09d0d77ebb762` |
| Task definition | `htc-sandbox-venue-app:774` |
| Health | `{"ok":true,"checks":{"env":"ok","supabase":"ok"}}` |

## Forensic (preserved)

Original hybrid evidence (do not overwrite): `db-snapshot.json`

| Field (forensic) | Value |
|---|---|
| Lead | `5d33fcbe-e6c7-4163-9b5e-29db3389efca` (Bindi Lulu) |
| Tour | `555060cd-a188-4e2a-ae42-f0da64396e50` |
| Forensic status | `scheduled` + `confirmed_at=2026-10-16T03:00:12.633152Z` + `confirmation_source=prospect_link` |
| Forensic slot | `2026-10-18T16:00:00Z` (12:00 PM ET) |
| Root cause | `applyLeadTourWrite` `future_schedule` forced `status: "scheduled"` on unchanged slot during follow-up save |

## Code fix

**Unchanged slot** (date/time match occupying `scheduled_at` with venue timezone): `resolveLeadTourWrite` → **`noop`** — does not rewrite status or confirmation metadata.

**Genuine date/time change:** still **`future_schedule`** (existing reschedule path; does not silently keep `confirmed` for a different slot).

**UI defense:** when `hideManualTourSummary`, follow-up Edit hides Venue tour fields and pins prior tour fields on save.

**Files:** `lib/leads/relationship-tour.ts`, `lib/leads/repository.ts`, `components/leads/relationship-card.tsx`, `lib/leads/relationship-tour.test.ts`

## Bindi repair

Guarded repair **refused** — live row no longer matched forensic hybrid:

| Field | Forensic | At repair attempt |
|---|---|---|
| `status` | `scheduled` | `confirmed` |
| `scheduled_at` | 12:00 PM ET | 3:00 PM ET (`…T19:00:00Z`) |
| `confirmed_at` | `03:00:12Z` | `03:13:51Z` (second prospect_link confirm) |

Evidence: `bindi-reassess.json`, `bindi-repair-before.json`. **No repair UPDATE applied.**

## Verification

**Focused tests:** relationship-tour + follow-up-first + tour-completion-default + tour-followup-card-layout → **43/43 pass**.

**Unrelated pre-existing:** `single-follow-up-date` `isDueToday` fails when local calendar day ≠ UTC day (ET evening).

**Browser + DB** (`verify-browser.mts` → `browser-results.json`): **ALL PASS**

- UI Confirmed before and after follow-up Save + reload
- Manual tour edit hidden when appointments present
- DB `status=confirmed`; `confirmed_at` / `confirmation_source` / slot unchanged
- Hybrid scan `status=scheduled AND confirmed_at IS NOT NULL` → **0** rows

Screenshots: `before-followup-save-1280.png`, `after-followup-save-1280.png`

## Scope scan limitations

The hybrid scan only detects `scheduled` + non-null `confirmed_at`. It does not prove absence of every historical demotion that was later re-confirmed.
