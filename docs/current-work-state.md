# Current Work State

**Last verified:** 2026-09-07 — Track B active (Sandbox dogfood provisioning started; compliance-gated).

## Active milestone: Track B (NOT deferred)

Track A / Messaging Trust shipped and live-proven on `00dc52e`.

**Dogfood venue:** Jen’s Fancy Venue `a415ac52-cd74-42a6-8df7-7a8f6e71d080` (synthetic — do not fabricate EIN/legal/A2P facts).

**Provisioned (Sandbox):** venue Twilio subaccount + API key + venue Messaging Service (inbound/status webhooks) + `htc/sandbox/twilio/venues/{AccountSid}` secret + `venue_twilio_accounts` row `pending_compliance`. ECS task role can read venue Twilio secrets.

**Blocked (compliance):** Secondary Customer Profile, A2P Brand/Campaign, SMS/MMS sender — Twilio requires real verified business registration / address / identity that the synthetic tenant cannot legitimately provide. No shared HTC Messaging Service or parent-level venue shortcut.

## Settled product rules

- Email platform-managed; SMS venue-enableable via HTC onboarding.
- Deferred provider submit → `information_saved` (never fake Pending).
- `smsReady` only when `venue_twilio_accounts` is sendable (`status=ready` + Messaging Service).
- No customer-facing Twilio / A2P / SID jargon.
- Locked SMS permission: `not_opted_in` allowed; `opted_out` / `provider_blocked` blocked.
- Track B dogfood: Jen’s Fancy Venue only; no shared MS/sender; no fabricated A2P legal data.
