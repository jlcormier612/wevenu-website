# HTC Calendar Corrections

**Environment:** Sandbox only  
**Verdict:** PENDING browser proof

## Scope

1. Appointment time preservation (no invented 09:00–17:00; explicit `is_all_day`)
2. Read-only appointment details (view ≠ edit)
3. Calendar usability (times/All day on rows, end-date coherence, Day vs Month list)
4. Lead/client workspace navigation from detail dialog
5. Public calendar past dates — no Available / Inquire

Nicole Bethune `scheduled_date` projection remains closed (`d753eafb` / evidence in `docs/qa/nicole-bethune-calendar-integrity/`).

## Commit / deploy

| Field | Value |
|---|---|
| Commit | _(filled after commit)_ |
| Deploy run | _(filled after deploy)_ |
| Serving tip | _(filled after verify)_ |

## Focused tests (pre-deploy)

44/44 calendar + public-calendar + Nicole projection (5/5).

## Browser proof

_(filled after Sandbox runtime verification)_

Production untouched.
