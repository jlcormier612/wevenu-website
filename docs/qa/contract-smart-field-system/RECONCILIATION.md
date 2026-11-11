# Contract Smart Field reconciliation (post-22f09ea4)

**Date:** 2026-09-28  
**Rule:** A Contract Smart Field is allowed only when a real authoritative source exists.  
**Rule:** Do not remove a field merely because an earlier implementation had a fallback or a sibling-field bug.

`22f09ea4` overcorrected. It treated “catalog usefulness” and “one balance representation was wrong” as reasons to delete event space, package, amount, and payment fields that already have booking/proposal SoT.

---

## Reconciliation table

| Field | Keep/Remove | Authoritative source | Exists in proposal? | Exists in booking? | Exists in contract materialization? | Why |
| --- | --- | --- | --- | --- | --- | --- |
| venue_name | **KEEP** | Venue customer-facing name (`venues.name` / brand helper) | Yes | Yes | Yes — `buildContractMergeData` | Party identity. Never in dispute. |
| venue_address | **KEEP** | Venue profile address lines | Yes | Yes (venue) | Yes | Venue identity. |
| venue_phone | **KEEP** | Venue profile phone | Yes | Yes (venue) | Yes | Venue identity. |
| venue_email | **KEEP** | Venue profile email | Yes | Yes (venue) | Yes | Venue identity. |
| client_name | **KEEP** | Required client signer(s), else primary contact | Yes | Yes | Yes — `requiredClientSignerNames` | Required signer identity. |
| first_name | **KEEP** | Primary client contact first name | Yes | Yes | Yes | Client identity. |
| last_name | **KEEP** | Primary client contact last name | Yes | Yes | Yes | Client identity. |
| client_email | **KEEP** | Client record email | Yes | Yes | Yes | Client identity. |
| client_phone | **KEEP** | Client record phone | Yes | Yes | Yes | Client identity. |
| event_name | **KEEP** | Event name | Yes | Yes | Yes | Event identity. |
| event_date | **KEEP** | Event / booking date | Yes | Yes | Yes | Required booking date. |
| event_type | **KEEP** | Event / client event type | Yes | Yes | Yes | Booking attribute. |
| guest_count | **KEEP** | Event / client guest count | Yes | Yes | Yes | Booking attribute. |
| event_spaces | **KEEP** | `event_space_assignments` → `Event.space_id` → `leads.planned_event_space_id` → `venue_spaces.name` | Yes — selected space is on the proposal | Yes — required/selected on the booking | Yes — `resolveEventSpacesLabel` | Real selected space. `22f09ea4` removed this incorrectly. Empty-state copy only when no space is set. |
| package_section | **KEEP** | Active `commercial_selections` (`formatPackageSection`) else Event Order package lines | Yes — selected package | Yes | Yes | Real selected package. Do not remove because Remaining once disagreed with Balance. |
| included_items_summary | **KEEP** | `selection.includedItems` when present; else Event Order `provenance = package` lines | Yes when the package lists them | Yes when the order lists them | Yes | Authoritative when the selected package/order has items. Honest empty copy when it does not. |
| additional_items_summary | **KEEP** | Event Order `provenance = custom` lines | Yes when add-ons exist | Yes when add-ons exist | Yes | Authoritative custom/add-on lines. Honest empty copy when none. |
| payment_schedule_summary | **KEEP** | `payment_schedules` + line items for the event | Yes when a plan exists | Yes when a plan exists | Yes | Real schedule when one exists. Honest “no schedule on file” when none. Not invented. |
| contract_total | **KEEP** | `commercial_selections.total_amount`; if no selection, schedule `totalAmount` | Yes — package/order amount | Yes | Yes | Real contracted/selected amount. Same value every occurrence. |
| balance_remaining | **KEEP (repair)** | Dual-source: schedule `totals.remaining` when a plan exists; else `remainingAmount(selection.total, deposit)` | Yes (amount − deposit, or schedule remaining) | Yes | Yes — already repaired in `service.ts` | Must not invent a balance. Must not be deleted because the old schedule-only path was wrong. |
| today_date | **KEEP** | Generation date | n/a | n/a | Yes | Supported. |
| contract_title | **KEEP** | Contract title | n/a | n/a | Yes | Supported. |
| venue_access_hours | **REMOVE** | Event setup/start/end/teardown *when filled* | Not a required proposal field | Not reliably present | Resolver only (legacy drafts) | Promised “access hours” are not consistently on the booking. Policy placeholder in starter. |
| ceremony_summary | **REMOVE** | Final-details questionnaire + optional ceremony assignment | Not required on proposal | Not consistently present | Resolver only (legacy drafts) | Implied ceremony program data is not a booking SoT. |
| reception_summary | **REMOVE** | Final-details questionnaire + optional reception assignment | Not required on proposal | Not consistently present | Resolver only (legacy drafts) | Same as ceremony. |
| coordinator_name | **REMOVE** | Current resolver uses `getVenueFullDetails().ownerName` | No assigned-coordinator field on proposal | No reliable assigned coordinator at contract time | Resolver only (legacy) | Venue owner name is **not** the booking coordinator. That is not an authoritative source for the promised field. |
| vendors_on_file | **DEFERRED** | None at contract time | No | No | Fallback only | Already out of picker. |
| couple_name / partner_name / full_name / primary_contact_name | **REMOVE (already gone)** | None — aliases | No | No | No | Duplicate/invented name fields. Unrelated to this restore. |

---

## A / B / C / D

### A. Incorrectly removed by `22f09ea4`

Restore to picker, starter, seed, and Sandbox `CTR-01`:

- `event_spaces`
- `package_section`
- `included_items_summary`
- `additional_items_summary`
- `payment_schedule_summary`
- `contract_total`
- `balance_remaining`

### B. Should remain removed

- `venue_access_hours`
- `ceremony_summary`
- `reception_summary`
- `coordinator_name` (resolver is venue owner, not assigned coordinator)

### C. Implementation needs repair, not removal

- **`balance_remaining` dual-source** — already in `buildContractMergeData`: selection `remainingAmount(total, deposit)` first; payment-schedule remaining overrides when a plan exists. Preserve. Never invent.
- **One materialization path** — Preview / Review / Send already share `materializeAuthoredContractContent` → one `buildContractMergeData` map → `mergeContent` global replace. Duplicate tokens (`{{contract_total}}`, `{{balance_remaining}}`, `{{event_spaces}}`) resolve to the same value.
- **Why payment appeared in one place but not another** — `package_section` embeds Remaining from the selection; old `balance_remaining` only filled from a payment schedule. That is a sourcing bug, not a reason to delete payment fields.
- **`event_spaces` empty-label bake** — `replaceEmptyEventSpacesLabel` still repairs Preview-baked empty copy once the real space is known.

### D. Exact starter-template changes

1. **Code master** `lib/contracts/starters.ts` (`CTR-01`): put booking-backed tokens back in Event Spaces / Package / Included / Payment. Keep ceremony / access-hour **policy placeholders**. Do not add `coordinator_name`, `venue_access_hours`, `ceremony_summary`, or `reception_summary` tokens.
2. **New migration** `20261408100000_contract_starter_ctr01_restore_booking_smart_fields.sql`: `UPDATE contract_templates SET content = <master> WHERE source_master_key = 'CTR-01'`. Customer-authored rows (`source_master_key IS NULL`) untouched.
3. **Provision**: refresh existing `CTR-01` rows that still have the `22f09ea4` / `078` stripped body (missing required booking tokens) **or** still contain removed tokens.
4. **Picker**: `MERGE_FIELDS` matches KEEP list. `REMOVED_MERGE_FIELD_KEYS` is only B.
5. **Legacy resolvers** for B remain so older drafts never emit raw tokens.

Duplicate tokens in the restored starter (intentional consistency proof):

- `{{event_spaces}}` — Event details + Venue & Event Spaces
- `{{contract_total}}` — Services & Package + Payment
- `{{balance_remaining}}` — Payment + confirmation line
