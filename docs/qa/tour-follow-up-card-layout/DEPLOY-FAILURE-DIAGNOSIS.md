# Queue Item 2B — Sandbox deploy failure diagnosis (`38505037803`)

**Status:** Cause identified; mirror retag correction implemented in `deploy-sandbox.yml`.  
**Failed run:** https://github.com/jlcormier612/wevenu-website/actions/runs/38505037803  
**Failed headSha:** `979cb8899ec24619328f9637b174aa5b029bb02c`

## Evidenced cause

1. Prefetch **succeeded** on venue-app / workspace / marketing / scheduler:
   - `Using private ECR base node-22-alpine -> node:22-alpine`
2. Dockerfiles still say:
   - `FROM public.ecr.aws/docker/library/node:22-alpine`
3. Build then ran `load metadata for public.ecr.aws/docker/library/node:22-alpine` and failed with **429 Data limit exceeded**.
4. Venue-app was cancelled after workspace failed; application stack + verify skipped.
5. Marketing/scheduler sometimes still resolved Public ECR metadata (race / quota) — not proof the short-tag mirror worked.

**Root cause:** image **reference mismatch**. Private mirror was tagged as short `node:22-alpine`, but BuildKit looks up the **full** Public ECR name from `FROM`, so `--pull=false` still consulted Public ECR and hit the rate limit.

Not an IAM, base-tag, or missing `htc-ci-bases` miss (private pull worked).

## Narrowest correction

In `.github/workflows/deploy-sandbox.yml` prefetch, tag the private base as the **exact** `public.ecr.aws/docker/library/...` reference used by Dockerfiles (not the short `node:22-alpine` / `alpine:3.20` aliases).

No Dockerfile, IAM, registry, or infrastructure change required.

## Out of scope for this correction

- Tour & follow-up product code
- Production workflows / Production deploy
- Changing base image versions
