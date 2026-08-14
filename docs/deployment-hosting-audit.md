# Deployment / Hosting Audit — Read Only

**Type:** Static repository inspection only. No service was authenticated to, no configuration changed, nothing deployed.
**Date:** 2026-08-14

---

## What was inspected

| Category | Result |
|---|---|
| `vercel.json` files | Exactly two: repo root (`./vercel.json`, cron jobs for the venue app) and `workspace/vercel.json` (cron job for the CRM). **`marketing/` has no `vercel.json`.** |
| `.vercel/` directories (local project links) | **None exist anywhere in the repo** — root, `marketing/`, and `workspace/` all lack `.vercel/project.json`. There is no local record of any of the three apps being linked to a real Vercel project. |
| `.gitignore` `.vercel` entries | Only the root `.gitignore` excludes `.vercel`; `marketing/.gitignore` and `workspace/.gitignore` do not mention it at all. |
| GitHub Actions / other CI-CD | **None.** No `.github/` directory anywhere in the repo. |
| Docker / containers | **None.** No `Dockerfile`, no `docker-compose*` anywhere in the repo (the Supabase Postgres container used for local dev is spun up by the separate Supabase CLI, not by anything checked into this repo). |
| AWS references | None — no `aws-sdk`, Amplify, Elastic Beanstalk, CloudFront, or `AWS_*` env var reads anywhere outside `node_modules`. |
| Netlify / Render / Cloudflare Pages / Amplify | None — zero references anywhere in the repo. |
| Production/custom-domain URLs | `hellotocheers.com` appears only as a *default fallback string* inside code (e.g., `marketingUrl()` in `shared/email/templates/helpers.ts`) and in docs written this session — never as a deployed, working URL confirmed from outside the code. **No `*.vercel.app` URL appears anywhere in the repo.** |
| `package.json` deploy scripts | None in any of the three `package.json` files — no `"deploy"` script, nothing that shells out to `vercel deploy` or similar. |
| Deployment/hosting documentation | Root `README.md`, `workspace/README.md`, and `docs/rc-launch-validation-runbook.md` all discuss hosting — see next section, all three describe it conditionally, not as settled fact. |
| Env files identifying a deployment target | No `.env.production` or `.env.staging` file exists anywhere. `.env.local` (git-ignored, present in root and `marketing/`; created only during this session's own local testing in `workspace/`) contains only local values. |
| Git remote | A real GitHub remote exists: `origin → https://github.com/jlcormier612/wevenu-website.git`, with genuine multi-hundred-commit history and a branch (`feature/legal-documents-and-acceptance`) that has previously been pushed there. `marketing/` and `workspace/` are plain subdirectories of this one repo, not separate repos or submodules — consistent with a single-repo, multi-project Vercel setup, but a GitHub remote by itself doesn't confirm a Vercel App is actually connected to it (checking that would require querying GitHub's or Vercel's API, which this audit didn't do, per your instruction not to authenticate to anything). |

## What the documentation itself says (verbatim, not paraphrased for certainty)

- Root `README.md`, line 14: **"Hosting: Vercel (target)."** The word "(target)" is the author's own word, not mine — it reads as intent, not confirmation. The same file's opening line also still says *"Sprint 1 — Foundation... No business modules have been built yet"* — i.e., this README has not been kept current with the rest of the codebase, so its claims should be read as early-project intent, not verified present-day fact.
- `docs/rc-launch-validation-runbook.md`, line 149: *"Walk the full table above against your actual hosting dashboard (**Vercel, presumably**...)"* — hedged with "presumably" in the document whose entire purpose is production launch readiness.
- Same file, line 191: *"**If you're not deploying to Vercel**, none of these [cron jobs] fire automatically... you'll need your own scheduler."* — written as a real, live conditional, not a hypothetical aside.
- `workspace/README.md`, line 572: cron config lives in *"`workspace/vercel.json` (this app's own Vercel project — not root `vercel.json`)"* — describes the **intended architecture** (three independent Vercel projects, one per app) precisely, but again as a description of how it *should* work, not a confirmation any of the three projects exist.

Every one of these is written by whoever built this codebase in language that assumes or targets Vercel, and none of them assert an already-completed deployment as fact.

---

## Per-app findings

### Venue / product app (repo root, `app/`)

- **Evidence it has ever been deployed:** None found. No linked `.vercel/project.json`, no production URL anywhere, no CI/CD workflow.
- **Where it's intended to be deployed:** Vercel — root `vercel.json` declares 8 cron jobs (notifications, digest, scheduled sends, automation, QuickBooks sync, Facebook sync ×2, saved reports), which are meaningless configuration unless a Vercel deployment exists to run them. `README.md` states this explicitly (`Hosting: Vercel (target)`).
- **Known production/preview URL:** None found anywhere in the repo.
- **Vercel project actually linked:** No local evidence either way — no `.vercel/project.json`. (Not re-checked against the Vercel account itself this pass, per your instruction not to authenticate to anything.)
- **Enough evidence to identify the deployment target:** Yes, as an *intended* target (Vercel) — no, as a *confirmed, currently live* deployment.

### Marketing site (`marketing/`)

- **Evidence it has ever been deployed:** None found. Notably, this is the one app of the three with **no `vercel.json` at all** — no cron jobs are declared for it, consistent with it being a simpler, non-scheduled site, but also the weakest of the three apps' evidence trails for Vercel-specific configuration.
- **Where it's intended to be deployed:** Same Vercel target as the other two, by inference (shares the monorepo, shares the `PRODUCT_API_BASE_URL`/`PRODUCT_SYNC_API_KEY` cross-app-call pattern with the other two, references `hellotocheers.com` as its default domain) — but this is the weakest direct evidence of the three apps, since it has no `vercel.json` of its own to point to.
- **Known production/preview URL:** None found. `hellotocheers.com` appears only as a code fallback default, never confirmed as a live, deployed address.
- **Vercel project actually linked:** No local evidence either way.
- **Enough evidence to identify the deployment target:** Weak — inferable from context (shared conventions with the other two apps) but not from any direct configuration of its own.

### Relationship Workspace / CRM (`workspace/`)

- **Evidence it has ever been deployed:** None found — same gaps as the other two (`.vercel/project.json` absent, no URL, no CI/CD).
- **Where it's intended to be deployed:** Vercel, explicitly and specifically — `workspace/vercel.json` declares its own cron job (`/api/cron/automations` every 10 minutes), and `workspace/README.md` explicitly describes it as *"this app's own Vercel project."* This app's documentation is the most explicit and detailed of the three about the intended hosting shape, including naming the exact env var (`CRON_SECRET`) that must be set "in the workspace project's Vercel env."
- **Known production/preview URL:** None found.
- **Vercel project actually linked:** No local evidence either way.
- **Enough evidence to identify the deployment target:** Yes, as an intended target, with the most explicit documentation of the three — but still no confirmation it's actually live.

---

## Conclusion

| App | Status |
|---|---|
| Venue / product app (`app/`) | **Configured for deployment** (Vercel-shaped configuration exists — cron jobs, README statement of intent) — **cannot confirm currently deployed** from repo evidence alone. |
| Marketing site (`marketing/`) | **Cannot determine with confidence** — no app-specific deployment configuration exists (no `vercel.json`); everything pointing at Vercel for this app is inferred from the other two, not from anything belonging to `marketing/` itself. |
| Relationship Workspace (`workspace/`) | **Configured for deployment** (the most explicit of the three — its own `vercel.json`, its own README section naming "this app's own Vercel project") — **cannot confirm currently deployed** from repo evidence alone. |

**None of the three can be confirmed as "currently deployed" from the repository alone.** The strongest concrete fact found — a real, multi-hundred-commit GitHub remote with a previously-pushed branch — is a necessary precondition for the most common Vercel setup (GitHub-integration auto-deploy), but a GitHub remote existing doesn't by itself prove a Vercel App is connected to it; confirming that requires checking Vercel's or GitHub's own records, which this audit didn't do, per your instruction not to authenticate to anything.

The honest, repo-only answer for all three is: **architected and documented for Vercel, with no direct evidence inside the repository of an actual completed deployment for any of them.** Whether they're actually live today is a question only the Vercel account (or GitHub's connected-Apps list) that actually owns these projects can answer — and per our prior exchange, this session doesn't currently have access to that account.
