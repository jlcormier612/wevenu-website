# HTC — Launch Blocker #2 Forensic Report

**STATUS:** 🔴 PRODUCTION LAUNCH BLOCKED  
**Pass type:** READ-ONLY forensic (no code changes, no deploy, no migrations, no DB writes)  
**Date:** 2026-10-06  
**Sandbox venue under investigation:** Juniper Valley Farm `af2d6aa1-0eb2-4e65-aa6f-c066cb71a4b6`

This report does **not** call the issue GREEN and does **not** implement a fix.

---

## A. CONFIRMED REPRODUCTION MODEL

Two distinct defects combine into the same customer-facing symptom (“I ended up in the wrong venue”):

| Path | What actually happened in Sandbox data | Primary defect class |
|---|---|---|
| **PATH A — Purchase / activation** | Purchase for Juniper completed; purchaser membership created; prior active venue preserved | Missing one-time onboarding venue handoff + intentional `B_keep_valid` |
| **PATH B — Owner invitation** | Invite addressed to `jyagnesak@yahoo.com` was accepted under auth user `jennifer@hellotocheers.com` (Fancy); then Fancy remained active | **Identity-boundary regression** in `accept_team_invitation` + missing post-accept handoff |

**Important identity clarification (proved from Sandbox rows, not assumed):**

Juniper enrollment purchaser is **not** Fancy’s login.

| Role | Email | Auth user id |
|---|---|---|
| Purchaser / enrollment `owner_email` | `jlcormier612@gmail.com` | `6721694e-3f38-45e6-9afa-383ba1fd7564` |
| Invited owner (staff.email) | `jyagnesak@yahoo.com` | intended auth user exists: `bb2c2bf3-5082-4a58-9e87-e1ea764f6b5f` |
| Fancy staff login | `jennifer@hellotocheers.com` | `2fa73101-337b-4530-8c77-f3c272c5463e` |

Enrollment facts:

- `venue_enrollments.id` = `051934bd-0fb9-4653-9844-9dbc94a45433`
- `venue_name` = Juniper Valley Farm
- `purchaser_is_owner` = **false**
- `invited_owner_name` = Jennifer Cormier
- `invited_owner_email` = `jyagnesak@yahoo.com`
- `status` = activated
- Stripe session `cs_test_b1zaxlxW…` present

If Path A was described as “Fancy purchased Juniper,” the Stripe/enrollment identity that actually purchased was `jlcormier612@gmail.com`. Fancy is a separate auth user that later became incorrectly bound as Juniper Owner via Path B.

---

## B. PURCHASER ACTIVATION TRACE

Exact code/data path:

1. **Purchase** → `venue_enrollments` row created (`owner_email = jlcormier612@gmail.com`, venue name Juniper).
2. **Activation token** → `act_5f07f8b599414ee6b79874b1427ae348`.
3. Workspace `activateAccountAction` → `activateVenueAccount` → product `POST /api/internal/enrollment/activate`.
4. Activate route resolves purchaser auth user via `resolveUserIdForEmail(enrollment.owner_email)` → `6721694e…`.
5. RPC `activate_venue_enrollment(..., p_purchaser_is_owner=false, invited owner…)`:
   - creates/binds venue Juniper
   - creates purchaser staff: Administrator + `account.billing`, **not owner**
   - creates pending owner staff for `jyagnesak@yahoo.com`
6. Route returns `{ ok:true, venueId: Juniper, alreadyActivated:false }`.
7. Workspace then **discards** that `venueId` and redirects:

```ts
// workspace/app/activate/actions.ts
redirect(productPostActivationLoginUrl());
```

8. `productPostActivationLoginUrl()` =

```text
{productApp}/login?activated=1&next=%2Fsetup-hub
```

No venue id. No one-time handoff token. No `set_active_venue`.

9. After login as purchaser, `app/(app)/layout.tsx` → `bootstrapActiveVenueContext()`:
   - reads `current_user_venue_id()` from `venue_staff_active_context`
   - purchaser still has prior valid membership at **Sally Sunshine** `9fcd858e…`
   - classification = **`B_keep_valid`**
   - Juniper is **not** selected

**Where the newly activated venueId is lost:**  
Between activate route JSON (`venueId`) and `activateAccountAction` redirect. The bridge result’s venue id is never carried into the product session.

**Confirmed created:**

- Juniper venue exists (`af2d6aa1…`)
- Purchaser has accepted Juniper membership (admin + billing)
- Purchaser still has Sally Sunshine membership
- Purchaser active context remains Sally Sunshine (updated_at still 2026-09-21)

---

## C. OWNER INVITATION TRACE

1. Activation with `purchaser_is_owner=false` + invite-now created pending owner staff for `jyagnesak@yahoo.com` (`owner_invite_pending`, invite email subject pattern “You're invited as an Owner of Juniper Valley Farm”).
2. Accept URL shape: `/join?token={invite_token}` (`lib/team/service.ts`, activate route).
3. `app/join/page.tsx`:
   - if **no** session → `/login?next=/join?token=…`
   - if session exists → **immediately** `acceptTeamInvitation(token)`
4. RPC `accept_team_invitation` (last migration definition: `20261405300000_team_permissions_activation.sql`):
   - matches token
   - sets `user_id = auth.uid()`
   - **no email match against `venue_staff.email`**
   - promotes owner when `owner_invite_pending`
   - may update `venues.owner_user_id`
5. On success, join page `redirect("/")` — **does not** call `setActiveVenue(result.venueId)`.
6. Layout bootstrap → if accepter already had Fancy as valid active venue → **`B_keep_valid`** → Fancy workspace.

Observed Juniper owner row after accept:

| Field | Value |
|---|---|
| staff.id | `f26f53a4-5613-47ff-9523-b37fad9d7adb` |
| staff.email | `jyagnesak@yahoo.com` |
| staff.user_id | `2fa73101-337b-4530-8c77-f3c272c5463e` (**Fancy / jennifer@hellotocheers.com**) |
| accepted_at | `2026-10-06T20:09:15Z` |
| is_owner | true |
| invite_token | null |

Meanwhile a **separate** auth user for the invited email still exists:

- `bb2c2bf3-5082-4a58-9e87-e1ea764f6b5f` / `jyagnesak@yahoo.com`
- active context still Sally Sunshine Events (`9136fc74…`)
- **no** Juniper membership

`venues.owner_user_id` for Juniper = Fancy user `2fa73101…`.

---

## D. ACTUAL AUTHENTICATED IDENTITY IN EACH PATH

### Path A (purchase/activation)

- Intended/activated purchaser identity: `jlcormier612@gmail.com` / `6721694e…`
- Not Fancy.
- If the human later opened the Fancy session, that is a different auth identity from the purchaser row.

### Path B (owner invite) — proved

- Invite target email on staff row: `jyagnesak@yahoo.com`
- Accepting auth uid bound onto that row: Fancy `jennifer@hellotocheers.com` / `2fa73101…`
- Therefore Path B was **not** completed as the invited identity.

This answers the critical identity test:

> Can an invitation for Email B be accepted while Email A is authenticated?

**YES — in the current last migration definition of `accept_team_invitation`.**

TR-G7 (`20261003000000_tr_g7_invite_identity_check.sql`) added `email_mismatch`.  
Later `20261405300000_team_permissions_activation.sql` replaced the function for owner-invite semantics and **omitted the email check**. That is the last `create or replace` in the migration tree → authoritative intended live state after ordered applies.

Data proves the regression fired: staff.email and auth.users.email disagree, yet `accepted_at` is set and `user_id` is Fancy.

---

## E. MEMBERSHIP STATE IN EACH PATH

### Juniper staff (complete)

| Email | user_id | Owner? | Role semantics |
|---|---|---|---|
| `jlcormier612@gmail.com` | `6721694e…` | false | Administrator + billing (purchaser NO path) — correct |
| `jyagnesak@yahoo.com` | `2fa73101…` (Fancy) | true | Owner accepted — **wrong auth binding** |

### Fancy Jennifer (`2fa73101…`) accepted memberships

- Jen’s Fancy Venue
- Texting E2E disposable venue
- **Juniper Valley Farm (incorrectly)**

### Purchaser (`6721694e…`) accepted memberships

- Sally Sunshine (prior)
- Juniper Valley Farm (admin + billing)

### Intended owner auth user (`bb2c2bf3…` / jyagnesak)

- Has other venue memberships
- **Does not** have Juniper membership after the invite “acceptance”

---

## F. ACTIVE VENUE STATE IN EACH PATH

`venue_staff_active_context` (DB authoritative):

| User | active_venue_id | Venue name |
|---|---|---|
| Fancy `2fa73101…` | `a415ac52…` | Jen’s Fancy Venue |
| Purchaser `6721694e…` | `9fcd858e…` | Sally Sunshine |
| Yahoo `bb2c2bf3…` | `9136fc74…` | Sally Sunshine Events |

Also mirrored in Fancy `user_metadata.active_venue_id` = Fancy.

Classification after both paths:

- Fancy user with Juniper membership + Fancy still valid → **`B_keep_valid` → Fancy**
- Purchaser with Juniper membership + Sally still valid → **`B_keep_valid` → Sally Sunshine** (not Juniper)

This matches `lib/venue/active-context-logic.ts`:

- valid existing active venue wins
- newly created/accepted venue does **not** auto-replace it
- multi-membership with no/invalid context → `/select-venue`
- single membership → auto-select

---

## G. EXACT ROOT CAUSE(S)

**Multiple defects. Not one.**

### Defect 1 — CRITICAL identity-boundary regression (Path B)

`accept_team_invitation` no longer requires `auth.users.email` to match `venue_staff.email`.

Consequence: an already-authenticated Fancy session can consume an invite minted for a different email and become Owner of Juniper.

`/join` reuses the existing session without forcing re-auth as the invited email when a session is present.

### Defect 2 — Missing one-time onboarding venue handoff (Paths A and B)

After successful activation / successful invite accept, code knows the intended venue id but never performs a server-side `set_active_venue` (or equivalent one-time handoff) before entering the workspace.

Ordinary `B_keep_valid` then correctly preserves the previous venue — which is wrong for these special entry flows, and right for ordinary return/login.

### Defect 3 — Activation redirect drops venue context (Path A)

Activate API returns `venueId`; workspace redirect uses only `/login?activated=1&next=/setup-hub`.

### Not the root cause

- Venue switcher itself
- “Always newest venue” absence
- Purchaser/owner product model (Juniper purchaser-as-admin is correct)
- Fancy mock lacking enrollment (unrelated)

---

## H. SECURITY / TENANT-ISOLATION ASSESSMENT

### Active-venue scoping (ordinary reads)

`getVenueForCurrentUser()` → `current_user_venue_id()` → filters `venues.id`.  
RLS child data follows active venue. With Fancy active, workspace data requests are Fancy-scoped. That is **not** a silent cross-tenant read of Fancy data into Juniper or vice versa while Fancy remains selected.

### Unauthorized membership / ownership grant

🔴 **CRITICAL SECURITY BLOCKER**

Because Path B bound Fancy’s auth user as Juniper Owner:

1. Fancy identity can open venue switcher and select Juniper.
2. After switch, `set_active_venue(Juniper)` succeeds (membership exists).
3. Fancy identity then receives Juniper-scoped data as Owner.

That is unauthorized cross-identity privilege assignment to a venue the invite was not addressed to.

Also: the intended invitee (`jyagnesak@yahoo.com`) does **not** hold the Juniper membership, so the rightful owner cannot enter Juniper via that invite anymore (token cleared).

---

## I. MINIMUM CORRECT FIX

Do **not** implement in this pass. Architecture only:

### Must restore / enforce (identity)

1. Restore TR-G7 email match inside `accept_team_invitation` (and keep owner-invite pending→owner promotion).
2. On `/join`, if session email ≠ invited email → refuse accept (existing `email_mismatch` UX), require sign-out / sign-in as invited email.
3. Do **not** trust raw `?venueId=` from the client as authorization.

### Must add (one-time handoff only)

Server-side, after a **successful** special entry that already authorized the membership:

**A. Purchase/activation handoff**  
After activate succeeds for the purchaser user, set active venue to the activated `venueId` once (service-role or authenticated `set_active_venue` in a controlled post-login completion step tied to the activation success), then resume normal persistence.

**B. Invite-accept handoff**  
After `accept_team_invitation` returns ok for the authenticated matching email, call `set_active_venue(venueId)` before `redirect("/")` (or redirect to a tiny completion action that sets it).

**C. Ordinary return/login**  
Unchanged: `B_keep_valid` remains.

**D/E.** Memberships and venue switcher unchanged.

Preferred minimal pattern (existing primitives only):

- Reuse `set_active_venue` (already membership-gated).
- Optionally a short-lived server-issued handoff marker (activation completion / invite accept result) consumed once server-side — **not** an unauthenticated query param as authz.

---

## J. FILES THAT WOULD NEED TO CHANGE

(For a later implementation pass — not done now.)

| Area | Files |
|---|---|
| Identity restore | New migration restoring email check into `accept_team_invitation` (merge with owner-pending semantics from `20261405300000`) |
| Invite accept UX / handoff | `app/join/page.tsx`, `lib/team/service.ts` |
| Activation handoff | `workspace/app/activate/actions.ts`, `shared/email/templates/helpers.ts` (`productPostActivationLoginUrl`), possibly `app/api/internal/enrollment/activate/route.ts` + a product post-login completion path |
| Tests | team invite identity tests; active-context handoff tests; K2 multi-venue purchase tests |
| No redesign | `components/shell/venue-switcher.tsx`, ordinary `B_keep_valid` logic |

---

## K. REGRESSION TESTS REQUIRED

1. **TR-G7 restored:** invite for Email B rejected with `email_mismatch` when session is Email A.
2. **Correct accept:** Email B session accepts → membership bound to B’s user id only.
3. **Invite handoff:** after successful accept, `venue_staff_active_context.active_venue_id` = invited venue; prior venues still memberships.
4. **Activation handoff:** multi-venue purchaser activates second venue → first authenticated product entry lands on new venue once; later ordinary login preserves whatever they last selected.
5. **Ordinary login:** multi-venue user with valid prior active venue still gets `B_keep_valid` (no newest-wins).
6. **Purchaser NO path unchanged:** purchaser remains admin+billing; invited owner separate.
7. **No client `venueId` authz bypass.**

---

## L. EXACT SANDBOX E2E PROOF REQUIRED

After a future fix (not now):

1. Disposable purchaser with Venue 1 active.
2. Purchase/activate Venue 2 → prove first entry is Venue 2; DB context = Venue 2; memberships include both.
3. Switch back to Venue 1; sign out/in → still Venue 1 (`B_keep_valid`).
4. Invite owner Email B to Venue 2 while browser session is Email A → must show Wrong Email; no binding.
5. Sign in as Email B; accept → active venue Venue 2; staff.user_id = B; staff.email = B.
6. Prove Email A has **no** Owner membership on Venue 2.
7. Serving proof + DB rows + browser switcher labels.

**Immediate Sandbox data remediation is out of scope for this forensic pass**, but Juniper currently has a wrong Owner binding that should be cleaned only under an explicit later instruction.

---

## M. PRODUCTION IMPACT

🔴 **PRODUCTION LAUNCH BLOCKED.**

| Risk | Impact |
|---|---|
| Invite accept without email match | Any logged-in staff/owner session can steal a pending invite token for another email if they open the link |
| Missing activation/invite handoff | Multi-venue purchasers/invitees land in the wrong venue after special entry; looks like “wrong venue / wrong account” |
| Current Sandbox Juniper state | Fancy identity incorrectly owns Juniper; intended yahoo identity does not |

Do not ship production until:

1. Identity check is restored and proven, and  
2. One-time handoff exists for activation + invite accept without changing ordinary multi-venue persistence.

---

## Verdict mapping (requested options)

| Option | Present? |
|---|---|
| 1. Missing one-time onboarding handoff | **YES** (Paths A and B) |
| 2. Invitation/authentication identity-boundary problem | **YES — CRITICAL** (Path B; TR-G7 regression) |
| 3. Active-venue bootstrap problem | **Partial** — bootstrap behaves as designed (`B_keep_valid`); wrong for special entry without handoff |
| 4. Membership/account-bridge problem | **YES for Path B binding**; Path A purchaser membership creation is correct |
| 5. Multiple defects | **YES** |

**Final status: 🔴 NOT GREEN. No implementation in this pass.**
