# Texting A2P number-status recovery (ops)

**Status:** Implementation companion — no Sandbox apply until founder-authorized.  
**Scope:** Missed Event Streams phone-registration events when no verified REST current-state API exists.

## Architecture (automatic path)

1. Venue self-service provisioning creates a per-venue Event Streams Sink + Subscription (six number registration/deregistration event types).
2. Twilio delivers CloudEvents to `POST /api/messaging/a2p-events`.
3. HTC verifies signature (+ optional Basic Auth), stores an idempotent event row, updates `phone_a2p_status`.
4. On a verified **REGISTERED** apply, HTC immediately resumes the existing provisioning processor (`await_number_a2p` → `mark_ready`) so the venue reaches Ready without another registration submit.
5. Scheduler recovery: every **2 minutes**, `GET /api/texting/provision/process` claims due steps and advances (bounded, idempotent) in case the webhook resume was interrupted.

## Webhook URL and authentication

| Item | Value |
|------|--------|
| Path | `/api/messaging/a2p-events` |
| Full URL | `{NEXT_PUBLIC_APP_URL}/api/messaging/a2p-events` |
| Allowlisted | Yes — `PUBLIC_PATHS` in `integrations/supabase/proxy.ts` (no staff session) |
| Signature | Twilio Event Streams body signature (`X-Twilio-Signature`) validated with the **venue subaccount** Auth Token |
| Optional Basic Auth | Username/password embedded in Sink destination URL when configured (see env vars) |

Do **not** put credentials in this document or in git.

## Required environment variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_APP_URL` | Public app base URL used for Sink destination and signature URL |
| `CRON_SECRET` | Bearer token for scheduler → `/api/texting/provision/process` |
| `TEXTING_PROVISION_SECRET` | Optional; manual POST to provision process (falls back to `CRON_SECRET`) |
| `TEXTING_A2P_EVENTS_WEBHOOK_USER` | Optional Basic Auth user for Event Streams Sink destination |
| `TEXTING_A2P_EVENTS_WEBHOOK_PASSWORD` | Optional Basic Auth password for Event Streams Sink destination |
| Texting self-service feature flag | Must be enabled for provision process to run (`isTextingSelfServiceProvisioningEnabled`) |

Venue Twilio Auth Tokens remain in the existing secret store (never logged).

## Scheduler configuration

File: `scheduler/crontab`

```
*/2 * * * * /app/invoke.sh texting-provision-process "$VENUE_APP_BASE_URL/api/texting/provision/process"
```

- Cadence: every 2 minutes (same pattern as facebook-sync).
- Auth: `invoke.sh` sends `Authorization: Bearer ${CRON_SECRET}`.
- Behavior: claims due `venue_texting_provisioning_steps` rows; advances up to 4 steps per venue per tick; respects leases via `next_attempt_at` and terminal error codes.
- Never invents REGISTERED; never marks Ready without Brand APPROVED + Campaign VERIFIED/APPROVED + phone REGISTERED.

## How HTC detects stalled registration

| Signal | Meaning |
|--------|---------|
| Provisioning step `await_number_a2p` stays `pending` with `Waiting for phone number registration event` | Event not received or not applied yet |
| Log `[texting-provisioning] missing Event Streams config while awaiting number A2P` | Sink/Subscription SIDs missing on `venue_twilio_accounts` |
| Log `[a2p-events] rejected` / 401 | Signature or Basic Auth failure |
| `phone_a2p_status` stuck at `PENDING_REGISTRATION` / `FAILURE` / null | Carrier registration incomplete or failed |
| Twilio Debugger | Event Streams delivery failures (Twilio-side) |

## Recovery from missed events

1. Confirm venue subaccount Sink/Subscription SIDs on `venue_twilio_accounts`.
2. In Twilio Console (**that venue subaccount**), confirm number registration status / campaign attachment.
3. If Twilio shows the number **Registered** but HTC does not:
   - Prefer Twilio-supported replay; do **not** casually remove/re-add the number (restarts registration; error 30035).
   - Authorized ops may set `phone_a2p_status = 'REGISTERED'` + `phone_a2p_status_updated_at` via service-role after Console proof, then ensure `await_number_a2p` / `mark_ready` are due (`next_attempt_at` ≤ now) so the 2-minute scheduler (or a manual authorized POST to `/api/texting/provision/process`) completes Ready.
4. Never mark Ready solely because a wait timed out or an event is missing.
5. Duplicate CloudEvent IDs are ignored; concurrent duplicate REGISTERED deliveries do not create a second Ready path beyond idempotent processor runs.

## Sandbox and Production setup requirements

### Both environments

- Apply the A2P migration (`phone_a2p_*` columns + `venue_twilio_a2p_events`) only when authorized.
- Set `NEXT_PUBLIC_APP_URL` to the environment’s public venue-app URL.
- Set `CRON_SECRET` so the scheduler job succeeds (401 otherwise).
- Deploy venue-app + scheduler image that includes the `*/2` texting provision crontab line.
- Confirm `/api/messaging/a2p-events` is publicly reachable (allowlisted) and returns 401 without a valid Twilio signature.

### Sandbox-specific

- Use a **disposable** self-service venue for A2P acceptance — not QuickCloud LLC, not Jen’s Fancy Venue.
- Do not mutate QuickCloud’s Twilio Primary Compliance Profile, parent account, or protected SIDs.
- Do not update QuickCloud’s database status to force Ready; accept that the QuickCloud demo venue may remain non-sending until independently verified.
- SMS send gate remains fail-closed for `ready` + NULL/`PENDING_*`/`UNREGISTERED`/`FAILURE` `phone_a2p_status`.

### Production-specific

- Same webhook + cron wiring with Production base URL and secrets.
- No Production deploy until founder-authorized (this workstream stops at local implementation until approved).

## What HTC does automatically

- Per-venue Event Streams Sink + Subscription for the six number registration/deregistration events
- Twilio-side Sink destination match + Subscription-by-SinkSid reuse before create (retry-safe)
- Webhook intake with signature (+ optional Basic Auth) validation
- Idempotent event rows in `venue_twilio_a2p_events`
- Fail-closed SMS Ready until `phone_a2p_status` is explicitly `REGISTERED`
- Provisioning `await_number_a2p` waits (does **not** invent REGISTERED)
- After verified REGISTERED: automatic provisioning resume + 2-minute scheduler recovery

## What not to do

- Invent a polling REST endpoint that was not verified on this account
- Infer REGISTERED from Campaign VERIFIED or Messaging Service membership alone
- Mutate QuickCloud / Jen’s Fancy protected SIDs
- Exempt protected venues from phone registration send gates
- Force QuickCloud demo venue Ready in the database without independent verification
