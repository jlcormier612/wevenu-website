# Current Work State

**Last verified:** 2026-09-07 — Track A / Messaging Trust ship sequence in progress.

## Ship sequence (authorized)

1. Commit + push Track A + Messaging Trust/Deliverability + migrations `20261349`–`20261351` + ECS secret wiring for `SENSITIVE_FIELD_ENCRYPTION_KEY`.
2. Apply Sandbox migrations `20261349`, `20261350`, `20261351`.
3. Deploy Sandbox; populate encryption key (SM → ECS, no ad-hoc mechanism); verify task receives it without exposing value.
4. Live-verify on `app.sandbox.hellotocheers.com`.
5. **Track B is the NEXT authorized major milestone** after this live-proof — NOT deferred. Status today: NOT STARTED (provisioning not begun).

## Settled product rules

- Email platform-managed; SMS venue-enableable via HTC onboarding.
- Deferred provider submit → `information_saved` (never fake Pending).
- `smsReady` only when `venue_twilio_accounts` is sendable.
- No customer-facing Twilio / A2P / SID jargon.
- Locked SMS permission: `not_opted_in` allowed; `opted_out` / `provider_blocked` blocked.
- Track B dogfood: Jen’s Fancy Venue only; no shared MS/sender; no fabricated A2P legal data.
