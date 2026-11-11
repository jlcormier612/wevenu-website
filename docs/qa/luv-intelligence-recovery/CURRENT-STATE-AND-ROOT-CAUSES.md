# Current state and root causes — Luv intelligence drift

## Serving at audit start

ECS was still on Merge Lead `8215db63` while unrelated timeline deploy ran. Recovery work targets branch tip after this change.

## What still works (preserve)

| Safeguard | Location |
|-----------|----------|
| Scheduled ≠ confirmed; confirmation request ≠ confirmed | `observation-quality.ts` |
| Drafted proposal ≠ sent | `isAuthoritativeProposalSent` / drafts factuality |
| No customer-facing internal notes in drafts | completed-tour + drafts rules |
| No “N tasks are past due / Want to clear them?” | Tasks omitted from `DOMAIN_AGGREGATE` |
| L3 tour/lead observations stay off Dashboard L1 | `isDashboardLevel1Observation` |
| Locked live L1 allowlist (setup / readiness / stale-comm) | `luv-entry.ts` |

## Drift mechanism

Correct factuality fixes were paired with **narrow selection**:

1. Tasks aggregate removed → Tasks-only Focus often produced **null Luv card**.
2. That silence was documented as intentional, which stopped the bad message but also stopped Luv from offering **any** useful interpretation of overdue work.
3. Confirmed-tour celebration had **no next-step CTA** (message-only).
4. Dashboard L1 recommendations path is effectively inert (`isDashboardLevel1Recommendation` returns false) — patterns stay L2/L3 by design.

Silence after Tasks-only Focus was therefore often **broken silence** (useful prioritization was possible from Focus facts) rather than “nothing useful exists.”

## Root causes (intelligence)

1. **Suppression-as-safety** for overdue tasks without a replacement insight.
2. **Allowlist + Focus-aggregate-only** Dashboard path under-uses Focus Task facts for prioritization.
3. **Celebration without action** on confirmed tours reduced partner usefulness after a genuine win.
