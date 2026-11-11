# HTC — Marketing Production Launch Preflight

**Updated:** 2026-11-10 (America/New_York) — Fail-closed Calendly webhook deployed to Sandbox  
**Mode:** Sandbox deploy of security fix only · no CFN/secret/subscription · no Production  
**Recommendation:** **CONDITIONAL GO** — fail-closed security live; booking embed live; CRM sync still blocked until signing secret + CFN wiring + Calendly subscription (next authorized step)

---

## 0. Executive verdict

| Layer | Verdict |
|---|---|
| Fail-closed webhook on Sandbox | **GO** — unsigned → **503** `Webhook not configured.` |
| Public booking embed + CTAs | **GO** — unchanged, desktop/mobile |
| Authenticated Calendly → CRM | **CONDITIONAL** — needs secret + CFN + subscription (not authorized this pass) |
| Production | **STOP** |

---

## 1. Commit and deployment

| Item | Value |
|---|---|
| Commit | `f22b8c143584e352582bfef682280894ebcfe473` |
| Message | Fail closed on unsigned Calendly webhooks before CRM writes. |
| Deploy | [42943210110](https://github.com/jlcormier612/wevenu-website/actions/runs/42943210110) **SUCCESS** |
| Serving | ECS `htc-sandbox-marketing:1141` · image `…/htc-sandbox-marketing:f22b8c14…` |
| CFN secret wiring | **Not applied** (as authorized) |
| Calendly subscription | **Not created** (as authorized) |

### Scoped commit contents

- `marketing/lib/calendly/verify.ts`
- `marketing/lib/calendly/webhook-auth.ts`
- `marketing/lib/calendly/webhook-auth.test.ts`
- `marketing/app/api/calendly/webhook/route.ts`
- `shared/relationships/ingest.ts`
- `shared/relationships/index.ts`
- `shared/relationships/calendly-walkthrough-lifecycle.test.ts`
- `docs/design/calendly-webhook-security/PREPARED-CFN-WIRING.json`
- `docs/design/calendly-webhook-security/PROBE-CLEANUP.json`

Unrelated dirty tree preserved.

### Pre-commit validation

- Webhook auth tests: **11/11 PASS**
- CRM lifecycle fixtures: **5/5 PASS**
- Marketing `tsc --noEmit` + `npm run build`: **PASS**

---

## 2. Security acceptance evidence (Sandbox live)

Evidence: `docs/design/calendly-webhook-security/SANDBOX-ACCEPTANCE.json`

| Request | HTTP | Body |
|---|---|---|
| Unsigned POST with invitee payload | **503** | `{"error":"Webhook not configured."}` |
| POST with garbage `Calendly-Webhook-Signature` (no key configured) | **503** | same — fail-closed before CRM (401 would apply once key is injected) |
| Empty unsigned body | **503** | same |
| CRM check for rejected probe email | **0 rows** | no mutation |

Auth runs before JSON/CRM handling. 180s replay window + HMAC `t.rawBody` remain in serving code. No secrets logged.

---

## 3. Booking UI acceptance

| Check | Desktop | Mobile |
|---|---|---|
| `/walkthrough` Calendly iframe (`new-meeting`) | Pass | Pass |
| “Coming soon” absent | Pass | Pass |
| Schedule CTAs → `/walkthrough` (home, pricing, product, features, our-story, contact) | Pass | Pass |

Screenshots: `docs/design/calendly-webhook-security/accept-{desktop,mobile}-walkthrough.png`  
No real appointment booked; no external notifications sent.

---

## 4. Next authorized step (precise sequence)

Prepared wiring: `docs/design/calendly-webhook-security/PREPARED-CFN-WIRING.json`  
Endpoint owner: **marketing ECS** only.

### Step 1 — Create signing secret securely

| Actor | Action |
|---|---|
| **You (Calendly)** | In Calendly Webhooks UI, confirm no existing callback to `https://sandbox.hellotocheers.com/api/calendly/webhook`. If none, create **user-scoped** subscription for `invitee.created` + `invitee.canceled`, with signing enabled. Copy the signing key once — do not paste into chat/git/GitHub vars. |
| **Cursor (after your approval)** | `aws secretsmanager create-secret` / `put-secret-value` for `htc/sandbox/calendly-webhook-signing-key` with JSON `{"value":"<key>"}` (value never printed). Prefer create empty secret via CFN placeholder first, then put-secret-value. |

### Step 2 — Apply prepared ECS / CloudFormation wiring

| Actor | Action |
|---|---|
| **Cursor (after infra approval)** | Add `CalendlyWebhookSigningKeySecret` to `infra/htc-ecs-stack.json`; grant `EcsTaskExecutionRole` `GetSecretValue`; inject `CALENDLY_WEBHOOK_SIGNING_KEY` = `${CalendlyWebhookSigningKeySecret}:value::` into **MarketingTaskDefinition** Secrets only. Deploy Sandbox stack / marketing service so the env is present. |
| **Not yet** | Do not apply until you explicitly authorize infrastructure. |

### Step 3 — Register Calendly webhook subscription

| Actor | Action |
|---|---|
| **You** | Create/confirm subscription in Calendly UI (or authorize API use of a PAT — none exists in Sandbox secrets today; do not create/rotate credentials without approval). |
| **Cursor** | Cannot list/create subscriptions without a Calendly token you authorize. |

### Step 4 — Verify authenticated delivery + CRM sync

| Actor | Action |
|---|---|
| **Cursor (after steps 1–3)** | Prove unsigned still **503** (or **401** if key present but bad sig); with a **signed** controlled payload or your authorized test booking, confirm CRM walkthrough lead / cancel / idempotency; no duplicate leads. |
| **You** | Approve one disposable test booking if live Calendly delivery is preferred over a signed synthetic POST. |

**401 vs 503 note:** With no key injected, missing/invalid signatures both fail closed as **503**. After the key is injected, invalid/stale signatures return **401**; unset key remains **503**.

---

## 5. Remaining Production dependencies (unchanged)

```text
NEXT_PUBLIC_CALENDLY_URL=https://calendly.com/jennifer-hellotocheers/new-meeting
CALENDLY_WEBHOOK_SIGNING_KEY=<Production subscription signing key>
```

Plus separate Production webhook URL `https://hellotocheers.com/api/calendly/webhook`, Resend/notify, CRM keys, pricing/Stripe/product sync as needed, robots/sitemap, explicit Production approval. Do not copy Sandbox secrets.

---

## 6. GO / CONDITIONAL GO / STOP

| Scope | Verdict |
|---|---|
| Sandbox fail-closed webhook deploy | **GO** |
| Sandbox public walkthrough booking UI | **GO** |
| Sandbox Calendly → CRM end-to-end | **CONDITIONAL GO** — blocked on secret + CFN + subscription |
| Production | **STOP** |

---

**Stop line honored this pass:** Sandbox only · no CFN/secret injection · no Calendly subscription · no credential create/rotate · no Production · no Stripe · no migrations · unrelated dirty work preserved.
