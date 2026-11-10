# Proxy Legal Fail-Open — Security Audit

**Date:** 2026-11-10  
**Mode:** Read-only code audit + safe local reproduction (no Production changes; no intentional data exposure)  
**Baseline:** Sandbox serving `960cad1242cbd2c5236acc39e11a5cec0e8bcf66`

---

## Exact code paths

1. `integrations/supabase/proxy.ts` (~432–472)  
   Authenticated non-public paths call `decideLegalProxyEnforcement`.  
   - `redirect_welcome` → 307 to `/welcome`  
   - `block_api` → 403 JSON `legal_acceptance_required`  
   - `allow` → request continues to route handlers / RSC

2. `lib/legal/enforce-legal-in-proxy.ts`  
   - **Fail-open A:** if `SUPABASE_SERVICE_ROLE_KEY` is missing/blank → `{ action: "allow" }` (lines ~139–141). Comment: avoid bricking local/dev without service role.  
   - **Fail-open B:** outer `try/catch` → on any thrown error, log `[legal] proxy enforcement failed open` and `{ action: "allow" }` (lines ~185–190). Comment: never take down the app if legal infra is mid-migrate; must not clear cookies / signOut.

3. Related (not fail-open for legal): venue-staff membership query errors on venue paths **fail closed** to `venue_owner` (stricter required docs), not to vendor — fixed in `960cad12`.

---

## Affected routes / roles

| When fail-open triggers | Who | Routes |
|---|---|---|
| Missing service role in marketing/product runtime env | Any authenticated user | All non-public, non-skip paths (`/dashboard`, `/clients`, `/vendor/*` app paths, most `/api/*`) |
| Thrown error inside admin client / acceptance engine / principal resolution | Same | Same |

**Skip list (never enforced anyway):** `/welcome`, `/login`, `/auth/*`, `/api/legal/*`, `/client/accept*`, `/vendor/accept`, `/vendor/login`, public legal pages, etc. (`lib/legal/welcome-middleware.ts`).

**Sandbox today:** service role is present on the product task (legal redirects work for jennifer/staff/vendor). Fail-open is **latent** unless env misconfigured or engine throws.

---

## Reproduction (safe)

`proxy-fail-open-repro.mts` / `proxy-fail-open-repro.json`:

| Condition | Result |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY=""` | `{ action: "allow" }` |
| Invalid service role key causing admin/engine error | `{ action: "allow" }` (logged fail-open) |

No customer data accessed.

---

## Downstream controls

| Control | Still active on fail-open? | Effect |
|---|---|---|
| Auth session required for protected routes | Yes | Unauthenticated still redirected to login |
| Supabase RLS on venue/client/vendor tables | Yes | Cross-tenant reads still blocked by RLS |
| Venue suspend hard-lock in proxy | Yes (separate block) | Suspended venues still redirected |
| HQ admin RPC check | Yes | Non-admins still blocked from `/admin` |
| Welcome page / `/api/legal/welcome` server gates | Only if user navigates there | Fail-open bypasses **proxy redirect**; does not invent membership |
| Signup invite `requireSignupLegalAccepted` | Independent | Invite claim forms still require checkbox |

**Critical distinction:** fail-open bypasses **legal-consent enforcement**, not authentication or RLS authorization.

---

## Could a user access protected information without completing legal acceptance?

**Under fail-open (misconfig or thrown engine error): yes for the consent gate.**  
A user who is already authenticated and authorized by RLS for a venue/vendor/client could load app pages and APIs **without** being redirected to Welcome.

**They cannot:**
- Access another venue’s data solely because fail-open fired (RLS still applies).
- Become an owner/admin without membership rows.
- Skip invite-form checkbox on `/client/accept` or `/vendor/accept` (those paths skip proxy legal but enforce checkbox in server actions).

**Risk class:** primarily **legal-consent enforcement / compliance**, secondarily **authorization policy intent** (product policy says outstanding legal blocks app use). Not a standalone confidentiality break across tenants.

**Availability tradeoff:** fail-open was chosen to avoid taking the whole app down during legal infra failures (redirect loops / hard outage). Fail-closed would improve consent enforcement but risks locking all users out if service role/engine breaks.

---

## Severity

| Dimension | Rating |
|---|---|
| Confidentiality (cross-tenant) | Low — RLS remains |
| Authorization (membership) | Low — unchanged |
| Legal-consent enforcement | **Medium–High** if service role missing or engine errors in Production |
| Availability if changed to fail-closed | Risk of total lockout / redirect storms |

**Sandbox operational status:** enforcement observed working (Welcome redirects proven) → fail-open **not currently exercising** on healthy Sandbox.

---

## Minimal recommended remediation

**Implemented locally 2026-11-10** — see `PROXY-FAIL-CLOSED-IMPLEMENTATION.md`.

1. ~~Preferred smallest fix~~ → **done locally:** fail closed to `/system/legal-unavailable` (pages) and `503 legal_enforcement_unavailable` (APIs); skip-list preserved.  
2. Structured `[legal] proxy enforcement unavailable` logs (redacted). Dedicated pager still optional follow-up.  
3. Local escape hatch `LEGAL_ENFORCEMENT_FAIL_OPEN=1` rejected in deployed runtimes.  
4. Local failure injection + healthy Sandbox reconfirm completed; **Sandbox deploy of the fix still requires separate authorization**.

**Do not** weaken RLS or invite checkbox paths as part of this change.
