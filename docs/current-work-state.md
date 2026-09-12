# Current Work State

**Last verified:** 2026-09-10 — Track B dogfood provisioning in progress (ops resources created; not live-sendable yet).

## Active milestone: Track B (ops-first)

Track A / Messaging Trust shipped. Track B application work (commit `abd26f6`): fail-closed readiness (requires real sender), venue_couple SMS conversation resolution, honest setup UX from `venue_twilio_accounts`.

**Dogfood compliance identity:** QuickCloud LLC (real legal/business information only).

**Do not** use Jen’s Fancy Venue as the Twilio compliance identity. Jen’s Fancy may remain only as a legacy/synthetic Sandbox shell for non-compliance development; it must never be submitted to Trust Hub / A2P as a real business.

### Dogfood provisioning status (Sandbox)

Executed against QuickCloud LLC (not Jen’s Fancy):

| Step | Status |
|------|--------|
| Sandbox venue `QuickCloud LLC` | Created (`0149e0d4-…`) |
| Dedicated Twilio subaccount | Created (`ACe48276…`) — distinct from Jen’s Fancy |
| AWS secret `htc/sandbox/twilio/venues/{AccountSid}` | Created (required keys present) |
| Venue Messaging Service + Sandbox inbound/status webhooks | Created (`MG4e1f56…`) |
| Real sender purchased + attached to MS | Yes (`+15083749761` / `PNe61f3b…`) |
| Secondary Customer Profile | Submitted — was `in-review` |
| A2P Trust Product | Submitted — was `in-review` |
| A2P Brand | Submitted — was `PENDING` (TCR id assigned); campaign blocked until Brand registered |
| `venue_twilio_accounts` | Populated with verified SIDs; **`status=pending_compliance`** (not `ready`) |
| `smsReady` / live E2E | **False / not run** — A2P campaign not created; parent Twilio account later returned not-active on API |

**Not claimed:** Twilio A2P approval, live sender operational for US 10DLC, or Track B complete.

**Next external blockers:** Twilio must keep/restore API access on the parent ISV account, complete Secondary Profile + Brand review, then campaign can be created and `status` may move to `ready` only when genuinely sendable.

## Settled product rules

- Email platform-managed; SMS venue-enableable via HTC onboarding (ops provisions Twilio).
- App does not call live Trust Hub/A2P APIs for dogfood; display syncs from `venue_twilio_accounts`.
- `smsReady` only when `venue_twilio_accounts` is sendable (`status=ready` + Messaging Service + real sender).
- No customer-facing Twilio / A2P / SID jargon.
- Locked SMS permission: application-originated outbound SMS requires `opted_in`.
  `not_opted_in` / `opted_out` / `provider_blocked` are blocked. Phone number alone
  and preferred-channel “Text message” are not consent. Explicit inquiry/tour SMS
  checkbox (optional, unchecked) records consent. STOP revokes; START restores.
- Unknown inbound: log and skip (no conversation / no review queue).
- Relationship SMS attaches to `conversation_kind = venue_couple` only (never `couple_vendor_inquiry`).
- No parent/shared Messaging Service fallback for customer sends.
- Ambiguous shared phone numbers across relationships: unresolved general-release product decision (not a Track B blocker; dogfood uses unique numbers).
