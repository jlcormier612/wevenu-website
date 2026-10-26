# Acceptance matrix — Luv contextual intelligence

| # | Scenario | Expected | Unit | Browser |
|---|----------|----------|------|---------|
| 1 | New lead, no tour | No all-set / no pretend tour | PASS | n/a (builder) |
| 2 | Tour scheduled, unconfirmed | Accurate unconfirmed path; never all-set | PASS | PASS (`B-*`) |
| 3 | Confirmation requested, awaiting reply | Waiting-for-reply; not all-set | PASS | n/a (unit) |
| 4 | Tour confirmed | All-set within window allowed; UI matches persisted | PASS | PASS (`B-persisted-confirmed`) |
| 5 | Tour completed | No upcoming all-set / confirm nudge | PASS | n/a |
| 6 | Tour cancelled | Silence for upcoming builder | PASS | n/a |
| 7 | Proposal drafted not sent | Existing draft factuality | PASS | n/a |
| 8 | Proposal sent | Authoritative sent check | PASS | n/a |
| 9 | Multiple overdue tasks on Focus | No “N tasks are past due / Want to clear them” | PASS | PASS (`A-*`) |
| 10 | No useful intervention (Tasks-only, no L1) | Scoped silence (null card) | PASS | PASS (Tasks-only shot) |
| 11 | Calendar Focus + overdue Tasks | Luv present with Calendar interpretation, not Tasks restatement | PASS | PASS (`presence-luv-when-calendar-focus`) |

Serving verification: `BROWSER-VERIFICATION.md` on `ad4d5b8b` / digest `sha256:a25e6791…`.
