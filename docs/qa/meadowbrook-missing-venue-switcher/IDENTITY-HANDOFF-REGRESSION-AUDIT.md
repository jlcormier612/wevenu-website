# Identity-handoff regression audit — final purchaser sign-in path

**Date (UTC):** 2026-10-11T20:57Z  
**Live Sandbox tip:** `459d63fc48ce6d11719d5bb809ca98ffa904b93e` (includes fix `4e3ea24a…`)  
**Related:** `HANDOFF-COVERAGE.md`, `HANDOFF-ROOT-CAUSE.md`, `FORENSIC.md`

---

## Final verdict

**GREEN — END-TO-END HANDOFF VERIFIED**

Disposable purchaser password sign-in after `/login?activated=1` consumes the onboarding handoff, selects the purchased venue, rejects stranger venues, survives refresh, and leaves Meadowbrook / Jennifer invariants unchanged.

---

## Previously verified (preserved)

| Item | Status |
|---|---|
| Fix `4e3ea24a` clears venue session + `htc_active_venue_id` on `activated=1` | GREEN (prior browser) |
| Wrong-account Jennifer path cannot win | GREEN (prior browser) |
| Unit scenario matrix in `post-activation-login.test.ts` | GREEN |
| Meadowbrook owner = original purchaser; Jennifer = 3 venues, no Meadowbrook | GREEN (re-checked this pass) |

---

## Gap closed this pass

| Gap (historical) | Result |
|---|---|
| Live purchaser authenticate → handoff consume → correct venue | **CLOSED — GREEN** via disposable fixture (not Meadowbrook revival) |

### Fixture (non-sensitive)

| Field | Value |
|---|---|
| Purchaser email | `handoff.buyer.<stamp>@hellotocheers-test.invalid` |
| Prior venue | `Handoff Prior <stamp>` (buyer owner) |
| Purchased venue | `Handoff Purchased <stamp>` (buyer owner; handoff target) |
| Stranger venue | `Handoff Stranger <stamp>` (other user; authz negative) |
| Unrelated session | Jennifer Fancy (existing Sandbox) |
| Handoff origin | `purchase_activation` via `create_venue_onboarding_handoff` |
| Auth mechanism | Password through product `/login` form (disposable `createUser`; no credential rotation of existing users) |

### Executed steps → results

1. Jennifer authenticated on `/dashboard` — **PASS**  
2. `/login?activated=1&email=<purchaser>` clears session, stays on login, prefills email — **PASS**  
3. Refresh before sign-in stays on activated login — **PASS**  
4. `/dashboard` before auth redirects to login — **PASS**  
5. Wrong password rejected — **PASS**  
6. Correct password → authenticated (Welcome legal gate for new user) — **PASS**  
7. Welcome Continue → app shell; bootstrap consumes handoff — **PASS** (`consumed_at` set)  
8. Active venue = purchased venue (not prior) — **PASS**  
9. UI shows purchased venue name in shell — **PASS**  
10. Refresh keeps active purchased venue — **PASS**  
11. Replay `consume_venue_onboarding_handoff` → `no_handoff` — **PASS**  
12. `set_active_venue(purchased)` OK; stranger → `not_a_member` — **PASS**  
13. Jennifer not on disposable venue; Meadowbrook/Jennifer invariants unchanged — **PASS**  
14. Expired handoff → `no_handoff`; malformed email prefill empty — **PASS**  
15. Unauthenticated / wrong-user consume rejected — **PASS**

Evidence: `purchaser-signin-handoff-results.json`, screenshots `purchaser-signin-*.png`, script `scripts/qa/post-activation-purchaser-signin-browser.mts`.

### Implementation note (not a defect)

Handoff consume runs in `bootstrapActiveVenueContext` (app layout). New purchasers may briefly land on `/welcome` before that bootstrap. Consume occurs on the first authenticated app-layout request after Welcome — observed here before `/onboarding/intake` / dashboard shell with purchased venue name.

---

## Failure / replay safety (this pass + existing unit coverage)

| Branch | Evidence |
|---|---|
| Wrong password | Browser — stays on login |
| Missing/malformed email prefill | Browser + unit (`safeLoginEmailPrefill`) |
| Expired / already-consumed handoff | Browser RPC + `onboarding-handoff.test.ts` |
| Refresh before sign-in | Browser |
| Refresh after consume | Browser |
| Replay activated URL | Browser — no ownership change |
| Access before auth | Browser — login redirect |
| `activated=1` / email / venueId alone grants access | Unsupported by design — proven |

---

## Command

```bash
EXPECT_SHA=459d63fc npx tsx scripts/qa/post-activation-purchaser-signin-browser.mts
```
