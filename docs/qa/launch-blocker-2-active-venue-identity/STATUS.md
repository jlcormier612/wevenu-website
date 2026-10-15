# Launch Blocker #2 — Active venue identity / activation

**STATUS:** 🟢 GREEN / CLOSED (re-proved 2026-10-14)  
**Production:** untouched  

## Root causes (unchanged from forensic)

| Path | Root cause | Fix already in tree |
|------|------------|---------------------|
| A — Purchaser activation | Activate discarded `venueId`; `B_keep_valid` kept prior venue | `createPurchaseOnboardingHandoff` + `consumeOnboardingHandoff` |
| B — Invite wrong email | `accept_team_invitation` missing email match | Restored in `20261412900000_…`; join UI Wrong account |

## This pass — no product code change

| Item | Value |
|------|--------|
| Serving SHA | `2bfe4cde2224d24169f906f5a2bc777488722795` |
| Task definition | `htc-sandbox-venue-app:752` |
| Deploy (already serving) | https://github.com/jlcormier612/wevenu-website/actions/runs/38658530427 |
| Health | `/api/health` → 200 |
| Focused tests | **54/54 PASS** (`invite-identity`, `onboarding-handoff`, `post-activation-login`, active-context, multi-venue integrity) |
| DB state | `sandbox-state-results.json` — **allPass** |
| Browser | `browser-reproof-results.json` — **allPass** |

## Browser / DB evidence (2026-10-14)

### Path B — mismatch

- Fancy session opens Juniper pending owner invite → **Wrong account** UI (`path-b-mismatch-1280.png`)
- Live RPC `accept_team_invitation` → `email_mismatch`
- Fancy Juniper membership count remains **0**
- Invite token remains pending for yahoo domain

### Path A — handoff

- Disposable purchaser + Prior + New venues (activation-equivalent handoff, not live Stripe)
- `consume_venue_onboarding_handoff` → `ok` + `venueId` = New
- Browser lands on New (`onboarding/intake`, `path-a-handoff-1280.png`)
- DB `venue_staff_active_context` = New; handoff `consumed_at` set
- Refresh keeps New (`B_keep_valid`)

### Juniper residual (still clean)

- `owner_user_id` prefix `6721694e` (purchaser)
- Fancy not owner; Fancy active venue remains Fancy

## Limitations

1. Path A is activation-equivalent (server handoff), not a full Stripe Checkout in this pass — same limitation as the 2026-10-06 closeout.
2. Correct-accept of the real yahoo Juniper invite was not re-run (would consume the restored pending invite); mismatch reject was re-proven.

## Master list

Recorded under `docs/qa/master-release-closeout/LEDGER.md` (Launch Blocker #2 re-proof).
