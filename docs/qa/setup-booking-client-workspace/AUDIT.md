# Audit — Setup → Booking → Client Workspace (locked model)

**Date:** 2026-10-12  
**Tip at audit start:** `79e778f7`

## Stage mapping

| Stage | Existing implementation | Spec gap |
|---|---|---|
| A Venue configuration | `venue_setup_profiles` + `template_refs` + Planning Tools | Vendor UI implies every vendor must be checkboxed for recommendations |
| B Event preparation | `inheritSetupProfileForNewEvent` at book; `EventSetupPanel` “Get this event ready” | Copy/states incomplete; invitation hierarchy not exact |
| C Client collaboration | `PortalLinkWidget` + portal sections; directory via `get_venue_vendor_directory` | Invite copy; drafts must stay private (already mostly true) |

## Feature lifecycle (book-time)

| Feature | At booking | Spec |
|---|---|---|
| Planning checklist | Applies client playbook when decision set_up + template id | OK if profile included |
| Timeline | Applies timeline template when included | OK |
| Floor plans | Preferred starting plan ref snapshotted; plans not auto-created from legacy multi-select | Distinctions need clearer UI copy |
| Vendors required | `venue_vendor_relationships.is_required` → assignments in `book_relationship` | OK; not Setup Profile |
| Vendors recommended | `recommendedVendorIds` → `event_vendor_recommendations` | Empty list ≠ empty directory (portal already has All Our Vendors) |
| Questionnaires | Templates applied as drafts; not sent | Draft vs sent must stay visible |
| Inventory / Event Order | Starting refs; no auto financial commit | Clarify in UI |

## Joined-text defect

`Invite to portalfrom` arises from inline `<span>Invite to portal</span> from…` in Setup Profiles (and related “Invite to portal” CTAs). Fix by exact locked label **Invite client to workspace** and explicit `{" "}` spacing.

## Implementation priority

1. Exact Overview invitation hierarchy + CTA label  
2. Setup Profile vendor directory vs recommendations copy/UI  
3. Joined-text / Invite label sweep  
4. Readiness row detail for inherited starting setup  
5. Sandbox browser proof  
