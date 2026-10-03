# Luv portal-activation milestone — STATUS

## Definition (LOCKED)

A client is “active in their portal” when that booked couple has opened their client portal at least once (`client_portal_sessions.last_accessed_at` set).

Milestone: **3 unique booked couples** have opened their planning portal at least once.

## Implementation

- Derive completion from booked `events` ∩ portal sessions with `last_accessed_at`.
- Write-once stamp `venue_activation_state.third_couple_portal_active_at` when met (no competing “active” definition).
- Luv copy: “Get 3 couples started in their portals”; single CTA → `/clients?filter=portal_activation`.
- Dashboard L1 uses observation detail as suggestion (not CTA label).
- Clients deep-link handoff: portal state + Invite / Resend (pending only) / Open client.

## Separate defect (not in this ship)

`venue_activation_state.first_portal_invite_sent_at` remains null on Fancy despite real invites — `inviteClient` does not record `couple.portal_invite_sent`. Track separately.

## Status

IN_PROGRESS — focused tests green; awaiting Sandbox deploy + browser/DB proof.
