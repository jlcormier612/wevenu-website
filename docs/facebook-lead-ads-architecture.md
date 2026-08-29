# Facebook / Instagram Lead Ads Integration — Architecture

**Sprint 3, Item 3. Research and design only — no implementation. Waiting for approval.**

**Date:** 2026-07-21

This integration does not exist in any form today. This document designs it from scratch, deliberately reusing this codebase's own established patterns rather than inventing new ones — specifically: QuickBooks's OAuth/token/connection-health shape (the most mature of the two existing OAuth integrations), Resend's webhook signature-verification shape, the QuickBooks sync queue's retry/backoff/dead-letter machinery, and the Lead Intake pipeline as the universal ingestion target every source (including this one) funnels into.

A note on scope discipline: this document designs the full integration as asked. It does **not** relitigate whether Meta Lead Ads should be built before or after the other Sprint 3 items — that ordering was already decided.

---

## 1. What this integration needs to do

A venue connects their Facebook Page (and optionally Instagram, since Meta's Lead Ads product covers both), selects which Lead Ads forms to pull from, and every new lead submitted through those forms arrives in Wevenu as a real Lead — via webhook in real time, with a periodic reconciliation poll as a backup for any missed delivery — with full retry handling, idempotency (a redelivered webhook must never create a duplicate Lead), and a Settings UI matching the connect/disconnect/health conventions already established for Stripe and QuickBooks.

---

## 2. OAuth

Meta's OAuth2 flow is closer in shape to QuickBooks's (short-lived user access token, needs exchange for a longer-lived one, page-level tokens layered on top) than to Stripe Connect's (one permanent account ID, no refresh cycle) — **mirror the QuickBooks pattern**, not Stripe's.

### 2.1 Authorize URL (client-side)

`buildFacebookConnectUrl(venueId)`, same shape as `buildQuickBooksConnectUrl` (`components/settings/quickbooks-connect-section.tsx:57-71`): reads `NEXT_PUBLIC_FACEBOOK_APP_ID` + `NEXT_PUBLIC_APP_URL`, builds Meta's OAuth dialog URL (`https://www.facebook.com/v{version}/dialog/oauth`) with `client_id`, `redirect_uri`, `state: venueId` (CSRF), and `scope=pages_show_list,pages_manage_metadata,leads_retrieval,pages_read_engagement` (the specific permission set Lead Ads retrieval requires — confirmed against Meta's own Lead Ads Graph API documentation shape, not verified against a live Meta app since none exists yet).

### 2.2 Callback route

`app/api/facebook/callback/route.ts`, mirroring `app/api/quickbooks/callback/route.ts:27-114`:
1. Read `code`/`state`/`error` from query params.
2. Validate `state === current session's venue.id` (CSRF defense-in-depth, same as the QuickBooks callback).
3. Exchange `code` for a **short-lived user access token** via Meta's token endpoint.
4. Immediately exchange the short-lived token for a **long-lived user access token** (a second required Meta-specific hop QuickBooks doesn't have — Meta's long-lived tokens run ~60 days and don't have a refresh-token/rotation model the way QBO does; they're re-extended by being used, or the user re-authorizes).
5. Persist the long-lived user token, then redirect to `/settings?facebook_success=1` — but **the connection isn't fully usable yet**, since a venue must still pick a Page (§3) before any leads can flow. The Settings UI reflects this as an intermediate "Connected — select a Page" state, not "Connected" outright.

### 2.3 Token storage

Dedicated table, `facebook_connections`, mirroring `quickbooks_connections`'s reasoning exactly (any integration with real credential material and an expiry belongs in its own table, isolated from `venues`' unrelated read/write patterns):

```
id                      uuid pk
venue_id                uuid fk venues, cascade, unique
user_access_token       text not null        -- long-lived user token
user_token_expires_at   timestamptz not null
page_id                 text                  -- set once a Page is selected (§3)
page_name               text
page_access_token       text                  -- Page tokens don't expire while the user token is valid (Meta-specific — worth
                                                -- confirming against real API behavior once credentials exist, not assumed)
status                  text not null default 'connected'  check in ('connected','needs_page_selection','disconnected','error')
last_health_check_at    timestamptz
last_health_check_ok    boolean
last_error              text
last_error_at           timestamptz
connected_at            timestamptz not null default now()
disconnected_at         timestamptz
created_at / updated_at
```
RLS: `venue_id = current_user_venue_id()`. Grants: `authenticated` (Settings reads/writes) + `service_role` (webhook/cron processing needs write access — same hazard-class lesson from this engagement applies here from day one: grant it explicitly in the same migration, never assume `rolbypassrls` implies table privileges).

`facebook_lead_forms` — a venue may connect one Page but want leads from only specific forms (or all of them):
```
id            uuid pk
venue_id      uuid fk venues, cascade
page_id       text not null
form_id       text not null
form_name     text
is_enabled    boolean not null default true
created_at
unique (venue_id, form_id)
```

### 2.4 Token refresh

Unlike QuickBooks's refresh-token rotation, Meta's long-lived user token has no rotating refresh token — it's valid for ~60 days and is extended by continuing to make authenticated calls with it, or requires the venue to re-authorize if it lapses entirely. Design: a proactive check (mirroring `getValidAccessToken`'s 2-minute buffer concept, scaled to days here) inside the webhook/poll processor — if the token is within, say, 5 days of expiry, attempt Meta's token-refresh-exchange endpoint; if that fails (token already expired), flip `status: 'error'` and surface "Reconnect required" in Settings, same as QuickBooks's `refreshTokenDead` path. Page access tokens derived from a still-valid user token don't need independent refresh handling.

### 2.5 Disconnect / reconnect

Mirror `disconnectQuickBooksAccount()` (`lib/quickbooks/service.ts:91-118`): call Meta's own token-invalidation endpoint (`DELETE /me/permissions`) best-effort, then always clear local state regardless of that call's success (never leave a venue "stuck connected" locally to a revoke call that failed for an unrelated reason). Reconnect is re-running the full authorize flow; `upsertConnection`-equivalent resets `status: 'connected'`/`disconnected_at: null` on conflict.

---

## 3. Page selection → Form selection (two-step picker)

No existing cascading-external-picker UI exists in this codebase to copy directly, but the **Import Wizard's step-machine skeleton** (`components/settings/import-wizard.tsx:587-771` — `step` index state, `ProgressBar`, per-step components taking `onNext`/`onBack`) is directly reusable, swapping its static CSV-mapping steps for two live Graph API-backed steps:

- **Step 1 — Select Page.** On mount, `GET /me/accounts` (using the stored user access token) returns every Page the authorizing user manages; render as a single-select list; on confirm, persist `page_id`/`page_name`/`page_access_token` (Meta returns a Page-scoped access token as part of this same response — no separate exchange needed) and flip connection `status: 'connected'`.
- **Step 2 — Select Lead Forms.** `GET /{page-id}/leadgen_forms` returns every Lead Ads form on that Page; render as a multi-select (a venue may run several simultaneous campaigns, e.g. a Spring Open House form and an evergreen "Request Info" form, and may not want every one of them feeding Wevenu); persist one `facebook_lead_forms` row per selected form.
- Both steps are re-enterable later from Settings ("Change Page," "Manage connected forms") without re-running the full OAuth authorize flow, since the underlying long-lived user token is still valid.

---

## 4. Webhook registration and verification

Meta's Lead Ads webhook has two distinct pieces this codebase has no existing precedent for, plus one it does:

### 4.1 Subscription verification handshake (new — no existing precedent)

Meta requires a one-time `GET` challenge-response before it will register a webhook subscription: it calls the webhook URL with `?hub.mode=subscribe&hub.verify_token={your_token}&hub.challenge={random_string}`, and expects the route to echo back `hub.challenge` as a plain-text 200 response if `hub.verify_token` matches a value you configured. `app/api/facebook/webhook/route.ts` needs a real `export async function GET(request)` handler implementing exactly this (not present anywhere else in the codebase — this is genuinely new code, though mechanically simple).

### 4.2 Signature verification on delivery (mirrors Resend's pattern closely)

Meta signs every webhook POST with `X-Hub-Signature-256: sha256={hex}` — structurally identical to Resend's Svix scheme (`app/api/messaging/webhook/route.ts:48-65`'s `verifySignature()`): read the raw body as text (never re-serialize-then-compare), compute `HMAC-SHA256(raw_body, FACEBOOK_APP_SECRET)`, compare hex digests. Copy that function's shape directly, swapping the header name and the underlying secret.

### 4.3 Proxy allowlist (same one-line fix class already found and fixed 3× this engagement)

`app/api/facebook/webhook` (both the `GET` verification handshake and the `POST` delivery) must be added to `integrations/supabase/proxy.ts`'s `PUBLIC_PATHS`, with the same inline "verifies its own signature" comment convention already used for the Twilio/Resend routes. **Given this exact class of bug (a webhook route left off the allowlist, silently redirected to `/login` before it ever runs) has now been found three separate times this engagement** (QuickBooks sync cron, and — found this same research pass — the pre-existing Email Intake webhook), this needs to be treated as a checklist item at implementation time, not an afterthought: **write the test that curls the route with no session cookie before considering the route done, every time.**

### 4.4 What the webhook payload contains, and what it doesn't

Meta's Lead Ads webhook delivery is deliberately thin — it notifies you that a lead was created (`leadgen_id`, `form_id`, `page_id`, `created_time`) but does **not** include the lead's actual field answers (name, email, phone, custom questions). A second call, `GET /{leadgen_id}?fields=field_data` using the Page access token, is required to fetch the actual submitted data. This means the webhook handler's job is narrow (validate signature → identify venue by `page_id` → enqueue a job to fetch and process this specific `leadgen_id`), and the actual "turn this into a Lead" work happens in the queue processor (§5), not inline in the webhook handler — this also naturally protects the webhook response time (Meta expects a fast 200 OK; doing the Graph API fetch synchronously inside the webhook handler risks a timeout Meta would interpret as failed delivery and retry unnecessarily).

---

## 5. Retry queue / reconciliation poll

Reuse the QuickBooks sync queue's exact shape (`quickbooks_sync_queue`/`quickbooks_sync_log`/`lib/quickbooks/backoff.ts`), as a dedicated `facebook_lead_queue` table (following this codebase's established one-table-per-integration convention rather than a shared cross-integration queue):

```
id, venue_id, leadgen_id text, form_id text, page_id text,
status text check in ('pending','processing','succeeded','failed_retrying','dead_letter'),
attempt_count int default 0, max_attempts int default 8, next_attempt_at timestamptz,
last_error, last_error_at, last_attempted_at,
created_at
```
Unique partial index on `(venue_id, leadgen_id) where status in ('pending','processing','failed_retrying')` — same shape as QuickBooks's payload-scoped dedup, but here `leadgen_id` itself is already the natural idempotency key (Meta guarantees it's stable and unique per lead), so **this also becomes the value written to `lead_intake_attempts.external_ref`**, directly using the unique index that table already has reserved for exactly this (`lead_intake_attempts_external_ref on (source, external_ref) where external_ref is not null` — see §6).

Processor (`lib/facebook/processor.ts`, cron every 5 minutes, mirrors `lib/quickbooks/processor.ts`'s claim/circuit-breaker/backoff shape exactly): claims a due batch, checks the venue's `facebook_connections.status === 'connected'` (circuit breaker), fetches `GET /{leadgen_id}?fields=field_data` using the Page access token, maps `field_data` (an array of `{name, values}` question/answer pairs — Meta's own custom-question naming varies per form, so this mapping needs a best-effort heuristic similar to the email extractor's approach: recognize common field names like `full_name`/`email`/`phone_number` directly, fall back to stashing anything unrecognized into `RawIntakeInput.sourceData`) into a `RawIntakeInput`, and calls `ingestLead()`.

**Reconciliation poll (backup for missed webhook deliveries):** a second, lower-frequency job (e.g. hourly) calls `GET /{form-id}/leads?since={last_poll_timestamp}` for every enabled `facebook_lead_forms` row and enqueues any `leadgen_id` not already present in `facebook_lead_queue` — this is what makes the integration resilient to a webhook Meta failed to deliver (network blip, Meta-side outage, app briefly unreachable during a deploy) without requiring Meta to ever redeliver anything itself.

---

## 6. Lead mapping and pipeline integration

- **New `lead_sources` row** (a plain migration `insert`, per that table's own designed extensibility — `supabase/migrations/20261110000000_lead_intake_architecture.sql:26-31`'s comment literally says "a future integration adds a row here"): `('facebook_lead_ads', 'Facebook Lead Ads', 'social', 'webhook', true)`. Note this is distinct from the pre-existing `'facebook'` row (`connection_type: 'manual_label'`), which stays as-is for coordinators manually tagging a lead as Facebook-sourced by hand.
- **`IngestLeadOptions` needs a real (small) extension**: `pipeline.ts`'s `ingestLead()` currently has no `externalRef` field to pass through to `logIntakeAttempt` (which already accepts one, per `attempt-log.ts:26` — this gap was found during research, not previously known). This needs to be added as part of this integration's implementation (or the Facebook adapter calls `logIntakeAttempt`/attempt-tracking directly itself, bypassing `ingestLead`'s built-in logging, the way the existing Email Intake route already does for its no-venue-match branch) — **flagging as a required small pipeline change, not a Facebook-specific hack**, since any future webhook source (this one, and whatever comes after) needs the same idempotency mechanism.
- `trustTier: "webhook"` — already exists in the `TrustTier` union (`lib/lead-intake/types.ts:16`) unused today; this integration is its first real consumer.
- Meta's structured question/answer array (event type, guest count, budget, etc., if the venue's ad form asks these) maps into `RawIntakeInput`'s named fields where recognizable, else into `sourceData` — same best-effort mapping philosophy as the email extractor, minus the AI extraction step (Lead Ads data already arrives structured, no free-text parsing needed).

---

## 7. Failure recovery

- **Webhook processing failure** (e.g. Graph API call to fetch `field_data` fails transiently): handled entirely by the queue/backoff mechanism above — same dead-letter-after-~1-day-of-retries shape as QuickBooks.
- **Token expired mid-flight**: the processor's circuit breaker (checking `facebook_connections.status`) prevents burning retry attempts against a connection that can't succeed until reconnected — items wait, don't dead-letter, until the venue reconnects (same design as QuickBooks's connection circuit breaker).
- **Meta returns a permanently-deleted lead** (a user can delete their own submitted lead on Meta's side before Wevenu processes it) — `GET /{leadgen_id}` would 404; this should be classified non-retryable (dead-letter immediately, log it, no Lead created) — an explicit design decision worth confirming at approval, since silently dead-lettering could look like a bug if not documented clearly in the sync log's message.
- **Duplicate webhook delivery**: handled entirely by `leadgen_id`-as-idempotency-key at two layers (queue's own partial unique index, and `lead_intake_attempts.external_ref`'s unique index) — a redelivered webhook for an already-processed `leadgen_id` is a safe no-op at both layers.

---

## 8. Settings UI

Mirrors `QuickBooksConnectSection` almost exactly: connection status badge (`Not Connected` / `Connected — select a Page` / `Connected` / `Reconnect required`), Connect button building the authorize URL, the two-step Page/Form picker (§3) shown once connected but before forms are chosen, a "Manage connected forms" affordance to revisit form selection later, a recent-activity list (mirroring `RecentSyncActivity`, reading `facebook_lead_queue`'s outcomes), and Disconnect.

---

## 9. Environment variables

`FACEBOOK_APP_ID` / `NEXT_PUBLIC_FACEBOOK_APP_ID` (client-visible OAuth client ID, not a secret, same convention as `QUICKBOOKS_CLIENT_ID`), `FACEBOOK_APP_SECRET` (server-only — used for both the OAuth token exchange and webhook signature verification), `FACEBOOK_WEBHOOK_VERIFY_TOKEN` (the arbitrary string used in the `hub.verify_token` handshake, §4.1), `FACEBOOK_GRAPH_API_VERSION` (Meta versions their Graph API and deprecates old versions on a schedule — worth pinning explicitly rather than hardcoding a version number inline, so it's a one-line bump when Meta deprecates the current one). Recommend documenting all four in `.env.example` (the QuickBooks integration skipped this convention; recommend not repeating that gap here).

---

## 10. Open decisions needing approval before coding starts

1. **Reconciliation poll cadence** — recommend hourly; confirm, or choose a different interval.
2. **Deleted-lead handling (§7)** — recommend treating a 404 on lead fetch as non-retryable dead-letter with a clear log message; confirm.
3. **Field-mapping heuristic (§6)** — recommend best-effort named-field recognition + `sourceData` fallback, matching the email extractor's philosophy, rather than requiring a venue to manually map every custom question before first use; confirm, or specify a required manual-mapping step instead.
4. **`IngestLeadOptions`/`externalRef` pipeline extension (§6)** — this is a small, real change to shared pipeline code (not Facebook-specific), needed for genuine idempotency; confirm this is in scope for this integration's implementation rather than a separate pre-req ticket.
5. **Instagram**: Meta's Lead Ads product covers both Facebook and Instagram lead forms through the same Page-connected API — this design already covers both without extra work, since Instagram Lead Ads forms surface through the same `leadgen_forms` endpoint once a Page with a linked Instagram account is selected. No separate decision needed, just confirming this is understood as already included.

---

## 11. Implemented state model and outstanding acceptance test (2026-08-29)

Added after the first real end-to-end venue connection in sandbox. §8 above is the
original pre-implementation design; this section records what actually shipped and what
is still unverified.

### 11.1 The connection has three stages, not two

Authorizing Meta grants nothing on its own. A Page must be bound, and then at least one
Lead Ads form must be enabled. Both ingestion paths independently require an **enabled**
`facebook_lead_forms` row for the incoming `form_id`:

- `app/api/facebook/webhook/route.ts` filters on `.eq("form_id", formId).eq("is_enabled", true)`
  and silently `continue`s when there is no match — the lead is dropped, not deferred.
- `lib/facebook/reconcile.ts` only iterates forms where `is_enabled = true`, so the hourly
  backstop cannot recover it either.

A Page-bound connection with zero enabled forms therefore delivers **exactly zero leads**.
This gating is intentional and was not changed. What was wrong was the UI: it showed a
green `Connected` badge and the copy "New leads from your enabled forms sync
automatically" in precisely that state — a false green light that would silently lose
leads.

### 11.2 Derived UI state

`lib/facebook/ui-state.ts` is now the single source of truth, covered by
`lib/facebook/ui-state.test.ts`. The connection's own `status` column must never drive the
green badge on its own.

| State | Condition | Badge |
| --- | --- | --- |
| `not_connected` | no row, or `status = 'disconnected'` | `Not connected` (muted) |
| `needs_page_selection` | `status = 'needs_page_selection'` | `Action needed` (warning) |
| `needs_forms` | `status = 'connected'`, zero enabled forms | `Action needed` (warning) |
| `delivering` | `status = 'connected'`, ≥1 enabled form | `Connected` (success) |
| `error` | `status = 'error'` | `Reconnect required` (destructive) |

This mirrors the Stripe card's existing connected-vs-`charges_enabled` split
(`components/settings/stripe-connect-section.tsx`), which already distinguished "linked"
from "actually capable". Facebook is deliberately **not** modelled as a binary integration
like Stripe Connect or QuickBooks.

### 11.3 Instagram requires no separate connection

The intended and implemented architecture is:

    Meta account → Facebook Page → Lead Ads (Facebook + Instagram placements) → Hello to Cheers

Instagram Lead Ads surface through the same Page `leadgen` webhook and the same
`leadgen_forms` endpoint once a Page with a linked Instagram account is selected. Do **not**
add a separate "Connect Instagram" button unless a distinct Instagram authorization is
later proven necessary for a different capability.

Page-level `leadgen` subscription is automatic: `selectFacebookPage` calls
`subscribePageToLeadgen` and refuses to save the Page if the subscription fails. Do not
introduce manual webhook configuration in the Meta App Dashboard.

### 11.4 Outstanding acceptance test — NOT yet verified

The Facebook-placement path has not been exercised end to end either, but the
Instagram-placement claim in §10.5 is the one asserted without evidence. Neither should be
described as verified until this passes:

1. Create a Lead Ads form on the connected Page with an **Instagram** placement.
2. Submit a real lead through the Instagram placement.
3. Confirm Meta delivers a `leadgen` webhook to `/api/facebook/webhook`.
4. Confirm a `facebook_lead_queue` row is created and claimed.
5. Confirm `facebook_lead_log` records `outcome = 'succeeded'`.
6. Confirm a Lead appears in Hello to Cheers with `lead_sources` = `facebook_lead_ads`,
   and that `externalRef` idempotency prevents a duplicate on webhook redelivery.

Until then, customer-facing guidance may say Instagram leads flow through the connected
Page setup, but must not state it as verified.

### 11.5 Verified live in sandbox (read-only checks, 2026-08-29)

- All five `FACEBOOK_*` values are populated in `htc/sandbox/facebook` and mounted into the
  running `htc-sandbox-venue-app` task.
- `/api/facebook/webhook` is reachable unauthenticated and returns `403` to a bad
  `hub.verify_token` — it is correctly on `PUBLIC_PATHS` and is not being redirected to
  `/login`.
- The Scheduler ECS service fires `facebook-sync-process` every 2 minutes and
  `facebook-reconcile-process` hourly, both returning `http_status=200` with real JSON
  bodies. The retired EventBridge restoration (§ `docs/infra/facebook-lead-cron-restoration-plan.md`)
  remains correctly retired; the replacement demonstrably works.
- Graph API `v21.0` (the pinned default) is still served by Meta.
