# Venue Team Authorization Inventory — Wave 0 Freeze

**Status:** Frozen checklist for Team & Permissions migration. Generated from repository search. No behavior changes.

**Clarifications incorporated:**
1. DB-backed active venue is authoritative; cookie is convenience; disagree → DB wins; missing/invalid → fail closed (no LIMIT 1).
2. `venues.owner_user_id` temporary internal account contact only after ownership migration; ownership auth = `venue_staff.is_owner` only.
3. Team target-scope evaluates effective capabilities, not title label alone.
4. Last-Owner invariant requires transactional DB enforcement (Wave 4+).

- Venue-team inventory entries (file×kind): **436**
- Raw non-test pattern matches: **1266**
- Distinct non-test files: **299**
- Machine-checkable CSV: `docs/authorization/venue-authorization-inventory.csv`

## Scope separation

| Scope | Treatment |
|---|---|
| Venue staff (`lib/`, `app/(app)`, `components/`, venue RLS) | In scope |
| `workspace/` Program 4 HQ roles | **Excluded** — separate product |
| `marketing/` SaaS billing webhooks | Account/billing touchpoints flagged where venue-facing |

## owner_user_id classification (pre–Wave 2)

Every `owner_user_id` inventory row is classified:

| Class | Meaning | Count (file×kind rows) |
|---|---|---|
| d) obsolete ownership auth signal | see CSV `owner_user_id_class` | 62 |
| c) specific actor / needs review | see CSV `owner_user_id_class` | 14 |
| a) account contact or historical migration | see CSV `owner_user_id_class` | 10 |
| a) account contact | see CSV `owner_user_id_class` | 8 |
| b) all Owners / single-owner assumption | see CSV `owner_user_id_class` | 1 |

**Rule after ownership migration begins:** no path may authorize using `owner_user_id`. Reclassify remaining `d_*` to account-contact reads or delete.

## Wave distribution

| Wave | Entries | Focus |
|---|---|---|
| 2 | 135 | active venue |
| 4 | 93 | multi-owner/contact |
| 6 | 49 | sensitive conversion |
| 7 | 61 | staff/finance CRUD |
| 9 | 98 | role retirement |

## High-risk app/service paths (non-SQL)

| File | Kind | Target capability | Wave | Risk |
|---|---|---|---|---|
| `app/(app)/clients/[id]/floor-plans/[planId]/page.tsx` | getCurrentUserRole | events.floor_plans | 7 | H |
| `app/(app)/clients/[id]/page.tsx` | getCurrentUserRole | LEGACY_ROLE_RESOLUTION | 9 | H |
| `app/(app)/events/[id]/edit/page.tsx` | getCurrentUserRole | LEGACY_ROLE_RESOLUTION | 9 | H |
| `app/(app)/events/[id]/floor-plans/[planId]/page.tsx` | getCurrentUserRole | events.floor_plans | 7 | H |
| `app/(app)/events/[id]/seating-print/page.tsx` | getCurrentUserRole | events.floor_plans | 7 | H |
| `app/(app)/events/[id]/seating/page.tsx` | getCurrentUserRole | events.floor_plans | 7 | H |
| `app/(app)/layout.tsx` | getCurrentUserRole | LEGACY_ROLE_RESOLUTION | 9 | H |
| `app/(app)/library/floor-plan-templates/[id]/page.tsx` | getCurrentUserRole | events.floor_plans | 7 | H |
| `app/(app)/library/floor-plan-templates/page.tsx` | getCurrentUserRole | events.floor_plans | 7 | H |
| `app/(app)/payments/[id]/actions.ts` | refundLineItem_ | payments.refund | 6 | H |
| `app/(app)/payments/[id]/page.tsx` | getCurrentUserRole | LEGACY_ROLE_RESOLUTION | 9 | H |
| `app/(app)/reporting/saved/[id]/page.tsx` | getCurrentUserRole | reports.view|reports.schedule | 9 | H |
| `app/(app)/settings/actions.ts` | exportVenueData | data.export | 6 | H |
| `app/(app)/settings/availability/page.tsx` | getCurrentUserRole | settings.availability | 9 | H |
| `app/(app)/settings/commercial-booking-actions.ts` | getCurrentUserRole | settings.availability | 9 | H |
| `app/(app)/settings/leads/page.tsx` | getCurrentUserRole | LEGACY_ROLE_RESOLUTION | 9 | H |
| `app/(app)/setup-hub/lead-capture/page.tsx` | getCurrentUserRole | LEGACY_ROLE_RESOLUTION | 9 | H |
| `app/(app)/tasks/page.tsx` | getCurrentUserRole | LEGACY_ROLE_RESOLUTION | 9 | H |
| `app/(app)/tours/page.tsx` | canRefundTourFee | payments.refund | 6 | H |
| `app/(app)/tours/page.tsx` | getCurrentUserRole | LEGACY_ROLE_RESOLUTION | 9 | H |
| `app/api/internal/enrollment/activate/route.ts` | owner_user_id | OWNER_USER_ID_REF | 4 | H |
| `app/api/internal/product-access/lock/route.ts` | is_owner_eq | ownership.* / is_owner | 4 | H |
| `app/setup/actions.ts` | getCurrentUserRole | LEGACY_ROLE_RESOLUTION | 9 | H |
| `components/library/library-documents-manager.tsx` | current_user_venue_id | ACTIVE_VENUE_CONTEXT | 2 | H |
| `lib/activation/service.ts` | is_owner_eq | ownership.* / is_owner | 4 | H |
| `lib/booking-journey/setup-payments.ts` | getCurrentUserRole | LEGACY_ROLE_RESOLUTION | 9 | H |
| `lib/calendar/schedule-item-catalog-service.ts` | getCurrentUserRole | settings.availability | 9 | H |
| `lib/calendar/venue-schedule-catalog-2a1.db.sql` | owner_user_id | OWNER_USER_ID_REF | 4 | H |
| `lib/calendar/venue-schedule-catalog-2a23.db.sql` | owner_user_id | OWNER_USER_ID_REF | 4 | H |
| `lib/calendar/venue-schedule-catalog-2a24.db.sql` | owner_user_id | OWNER_USER_ID_REF | 4 | H |
| `lib/client-auth/service.ts` | current_user_venue_id | ACTIVE_VENUE_CONTEXT | 2 | H |
| `lib/clients/repository.ts` | current_user_venue_id | ACTIVE_VENUE_CONTEXT | 2 | H |
| `lib/contracts/service.ts` | getCurrentUserRole | contracts.venue_sign|documents.delete | 6 | H |
| `lib/conversations/repository.ts` | current_user_venue_id | ACTIVE_VENUE_CONTEXT | 2 | H |
| `lib/conversations/service.ts` | current_user_venue_id | ACTIVE_VENUE_CONTEXT | 2 | H |
| `lib/dashboard/service.ts` | is_owner_eq | ownership.* / is_owner | 4 | H |
| `lib/documents/storage-path.ts` | current_user_venue_id | ACTIVE_VENUE_CONTEXT | 2 | H |
| `lib/event-inventory/service.ts` | getCurrentUserRole | LEGACY_ROLE_RESOLUTION | 9 | H |
| `lib/events/service.ts` | getCurrentUserRole | LEGACY_ROLE_RESOLUTION | 9 | H |
| `lib/export/service.ts` | exportVenueData | data.export | 6 | H |
| `lib/export/service.ts` | get_venue_export | data.export | 6 | H |
| `lib/floor-plan-offers/service.ts` | getCurrentUserRole | events.floor_plans | 7 | H |
| `lib/floor-plan-templates/service.ts` | getCurrentUserRole | events.floor_plans | 7 | H |
| `lib/floor-plans/service.ts` | getCurrentUserRole | events.floor_plans | 7 | H |
| `lib/guests/service.ts` | current_user_venue_id | ACTIVE_VENUE_CONTEXT | 2 | H |
| `lib/inquiry-form/service.ts` | getCurrentUserRole | settings.venue_profile | 9 | H |
| `lib/invoices/service.ts` | getCurrentUserRole | LEGACY_ROLE_RESOLUTION | 9 | H |
| `lib/leads/repository.ts` | current_user_venue_id | ACTIVE_VENUE_CONTEXT | 2 | H |
| `lib/luv/drafts.ts` | is_owner_eq | ownership.* / is_owner | 4 | H |
| `lib/metrics/revenue.ts` | current_user_venue_id | ACTIVE_VENUE_CONTEXT | 2 | H |
| `lib/migration/active-commitment-e2e.db.sql` | owner_user_id | OWNER_USER_ID_REF | 4 | H |
| `lib/migration/cutover-e2e.db.sql` | owner_user_id | OWNER_USER_ID_REF | 4 | H |
| `lib/migration/service.ts` | getCurrentUserRole | LEGACY_ROLE_RESOLUTION | 9 | H |
| `lib/onboarding/operator-session.ts` | current_user_venue_id | ACTIVE_VENUE_CONTEXT | 2 | H |
| `lib/onboarding/operator-session.ts` | is_owner_eq | ownership.* / is_owner | 4 | H |
| `lib/onboarding/white-glove-handoff.ts` | is_owner_eq | ownership.* / is_owner | 4 | H |
| `lib/onboarding/white-glove-handoff.ts` | owner_user_id | OWNER_USER_ID_REF | 4 | H |
| `lib/payments/service.ts` | getCurrentUserRole | LEGACY_ROLE_RESOLUTION | 9 | H |
| `lib/payments/service.ts` | refundLineItem_ | payments.refund | 6 | H |
| `lib/provisioning/workspace.ts` | is_owner_eq | ownership.* / is_owner | 4 | H |
| `lib/provisioning/workspace.ts` | is_owner_true | ownership.* / is_owner | 4 | H |
| `lib/provisioning/workspace.ts` | owner_user_id | OWNER_USER_ID_REF | 4 | H |
| `lib/saved-reports/service.ts` | getCurrentUserRole | reports.view|reports.schedule | 9 | H |
| `lib/scheduled-messages/repository.ts` | is_owner_eq | ownership.* / is_owner | 4 | H |
| `lib/seating/service.ts` | getCurrentUserRole | events.floor_plans | 7 | H |
| `lib/stripe/refunds.ts` | refundLineItem_ | payments.refund | 6 | H |
| `lib/stripe/webhook-handlers.ts` | markLineItemPaid | payments.refund | 6 | H |
| `lib/stripe/webhook-handlers.ts` | refundLineItem_ | payments.refund | 6 | H |
| `lib/team/service.ts` | canManageStaff | team.invite|team.change_access|team.remove | 6 | H |
| `lib/team/service.ts` | getCurrentUserRole | team.invite|team.change_access|team.remove | 6 | H |
| `lib/texting-registration/service.ts` | getCurrentUserRole | settings.texting | 6 | H |
| `lib/tours/protection-rules.ts` | canRefundEventPayment | payments.refund | 6 | H |
| `lib/tours/protection-rules.ts` | canRefundTourFee | payments.refund | 6 | H |
| `lib/tours/protection.ts` | canRefundTourFee | payments.refund | 6 | H |
| `lib/tours/protection.ts` | getCurrentUserRole | LEGACY_ROLE_RESOLUTION | 9 | H |
| `lib/tours/tour-booking-atomicity.db.sql` | owner_user_id | OWNER_USER_ID_REF | 4 | H |
| `lib/tours/tour-capacity-write.db.sql` | owner_user_id | OWNER_USER_ID_REF | 4 | H |
| `lib/vendor-events/service.ts` | current_user_venue_id | ACTIVE_VENUE_CONTEXT | 2 | H |
| `lib/vendor-partnerships/service.ts` | current_user_venue_id | ACTIVE_VENUE_CONTEXT | 2 | H |
| `lib/vendors/list-presentation.ts` | current_user_venue_id | ACTIVE_VENUE_CONTEXT | 2 | H |
| `lib/vendors/repository.ts` | current_user_venue_id | ACTIVE_VENUE_CONTEXT | 2 | H |
| `lib/venue/repository.ts` | current_user_venue_id | ACTIVE_VENUE_CONTEXT | 2 | H |
| `lib/venue/repository.ts` | is_owner_eq | ownership.* / is_owner | 4 | H |
| `lib/venue/repository.ts` | owner_user_id | OWNER_USER_ID_REF | 4 | H |
| `lib/venue/service.ts` | getCurrentUserRole | LEGACY_ROLE_RESOLUTION | 9 | H |

## How to re-verify

```bash
rg -n 'getCurrentUserRole\(|current_user_role\(|current_user_venue_id\(|canManageStaff|owner_user_id|is_owner' lib app components supabase/migrations
```

Compare against CSV; any new hit without an inventory row blocks Wave progression.
