# Release Test Foundation — A+B UX

**Commit / image tag:** `6490374a9f4a898602e45537fc802d3a16e3d3fb`  
**Sandbox deploy:** https://github.com/jlcormier612/wevenu-website/actions/runs/37537538951 → **success**  
**Production:** not touched  
**Cohort / deletes / full E2E:** not started

## Serving runtime (exact)

| Service | Task | Task definition | Image | Digest | Rollout |
|---|---|---|---|---|---|
| `htc-sandbox-workspace` | `f0122c271d124cc8b7aa98212201adc7` | `:582` | `…/htc-sandbox-workspace:6490374a…` | `sha256:0486b097…dda02` | PRIMARY COMPLETED, sole RUNNING |
| `htc-sandbox-venue-app` | `f183d41000eb4ffb860553a68c72a2f1` | `:599` | `…/htc-sandbox-venue-app:6490374a…` | `sha256:bbf05ea8…7103d2` | PRIMARY COMPLETED, sole RUNNING |

Old images are not serving (single PRIMARY deployment per service, rollout COMPLETED).  
Venue-app HTTP proves `dpl=6490374a…`. Workspace proves the new A copy on the live activation page.

## Classification

- 🟢 **A — Existing-user activation password UX CLOSED**
- 🟢 **B — Invitation mismatch UX CLOSED**

Launch Blocker #2 remains CLOSED.

## Proof artifacts

- `docs/qa/release-test-foundation/ab-runtime-browser-results.json`
- `docs/qa/release-test-foundation/ab-db-proof.json` (pre-browser snapshot)
- Focused tests: 63/63 PASS (prior turn)

## Locked (untouched in product)

Authentication architecture, password overwrite policy, second auth identity, Supabase identity model, multi-venue membership model, `purchaser_is_owner`, activation semantics, onboarding handoff security, `B_keep_valid`, VenueSwitcher, invite email matching, `auth.uid` binding, owner promotion rules, Stripe, venue creation, Production.
