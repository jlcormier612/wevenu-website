# Luv first_portal_invite factuality

## Definition (LOCKED)

`first_portal_invite` is complete when this venue has at least one **booked** client (`events.booked_at` set, `status != cancelled`) with a `client_invitations` row whose `status` is `pending` or `accepted`.

Not engagement telemetry. Not portal sessions. Not `first_portal_open_at`. Not `third_couple_portal_active_at`.

## Status

GREEN on Sandbox `f83ad5897dbde5ba7d3600dd2012db46866b2afb` (2026-10-09). Fancy Dashboard does not offer a first portal invite. Product-wide release is not declared from this result.

## Runtime proof (2026-10-09)

Health `{"ok":true,"checks":{"env":"ok","supabase":"ok"}}`. Venue Jen's Fancy Venue. Staff `jennifer@hellotocheers.com` opened `/dashboard` on that SHA. The session was already Fancy; no venue switch and no invitation was sent.

Qualifying booked clients already on file (event `booked_at` set, status not cancelled, future event date, lead `sales_stage` booked):

- Minnie Mouse `36af0561-55cd-45ed-accc-dc890709437e` — invitation `e46344ee-f192-4c14-89cc-5204a9be235e` accepted, event `8e666a40-37d6-43c2-8181-a2e8109e09f8` booked 2026-10-02, event date 2027-12-12
- Ivy Quinn `3c9ecc54-fe49-432a-b49e-9d68dee33575` — invitation `f0b84d73-e47d-45d4-b3aa-9a728baa59c4` accepted
- Alison Morrill `94fdf029-d912-4b1f-9c5a-79efd0757427` — invitation `7d09d944-1616-43d1-bc1a-3893a745534b` pending

Dashboard Luv showed “Everything sent in the last day reached its destination — 4 messages, no failures.” The page did not contain “Invite your first couple to their portal” or “Until you send an invite”.

`venue_activation_state.first_portal_invite_sent_at` stayed `2026-10-03T01:18:59.657466+00:00`. No new invitation was created.

## Implementation

Live overlay (same principle as `applyPortalOpenMilestoneToChecklist`):

- `getVenueFirstPortalInviteMilestone` reads invitation rows
- `applyFirstPortalInviteToChecklist` sets checklist completion
- Write-once `first_portal_invite_sent_at` is derived telemetry only
- `inviteClient` unchanged
