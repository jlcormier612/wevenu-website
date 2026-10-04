# Luv first_portal_invite factuality

## Definition (LOCKED)

`first_portal_invite` is complete when this venue has at least one **booked** client (`events.booked_at` set, `status != cancelled`) with a `client_invitations` row whose `status` is `pending` or `accepted`.

Not engagement telemetry. Not portal sessions. Not `first_portal_open_at`. Not `third_couple_portal_active_at`.

## Status

NOT GREEN — awaiting Sandbox runtime + Fancy Dashboard proof.

## Implementation

Live overlay (same principle as `applyPortalOpenMilestoneToChecklist`):

- `getVenueFirstPortalInviteMilestone` reads invitation rows
- `applyFirstPortalInviteToChecklist` sets checklist completion
- Write-once `first_portal_invite_sent_at` is derived telemetry only
- `inviteClient` unchanged
