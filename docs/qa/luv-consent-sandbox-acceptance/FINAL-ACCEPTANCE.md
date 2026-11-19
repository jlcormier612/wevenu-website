# LUV-CONSENT — Final Sandbox acceptance (GREEN / CLOSED candidate)

**Disposition:** **GREEN / CLOSED** (documentation PR for founder merge review; product already on Sandbox `7cde5d97`).  
**Authoritative register:** [`docs/launch/LAUNCH-READINESS.md`](../../launch/LAUNCH-READINESS.md)  
**Desktop:** `~/Desktop/HTC-LUV-CONSENT-SANDBOX/`

---

## Deployment

| Item | Result |
|------|--------|
| PR #109 approved head | `96c539860c0241a69bdb197fde04ecfbc8be2b9d` |
| Merge SHA | `7cde5d974cebbb9f32e13a67ac0e1245affa0610` |
| Deploy Sandbox | [44632487026](https://github.com/jlcormier612/wevenu-website/actions/runs/44632487026) |
| Serving SHA (ECS + `dpl=` header) | `7cde5d974cebbb9f32e13a67ac0e1245affa0610` |
| ECS | venue `:1236` / marketing `:1214` / workspace `:1215` / scheduler `:1163` — rollouts **COMPLETED**, running=desired=1 |
| Health | `GET /api/health` → `{"ok":true,"checks":{"env":"ok","supabase":"ok"}}` |
| Production | Untouched |

---

## Browser acceptance (live Sandbox UI on `7cde5d97`)

Artifact: `browser-acceptance.json` + Desktop screenshots.

| Case | Result |
|------|--------|
| Serving SHA header `dpl=7cde5d97…` | PASS |
| Eligible email → Luv “Draft a follow-up email” CTA | PASS |
| Non-send lead/Luv review chrome | PASS |
| Email opted_out → CTA hidden; blocked copy (“Communication consent is no longer in place for this channel.”) | PASS |
| Pending draft visible while eligible (DB-inserted; **no OpenAI**) | PASS |
| Consent revoked → “No longer applicable” / withdrawn drafts UI | PASS |
| Leads nav OK | PASS |

**Not claimed:** SMS drafting browser UI (product remains email-primary for Luv drafts).

---

## Prior DB / code-path acceptance (preserved)

Artifact: `acceptance.json` (earlier GREEN run against live Sandbox DB + production loader/send helpers).

Includes: email no-row eligible; opted_out / provider_blocked; **simulated** permission-read fail-closed; SMS missing/opted_in/opted_out; channel switch; consent-request unchanged; revocation withdraw; changed address; cross-venue; lost/booked; never-sends contract.

---

## Simulated vs live

| Case | Mode |
|------|------|
| Permission-read transport failure | **SIMULATED** (mock client) |
| All other DB + browser matrix rows above | **LIVE** Sandbox |
| AI draft generation | **Not run** (no paid OpenAI) |

---

## Residual risks / limitations

1. Read-error fail-closed proven in unit + simulated harness, not by disrupting live DB.
2. No OpenAI generation during acceptance — pending drafts inserted via DB for revoke/accept UI.
3. SMS text-draft UI not product-surfaced; SMS eligibility proven at DB/code layer only.
4. Separate product direction **LUV-OPTOUT** (master opt-out switch) is out of scope.

---

## Preserved closures

RESEND-SCALE GREEN/CLOSED · LUV-FINAL GREEN · NAV-PERF P1 OPEN · primary dirty 746 · no Production · no schema in this docs package.
