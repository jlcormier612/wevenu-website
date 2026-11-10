# Routing Gaps Closure — Recovery Page + Staff Onboarding

**Date:** 2026-11-10  
**Authorization:** Local investigation + minimal corrections + tests only — **no commit / push / deploy / migrations**  
**Serving Sandbox baseline:** `15e10a4743f7e3d84ee6978195334c45a3e9c319` (unchanged this pass)

---

## A. Root cause of each issue

### Issue A — Unauthenticated `/system/legal-unavailable`

| Layer | Behavior |
|---|---|
| Legal enforcement skip list | Already includes `/system/legal-unavailable` (prevents fail-closed → Welcome loops) |
| Auth proxy `PUBLIC_PATHS` | **Did not** include the recovery path |
| Result | Unauthenticated request → `updateSession` treats route as protected → redirect `/login?next=%2Fsystem%2Flegal-unavailable` |
| Authenticated | Recovery page rendered correctly (static copy; no secrets) |

**Intent:** Recovery is a static “compliance check temporarily unavailable” page with no session/tenant data. It **should** be publicly reachable so fail-closed redirects and “try again / sign in” recovery work even when the session is missing or mid-failure.

**Root cause:** Allowlist omission — recovery was legal-skip but not auth-public.

### Issue B — Staff `/onboarding/intake` redirect loop

Observed hops (pre-fix): `/dashboard` → `/onboarding/intake` → `/onboarding/intake` … (307 storm).

| Fact | Evidence |
|---|---|
| Fancy intake already submitted | `venue_onboarding_intake.submitted_at = 2026-09-13…` — intake submission gate would **not** fire |
| Disposable staff row | `user_id` set, `is_active=true`, **`accepted_at=null`** |
| Membership RPC | `list_my_venue_memberships` requires `accepted_at is not null` |
| Bootstrap | No memberships → `boot.status === "no_memberships"` |
| Layout | Unconditional `redirect("/onboarding/intake")` for `no_memberships` |
| Loop amplifier | Redirect fires even when already on `/onboarding/intake` → self-307 storm |

**Root cause (primary):** **Malformed disposable fixture** — staff invite never marked accepted (`accepted_at` left null after linking `user_id`), so the user had zero memberships for bootstrap.

**Root cause (secondary / genuine small defect):** `no_memberships` always redirected to intake **without** a “already there” guard, so any no-membership identity storm-looped on that URL.

Not caused by legal fail-closed. Not an owner-permission leak. Not a reason to bypass onboarding for real self-setup purchasers.

---

## B. Fixture issue versus genuine application defect

| Issue | Classification |
|---|---|
| A — recovery auth gate | **Genuine app defect** (narrow allowlist omission) |
| B — staff cannot enter workspace | **Fixture defect** (missing `accepted_at`) |
| B — 307 storm on intake | **Genuine small app defect** (missing already-on-intake guard) |

Genuine invited staff who complete `/join` set `accepted_at` and are unaffected by the fixture bug. Legacy venues with submitted intake are unaffected once membership resolves.

---

## C. Exact code or test-fixture changes

### Code (local, undeployed)

| File | Change |
|---|---|
| `integrations/supabase/proxy.ts` | Add `/system/legal-unavailable` to `PUBLIC_PATHS` only (not bare `/system`) |
| `integrations/supabase/proxy-public-paths.test.ts` | Assert recovery public; `/system` and `/system/other` remain private |
| `app/(app)/layout.tsx` | `no_memberships`: redirect to intake only if not already on `/onboarding/intake`; then `return <>{children}</>` |
| `app/(app)/layout.no-memberships-loop.test.ts` | **New** — source regression for loop guard; asserts no owner bypass |

### Disposable Sandbox fixture (applied)

| Row | Change |
|---|---|
| `venue_staff` `5438044e-b9c9-4ebc-b9e2-2de01e26ea85` | Set `accepted_at` + `invited_at` to `2026-11-10T19:43:35.912Z`; kept `role=staff`, `is_owner=false` |

### Explicitly untouched

Marketing CTA/footer CSS, legal document text/versions, migrations, Stripe, Production, principal-resolution logic, RLS policies, unrelated dirty tree.

---

## D. Before / after routing behavior

### Recovery

| Actor | Before | After (local code) | Serving Sandbox now |
|---|---|---|---|
| Unauthenticated GET `/system/legal-unavailable` | → `/login?next=…` | → recovery page 200 | Still login (undeployed) |
| Authenticated GET | Recovery page | Recovery page | Recovery page |
| Fail-closed redirect target | Works if session present | Works with or without session | Session path only until deploy |

### Staff disposable fixture

| Step | Before | After fixture fix |
|---|---|---|
| Bootstrap memberships | Empty (`accepted_at` null) | Fancy membership present |
| `/dashboard` | 307 → intake loop | **PASS** → `/dashboard` |
| Role | staff / not owner | unchanged |

### `no_memberships` layout (local)

| Path | Before | After |
|---|---|---|
| `/dashboard` with no memberships | → `/onboarding/intake` | → `/onboarding/intake` |
| `/onboarding/intake` with no memberships | → `/onboarding/intake` (loop) | Render children (no self-redirect) |

---

## E. Test results and browser evidence

### Focused local tests

**89/89 PASS** including:
- `proxy-public-paths.test.ts` (recovery public; no `/system` widen)
- `layout.no-memberships-loop.test.ts`
- `enforcement-fail-mode`, `resolve-user-type-for-proxy`, `resolve-venue-staff-membership`, `welcome-integration`, `acceptance-engine`, `signup-consent`

### Local failure injection

**PASS** — `proxy-fail-closed-repro.json`: missing service role / admin init / engine API → `unavailable` / `block_api` with recovery path; fail-closed preserved.

### Browser evidence

| # | Scenario | Local impl | Local browser | Serving Sandbox |
|---|---|---|---|---|
| 1 | Unauth recovery | PASS (code+unit) | Not re-run on local product server this pass | Still login redirect (**expected** until deploy) |
| 2 | Auth recovery | PASS (prior postdeploy) | — | **PASS** (already on `15e10a47`) |
| 3 | Recovery + enforcement unavailable decision | PASS (unit/repro) | — | N/A (injection local-only) |
| 4 | No redirect loops (layout guard) | PASS (unit) | — | Staff loop gone via fixture; layout guard undeployed |
| 5 | Protected pages still require auth | PASS (PUBLIC_PATHS narrow) | — | PASS |
| 6 | APIs fail closed on enforcement errors | PASS (repro) | — | N/A |
| 7 | Current-version owner proceeds | — | — | **PASS** |
| 8 | Outdated owner → Welcome | — | — | **PASS** |
| 9 | Invited staff (fixed fixture) reaches destination | — | — | **PASS** `/dashboard`; acc 3→3 |
| 10 | Staff not owner | — | — | **PASS** `role=staff`, `is_owner=false` |
| 11 | Couple portal | — | — | **PASS** |
| 12 | Vendor routing | — | — | **PASS** `/vendor/dashboard` |
| 13 | Multi-venue principal (jennifer Welcome) | — | — | **PASS** |
| 14 | Visit recovery/onboarding does not write acceptances | — | — | **PASS** (staff/jennifer counts stable) |

Artifacts: `routing-gaps-browser-verify.json`, `routing-gaps-staff-dashboard.png`.

---

## F. Remaining risks or blockers

1. **PUBLIC_PATHS + layout loop guard are undeployed** — unauthenticated recovery still fails on serving Sandbox until a separately authorized deploy.  
2. Future disposable staff fixtures must set `accepted_at` when linking `user_id` (or go through `/join`).  
3. Legal finalize migrations / revised-version / new-owner Stripe proof still open (unchanged).  
4. Optional: local product-app browser proof of unauth recovery once a local venue-app server is running (unit coverage already asserts allowlist).

---

## G. GO / NO-GO for separately authorized Sandbox deployment

### **GO** (scoped)

Deploy the local routing-gap commit when authorized, containing only:
- `integrations/supabase/proxy.ts`
- `integrations/supabase/proxy-public-paths.test.ts`
- `app/(app)/layout.tsx`
- `app/(app)/layout.no-memberships-loop.test.ts`
- this report (optional)

**Do not** bundle marketing footer/CTA dirty work or legal migrations.

### Post-deploy must confirm

1. Unauthenticated `/system/legal-unavailable` renders recovery copy (not login).  
2. Authenticated recovery still works; no acceptance writes.  
3. Staff (accepted fixture) still reaches `/dashboard`.  
4. Owner Welcome / current-owner / couple / vendor matrix still PASS.  
5. Fail-closed still redirects authenticated users to recovery; APIs still 503 on injection locally.

### Verdicts

| Area | Verdict |
|---|---|
| Issue A local fix | **GREEN** |
| Issue B fixture + loop guard | **GREEN** (fixture verified on Sandbox; layout guard local-only until deploy) |
| Serving Sandbox unauth recovery | **YELLOW** — pending deploy |
| Overall legal launch readiness | **YELLOW** — migrations / new-owner still open |

---

*Production untouched. No migrations. No commits/pushes this pass. Unrelated dirty marketing work preserved.*
