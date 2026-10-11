# Venue password recovery — audit, implementation, verification

**Audit type:** Feature gap close. Sandbox only. No Production / public-marketing deploy.  
**Commit:** `2af63b9c6145257851f1d76ff4dd85e64b4670d4`  
**Deploy:** [Deploy Sandbox 38174964241](https://github.com/jlcormier612/wevenu-website/actions/runs/38174964241) (`environment: sandbox`)

---

## 1. Audit verdict (before change)

| Layer | Finding |
|---|---|
| Login UI | Email + Password + Sign in only — **no Forgot password link** |
| Routes | **No** `/forgot-password`, `/reset-password`, or `/auth/confirm` |
| Server actions | `signIn` / `signOut` only — **no** `resetPasswordForEmail` |
| Auth callback | **Missing** (`exchangeCodeForSession` / recovery `verifyOtp` absent) |
| Client portal | `changeMyPassword` for signed-in users only — not email recovery |
| Classification | **Missing end-to-end** (not hidden; not partially wired) |

### Sandbox Auth redirect reality (probed)

| Asked `redirectTo` | Got `redirect_to` on recovery link |
|---|---|
| `https://app.sandbox…/auth/confirm` | Rejected → Site URL `http://app.sandbox.hellotocheers.com` |
| `http://app.sandbox…/auth/confirm` | **Accepted** |

Site URL on Sandbox GoTrue is **http** `app.sandbox.hellotocheers.com`. Implementation uses the allowlisted http confirm URL on that host; post-exchange browser redirects use `publicAppOrigin()` (**https**).

**Owner follow-up (recommended):** Add `https://app.sandbox.hellotocheers.com/auth/confirm**` (and prefer https Site URL) in Supabase Auth URL config so recovery need not rely on the http allowlist exception.

---

## 2. What was implemented

| Piece | Location |
|---|---|
| Forgot password? link (below password, right-aligned) | `components/auth/login-form.tsx` |
| Request form + generic success copy | `app/(auth)/forgot-password`, `requestPasswordReset` |
| Auth confirm callback | `app/auth/confirm/route.ts` |
| New password form | `app/(auth)/reset-password`, `updatePasswordAfterRecovery` |
| Redirect helper | `lib/auth/password-recovery.ts` |
| Public + legal skip paths | `integrations/supabase/proxy.ts`, `welcome-middleware.ts` |
| Login success banner after reset | `/login?reset=1` |
| Unit wiring tests | `lib/auth/password-recovery.test.ts` |
| Browser E2E script | `scripts/qa/password-recovery-browser.mts` |

Guarantees preserved: activated=1 handoff behavior untouched; email query still prefill-only; no secrets logged; enumeration-safe success copy.

---

## 3. Verification status

| Check | Status |
|---|---|
| Unit tests (`password-recovery`, public paths, email prefill) | **PASS** (10/10) |
| Sandbox deploy of `2af63b9c` | Started run **38174964241** — verify `dpl` before GREEN |
| Browser E2E (disposable user, generateLink, update, sign-in) | Run after tip shows `2af63b9c` |
| Real SMTP delivery to a mailbox | **Not claimed** — disposable `.invalid` + `generateLink` (no customer email) |

---

## 4. Commands

```bash
npx tsx --test lib/auth/password-recovery.test.ts
EXPECT_SHA=2af63b9c npx tsx scripts/qa/password-recovery-browser.mts
```

---

## Safety

- Production / public marketing untouched.  
- Deploy workflow targets `environment: sandbox` only.  
- Disposable Sandbox users; no credential rotation for Jennifer / Meadowbrook / customers.  
- Dirty unrelated work preserved.
