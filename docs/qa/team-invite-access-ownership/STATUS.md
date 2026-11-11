# Owners → Business & Brand / Team staff-only — GREEN

## Existing functionality reused (unchanged auth)

- `venue_staff.is_owner` + `owner_invite_pending`
- `inviteStaffMember({ isOwner: true })` + owner invite email
- `removeStaffMember` + last-owner protection
- Multi-owner already supported (relocated, not redesigned)

## UX / IA changes

| Surface | Change |
|---|---|
| Business & Brand | **Owners** list + Add owner (reuses invite; silent `accessTitle: administrator`) |
| Business & Brand | **General settings** = currency + week |
| Team & Permissions | **Owners** informational list at top + link to Business & Brand |
| Team invite | Staff only — Access titles only; **no** Owner checkbox / Invite as Owner |
| Team edit | No ownership toggle |

## Runtime (Sandbox)

| Field | Value |
|---|---|
| Commit | `ac3d4ceee52b6955e3e52a5199d4eb507fa3edc8` |
| Deploy | https://github.com/jlcormier612/wevenu-website/actions/runs/35948620461 **success** |
| Task definition | `htc-sandbox-venue-app:374` |
| Image | `…/htc-sandbox-venue-app:ac3d4cee…` |
| Digest | `sha256:ee3d3210534c1e4709fdfc387f69cfc51165a8a25cbb41872ab7ff5b62775686` |
| Task | `e4272a990e314e5f854ec56b65d2a633` RUNNING |

## Verification

- Jennifer Fancy unchanged: `is_owner=true`, `access_title=administrator`
- Add owner from Business & Brand → `owner_invite_pending=true`, `access_title=administrator`
- Both owners appear at top of Team page
- Staff Access listbox: Administrator / Manager / Coordinator / Staff / View Only / Custom — **no Owner**
- Coordinator invite → `access_title=coordinator`, `is_owner=false`
- Custom invite → `access_title=custom`, `title_basis=coordinator`
- Customize access UI opens with individual permission checkboxes
- Mobile 390 + desktop 1280 screenshots
- Production: **untouched** (no htc-production cluster)

## Verdict

**GREEN**
