# HTC Calendar Corrections

**Environment:** Sandbox only  
**Verdict:** GREEN (evidence-gated)

## Scope

1. Appointment time preservation (no invented 09:00–17:00; explicit `is_all_day`)
2. Read-only appointment details (view ≠ edit)
3. Calendar usability (times/All day on rows, end-date coherence, Day vs Month list)
4. Lead/client workspace navigation from detail dialog
5. Public calendar past dates — no Available / Inquire + server authority rejects past

Nicole Bethune `scheduled_date` projection remains closed and was re-proven in this run.

## Commits / deploy

| Field | Value |
|---|---|
| App commit (serving) | `5fe3d13ece6d3002452e28c30cda5b47754e8173` |
| Past-date SQL migration | `5b94b4e3` (`20261418400000_public_availability_rejects_past_dates.sql`) |
| Assertion fix | `2320f772` |
| Deploy run | https://github.com/jlcormier612/wevenu-website/actions/runs/38333123630 |
| Serving tip | `dpl=5fe3d13ece6d3002452e28c30cda5b47754e8173` |
| Migration apply | https://github.com/jlcormier612/wevenu-website/actions/runs/38333729381 |

First deploy attempt `38332682930` failed on Public ECR rate limit (`toomanyrequests`); retry succeeded. Production untouched.

## Focused tests

45/45 calendar + public-calendar + Nicole projection.

## Browser proof (32/32)

Artifacts: `browser-results.json`, `browser-run.log`, `day-timed.png`, `public-past-month.png`

| Check | Result |
|---|---|
| Timed create 2027-03-27 10:00–11:00 (no custom end date) | PASS — persisted timed, not all-day |
| Reload / day view times | PASS |
| Read-only detail on row click | PASS |
| Explicit Edit prefilled times | PASS |
| Unrelated notes edit preserves schedule | PASS |
| Cancel makes no changes | PASS |
| Genuine all-day stays untimed; edit does not invent 09:00–17:00 | PASS |
| Month list / Day labels; Week + Agenda show times; Today nav | PASS |
| Public past month: no Available cells, no Inquire | PASS |
| Future Sept 2027 still Available/Inquire | PASS |
| `_is_event_date_available` past → false; past month RPC dates empty | PASS |
| No blocked_time side effect | PASS |
| Nicole May 8–9 projection + UI + Barn filter + reload | PASS |
| Runtime stayed on `5fe3d13e` | PASS |

Public form `create_public_form_lead` public_key was not present for this venue; rejection is proven via `_is_event_date_available` (the `choose_available` gate) and `get_public_availability_calendar` returning no past dates.

Proof fixtures were deleted after the run.

Production untouched. Unrelated dirty tree preserved.
