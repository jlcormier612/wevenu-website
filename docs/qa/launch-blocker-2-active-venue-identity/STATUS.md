# Launch Blocker #2 — Closed

**STATUS:** 🟢 GREEN — LAUNCH BLOCKER #2 CLOSED  
**Date:** 2026-10-06  
**Production:** untouched. Do not treat this as a Production deploy.

## Final commit / serving identity

| Item | Value |
|---|---|
| Product fix commit | `450ba20a` |
| Proof-artifact commit (served) | `e7a2fe4b` |
| Venue-app task | `f39ca89b68c54d3a816a4159c75f38ce` |
| Task definition | `htc-sandbox-venue-app:595` |
| Image | `htc-sandbox-venue-app:e7a2fe4b4ef8789e3b3907592f725e4974da8240` |
| Digest | `sha256:8217390ab0e754769eaa5cd501a11a824c065d581b1c786e87131e1caba7462c` |
| `data-dpl-id` | `e7a2fe4b4ef8789e3b3907592f725e4974da8240` |
| Health | `https://app.sandbox.hellotocheers.com/api/health` → 200 |
| Prior images retired | `5c6ec487` not serving; `450ba20a` task `:594` drained |

## Deployment runs

| Run | Commit | Result |
|---|---|---|
| [37526923136](https://github.com/jlcormier612/wevenu-website/actions/runs/37526923136) | `450ba20a` | success — first serving of the product fix |
| [37527763422](https://github.com/jlcormier612/wevenu-website/actions/runs/37527763422) | `e7a2fe4b` | proof artifacts included; venue-app sole RUNNING is this SHA |

## Database migrations

| File | Sandbox |
|---|---|
| `20261412900000_invite_identity_and_onboarding_handoff.sql` | applied (identity bound + one-time handoff) |
| `20261413000000_repair_juniper_owner_identity_sandbox.sql` | [37526527262](https://github.com/jlcormier612/wevenu-website/actions/runs/37526527262) — staff UPDATE 1 |

## Sandbox cleanup (still clean after E2E)

| Target | State |
|---|---|
| Juniper `owner_user_id` | purchaser `6721694e…` / `jlcormier612@gmail.com` |
| Fancy `2fa73101…` Juniper membership | none |
| Yahoo staff `f26f53a4…` | pending, unbound, invite token intact |
| Fancy membership at Fancy | untouched |
| Purchaser Juniper admin+billing | untouched |

## Automated tests

- Static identity/handoff: **17/17 pass** (re-run after serving proof)
- Related Wave 2 classification tests: **pass**
- Live Sandbox RPC: **26/26 pass** (re-run after browser tests; new disposable identities)

## Browser E2E (on serving product fix `450ba20a`, then cut over to `e7a2fe4b`)

### TEST A — New purchase / activation handoff

**Limitation:** activation-equivalent, not a live Stripe Checkout. Disposable purchaser `lb2.a.1791318625931@hellotocheers-test.invalid` had prior venue `LB2 Prior` + server-created `purchase_activation` handoff for `LB2 New`.

Browser: login consumed the handoff. Header + intake showed `LB2 New 1791318625931` and the purchaser email. Switcher listed Prior (owner) and New (manager). DB: handoff `consumed_at` set; `active_venue_id` = New; Prior membership intact.

### TEST B — Wrong owner identity (security)

Authenticated as `jennifer@hellotocheers.com` (Fancy) and opened the repaired Juniper invite `7a80ab1c-…`. Browser: **Wrong Email Address**. Repeat with purchaser Email A vs seeded Email D invite: same reject.

DB: Fancy still has **zero** Juniper rows. Yahoo invite still pending and unused. No active-venue grant to the wrong user.

### TEST C — Correct invited identity

**Limitation:** real Juniper owner `jyagnesak@yahoo.com` was not browser-accepted. That account’s password was not used or rotated. Correct-accept browser proof used the seeded invite for Email D onto `LB2 New` (same `accept_team_invitation` path).

Browser: Email D entered `LB2 New` onboarding/intake. Header showed `LB2 New` + `lb2.d…`. DB: Email D is Owner; invite consumed; active venue = New; Fancy is not Owner.

### TEST D — Ordinary multi-venue return

After Test A, logout/login as the purchaser. Did **not** land on Select Venue. Header remained `LB2 New` (`B_keep_valid`). Switcher still offered Prior + New. No newest-wins replacement of a valid context.

## Security / tenant isolation

- Invite email mismatch fails closed in the serving app and in live RPC
- Raw other-venue `set_active_venue` → `not_a_member`
- Handoff consume is auth+email+membership bound; replay and wrong user rejected
- No unauthorized Juniper Owner remains

## Ordinary multi-venue

`B_keep_valid` unchanged. VenueSwitcher not redesigned. Manual switch still membership-gated.

## Explicit limitations

1. Test A used a Sandbox-seeded activation-equivalent (server handoff after activation RPC), not a literal Stripe test checkout.
2. Test C browser venue name is the seeded `LB2 New`, not the header string “Juniper Valley Farm”. Real Juniper wrong-identity reject **was** proven. Yahoo can still accept the restored pending invite as that email.
3. Disposable venues are minimally provisioned; first login shows legal welcome + intake rather than a fully provisioned Setup Hub.
