# Luv Noticed — stale early-arrival insight / tour-outcome reconciliation

**Date:** 2026-10-14  
**Production / Resend / DNS:** untouched  

## Exact timeline (Meadowbrook Rory)

| UTC | Event |
|-----|--------|
| `2026-10-15T01:59:59Z` | Tour scheduled email (Sat Oct 17 10:30) |
| `2026-10-15T02:00:25Z` | Tour confirmed email (“reply to reschedule”) |
| `2026-10-15T02:01:29Z` | Inbound: “Can I come in tonight instead…” (`07df6ca5-…`) |
| `2026-10-14T22:00:00Z` | `actual_occurred_at` recorded (visit clock — **before** the ask timestamp) |
| `2026-10-15T02:23:41Z` | `completed_at` — status `completed`; notes: loved venue / want to book |
| Later | Luv Noticed: “They asked about Can I come in tonight… after the tour, and I don't see an answer recorded yet.” |

Conversation: `dcba7cbc-…` · Lead `09d26751-…` · Tour `4b57743b-…`  
`needs_response` / unread contracts unchanged by this fix.

## Root cause

1. Luv Noticed completed-tour observations are **computed live** via `evaluateCompletedTour` in `lib/luv/observations.ts` (not a stale `luv_insights` row).
2. `occurredAt` = `tourOccurrenceIso` → prefers `actual_occurred_at`.
3. `inboundAfter(messages, occurredAt)` therefore includes the early-arrival ask (ask time > `actual_occurred_at`).
4. No `venue_staff` outbound after that ask → `unansweredInbound` treats it as open.
5. Copy asserts unanswered / needs reply — **absence of a typed reply is treated as proof**, ignoring that **tour completion is the resolution** of an attendance/timing request.

## Why completion should resolve this request

The ask is about attending the tour now/early. Verified `status=completed` (with recorded outcome) is trustworthy evidence the situation was handled in person. Missing thread reply must not force “still unanswered.”

A genuinely new post-tour question (e.g. Saturday setup) remains actionable.

## Minimum correction

In `evaluateCompletedTour`: if the open post-occurrence inbound is a **tour attendance / early-arrival request** (`looksLikeTourAttendanceRequest`), return **silence** — do not emit unresolved_question ACTION. Do not touch conversation unread/needs_response, messages, or tour rows.

## Privacy

Unchanged — still Gate 1/2; internal notes never enter customer-facing drafting or this classifier’s customer path.
