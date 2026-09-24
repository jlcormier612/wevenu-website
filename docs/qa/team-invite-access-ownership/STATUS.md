# Owners → Business & Brand / Team staff-only

## Existing functionality reused (unchanged auth)

- `venue_staff.is_owner` + `owner_invite_pending`
- `inviteStaffMember({ isOwner: true })` + owner invite email
- `removeStaffMember` + last-owner protection
- Multi-owner already supported

## UX / IA changes

| Surface | Change |
|---|---|
| Business & Brand | **Owners** list + Add owner (reuses invite with `isOwner:true`, silent `accessTitle: administrator`) |
| Business & Brand | **General settings** = currency + week (owner name/email form removed from settings) |
| Team & Permissions | **Owners** informational list at top + link to Business & Brand |
| Team & Permissions | Staff invite has **no** Owner checkbox / Invite as Owner |
| Team edit | No ownership toggle |

## Status

- Implementing → commit → Sandbox deploy → browser/DB verify
- Production: untouched
