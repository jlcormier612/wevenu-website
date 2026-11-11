# Lead Capture setup — no reporting — GREEN

**Verdict:** GREEN  
**Production:** untouched  

## Runtime (exact)

| Field | Value |
| --- | --- |
| Commit | `4b75d776c8a15f8e0f2b018400c60a69cb789243` |
| Deploy run | https://github.com/jlcormier612/wevenu-website/actions/runs/35950031985 |
| Cluster / service | `htc-sandbox` / `htc-sandbox-venue-app` |
| Task definition | `htc-sandbox-venue-app:375` |
| Running task | `arn:aws:ecs:us-east-1:405254329873:task/htc-sandbox/7a665a115bab4987ba92c1034d7a5724` |
| Image | `405254329873.dkr.ecr.us-east-1.amazonaws.com/htc-sandbox-venue-app:4b75d776c8a15f8e0f2b018400c60a69cb789243` |
| Image digest | `sha256:433621c969e001527bf3a71debf4694e88171bbceb86351cab39c170a097afdd` |
| Rollout | COMPLETED (PRIMARY, runningCount 1) |

## Browser verification (Sandbox)

- `/setup-hub/lead-capture` — no 7-day volume, source breakdown, Recent inquiries, All caught up, or Lead sources overview
- Setup sections present: Website, Email intake (Waiting for first inquiry), Tour requests, Facebook / Instagram (exact copy), QR campaigns, Manual entry
- **Open Meta integration** → `/settings/integrations` (Financials & Integrations)
- `/settings/leads` — Lead Capture reporting card gone; Inquiry Form + Email + Tours remain
- `/leads` — pipeline loads (15 active leads); no capture/reporting regression
- Desktop + 390 mobile layout OK

## Preserved (not deleted)

- `lib/lead-intake/monitoring.ts` (`getLeadCaptureSummary` / source breakdown)
- `components/settings/lead-intake-health-section.tsx` (unmounted from setup surfaces)
- Lead capture, attribution, email intake, Meta, QR, tours, manual entry behavior
