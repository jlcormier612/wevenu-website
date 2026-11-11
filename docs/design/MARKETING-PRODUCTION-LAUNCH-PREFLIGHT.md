# HTC — Marketing Production Launch Preflight

**Updated:** 2026-11-10 (America/New_York) — Sandbox Calendly signing secret + ECS wiring  
**Mode:** Sandbox infra only · no Calendly subscription · no Production · no real bookings  
**Recommendation:** **CONDITIONAL GO** — signing key injected and auth verified (401/200); **you** must register the Calendly webhook subscription using the same key from Secrets Manager

---

## 0. Executive verdict

| Layer | Verdict |
|---|---|
| Secrets Manager signing key | **GO** — `htc/sandbox/calendly-webhook-signing-key` populated (value never disclosed) |
| CFN / ECS wiring | **GO** — marketing task receives `CALENDLY_WEBHOOK_SIGNING_KEY` |
| Webhook auth on Sandbox | **GO** — missing/invalid/stale → **401**; valid signed ignored-event → **200** |
| Public booking embed / CTAs | **GO** |
| Calendly subscription registration | **STOP until you act** — not created this pass |
| Authenticated live Calendly → CRM | **CONDITIONAL** — blocked on subscription registration |
| Production | **STOP** |

---

## 1. Secret provisioning status

| Item | Evidence (non-sensitive) |
|---|---|
| Secret name | `htc/sandbox/calendly-webhook-signing-key` |
| ARN | `arn:aws:secretsmanager:us-east-1:405254329873:secret:htc/sandbox/calendly-webhook-signing-key-BMUVVf` |
| Runtime env | `CALENDLY_WEBHOOK_SIGNING_KEY` ← Secrets Manager JSON key `value` |
| Value length check | 64 chars (hex), non-empty; **value never printed** |
| Pre-existing? | **No** — `ResourceNotFoundException` before create |
| Rotation | None — first provisioning only |

Generated with `secrets.token_hex(32)` and written via `put-secret-value` after CFN created the empty placeholder secret. Not stored in Git, chat, GitHub vars, or `NEXT_PUBLIC_*`.

---

## 2. CloudFormation change-set evidence

| Item | Value |
|---|---|
| Stack | `htc-sandbox` |
| Change set | `calendly-webhook-secret-1794363548` |
| Parameters | All `UsePreviousValue=true` (images remain `f22b8c14…`) |
| Result | **UPDATE_COMPLETE** |

Summary artifact: `docs/design/calendly-webhook-security/CFN-CHANGESET-SUMMARY.json`

| Action | Resource | Notes |
|---|---|---|
| **Add** | `CalendlyWebhookSigningKeySecret` | New SM secret |
| **Modify** | `EcsTaskExecutionRole` | `GetSecretValue` on new secret only (existing ReadHtcSecrets policy) |
| **Modify** | `MarketingTaskDefinition` | Replace=True (expected for ContainerDefinitions secret add) → revision **1142** |
| **Modify** | `MarketingService` | Points at new task def |
| **Modify** | Venue/Workspace/Scheduler task defs | Conditional on shared execution role update — **no container/env changes**; services stayed healthy |

No unrelated Removes. No Production stack touched.

---

## 3. Applied infrastructure changes

- `infra/htc-ecs-stack.json`: `CalendlyWebhookSigningKeySecret` + marketing Secrets entry + IAM Ref  
- Marketing container secrets now include `CALENDLY_WEBHOOK_SIGNING_KEY`  
- Venue-app / workspace / scheduler **application** config unchanged  
- Force-new-deployment completed so tasks load the populated secret version  

---

## 4. ECS task definition and serving image

| Item | Value |
|---|---|
| Task definition | `htc-sandbox-marketing:1142` |
| Image | `…/htc-sandbox-marketing:f22b8c143584e352582bfef682280894ebcfe473` (security commit preserved) |
| Rollout | PRIMARY / COMPLETED / steady state |
| Secret names on task | includes `CALENDLY_WEBHOOK_SIGNING_KEY` (value not readable via describe) |

App security commit remains `f22b8c14` (fail-closed route). Infra-only update to inject the key.

---

## 5. Webhook authentication verification

Evidence: `docs/design/calendly-webhook-security/INFRA-AUTH-ACCEPTANCE.json`

| Case | HTTP | Result |
|---|---|---|
| Missing signature | **401** `Invalid signature.` | Pass |
| Invalid signature | **401** | Pass |
| Stale timestamp (>180s) | **401** | Pass |
| Valid HMAC + ignored event (`invitee.no_show`) | **200** `{"ok":true,"ignored":…}` | Pass — auth OK, no CRM write |
| CRM rows for auth probe emails | **0** | Pass |

Positive test intentionally used an **ignored** event type so authentication could be proven without creating CRM leads.

---

## 6. Booking UI verification

Evidence: `docs/design/calendly-webhook-security/INFRA-UI-ACCEPTANCE.json`

| Check | Desktop | Mobile |
|---|---|---|
| `/walkthrough` iframe → `jennifer-hellotocheers/new-meeting` | Pass | Pass |
| No “coming soon” | Pass | Pass |
| Schedule CTAs → `/walkthrough` | Pass | Pass |

---

## 7. Exact remaining Calendly subscription registration procedure

**Callback:** `https://sandbox.hellotocheers.com/api/calendly/webhook`  
**Events:** `invitee.created`, `invitee.canceled`  
**Scope:** User (`jennifer-hellotocheers`)  
**Signing key:** Must be **identical** to `htc/sandbox/calendly-webhook-signing-key` → JSON `value`

### Can Cursor register it now?

**No** — no Calendly Personal Access Token / OAuth credential exists in Sandbox Secrets Manager, and subscription creation is **not authorized** this pass.

### What you do (Calendly UI — preferred)

1. Sign in as the owner of `jennifer-hellotocheers`.  
2. Open **Integrations & apps** / **Developer** → **Webhooks**.  
3. Confirm there is **no** existing subscription pointing at the Sandbox callback (avoid duplicates).  
4. Retrieve the signing key yourself from AWS (Console → Secrets Manager → `htc/sandbox/calendly-webhook-signing-key` → Retrieve secret value → `value`), or:
   ```bash
   aws secretsmanager get-secret-value \
     --secret-id htc/sandbox/calendly-webhook-signing-key \
     --query SecretString --output text
   ```
   (Do not paste the value into chat/Cursor.)  
5. Create **one** user-scoped webhook subscription:  
   - URL = Sandbox callback above  
   - Events = `invitee.created`, `invitee.canceled`  
   - Signing key = the Secrets Manager value (custom/signing key field — do not let Calendly generate a different key unless you then update SM to match)  
6. Save. Do not create a Production callback.

### If Calendly UI only auto-generates a key

1. Create the subscription and copy Calendly’s generated signing key once.  
2. Authorize Cursor (separate approval) to `put-secret-value` that key into `htc/sandbox/calendly-webhook-signing-key` (overwrite).  
3. Force marketing ECS redeploy so tasks reload the secret.  
4. Then verify signed delivery.

### Optional API path (needs separate approval)

- Create a Calendly **Personal Access Token** with webhook subscription permissions (minimum: webhooks read/write for your user).  
- Store the PAT in Secrets Manager (e.g. `htc/sandbox/calendly-pat`) — never in chat.  
- Authorize Cursor to `POST /webhook_subscriptions` with the Sandbox URL, events, user scope, and signing key already in SM.  
- Do **not** create/rotate a PAT until you explicitly approve.

### After subscription exists (next Cursor verification, when authorized)

1. Unsigned/missing/invalid/stale still **401**.  
2. Authorized disposable test booking **or** signed synthetic `invitee.created` → CRM walkthrough lead.  
3. Cancel path → CRM cancel idempotency.  
4. Confirm a single subscription only.

---

## 8. Action required from you

1. **Register** the Sandbox Calendly webhook subscription (UI steps above) using the SM signing key.  
2. Reply with confirmation (no secrets) when done.  
3. Authorize the follow-up signed CRM verification pass (and optionally a disposable test booking).

---

## 9. GO / CONDITIONAL GO / STOP

| Scope | Verdict |
|---|---|
| Sandbox secret + CFN/ECS injection + auth | **GO** |
| Public walkthrough booking UI | **GO** |
| End-to-end Calendly → CRM | **CONDITIONAL GO** — waiting on your webhook subscription |
| Production | **STOP** |

---

## Prior context (still valid)

- App security commit: `f22b8c14`  
- Prior app deploy: [42943210110](https://github.com/jlcormier612/wevenu-website/actions/runs/42943210110)  
- Embed URL: `https://calendly.com/jennifer-hellotocheers/new-meeting`  
- Prepared wiring (now applied): `docs/design/calendly-webhook-security/PREPARED-CFN-WIRING.json`

---

**Stop line honored:** Sandbox only · no Calendly subscription create · no PAT create/rotate · no real booking · no Production · no Stripe · no migrations · secret values never disclosed · unrelated dirty work preserved.
