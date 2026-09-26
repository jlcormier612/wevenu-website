# Contract Smart Field System — Forensic Audit + Fix

**Date:** 2026-09-26  
**Production:** untouched  
**Verdict (code):** systemic always-resolve shipped; live GREEN gated on ECS + browser

## Root systemic defect

`buildMergeData` used `setIfPresent` for several picker fields. Missing values omitted the key → `mergeContent` left raw `{{token}}`.

Confirmed killer for `event_spaces`:

```ts
if (eventSpaces === EMPTY_EVENT_SPACES_LABEL) {
  eventSpaces = ""; // then omitted from MergeData → raw {{event_spaces}}
}
```

Preview/Review/Send share `materializeAuthoredContractContent` → all paths could emit raw tokens.

## Inventory (MERGE_FIELDS)

| FIELD | PICKER | DEFAULT TEMPLATE | AUTHORITATIVE SOURCE | RESOLVER | ALWAYS FALLBACK | STATUS |
| --- | --- | --- | --- | --- | --- | --- |
| venue_name | Y | Y | venues.name | buildContractMergeData | Your venue | RETAINED |
| venue_address | Y | Y | venues address lines | buildContractMergeData | Address on file… | RETAINED |
| venue_phone | Y | Y | venues.phone | buildContractMergeData | Phone on file… | RETAINED |
| venue_email | Y | Y | venues.email | buildContractMergeData | Email on file… | RETAINED |
| client_name | Y | Y | required client signers (or primary) | requiredClientSignerNames | Client | RETAINED |
| first_name | Y | N* | clients.first_name | buildMergeData | First name is not listed yet. | RETAINED |
| last_name | Y | N* | clients.last_name | buildMergeData | Last name is not listed yet. | RETAINED |
| client_email | Y | Y | clients.email | buildContractMergeData | Email on the client record | RETAINED |
| client_phone | Y | Y | clients.phone | buildContractMergeData | Phone on the client record | RETAINED |
| event_name | Y | Y | events.name | buildContractMergeData | Your celebration | RETAINED |
| event_date | Y | Y | events.event_date / clients.event_date | formatContractDate | Date to be confirmed | RETAINED |
| event_type | Y | Y | events/clients.event_type | pretty | Celebration | RETAINED |
| guest_count | Y | Y | events/clients.guest_count | String | To be confirmed | RETAINED |
| event_spaces | Y | Y | event_space_assignments → Event.space_id → lead.planned | resolveEventSpacesLabel | No event spaces are listed… | **FIXED** (was raw token) |
| venue_access_hours | Y | Y† | event setup/start/end/teardown | formatVenueAccessHours | Venue access hours are not listed yet. | RETAINED |
| ceremony_summary | Y | Y† | final_details questionnaire + space use | formatCeremonyOrReceptionSummary | Ceremony details are not listed yet. | RETAINED |
| reception_summary | Y | Y† | final_details questionnaire + space use | formatCeremonyOrReceptionSummary | Reception details are not listed yet. | RETAINED |
| coordinator_name | Y | Y | venue owner name | getVenueFullDetails | Your venue team | RETAINED |
| package_section | Y | Y | commercial_selections (preferred) / event order | formatPackageSection | No package is currently selected… | RETAINED |
| included_items_summary | Y | Y | selection included / package order lines | buildContractMergeData | No included items… | RETAINED |
| additional_items_summary | Y | Y | event order custom lines | buildContractMergeData | No additional… | RETAINED |
| payment_schedule_summary | Y | Y | payment_schedules for event | getPaymentSchedule | No payment schedule is on file… | RETAINED (honest; no invent) |
| contract_total | Y | Y | selection.totalAmount or schedule.total | formatContractTotalAmount | Total contracted amount is not listed yet. | RETAINED |
| balance_remaining | Y | Y† | portal schedule totals.remaining | formatBalanceRemaining | Balance remaining is not listed yet. | RETAINED (honest; no invent) |
| today_date | Y | Y‡ | generation time | Date | always | RETAINED |
| contract_title | Y | N* | contract title input | buildMergeData | Agreement | RETAINED |

\* Available in picker; not required in every starter section.  
† Now in code starter (aligned with Sandbox Library).  
‡ Used in acknowledgment / signature date contexts as needed.

### Deferred (not picker)

| FIELD | STATUS |
| --- | --- |
| vendors_on_file | Deferred — honest fallback only; never invents vendors |

### Fields removed from picker

None this pass — every picker field now has SoT + always-resolve.  
(vendors_on_file already deferred.)

## Default template changes

- EVENT SCHEDULE uses `{{venue_access_hours}}`, `{{ceremony_summary}}`, `{{reception_summary}}`, `{{event_spaces}}` (Smart Fields, not policy placeholders).
- PAYMENT adds `{{balance_remaining}}`.
- Sandbox Library template `6260b3e1…` synced to code starter.

## Architecture

```
Preview / Review / Send
  → materializeAuthoredContractContent
    → requiredClientSignerNames (persisted signers on Send)
    → buildContractMergeData (domain SoT)
    → buildMergeData (every MERGE_FIELDS key + fallbacks)
    → mergeContent
    → applyRequiredSignerSignatureBlocks
```

Invariant: `mergeDataCoversPickerFields(data) === true`.

## Tests

`npx tsx --test 'lib/contracts/*.test.ts'` → **142/142 pass**
