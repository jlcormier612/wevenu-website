# Repository hygiene inventory

**Generated:** 2026-08-26. **Do not delete** anything listed here without explicit approval.

## Safe to discard (after confirmation)

| Item | Reason |
|------|--------|
| `stash@{0}` `redundant-already-matches-portal-sandbox-2026-08-24` | 10/13 files identical to `origin/main`; remainder is stale pre-reconciliation infra |
| `stash@{2}` `temp-unrelated-before-intake-branch` | Product files on `main`; duplicates marketing WIP from stash@{1} |
| `stash@{3}` `preview.ts sample values fix` | Superseded by `communications/smart-fields` branch (`bc13469`) |
| `scratch-migration-backfill.sql` (untracked) | Local migration bookkeeping scratch |
| `workspace/node_modules 3` (untracked symlink) | Accidental artifact |

## Keep until merged / explicitly dropped

| Item | Reason |
|------|--------|
| `stash@{1}` `out-of-scope-marketing-infra-wip-2026-08-24` | Marketing pricing UX WIP — product decision needed |
| `stash@{4}` WIP seating on `feature/legal-documents-and-acceptance` | Seating print refactor not on `main` — finish or defer |
| Dirty worktree `/private/tmp/htc-fb-commit` | Superseded by `integrations/stripe-qb-oauth-runtime` PR #4 (exclude Facebook test tweak) |

## Stale branches (retire after open PRs merge)

These are **0 commits ahead** of reconciled work or fully superseded:

- `origin/settings-ia-restructure`, `origin/portal-multi-session-sandbox`, `origin/intake-email-meta-sandbox`
- `origin/feature/legal-documents-and-acceptance`, `origin/sandbox-full-sweep`, `origin/sandbox-infra-completion`
- `origin/sandbox/facebook-lead-ads` (do not merge wholesale — smart fields extracted to PR #3)

Local `main` checkout may be behind `origin/main`; fast-forward or re-checkout — do not treat as missing deploy work.

## Active review branches (do not merge without approval)

| Branch | PR |
|--------|-----|
| `communications/smart-fields` | https://github.com/jlcormier612/wevenu-website/pull/3 |
| `integrations/stripe-qb-oauth-runtime` | https://github.com/jlcormier612/wevenu-website/pull/4 |
| `infra/facebook-lead-cron-restore` | (pending PR — infra only, post-test window) |

## Deployed baseline (unchanged)

Jennifer's sandbox: **`origin/main` @ `5b246b4`**.
