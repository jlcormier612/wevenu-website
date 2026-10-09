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

GREEN on Sandbox `f83ad5897dbde5ba7d3600dd2012db46866b2afb` (2026-10-09). The notes below that the browser proof was pending, and that `first_portal_invite_sent_at` was still null, are historical. Product-wide release is not declared from this result.

## Runtime proof (2026-10-09)

Health `{"ok":true,"checks":{"env":"ok","supabase":"ok"}}`. Jen's Fancy Venue. Staff `jennifer@hellotocheers.com`.

`third_couple_portal_active_at` is `2026-10-03T04:18:29.533+00:00`. Dashboard Luv did not show “Get 3 couples started in their portals”.

`/clients?filter=portal_activation` on the same SHA showed “11 of 3 booked couples have opened their planning portal.” Row labels matched the records, and no Invite or Resend was clicked:

- Minnie Mouse — portal `last_accessed_at` set — **Opened** — action “Open client”
- Alison Morrill — invitation `7d09d944-1616-43d1-bc1a-3893a745534b` pending, no portal open — **Invited — not opened** — action “Resend”
- Jane Smith — no invitation and no portal session — **Not invited** — action “Invite”

- Commit: `e01d646c`
- Focused tests: 14/14 portal-open-milestone (+ list-filters / phase3b L1)
- Sandbox deploy: https://github.com/jlcormier612/wevenu-website/actions/runs/37095648085 (`e01d646c`)
- DB (pre-runtime stamp): Fancy has **7** unique booked portal opens → derived complete; `third_couple_portal_active_at` still null until new code stamps on first activation read
- Cached SQL checklist still shows `three_couples_active` incomplete (expected; runtime enrich overrides)
- Browser / ECS image proof: pending deploy completion
- Separate: `first_portal_invite_sent_at` still null (invite telemetry defect)
