# Multi-day booked event vs public calendar — STATUS

**Environment:** Sandbox only  
**Production:** Untouched  
**Status:** IN PROGRESS

## Verdict

Public calendar **Available** on 2027-09-03 / 2027-09-04 for Ellie is **correct** under established choose_available + simultaneous-venue rules: Meadow Lawn remains free for a full-day Event.

A separate SQL day-scoping defect falsely blocked other spaces on the wrong day; fixed in `20261418300000_schedule_overlap_same_calendar_day.sql`.

See `FORENSIC.md` for persisted evidence.
