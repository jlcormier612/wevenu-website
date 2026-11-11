# Vendor ecosystem capability matrix

Serving SHA: `3dbc2a45…`. Evidence: `browser-results.json` (28/28) + `vendor-client-venue-workflow` (17/17) + unit 30/30.

| # | Requirement | Implementation | Status | Evidence |
| --- | --- | --- | --- | --- |
| A1 | Venue create/edit vendor records | `components/vendors/*`, `lib/vendors/service.ts`, `venue_vendor_relationships` | GREEN | Venue `/vendors` loads; disposable vendor+relationship insert |
| A2 | Required vs optional / preference | `is_required`, `preference_level`, portal Required section | GREEN | Selection harness: Cuppity required; optional tab counts |
| A3 | Invite all/some/none | Explicit invite via `sendVendorInvite` / `vendor_invitations`; listing ≠ invite | GREEN | Uninvited disposable had 0 invites; invite upsert idempotent |
| B1 | Invitation create + token resolve | `vendor_invitations`, `get_invitation_preview`, `get_vendor_by_claim_token` | GREEN | Preview + claim token resolve; invalid rejected |
| B2 | Accept page | `/vendor/accept` | GREEN | Valid token Claim UI; bogus → invalid/expired |
| B3 | Claim / identity | `claim_vendor_profile`, `vendor_users` | GREEN | Existing claimed Baker/Harah via jennifer; accept path rendered |
| C1 | Vendor-owned profile | `/vendor/profile`, `lib/vendor-profile/service.ts` | GREEN | Portal reachable; description persist; anon mutate denied |
| C2 | Availability calendar | `/vendor/availability`, `vendor_availability` | GREEN | Portal reachable; date row persist |
| D1 | Client discovery | Portal `VendorSection`, recommendations RPC | GREEN | Client vendors section after legal welcome |
| D2 | Inquiry claimed | `start_portal_vendor_inquiry` | GREEN | Conversation + message; `vendor_notifications` “New message from a couple” |
| D3 | Inquiry unclaimed | RPC `vendor_unclaimed` | GREEN | Disposable unclaimed rejected |
| D4 | Vendor reply + privacy | `conversation_messages`; couple RPC filters | GREEN | Vendor portal msg persists; internal_note not in couple API |
| E1 | Private pick vs submit | `picked_at` / `selected_at` / `submit_vendor_list` | GREEN | Ecosystem + selection harness |
| E2 | Assignment idempotent | `event_vendor_assignments` | GREEN | Resubmit assignCount=1 |
| E3 | Venue sees selections | Recommendations `selected_at` | GREEN | Selection harness venue_can_see_submitted |
| F1 | Event assignment access | `event_vendor_assignments` | GREEN | Linked after submit |
| F2 | Vendor tasks | `event_tasks` owner/visibility vendor_* | GREEN | `vendor_owned` task created; notify “New task shared with you” |
| F3 | Documents share flag | `documents.shared_with_vendors` | GREEN | Column readable |
| F4 | Floor plans / handbook / timeline | Vendor event workspace modules | GREEN (code+prior) | Workspace exists; not every UI click re-driven this pass |
| G1 | Unclaimed fallback | Portal copy + RPC gate | GREEN | Unclaimed inquiry rejected; Flora-style unclaimed listed |
| H1 | Cross-tenant | RLS + anon queries | GREEN | Anon cannot list other venue relationships or read assignments |
| N1 | Notifications | `vendor_notifications` | GREEN | Inquiry + selection + task titles present (Sandbox records) |

### Intentionally not invented

- Parallel vendor directory / second status model.
- Marketing-site claim changes.
- Production email to real third-party vendors (Sandbox controlled identities + in-app `vendor_notifications`).
