# Vendor ecosystem lifecycle map

## Systems of record

| Concept | Table / mechanism |
| --- | --- |
| Global business profile | `vendors` (claimed via `is_claimed` + `claim_token`) |
| Venue network membership | `venue_vendor_relationships` (`status`, `preference_level`, `is_required`, `is_in_house`) |
| Portal claim invite | `vendor_invitations` + `vendors.claim_token` |
| Vendor auth membership | `vendor_users` |
| Couple shortlist | `event_vendor_recommendations.picked_at` (private) → `selected_at` on submit |
| Event participation | `event_vendor_assignments` |
| Pre-selection chat | `conversations.conversation_kind = couple_vendor_inquiry` |
| Post-assignment chat | Conversations linked by `event_vendor_assignment_id` |
| Availability | `vendor_availability` |
| Tasks | `event_tasks` (`owner_type` / `visibility` include vendor_*) |
| Document share | `documents.shared_with_vendors` |
| Floor-plan share | `floor_plans.shared_with_vendors` |
| In-app vendor alerts | `vendor_notifications` |

## Lifecycle

1. **Listed, not invited** — relationship `active`; no `vendor_invitations` row required.
2. **Invite sent** — invitation `pending` + claim token; email via `sendVendorInvite` (Sandbox-redirected).
3. **Accepted / claimed** — `claim_vendor_profile` → `is_claimed`, `vendor_users` row.
4. **Profile / availability** — vendor portal edits `vendors` + `vendor_availability`.
5. **Client discovery** — portal recommendations + directory; required separated from optional.
6. **Inquiry** — claimed only; unclaimed → `vendor_unclaimed` + contact fallback.
7. **Reply** — vendor messages; internal_note staff-only (not couple API).
8. **Private pick** — `picked_at` set; `selected_at` null.
9. **Submit** — `selected_at` + `event_vendor_assignments` + vendor notify; idempotent.
10. **Event work** — assigned vendor: tasks, shared docs/floor plans/handbook, messages per visibility.
11. **Removal** — assignment delete / removal request paths exist; history retained on conversations.

## Visibility rules (verified)

- Couple never sees `internal_note` on couple↔vendor conversation RPCs.
- Anon cannot read assignments or foreign venue relationships.
- Listing/recommendation ≠ event access; assignment grants event participation.
