# Launch Recovery — customer-journey status

**GREEN — READY FOR JENNIFER FINAL ACCEPTANCE**

Completed 2026-09-28 against Sandbox image `8567ff57` (login fix) plus
`20261408300000` applied after the incident-window migration miss. Dedicated
E2E venue only. Jennifer's canonical account was never used or modified.

## Proved through the UI

| Journey | Result |
| --- | --- |
| Login / first-login handoff | GREEN — no blank page, no RSC loop |
| Tenant isolation | GREEN |
| Legal acceptance | GREEN |
| Venue setup intake | GREEN |
| Setup Hub / graduation | GREEN |
| Lead creation + persistence + idempotency | GREEN |
| Date hold + Booked + client creation | GREEN |
| Date-hold consumption (post-migration) | GREEN — Robin Avery hold `converted` |
| Package pricing + select package | GREEN — Essential Wedding $18,000 |
| Contract authoring | GREEN — draft saved, placeholders replaced |
| Smart Fields + Preview | GREEN — tokens stay in draft; preview resolves venue, address, Robin Avery, Sep 11 2027 |
| Send to client | GREEN — Sent to Client persists |
| Client signing (`/sign/{token}`) | GREEN — isolated browser, no venue session |
| Venue countersign | GREEN |
| Fully Executed | GREEN — list + reopen + `contracts.status=signed` |
| Payment plan | GREEN — $4,500 deposit + $13,500 remaining, 2 installments |
| Payment request | GREEN — review before send; preview does not send |
| Duplicate payment-request (regression A) | GREEN — already-sent banner; request button gone on reload; in-flight second click blocked |
| Lead Documents | GREEN — contract visible from lead |
| Client / Event workspace | GREEN — Booked, package, Fully Executed, payment plan |
| Notifications | GREEN — "Contract awaiting your signature" + new inquiry |
| Calendar / Tasks | GREEN — surfaces render; event lives on the booking file |
| Phase 6 resilience (Sandbox, client-side faults) | GREEN — 503 and timeout on notification poll: 2 hits / 20s, no overlap, page usable |

## Mandatory regressions

- **A. Duplicate payment-request protection** — proved on invoice `a09d3735-…`. Review overlay (`data-testid=payment-request-review`) does not send. After a successful send, reload shows `payment-request-already-sent` and hides Request initial payment.
- **B. Date-hold consumption at Booked** — proved on Robin Avery after the missing migration was applied. Taylor Morgan's leftover `active` hold was **not** hand-edited (pre-migration state).

## Leftover-hold self-heal (Taylor Morgan)

Not mutated. The RPC contract is asserted in
`lib/availability/date-hold-booked-boundary.test.ts`:
already-Booked re-entry converts leftover active holds on the Event date
(`hold_date = v_existing_date`) and does not insert a new event.

## Release-readiness (not journey blockers)

See `TECH-DEBT.md` and `MIGRATION-GAP.md`.

1. **Deployment must verify actual target DB migration state; repository migration-file presence is insufficient.** `SANDBOX_DB_URL` is unset, so deploys skip the check.
2. Legal service `auth.users` PostgREST lookup + `listUsers` cap 2000 (P2).
3. `startOperatorConfigureAction` still Server-Action-redirects into the gated workspace (HQ path).
4. ALB access logs disabled.
5. `pgrst_db_pool_available` still reads **−14**. Pool timeouts unchanged at **531**. Load 0.52. No new Auth 409/429/5xx during the journeys. Continue to flag; not treated as a blocker.

## What Jennifer should accept

Sign in as herself (independent of this run) and walk the same customer path
on a venue she trusts. This run used
`recovery-e2e-1790617113989@hellotocheers-test.invalid` /
Recovery E2E Venue 1790617113989 so her session was never a discovery tool.
