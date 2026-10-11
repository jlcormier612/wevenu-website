# Meadowbrook checkout identity handoff — root cause & fix

**Environment:** Sandbox only (`app.sandbox.hellotocheers.com`, Supabase `wvpsldwwjqdannqasrdf`, Stripe test).  
**Production / public marketing deploy:** not touched.  
**Meadowbrook ownership:** not altered, not re-purchased, not attached to Jennifer Fancy.

---

## Executive verdict

**ROOT CAUSE: PROVEN.** After Self-Setup activation, the product redirected to `/login?activated=1&next=/setup-hub`. Middleware treated any already-authenticated venue user as “already logged in” and **bounced them into their existing home** (Jennifer Fancy venues). Activation had correctly created Meadowbrook + owner membership + a one-time onboarding handoff for `jlcormier612@gmail.com`, but that handoff was **never consumed** because the browser never signed in as the purchaser.

**FIX: IMPLEMENTED and VERIFIED on Sandbox** in commit `4e3ea24a` — on `/login?activated=1`, clear the venue Supabase session (and `htc_active_venue_id`), do not bounce home, and prefill the purchaser email for an explicit sign-in.

| Status field | Value |
|---|---|
| **ROOT CAUSE** | **PROVEN** |
| **FIX** | **IMPLEMENTED** |
| **SANDBOX DEPLOYMENT** | **VERIFIED** (`dpl` + ECS image `4e3ea24a…`, run [38170335676](https://github.com/jlcormier612/wevenu-website/actions/runs/38170335676)) |
| **PURCHASER IDENTITY HANDOFF** | **GREEN** (live browser acceptance) |
| **OWNERSHIP AND MEMBERSHIP INTEGRITY** | **VERIFIED** (unchanged before/after acceptance) |

---

## Timestamped transaction & activation timeline (Meadowbrook)

| UTC | Event | IDs (redacted) |
|---|---|---|
| 2026-10-11T19:10:06Z | Stripe Checkout Session created (test) | `cs_test_b19KKqYvN4iOs6GAAh2danhEWNAIFKiOIF0sKMjBTc2zDp9PyTR0LkM2nK` |
| ~19:10–19:11 | Paid $199; customer email **`jlcormier612@gmail.com`** | livemode=false |
| 19:11:17Z | Enrollment created → progressed | enrollment `dd706eb8-4475-48df-a58d-912cd06b1c60` |
| 19:11:19Z | Venue row created | venue `05f16a15-1752-4855-8a3b-aad5c593d8d9` · owner_user_id `6721694e-…` |
| 19:11:36Z | Welcome email marker set | `welcome_email_sent_at` |
| 19:22:38Z | Owner `venue_staff` for purchaser | user `6721694e-…` / `jlcormier612@gmail.com` |
| 19:22:39Z | Onboarding handoff created | handoff `edd86dfa-…` · **unconsumed** at forensic time (still unconsumed after fix — purchaser has not signed in as that identity in this acceptance) |
| Post-activate | Redirect to product `/login?activated=1&next=/setup-hub` | no session established for purchaser |
| Browser (incident) | Existing Fancy session (`jennifer@hellotocheers.com` / `2fa73101-…`) bounced off `/login` into Fancy home | Meadowbrook absent from switcher (correct for that identity) |

Source forensic: `docs/qa/meadowbrook-missing-venue-switcher/FORENSIC.md`.

---

## Identity relationships (authoritative)

| Layer | Identity |
|---|---|
| Checkout contact / Stripe customer email | `jlcormier612@gmail.com` |
| Enrollment purchaser / recorded owner email | `jlcormier612@gmail.com` · `purchaser_is_owner=true` · status `activated` |
| Auth user (purchaser) | `6721694e-3f38-45e6-9afa-383ba1fd7564` |
| Venue owner + owner membership | same purchaser user id · venue `05f16a15-1752-4855-8a3b-aad5c593d8d9` |
| Onboarding handoff | bound to purchaser user id + intended email · **not** Jennifer |
| Browser session that “won” (incident) | `2fa73101-337b-4530-8c77-f3c272c5463e` · `jennifer@hellotocheers.com` |
| Jennifer memberships (unchanged) | Fancy Owner, Sweet Daisy Manager, Texting E2E Disposable Owner — **no** Meadowbrook |

Matching email strings alone are insufficient; user ids above are authoritative.

---

## Exact code path (this transaction)

1. Marketing pricing → Stripe Checkout (test) with purchaser email.  
2. Webhook / enrollment provision → venue + auth user for purchaser.  
3. Workspace `/activate/{token}` → `activateVenueAccount` + `createPurchaseOnboardingHandoff` (product activate route).  
4. `productPostActivationLoginUrl()` → `{product}/login?activated=1&next=/setup-hub` (**no** purchaser session cookie set).  
5. **Defect point:** `integrations/supabase/proxy.ts` — `venueUser && pathname === "/login"` → `resolveAuthenticatedHomePath` redirect.  
6. Jennifer session restored prior active venue among **her** memberships; purchaser handoff left unconsumed.  
7. Venue switcher correctly listed only Jennifer’s memberships.

This is **not** a recurrence of `B_keep_valid` / same-email second-venue active-venue keep. It is a **post-activation login bounce** that skips identity handoff when another account is already signed in. Related prior work (launch-blocker-2, K2, same-email second venue) assumed the correct auth user would complete login; they did not clear a **wrong** prior session on `activated=1`.

---

## Why the Jennifer session took precedence

- Activation does not mint a browser session for the purchaser; it only stores a server-trusted one-time handoff for the purchaser user id.  
- Success/activate then sends the browser to ordinary product login with `activated=1`.  
- Proxy treated “logged-in venue user on `/login`” as success and redirected home.  
- Therefore the unrelated Fancy session won; Meadowbrook never appeared for that identity (correct filtering, wrong handoff).

---

## Security & ownership assessment

| Risk | Mitigation in fix |
|---|---|
| Auth as purchaser merely from Stripe/email metadata | **No** — email is prefill only; handoff consume still requires matching authenticated `auth.users` email + user id (`email_mismatch` in SQL) |
| Grant Jennifer Meadowbrook | **No** — no membership writes; ownership untouched |
| Reusable / logged activation tokens | Unchanged one-time handoff RPCs; tokens not added to URLs |
| Prior session silently overrides purchaser | **Fixed** — `activated=1` forces `signOut` + clear `htc_active_venue_id` before login UI |
| Replay / refresh restoring wrong account | Cleared session; refresh stays on login when `activated=1` |

Same-account path: if the browser is already signed in as the purchaser, `activated=1` still signs out then requires re-auth (explicit, slightly stricter, secure). Wrong-account path: explicit sign-in with purchase email prefilled.

---

## Scoped code changes

| File | Change |
|---|---|
| `integrations/supabase/proxy.ts` | On `/login?activated=1` + venue session → `signOut`, clear active-venue cookie, **no** home bounce |
| `shared/email/templates/helpers.ts` | `productPostActivationLoginUrl(email?)` adds safe email query |
| `workspace/app/activate/actions.ts` + API activate route | Pass purchaser email into login URL |
| `app/(auth)/login/page.tsx` | Explicit post-activation copy |
| `marketing/app/pricing/success/page.tsx` | Already-activated CTA uses post-activation login URL |
| `app/api/internal/enrollment/by-session/route.ts` + `shared/product-account` | Return `ownerEmail` for prefill |
| `lib/auth/post-activation-login.ts` (+ tests) | Pure rules + wiring invariants |
| `lib/venue/onboarding-handoff.test.ts` / helpers tests | Updated expectations |

**Commit:** `4e3ea24a` — *Clear prior venue session on post-purchase activation login.*

**Regression tests:** `npx tsx --test lib/auth/post-activation-login.test.ts shared/email/templates/helpers.test.ts lib/venue/onboarding-handoff.test.ts` — all pass.

---

## Deploy

| Item | Value |
|---|---|
| Branch | `feat/spaces-booking-e1-smart-fields` |
| Commit | `4e3ea24a60b3c19c1ed61e1f8768a33e88885b20` |
| Workflow | [Deploy Sandbox #38170335676](https://github.com/jlcormier612/wevenu-website/actions/runs/38170335676) — **success** |
| Live `dpl` | `4e3ea24a60b3c19c1ed61e1f8768a33e88885b20` |
| ECS image | `…/htc-sandbox-venue-app:4e3ea24a60b3c19c1ed61e1f8768a33e88885b20` |
| Health | `{"ok":true,"checks":{"env":"ok","supabase":"ok"}}` |
| Acceptance script | `scripts/qa/post-activation-handoff-browser.mts` |

---

## Browser acceptance & DB checks (live)

Ran against deployed `4e3ea24a` without re-purchasing Meadowbrook:

| Check | Result |
|---|---|
| Deployed revision matches expect | **PASS** |
| Jennifer session active on `/dashboard` before handoff | **PASS** (user id `2fa73101-…`) |
| Navigate `/login?activated=1&email=jlcormier612@gmail.com&next=/setup-hub` | **Stays on login** — does **not** bounce to Fancy |
| Handoff copy + email prefill | **PASS** |
| Refresh keeps activated login | **PASS** |
| Bare `/login` after clear — no Fancy bounce | **PASS** |
| Meadowbrook owner still purchaser; Jennifer still no Meadowbrook staff; Jennifer venue count = 3 | **PASS** (before === after) |

Artifacts:

- `handoff-browser-results.json`
- `handoff-jennifer-before.png`
- `handoff-activated-login.png`
- `handoff-activated-refresh.png`

**Note:** This acceptance proves the wrong-account silent-land defect is fixed. Completing purchaser password sign-in as `jlcormier612@gmail.com` (to consume the Meadowbrook handoff and open that venue) was **not** required to prove the Jennifer session can no longer win; credentials were not rotated or guessed.

---

## Remaining limitations

- Purchaser must complete password/sign-in after activation when any prior venue session existed (including same-account).  
- Original Meadowbrook onboarding handoff may remain unconsumed until the purchaser signs in as `jlcormier612@gmail.com` — this fix does **not** silently attach Meadowbrook to Jennifer.  
- Marketing already-activated CTA uses the product post-activation login URL; critical path verified is venue-app proxy + login.

---

## Final status

- **ROOT CAUSE:** PROVEN  
- **FIX:** IMPLEMENTED  
- **SANDBOX DEPLOYMENT:** VERIFIED  
- **PURCHASER IDENTITY HANDOFF:** GREEN  
- **OWNERSHIP AND MEMBERSHIP INTEGRITY:** VERIFIED  
