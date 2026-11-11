# STATUS — Luv contextual intelligence

**Verdict: GREEN / CLOSED**

## Root causes (original failures)

| Failure | Cause | Fix |
|---------|--------|-----|
| A — Overdue restatement | Tasks Focus aggregate → “I noticed N tasks are past due” | Omit Tasks from `DOMAIN_AGGREGATE` |
| B — False all-set | `buildTourAllSetObservation` treated `scheduled` as all-set | Require `confirmed`; scheduled → accurate unconfirmed copy |

Commit: `ad4d5b8b52002a3a9154fe311d7d196878fb82e8`  
Deploy: [40250604713](https://github.com/jlcormier612/wevenu-website/actions/runs/40250604713)

## Dashboard presence regression (follow-up)

**Not a defect.** Luv is not globally hidden. With Tasks-only Focus and no live L1 observations, `selectLuvDashboardEntry` returns null → no card (intentional silence). See `DASHBOARD-PRESENCE.md`.

Proven on serving image: when Focus includes Calendar (today’s tour), Luv card returns with useful interpretation — not the overdue restatement.

## Serving verification

| Item | Value |
|------|--------|
| SHA | `ad4d5b8b52002a3a9154fe311d7d196878fb82e8` |
| Digest | `sha256:a25e67919ca7775ba51a7fda24e9c23cd081906bf3856316715cd44af3a122db` |
| Unit (presence + factuality suite) | PASS |
| Browser | GREEN — `BROWSER-VERIFICATION.md` / `browser-results.json` |

## Production

**Untouched.**
