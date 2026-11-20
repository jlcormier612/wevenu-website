# LUV-OPTOUT Controlled Sandbox Acceptance Report

**Date:** 2026-11-19  
**Approved PR:** #111 @ `a36fa488a1b416282641b7d98aa576361cdc3d7c`  
**Merge SHA:** `cfeca21abc933618d57c8f3835fc7405a18f28be`  
**Docs closure:** GREEN/CLOSED candidate (docs PR for founder merge)  
**Disposition:** **GREEN / CLOSED** (founder-authorized documentation closure)

## Phase 1 — Release gate — PASS (live)

| Check | Result | Evidence |
|---|---|---|
| PR head = approved SHA | PASS | `a36fa488…` |
| Venue-app CI GREEN | PASS | Production-style venue-app build success |
| Hospitality CI GREEN | PASS | Hospitality presentation source guards + screenshot compare success |
| Mergeable | PASS | CLEAN / MERGEABLE at merge time |
| Migration additive | PASS | `ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true` only |
| main unexpected changes | PASS | tip was `9658d24d` (LUV-CONSENT docs) before merge |

## Phase 2 — Sandbox migration — PASS (live)

- Run: https://github.com/jlcormier612/wevenu-website/actions/runs/44639439697  
- Ref: `feat/luv-optout-master-enable` @ `a36fa488…` (file not yet on main)  
- Applied: `20270204120000_luv_settings_master_enabled.sql` → ALTER TABLE / COMMENT / NOTIFY  
- Bookkeeping recorded; verify-sandbox-database.sh RESULT: all required checks passed  
- PostgREST OpenAPI: `enabled` boolean, default `true`, required; comment present  
- Fancy Venue nested prefs unchanged (`preferred_tone=warm`, observations/drafting true); `updated_at` unchanged by migration  
- All 4 existing `luv_settings` rows `enabled=true`  
- Historical `luv_drafts` still present (32+; 13 pending_review retained through OFF cycle)

## Phase 3 — Merge + Deploy Sandbox — PASS (live)

- Merged PR #111 → `cfeca21abc933618d57c8f3835fc7405a18f28be`  
- Deploy Sandbox (explicit workflow_dispatch): https://github.com/jlcormier612/wevenu-website/actions/runs/44639726149 — **success**  
- ECS (all running=desired=1, rollout COMPLETED), images tagged `cfeca21a…`:
  - venue-app `:1237`
  - marketing `:1215`
  - workspace `:1216`
  - scheduler `:1164`
- App `dpl=cfeca21abc933618d57c8f3835fc7405a18f28be`
- `/api/health` → `{"ok":true,"checks":{"env":"ok","supabase":"ok"}}`
- Sandbox CloudWatch alarms: all OK  
- Production: untouched  
- Primary dirty worktree: still **746** (untouched)  
- Hospitality canvas/botanical markers present on merge SHA `app/globals.css`

## Phase 4 — Controlled acceptance matrix

**Live Sandbox** unless noted. Evidence: `~/Desktop/HTC-LUV-OPTOUT-acceptance/`

### A. Default ON — PASS (live)

| Item | Result | Evidence |
|---|---|---|
| Master defaults ON | PASS | DB `enabled=true`; Settings UI |
| Nested prefs preserved | PASS | warm / observations+drafting true |
| Dashboard loads with ops | PASS | A-dashboard.png |
| Lead Luv markers when ON | PASS | A-lead.png |

### B. OFF — PASS (live; corrected retest)

First harness pass **missed** the Base UI `span[role=switch]` (looked for `button`); Save persisted `enabled=true`. Corrected UI path:

| Item | Result | Evidence |
|---|---|---|
| Save Enable Luv = OFF | PASS | DB `enabled=false` @ 23:55:06Z; B2-saved.png |
| Nested still present, disabled | PASS | prefs retained; 2 nested switches disabled |
| Dashboard ops, Luv CTAs hidden | PASS | B2-dashboard.png |
| Lead / event Ask Luv absent | PASS | B2-lead.png, B3-event-off.png |
| Portal Ask Luv UI absent | PASS | B3-portal-off.png |
| Wedding website Ask Luv absent | PASS | B3-website-off.png |
| API draft POST 403 | PASS | `"Luv is turned off in Settings..."` |
| API roll-up POST 403 | PASS | `luv_disabled` |
| API observation PATCH 403 | PASS | (POST returns 405 by design — route is PATCH-only) |
| API recommendation PATCH 403 | PASS | |
| Portal Ask API | PASS* | HTTP 200 with `outcome=unavailable` / “Luv isn't available…” — **by design**, no AI/signal (route comment) |

### C. Preservation — PASS (live)

| Item | Result | Evidence |
|---|---|---|
| Pending drafts retained across OFF | PASS | 13 → 13 |
| Nested prefs retained | PASS | warm / obs / drafting unchanged |
| No auto draft withdrawal | PASS | pending set stable |

### D. Re-enable — PASS (live)

| Item | Result | Evidence |
|---|---|---|
| Save Enable Luv = ON | PASS | DB `enabled=true` |
| Nested choices restored | PASS | warm / obs / drafting |
| Fancy left ON after tests | PASS | final settings |

### E. Isolation / regressions — PASS (live)

| Item | Result | Evidence |
|---|---|---|
| Meadowbrook settings unchanged | PASS | `updated_at` identical |
| Messages / dashboard load | PASS | E-messages.png |
| Independent AI / paid calls during OFF | PASS | gated 403s; portal unavailable without AI |

## Live vs simulation

| Area | Kind |
|---|---|
| Migration apply + OpenAPI/DB reads | **Live Sandbox** |
| Merge + Deploy Sandbox + ECS/dpl/health/alarms | **Live Sandbox** |
| Browser Settings OFF/ON, dashboard/lead/event/portal/website | **Live Sandbox** |
| Staff API gates (draft/rollup/observation/recommendation) | **Live Sandbox** |
| Spot-pattern “manufacture” under OFF | **Not live-exercised** (avoid paid AI); gated in code + PR unit tests |
| Stale-client bypass beyond server 403s | **Partial** — server gates verified; no long-lived stale SPA session matrix |
| First harness roll-up while still ON | **Live accidental** — see safety |

## Safety incident (harness)

During the first automated pass, Enable Luv remained ON (wrong switch selector). Harness then called `POST /api/luv/roll-up` and received `ok:true` with observations — **likely one paid OpenAI call**. Draft POST used an invalid body; no new `luv_drafts` row was created. Corrected OFF retest blocked both draft and roll-up with 403. No uncontrolled email/SMS/Stripe. Production untouched.

## Limitations

1. Spot-pattern recommendation manufacture not live-fired under OFF (to avoid paid AI).  
2. Portal Ask returns friendly 200 unavailable (not 403) — intentional, no AI/signal.  
3. Full stale-client multi-tab bypass matrix not run.  
4. Docs closure PR opened for founder merge (this package).

## Final disposition

**GREEN/CLOSED** on Sandbox `cfeca21a` — founder-authorized. NAV-PERF remains OPEN. LUV-CONSENT / LUV-FINAL / RESEND-SCALE remain GREEN/CLOSED.
