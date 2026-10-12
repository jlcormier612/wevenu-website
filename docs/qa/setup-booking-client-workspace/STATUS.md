# Setup → Booking → Client Workspace — STATUS

**Environment:** Sandbox only  
**Overall:** IN PROGRESS (implementation committed; awaiting Sandbox deploy + browser proof)

## Root causes addressed

1. Invitation CTA / Setup Profile copy still said `Invite to portal`, which could render as joined text (`Invite to portalfrom`) next to following copy.
2. Setup Profile vendors UI implied every directory vendor must be checkbox-selected for client discovery.
3. Booked Overview readiness badges did not surface Draft / Shared / Unavailable from verified artifact state.
4. Invitation area did not use the locked hierarchy explaining venue preparation → client workspace.

## Changes

| Area | Change |
|---|---|
| Overview | Exact invitation hierarchy; readiness statuses via `setupReadinessDetail` |
| Portal widget | `Invite client to workspace`; Not invited / Invitation sent / Accepted |
| Setup Profiles | Vendor directory default + optional recommendations + Vendor Network required; dead `requiredVendorIds` cleared on save |
| Booking journey | Primary label → Invite client to workspace |

## Deploy / tip

| Item | Value |
|---|---|
| Tip | _pending commit_ |
| Deploy | _pending_ |

## Tests

- Unit: `readiness-detail`, `client-workspace-invite-copy`, `setup-profile-client-experience`, `required-vendors` — pass
- Browser: `scripts/qa/setup-booking-client-workspace-browser.mts` — pending deploy tip
