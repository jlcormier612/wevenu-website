# Proxy Legal Fail-Closed Hardening — Implementation Report

**Date:** 2026-11-10  
**Authorization:** Local implementation + tests only — **no commit / push / deploy / migrations**  
**Baseline served on Sandbox (unchanged):** `960cad1242cbd2c5236acc39e11a5cec0e8bcf66`

---

## A. Root cause and exact fix

### Root cause
`decideLegalProxyEnforcement` previously **failed open**:

1. Missing/blank `SUPABASE_SERVICE_ROLE_KEY` → `{ action: "allow" }`
2. Any thrown error in admin client / principal resolution / acceptance engine → catch → `{ action: "allow" }`

Authenticated users could therefore reach protected pages/APIs without a completed legal-compliance determination whenever enforcement infra failed.

### Exact fix
Fail **closed** in Sandbox/Production-like runtimes:

| Failure | Page | API |
|---|---|---|
| Missing service role | Redirect `/system/legal-unavailable` | `503` + `legal_enforcement_unavailable` |
| Admin client init throw | Same | Same |
| Engine / unexpected throw | Same | Same |

- Recovery page is on the legal skip list → **no redirect loop**.
- Copy states the compliance check is temporarily unavailable; **does not** imply the user rejected terms; **does not** write acceptances.
- Welcome, public legal docs, login/auth/recovery, invite accept surfaces remain skipped/enforce-exempt as before.
- Principal-resolution logic (`resolveUserTypeForProxy` / venue fail-closed to owner) **unchanged**.

### Local-only override
`LEGAL_ENFORCEMENT_FAIL_OPEN=1` allows the old allow behavior **only** when:

- `NODE_ENV` is `development` or `test`, **and**
- Not `HTC_ENVIRONMENT`/`EnvironmentName` sandbox|production, **and**
- Not Vercel preview/production, **and**
- Not AWS/ECS runtime markers.

Setting the flag in deployed Sandbox/Production has **no effect**.

---

## B. Changed files and scope

### Code (in scope)
| File | Change |
|---|---|
| `lib/legal/enforcement-fail-mode.ts` | **New** — fail-open gate, logging, failure decisions |
| `lib/legal/enforcement-fail-mode.test.ts` | **New** — focused regression suite |
| `lib/legal/enforce-legal-in-proxy.ts` | Fail-closed branches + injectable deps for tests |
| `lib/legal/welcome-middleware.ts` | Skip `/system/legal-unavailable` |
| `lib/legal/welcome-integration.test.ts` | Skip-list coverage for recovery path |
| `integrations/supabase/proxy.ts` | Handle `unavailable`; API `503` for enforcement unavailable |
| `app/system/legal-unavailable/page.tsx` | **New** recovery UI |

### Docs / evidence (in scope)
| File | Change |
|---|---|
| `PROXY-FAIL-CLOSED-IMPLEMENTATION.md` | This report |
| `proxy-fail-closed-repro.json` (+ `.mts`) | Local failure injection |
| `browser-fail-closed-healthy-verify.json` (+ `.mts`) | Healthy Sandbox reconfirm |

### Explicitly not touched
Legal document text/versions, migrations, Stripe, marketing/onboarding/billing workflows, principal-resolution membership selection, unrelated dirty working-tree files.

---

## C. Test matrix (actual results)

Focused local suite (`npx tsx --test` on legal fail-closed + related):

**81/81 PASS** (includes `enforcement-fail-mode.test.ts`, principal-resolution suites, welcome-integration, acceptance-engine, signup-consent).

| # | Case | Result |
|---|---|---|
| 1 | Missing service role → protected page unavailable | **PASS** |
| 2 | Missing service role → protected API 503 decision | **PASS** |
| 3 | Admin client init failure | **PASS** |
| 4 | Engine throw on page | **PASS** |
| 5 | Engine throw on API | **PASS** (repro) |
| 6 | Public / skip routes remain skipped | **PASS** |
| 7 | Welcome remains skipped | **PASS** |
| 8 | `/api/legal/welcome` remains skipped | **PASS** |
| 9 | Login / auth / forgot / reset skipped | **PASS** |
| 10 | Healthy current-version → allow | **PASS** |
| 11 | Outdated → redirect_welcome | **PASS** |
| 12 | Vendor-only prefer vendor (not venue_owner) | **PASS** |
| 13 | Multi-venue activeVenueId passed; still gates | **PASS** |
| 14 | Failure path does not call recordAcceptance | **PASS** (only requiresAcceptance attempted) |
| — | Deployed override rejected (prod/ECS/sandbox/vercel) | **PASS** |
| — | Local override allow when explicitly enabled | **PASS** |

---

## D. Failure-injection evidence

`proxy-fail-closed-repro.json`:

```json
{
  "missingServiceRoleKey": { "action": "unavailable", "recoveryPath": "/system/legal-unavailable", "code": "legal_enforcement_unavailable" },
  "adminClientFailure": { "action": "unavailable", "recoveryPath": "/system/legal-unavailable", "code": "legal_enforcement_unavailable" },
  "engineErrorApi": { "action": "block_api", "welcomePath": "/system/legal-unavailable", "code": "legal_enforcement_unavailable" }
}
```

Server log shape (no secrets):  
`[legal] proxy enforcement unavailable { reason, pathname, userId, errorName, errorMessage }`  
JWT/service-role-looking substrings redacted; message truncated.

**Ops alert:** no new SNS/Datadog wiring in this narrow change. CloudWatch/log aggregation on the existing error line is the immediate signal. Dedicated paging remains a follow-up if desired.

---

## E. Browser regression results

Against **currently deployed** Sandbox (`960cad12` — **without** this patch):

| Check | Result |
|---|---|
| Outdated VSA owner → Welcome; visit no write (7→7) | **PASS** |
| Current-version owner → `/dashboard` (5→5) | **PASS** |
| Vendor-only → Privacy Welcome, not VSA | **PASS** |
| Login reachable | **PASS** |
| `/client/accept`, `/vendor/accept`, `/legal/privacy_policy`, `/api/health` HTTP OK | **PASS** |
| Recovery page on deployed Sandbox | **BLOCKED** — not deployed yet (unauth hits `/login?next=…`) |
| Full couple/vendor re-accept | **Not re-run** this pass (avoid extra fixture churn); prior matrix still green; accept routes 200 |

Staff Fancy session hit a **pre-existing** `/dashboard` redirect loop on Sandbox (unrelated to this un-deployed patch); not treated as a fail-closed regression.

---

## F. Remaining security / availability risks

1. **Availability:** If service role/engine is broken in Sandbox/Production after deploy, **all protected app use** redirects to recovery / 503 until infra recovers. This is intentional fail-closed.  
2. **Recovery UX:** “Try again” returns to `/dashboard`, which will re-enter unavailable until enforcement recovers — correct, not a loop through Welcome.  
3. **No new pager** — ops must watch logs.  
4. **Finalize migrations** still unapplied — separate track.  
5. Local override misuse is guarded against deployed markers, but developers must not set `LEGAL_ENFORCEMENT_FAIL_OPEN=1` in shared deploy env files.

---

## G. Recommendation for Sandbox deployment

### **GO** — separately authorized Sandbox deploy recommended

**Why:** Smallest correct consent-enforcement fix; focused tests green; healthy Sandbox gates still green on current build; principal-resolution preserved; no migrations/legal text/Stripe changes.

**Deploy contents should include only:**
- The code files listed in §B (plus this report if desired)
- **Not** unrelated dirty marketing/settings/QA tree changes

**Post-deploy verify:**
1. Serving SHA includes this commit  
2. Reconfirm jennifer Welcome + current owner dashboard  
3. Authenticated hit to a forced local failure is N/A on shared Sandbox — do **not** remove live service role  
4. Optional: authenticated navigate to `/system/legal-unavailable` shows recovery copy without writing acceptances  
5. `/api/...` under simulated local failure returns 503 (already proven locally)

**Production:** NO-GO until Sandbox deploy verification passes.

---

## Diff scope summary

```
lib/legal/enforcement-fail-mode.ts          (new)
lib/legal/enforcement-fail-mode.test.ts     (new)
lib/legal/enforce-legal-in-proxy.ts         (fail-closed)
lib/legal/welcome-middleware.ts             (skip recovery path)
lib/legal/welcome-integration.test.ts       (skip coverage)
integrations/supabase/proxy.ts             (unavailable + 503)
app/system/legal-unavailable/page.tsx       (new)
docs/design/legal-launch-consolidated-audit/PROXY-FAIL-CLOSED-IMPLEMENTATION.md
docs/design/legal-launch-consolidated-audit/proxy-fail-closed-repro.*
docs/design/legal-launch-consolidated-audit/browser-fail-closed-healthy-verify.*
```

**Not committed. Not pushed. Not deployed.**
