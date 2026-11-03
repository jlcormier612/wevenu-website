# Step 2 — Release Candidate

| Field | Value |
|---|---|
| Worktree | `/Users/jensmac/Developer/htc-visual-p1-9-release` |
| Branch | `sandbox-deploy/visual-phases-1-9` |
| Baseline SHA | `cf84a4ee98eedc3d630737478e97ffecad9c519d` |
| Candidate SHA | `3ca9aa0c8d09831f65c296a2cf1589cb6ef0b4a0` |
| Original tree | `/Users/jensmac/Developer/wevenu-website` @ `69cacab8508c40f4d4716b552f2b88e831816ca3` — dirty preserved |
| Changed source files | 30 modified + 11 new (helper + tests) + surgical CSS |
| Evidence docs | this directory |

## Verdict

**READY FOR STEP 3 — SANDBOX DEPLOYMENT APPROVAL**

Local verification complete. **Do not push or deploy until product approves Step 3.**

## What Step 3 would do (not executed)

1. `git push -u origin sandbox-deploy/visual-phases-1-9` (does **not** auto-deploy).
2. GitHub Actions → **Deploy Sandbox** → `workflow_dispatch` on that branch.
3. Confirm Actions success and serving image tag / `github.sha` == candidate SHA.
4. Browser smoke on `https://app.sandbox.hellotocheers.com` for Phase 1–9 routes; confirm Phase 10 absent.
5. Rollback if needed: re-dispatch prior SHA `cf84a4ee…`.

## Integrity

- No push / merge to `main` / Production deploy
- No migrations / DB writes (auth OTP for local browser only)
- Original dirty tree + Phase 10 intact
