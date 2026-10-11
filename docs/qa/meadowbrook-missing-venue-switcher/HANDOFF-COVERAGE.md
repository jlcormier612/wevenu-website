# Identity-handoff regression coverage — scenario matrix

**Baseline fix:** `4e3ea24a60b3c19c1ed61e1f8768a33e88885b20` (ancestor of current Sandbox `459d63fc…`).  
**Do not reopen the verified Meadowbrook ownership / Jennifer membership invariants.**  
**Related:** `HANDOFF-ROOT-CAUSE.md`, `FORENSIC.md`.

---

## What the verified fix already guarantees

| Guarantee | Mechanism |
|---|---|
| Wrong-account browser cannot silently win after purchase activation | Proxy: `/login?activated=1` → `auth.signOut()` + clear `htc_active_venue_id`; no home bounce |
| Purchaser must authenticate | Login form after clear; no session minted at activate |
| Email query is prefill only | `safeLoginEmailPrefill`; handoff consume checks `auth.users` email |
| Meadowbrook not attached to Jennifer | No membership writes in fix |
| Refresh on activated login stays on login | Session cleared; bounce skipped |

---

## Flow map (supported)

```
Checkout (Stripe email) → enrollment/provision → workspace /activate/{token}
  → createPurchaseOnboardingHandoff(userId, intendedEmail, venueId)
  → productPostActivationLoginUrl(email?)  // activated=1&next=/setup-hub[&email=]
  → product /login?activated=1
       ├─ if venue session: signOut + clear active-venue cookie → render login
       └─ if no session: render login (prefill email if safe)
  → user signs in as purchaser
  → bootstrap consumeOnboardingHandoff() (user-id + email match, one-time)
  → set active venue to purchased venue among memberships
```

Team invite (separate supported path):

```
/join?token=… → if wrong auth email: Wrong account + Switch account (signOut) → /login?email=&next=/join?token=
              → if match: accept_team_invitation → setup-hub
```

---

## Scenario matrix

| # | Scenario | Classification | Expected behavior | Coverage |
|---|---|---|---|---|
| A | New purchaser, signed out, activates | **Supported** | Login → auth → handoff consume → new venue | **Sandbox browser GREEN** (disposable purchaser password + consume) + unit |
| B | Purchaser signed in as **same** account, activates | **Supported** | Session cleared; re-auth with prefill; then handoff | Pure rule + wiring (explicit re-auth) |
| C | Purchaser signed in as **different** account (Meadowbrook/Jennifer) | **Supported** | Session cleared; handoff copy; no Fancy bounce | **Sandbox browser GREEN** + unit |
| D | Missing / malformed `email=` on activated login | **Supported** | Still clear session; no prefill; no auth-by-email | Unit |
| E | Direct `/login?activated=1` + refresh | **Supported** | Stay on login when previously other session | Sandbox browser |
| F | Ordinary `/login` while signed in | **Supported** | Bounce to authenticated home (unchanged) | Unit (proxy order) |
| G | Team invite, signed out | **Supported** | Redirect login with `next=/join` + email prefill | `invite-identity.test.ts` |
| H | Team invite, correct account | **Supported** | Accept → setup-hub; set active venue | `invite-identity.test.ts` |
| I | Team invite, wrong account | **Supported** | Wrong account UI + Switch account sign-out | `invite-identity.test.ts` |
| J | Multi-venue user ordinary login | **Supported** | `B_keep_valid` keep prior venue | `onboarding-handoff.test.ts` |
| K | Handoff consume wrong user / email | **Supported** | `email_mismatch`; no venue grant | SQL + handoff tests |
| L | Expired / replayed handoff | **Supported** | Reject; no client venueId | `onboarding-handoff.test.ts` |
| M | Activation replay / ownership immutable | **Supported** | Already-activated safe | `activation-replay-immutable.test.ts` |
| N | White Glove pending intake | **Supported (different path)** | Intake URL, not `activated=1` login | Unit (success page) |
| O | Vendor accept wrong account | **Supported (vendor scope)** | `/vendor/login` + next accept | Existing vendor login paths |
| P | Email query alone grants venue | **Unsupported by design** | Never — server handoff + membership | Handoff SQL |
| Q | Attach purchase to unrelated session | **Unsupported by design** | Cleared by activated=1 | Fix + browser |
| R | Auto-login without password after activate | **Unsupported by design** | Explicit login required | Activate → login URL only |

---

## Audit of `activated=1` (no regression)

| Question | Answer |
|---|---|
| What is cleared? | Venue Supabase auth session **and** `htc_active_venue_id` cookie |
| Does it sign the user out? | **Yes** — intentional for both wrong- and same-account |
| Is `email=` proof of identity? | **No** — prefill / copy only |
| Must purchaser authenticate? | **Yes** before handoff consume |
| Can stale session restore Fancy? | **No** after signOut + cookie clear (browser-proven) |
| Are query flags cleaned? | `activated=1` remains on URL until navigation away; harmless after signOut |
| Refresh / back | Refresh stays on login; ordinary `/login` does not re-enter Fancy |

---

## Live tip re-verification

| Item | Result |
|---|---|
| Live `dpl` | `459d63fc48ce6d11719d5bb809ca98ffa904b93e` (includes `4e3ea24a`) |
| Wrong-account browser script | **GREEN** (`EXPECT_SHA=459d63fc`) |
| Purchaser sign-in → handoff consume | **GREEN** — disposable fixture E2E (see `IDENTITY-HANDOFF-REGRESSION-AUDIT.md`) |
| Meadowbrook owner | Still original purchaser `6721694e…` (untouched) |
| Jennifer venues | Still 3; no Meadowbrook membership |
| Expanded unit suite | `post-activation-login` scenario matrix + invite/handoff/helpers — **pass** |

## Remaining gaps (honest)

| Gap | Status |
|---|---|
| Original Meadowbrook purchaser password re-sign-in on the historical handoff | **Not re-run by design** — handoff may be expired/unused; closed via disposable equivalent without credential rotation |
| Owner Usage / CRM work | Orthogonal; see egress/CRM docs |

**Final path status:** **GREEN — END-TO-END HANDOFF VERIFIED** (disposable purchaser). Historical Meadowbrook-specific password re-proof remains intentionally skipped.

---

## Commands

```bash
npx tsx --test lib/auth/post-activation-login.test.ts lib/venue/onboarding-handoff.test.ts lib/team/invite-identity.test.ts lib/auth/login-email-prefill.test.ts shared/email/templates/helpers.test.ts
EXPECT_SHA=<live-dpl-prefix> npx tsx scripts/qa/post-activation-handoff-browser.mts
EXPECT_SHA=<live-dpl-prefix> npx tsx scripts/qa/post-activation-purchaser-signin-browser.mts
```
