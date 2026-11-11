# Account-creation route inventory

Discovered via codebase search of `createUser`, invite accept routes, activate APIs, and auth signup forms. Worktrees / marketing-only newsletter paths excluded as non-account-creation.

## Venue

| Route / entry | Creates auth user? | Notes |
|---|---|---|
| `workspace` Activate Account ` /activate/[token]` + `activateAccountAction` | Yes (via product enrollment bridge) | Password + **legalAccepted** checkbox; records Venue ToS + Privacy then `activateVenueAccount` |
| `workspace/app/api/activate/[token]` POST | Completes CRM activation after legal | Requires `legalAccepted` |
| `POST /api/internal/enrollment/activate` | Yes (sets password / activates enrollment) | Now requires `legalAccepted: true` (server) |
| `POST /api/internal/legal/venue-activate` | May create shell auth user for FK | Requires `legalAccepted`; records acceptances |
| `/join?token=` team invitation | **No** — existing login only | Redirects to `/login?next=` then accepts membership; legal via `/welcome` proxy for outstanding docs |
| `/login` venue | **No** create | Existing account only |
| `/welcome` | **No** create | Post-login Welcome Experience for outstanding required docs |

## Client (couple)

| Route / entry | Creates auth user? | Notes |
|---|---|---|
| `/client/accept?token=` + `acceptClientInvitationAction` | **Yes** | Primary venue-invited couple signup |
| `/client/accept-participant?token=` + `acceptParticipantInvitationAction` | **Yes** | Participant invite signup |
| `/client/login` | **No** | Existing account; must not invent consent |
| Portal `/p/[token]` WelcomeExperienceGate | **No** | Soft/hard gate for outstanding couple docs (version update / fail-closed unlock) |
| `POST /api/portal/legal` | **No** | Records couple acceptances when Welcome continues |

## Vendor

| Route / entry | Creates auth user? | Notes |
|---|---|---|
| `/vendor/accept?token=` unauth signup (`createVendorAccountAndClaimAction`) | **Yes** | Venue-invited vendor create + claim |
| `/vendor/accept` authed Claim | **No** create | Claims profile onto existing vendor session; Welcome gate for outstanding docs |
| `/vendor/login` | **No** | Existing account |

## Shared / not account creation

- Marketing newsletter signup — relationship ingest only, no auth user.
- OAuth: not used for these portals (password forms only).
- Direct `admin.auth.admin.createUser` call sites: client-auth, vendor-auth, legal `resolveUserIdForEmail` (shell for acceptances).
