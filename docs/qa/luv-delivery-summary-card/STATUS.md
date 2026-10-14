# Luv Dashboard — remove unsupported delivery summary

**Status: IMPLEMENTATION — Sandbox deploy/verify pending**

| Field | Value |
|-------|--------|
| Root cause | `comm-all-delivered` / `comm-recent-failures` quantified delivery using Health as View target after Health deferred delivery lists |
| Decision | **Remove** aggregate cards (no truthful non-quantified replacement). Keep `comm-stale-unopened-*` with lead or Inbox link |
| Files | `lib/luv/communication-observations.ts`, `lib/dashboard/service.ts`, `lib/dashboard-system/luv-entry.ts`, tests |
| Production | Untouched |

## Evidence pending

Browser verify on Dashboard after Sandbox deploy — no “reached its destination” / message-count celebration.
