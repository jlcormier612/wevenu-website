# Luv Noticed — stale early-arrival insight / tour-outcome reconciliation

**Date:** 2026-10-14 · **Closure pass:** 2026-10-15  
**Production / Resend / DNS:** untouched  

## Exact timeline (Meadowbrook Rory)

| UTC | Event |
|-----|--------|
| `2026-10-15T01:59:59Z` | Tour scheduled email (Sat Oct 17 10:30) |
| `2026-10-15T02:00:25Z` | Tour confirmed email (“reply to reschedule”) |
| `2026-10-15T02:01:29Z` | Inbound: “Can I come in tonight instead…” (`07df6ca5-…`) |
| `2026-10-14T22:00:00Z` | `actual_occurred_at` recorded (visit clock — **before** the ask timestamp) |
| `2026-10-15T02:23:41Z` | `completed_at` — status `completed`; notes: loved venue / want to book |
| Later (pre-fix) | Luv Noticed: “They asked about Can I come in tonight… after the tour, and I don't see an answer recorded yet.” |

Conversation: `dcba7cbc-…` · Lead `09d26751-…` · Tour `4b57743b-…`  

## Root cause

1. Luv Noticed completed-tour observations are **computed live** via `evaluateCompletedTour`.
2. `occurredAt` prefers `actual_occurred_at`, so the early-arrival ask fell in the post-occurrence window.
3. No `venue_staff` outbound after that ask → treated as open.
4. Copy asserted unanswered / needs reply — **absence of a typed reply treated as proof**, ignoring that **tour completion resolves attendance/timing requests**.

## Attendance correction (`792e2a74`)

`looksLikeTourAttendanceRequest` → **silence** on completed-tour evaluation. Does not mutate messages, tour rows, `venue_unread`, or `needs_response`. Does not match “come back / come again” style questions.

## Writing-quality correction (follow-on)

See `WRITING-QUALITY-AUDIT.md`. Unresolved-question copy no longer awkwardly stitches raw clauses or asserts “still unanswered” / “don't see an answer recorded.”

## Privacy / Inbox

Unchanged — Gate 1/2; unread≠needs_response preserved; evaluator is read-only.
