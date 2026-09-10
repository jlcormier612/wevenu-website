# Current Work State

**Last verified:** 2026-09-10 — Track B implementation (ops-first dogfood; app readiness + conversation safety).

## Active milestone: Track B (ops-first)

Track A / Messaging Trust shipped. Track B application work: fail-closed readiness (requires real sender), venue_couple SMS conversation resolution, honest setup UX from `venue_twilio_accounts`.

**Dogfood compliance identity:** QuickCloud LLC (real legal/business information only).

**Do not** use Jen’s Fancy Venue as the Twilio compliance identity. Jen’s Fancy may remain only as a technical Sandbox shell for non-compliance development; it must never be submitted to Trust Hub / A2P as a real business.

**Ops provisioning (required before live E2E):** QuickCloud dogfood venue → per-venue Twilio subaccount → Secondary Customer Profile → A2P Brand/Campaign → real sender on venue Messaging Service → inbound/status webhooks → Secrets Manager `htc/{env}/twilio/venues/{AccountSid}` → `venue_twilio_accounts` with `status=ready` only when genuinely sendable (`default_from_e164` + `phone_number_sid` present).

## Settled product rules

- Email platform-managed; SMS venue-enableable via HTC onboarding (ops provisions Twilio).
- App does not call live Trust Hub/A2P APIs for dogfood; venue submit stays `information_saved` until ops state advances display.
- `smsReady` only when `venue_twilio_accounts` is sendable (`status=ready` + Messaging Service + real sender).
- No customer-facing Twilio / A2P / SID jargon.
- Locked SMS permission: `not_opted_in` allowed; `opted_out` / `provider_blocked` blocked.
- Unknown inbound: log and skip (no conversation / no review queue).
- Relationship SMS attaches to `conversation_kind = venue_couple` only (never `couple_vendor_inquiry`).
- No parent/shared Messaging Service fallback for customer sends.
- Ambiguous shared phone numbers across relationships: unresolved general-release product decision (not a Track B blocker; dogfood uses unique numbers).
