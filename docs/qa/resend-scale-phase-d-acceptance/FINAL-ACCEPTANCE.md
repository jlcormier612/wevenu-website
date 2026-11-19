# RESEND-SCALE — Phase D final acceptance (GREEN)

**Disposition:** GREEN / CLOSED (founder-approved 2026-11-19)  
**Authoritative register:** [`docs/launch/LAUNCH-READINESS.md`](../../launch/LAUNCH-READINESS.md)  
**Desktop mirror:** `~/Desktop/HTC-RESEND-SCALE-PHASE-D/`

---

## Final acceptance (run `pdmwo468og`)

| Item | Result |
|------|--------|
| Phase D run `pdmwo468og` | **GREEN** |
| Sandbox SHA | `f143df944b322518afa670d7d58e51ef0b18f2e6` (`f143df94`) |
| Migration | `20270203120000_resend_pacing_revoke_client_roles.sql` ([run 44625106512](https://github.com/jlcormier612/wevenu-website/actions/runs/44625106512)) |
| Deploy Sandbox | [run 44625430288](https://github.com/jlcormier612/wevenu-website/actions/runs/44625430288) |
| Anon EXECUTE | **Denied** by live RPC (`permission denied for function acquire_resend_send_slot`) |
| Authenticated EXECUTE | **Denied** by effective privilege inspection + migration assertion (`has_function_privilege`); not a live signed-in staff RPC call |
| Service-role EXECUTE | **Allowed** |
| Global pacing | Remains **9 total / 6 bulk**, with **3 critical** slots reserved |
| ECS services | All four healthy — venue `:1235` / marketing `:1213` / workspace `:1214` / scheduler `:1162` |
| Resend provider ID | Matches database `invitation_emails.provider_id` history (e.g. `01a1f5e5-d9f…`) |
| Guest status + UI | **Sent** (list + Sent label; screenshot `phase-d-guests-pdmwo468og.png`) |
| Controlled delivery | Verified (Resend API hit + receipt row) |
| Retry + receipt-based duplicate protection | Verified (same-attempt no duplicate Resend; recovery then API no re-send) |
| Deferred / token-security / cross-tenant | Passed (bulk deferred; invalid/expired token 401; cross-client/venue rejected) |
| Ops-alert Lambda | Unchanged (`CodeSha256` `ZF2kMkD4…`); canary and alarms healthy |

**Product PRs already on `main` (not part of docs PR #106):** [#105](https://github.com/jlcormier612/wevenu-website/pull/105), [#107](https://github.com/jlcormier612/wevenu-website/pull/107), [#108](https://github.com/jlcormier612/wevenu-website/pull/108) → merge `f143df94`.

Artifacts: `acceptance-phase-d-pdmwo468og.json`, `acceptance-phase-d-final.json`, `phase-d-rollout-closure.json`, `rpc-roles-post-migration.txt`, `acceptance-r3-GREEN.txt`.

---

## Historical remediation sequence (do not rewrite as passing)

Phase D acceptance was **not** green on first attempt. Preserve these failures:

| Run | Outcome | Failure | Remediation |
|-----|---------|---------|-------------|
| `pdmwo44ikz` (r1) | **NOT GREEN** | `bulk-deferred` / `deferred-not-marked-sent` — fixture miss; bulk fill did not hold capacity so deferred guest was sent | Fix acceptance wall-clock / deferred capacity fixture |
| `pdmwo45j4o` (r2) | **NOT GREEN** | `bulk-fill-6` undercount (`granted=5`) | Correct fill timing vs sliding window |
| `pdmwo468og` (r3) | **GREEN** | — | Final acceptance |

Logs: `acceptance-r1-deferred-fixture-miss.txt`, `acceptance-r2-fill-undercount.txt`, `acceptance-r3-GREEN.txt`.

**Prior Phase C** Sandbox rollout on `9de88f75` remained **OPEN / KEEP** with residuals (live guest invite click-through; optional `retry_after_ms` clamp). Those residuals were addressed by subsequent Phase D product work (#107/#108) and this acceptance — Phase C itself is **not** rewritten as a passing final gate.

---

## Testing limitations (accurate — not live-tested as claimed otherwise)

1. **Mid-request RPC failure** was validated through the direct recovery helper and unit/persistence tests, **not** by disrupting the live Sandbox RPC mid-flight.
2. **Authenticated-user denial** was proven through effective database privileges (migration `has_function_privilege` assertion + privilege inspection), **not** a live signed-in staff RPC call. Live anon denial was exercised; authenticated live sign-in RPC was skipped when staff credentials were unavailable to the role verifier.
3. **Residual risk retained (documented, not cleared):** concurrent same-attempt sends, and the rare provider-accepted / no-durable-receipt scenario.

Do **not** claim these three cases were live Sandbox end-to-end tested when they were not.

---

## Out of scope for this closure

- Monthly Resend allowance monitoring / capacity upgrades — separate growth-readiness item (`RESEND-MONTHLY-MONITOR`); not implied complete or required now.
- Production — untouched.
- Documentation-only merge of PR #106 does **not** require a Sandbox redeploy.
