# HTC — Email open tracking: read-only behavior verification

**Generated:** 2026-10-13  
**Mode:** Forensic / findings only. No code, config, DB, provider, or deploy changes.  
**Sandbox serving tip (verified):** `dpl=e13bf0cece30c1477d9d2c32c7b243007c67e26b`  
**Branch HEAD (local):** `e13bf0cece30c1477d9d2c32c7b243007c67e26b`  
**Deploy idle:** last Sandbox deploy success `38452156329` @ same SHA.

Production untouched. Dirty/untracked work preserved. No emails sent for this pass.

---

## Executive verdict

| Question | Answer |
|----------|--------|
| Does code request open/click tracking on outbound Resend sends? | **Yes** (`open_tracking: true`, `click_tracking: true` in `lib/email/send.ts`) |
| Does the webhook route handle `email.opened` / `email.clicked`? | **Yes** (status advance + event log + lead signal) |
| Do Sandbox persisted records show any opens/clicks in the last 90 days? | **No** — **0** `opened`/`clicked` statuses; **0** `email.opened`/`email.clicked` event rows |
| Are delivery webhooks working in Sandbox? | **Yes** — large volumes of `email.sent`, `email.delivered`, `email.bounced`, `email.delivery_delayed` |
| Can HTC truthfully claim a person read an email from an open event? | **No** — even when working, an open is a provider tracking signal, not proof of human reading |

**Implication:** Application path for opens is implemented, but **runtime evidence of successful open-event receipt/persistence in Sandbox is absent**. Most likely gap is **provider/webhook subscription or tracking effectiveness**, not missing application handlers — **UNVERIFIED** which of those is causal without Resend dashboard inspection or an authorized test send.

---

## 1. Implementation (traced)

### 1.1 Outbound send (`lib/email/send.ts`)

- Resend REST `POST https://api.resend.com/emails` when `RESEND_API_KEY` is set.
- Request body always includes `open_tracking: true` and `click_tracking: true` on the venue-app messaging send path.
- Returns Resend `id` as `providerId` (required for later webhook match).
- Sandbox mode may redirect `to` → `COMMUNICATION_SANDBOX_EMAIL` but still calls Resend with tracking flags.

**Note:** Some other sends (e.g. password recovery) set `open_tracking: false` — out of scope for Inbox messaging.

### 1.2 Persist provider id on conversation send

`lib/conversations/service.ts` → `acceptOutboundEmail` → stores `providerId` on `conversation_messages.provider_id` via repository RPC. Without this id, webhooks cannot associate.

Sandbox evidence (90d): **359** email outbound conversation messages; **349** with non-null `provider_id`.

### 1.3 Webhook endpoint (`POST /api/messaging/webhook`)

| Concern | Actual behavior |
|---------|-----------------|
| Signature | Svix headers via `verifyResendWebhookSecrets` (`lib/resend/inbound-webhook.ts`); 401 if invalid |
| Secrets | Comma-separated `RESEND_WEBHOOK_SECRET` (values not inspected/printed) |
| ID match | `payload.data.email_id` → `messages.provider_id` then `conversation_messages.provider_id` |
| Unknown id | Returns `{ ok: true }` (ignore) — no persistence |
| Status map | `email.sent`→`accepted`, `email.delivered`→`delivered`, `email.opened`→`opened`, `email.clicked`→`clicked`, `email.bounced`→`failed` |
| Status write | Only if `shouldAdvanceStatus(current, next)` — forward-only ranks; failures always record |
| Event log | **Always** inserts into `message_events` / `conversation_message_events` when message found (even if status does not advance) |
| Dedup | Status: rank prevents regress. Events: **no** idempotency key — retries can insert duplicate event rows |
| Opens/clicks extras | `logSignalEvent` (`email_opened` / `email_clicked`) + async score refresh when lead resolvable |
| Admin client | Uses `createAdminClient()` (avoids RLS silent failure) |

Status ranks (`lib/communication/status.ts`):  
`draft < sending < accepted < delivered < opened < clicked < replied`  
So **`opened` overwrites primary status** (replaces `delivered` on the message row). Timeline still reconstructs earlier steps from the event log.

### 1.4 Timeline / UI labels

- `lib/communication/timeline.ts` maps `email.opened`→ step **Opened**, `email.clicked`→ **Clicked**.
- `MESSAGE_STATUS_META.opened` = “Opened”; `.clicked` = “Clicked”.
- Communication Health Message History: outbound status via `MessageTimelinePopover` (click badge for timeline).
- Dashboard tiles: **Opened/Clicked count as Delivered** (`DELIVERED_LIKE`); **no separate open count** on the health dashboard.

### 1.5 Paths that can accept but fail to associate/persist

| Failure mode | Observable effect |
|--------------|-------------------|
| Webhook not subscribed to open/click | No `email.opened` rows (consistent with Sandbox data) |
| Missing/wrong `provider_id` on message | Event ignored (`ok: true`) |
| Signature fail | 401; no write |
| Status update DB error | Logged; event insert may still run |
| Event insert error | Logged; status may already have updated |
| Open after `replied` | Status does **not** regress to opened; event row can still be inserted |

---

## 2. Sandbox configuration & runtime evidence

### 2.1 Serving

- HTTP `dpl=e13bf0cece30c1477d9d2c32c7b243007c67e26b` matches local HEAD.

### 2.2 Open tracking enabled on send path

- **Code:** yes (`open_tracking: true`).
- **Whether Resend account/domain settings honor per-message flags:** **UNVERIFIED** (no dashboard access this pass).

### 2.3 Webhook receives open events

- Delivery/bounce/delay events **are** being received and persisted (see counts).
- Open/click events: **none found** in 90-day sample of `conversation_message_events` / `message_events`.
- Whether Resend endpoint subscription includes `email.opened` / `email.clicked`: **UNVERIFIED** (requires Resend UI or authorized API listing). Strong circumstantial evidence that opens are **not** arriving, while delivery events are.

### 2.4 Persisted open → message association

- No open rows to associate. **Cannot verify** a live open→message chain from existing data.
- Association mechanism (by `provider_id`) is the same path proven for `email.delivered` (269 such events in sample).

### 2.5 Aggregate Sandbox counts (read-only query)

**`conversation_messages` email statuses (all-time query on status):**

| Status | Count |
|--------|------:|
| accepted | 15 |
| delivered | 281 |
| opened | **0** |
| clicked | **0** |
| failed | 68 |
| replied | 6 |

**`conversation_message_events` event_type frequencies (sample ≤1000 rows, last 90d):**  
`email.sent` 327 · `email.delivery_delayed` 331 · `email.delivered` 269 · `email.bounced` 55 · `replied` 9 · SMS events present · **`email.opened` / `email.clicked` absent**

**`lead_signal_events` `email_opened` (90d):** **0**

### 2.6 Local env vs ECS

Local `.env.local` does **not** contain `RESEND_API_KEY` / `RESEND_WEBHOOK_SECRET` (presence flags false). Sandbox ECS secrets are **UNVERIFIED** from this workstation; runtime behavior of delivery webhooks proves Resend + webhook secret are configured in Sandbox.

---

## 3. UI & reporting behavior (current)

| Surface | Behavior |
|---------|----------|
| Message status badge / history | Would show **Opened** / **Clicked** if status persisted; currently no such rows to display |
| Message Timeline popover | Would list Opened/Clicked steps from event log if events existed |
| Inbox conversation thread | Uses delivery display resolution; no separate “opens” counter observed |
| Communication Health tiles | Opens roll into **Delivered** count; **no open-specific metric** |
| Primary status | Open **replaces** Delivered on the message row (rank advance), not a side field |

---

## 4. What an open event means (truth limits)

- **Sent (`accepted`):** Provider accepted the submit — not delivery, not read.
- **Delivered:** Recipient MTA/endpoint accepted the message — not open/read.
- **Opened:** Provider reported its open-tracking signal (typically a tracking pixel load).  
  - Can fire from privacy proxies, prefetch, security scanners, or clients that block images (false negatives).  
  - **Not** proof a human read the content.
- **Clicked:** Provider reported a tracked link click — stronger engagement signal than open, still not “read the whole email.”
- HTC must **not** equate Opened with “read” in customer-facing copy (Communication Readiness definitions already warn Delivered ≠ read).

Privacy / client features that limit opens (image blocking, Apple Mail Privacy Protection, etc.) are **external**; HTC cannot compensate without different signals.

---

## 5. Prerequisites for a live proof (not performed)

To prove end-to-end open handling without guessing:

1. Confirm in Resend that the Sandbox webhook endpoint is subscribed to **`email.opened`** and **`email.clicked`** (read-only dashboard check — needs credentials).
2. Authorized test send to a **non-customer** inbox that loads remote images, using a disposable Sandbox venue.
3. Wait for webhook → confirm `conversation_message_events.event_type = email.opened` and message `status = opened`.
4. Confirm UI badge/timeline show Opened.

**This pass did not send mail, change Resend settings, or write DB rows.**

---

## 6. Integrity confirmation

| Check | Result |
|-------|--------|
| Source / tests / config edited | **No** |
| DB / provider / env mutated | **No** |
| Deploy / commit / push | **No** |
| Customer communications | **No** |
| Secrets / message bodies printed | **No** |
| Unrelated dirty tree preserved | **Yes** |

**STOP** for open-tracking implementation until authorized. Next authorized workstreams may proceed separately.
