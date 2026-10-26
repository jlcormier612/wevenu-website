# Acceptance matrix — Luv contextual intelligence

| # | Scenario | Expected | Unit | Browser |
|---|----------|----------|------|---------|
| 1 | New lead, no tour | No all-set / no pretend tour | PASS (dispatcher null without scheduled/confirmed) | pending serving |
| 2 | Tour scheduled, unconfirmed | Accurate “not confirmed”; may offer confirmation path; never all-set | PASS | pending |
| 3 | Confirmation requested, awaiting reply | Waiting-for-reply language; not all-set | PASS | pending |
| 4 | Tour confirmed | All-set within 3-day window allowed | PASS | pending |
| 5 | Tour completed | No upcoming all-set / confirm nudge from this builder | PASS | pending |
| 6 | Tour cancelled | Silence for upcoming builder | PASS | pending |
| 7 | Proposal drafted not sent | Existing draft factuality (unchanged) | covered by `draft-proposal-factuality.test.ts` | n/a |
| 8 | Proposal sent | Existing authoritative sent check (unchanged) | covered | n/a |
| 9 | Multiple overdue tasks on Focus | No “N tasks are past due / Want to clear them” | PASS | pending |
| 10 | No useful intervention | Silence (null L1 card) | PASS | pending |

Observed unit results: `TEST-RESULTS.md`. Browser column filled after Sandbox serving verification.
