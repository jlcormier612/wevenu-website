# Owner setup — ownership ≠ invitation — GREEN

## How ownership vs invitation is represented

| Customer state | `venue_staff` | UI |
|---|---|---|
| Logged-in owner (You) | `is_owner=true`, `accepted_at` set, `owner_invite_pending=false` | Owner · email · **You** |
| Recorded, not invited | `is_owner=true`, `accepted_at=null`, `owner_invite_pending=false`, `invite_token=null` | **Owner access not yet invited** + [Invite] |
| Invitation sent | `owner_invite_pending=true` (may also keep `is_owner` if invited after record) | **Invitation sent** + [Cancel invite] |
| Has HTC access (other owner) | `is_owner=true`, `accepted_at` set | Owner · email |

**Add owner** asks explicitly:
- **Add owner only** → `recordOwnerMember` (no email, no pending invite)
- **Invite owner now** → existing `inviteStaffMember({ isOwner: true })`

Existing accepted members matching the email are **promoted** to owner without a duplicate invitation.

## Runtime (exact)

| Field | Value |
|---|---|
| Commit | `a08781b846bd8266fad29717df40713b8a3c5752` |
| Deploy | https://github.com/jlcormier612/wevenu-website/actions/runs/35951813084 **success** |
| Task definition | `htc-sandbox-venue-app:376` |
| Task | `arn:aws:ecs:us-east-1:405254329873:task/htc-sandbox/84e8bec1256b490ab833bbfc9b21edec` |
| Image | `…/htc-sandbox-venue-app:a08781b8…` |
| Digest | `sha256:6d30abfa8fec4aec24b954ccb50ee32b11f02fc50da8f9f09d93a39a1dff830e` |
| Production | **untouched** |

## Scenarios verified (Sandbox browser + DB)

1. **Jennifer Fancy** remains owner, shows **You**, no self-invite  
2. Cancel prior pending invite → works  
3. **Add owner only** (Ron Cormier) → DB: `is_owner=true`, `owner_invite_pending=false`, `accepted_at=null`, `invite_token=null`  
4. UI: **Owner access not yet invited** + Invite  
5. **Invite** later → DB: `owner_invite_pending=true`, `invited_at` set, token issued; UI **Invitation sent**  
6. Team page: both owners; Jennifer **You**; Ron **Invitation sent**; staff Access = Administrator/Manager/Coordinator/Staff/View Only/Custom (**no Owner**)  
7. Last-owner protections unchanged (DB trigger; Jennifer remains accepted owner)  
8. Desktop + 390 viewport  

## Auth model

Unchanged: `is_owner`, `owner_invite_pending`, last-owner invariant, multi-owner, staff-only Team invite.
