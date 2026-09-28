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

## Inventory (MERGE_FIELDS) — historical 2026-09-26

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

---

## Starter Template / Smart Field Catalog Defect

**Date:** 2026-09-28  
**Trigger:** Jennifer independent browser acceptance — contract shows Remaining $11,250 in package summary while Balance says “Balance remaining is not listed yet.” Starter template / picker still advertise operational Smart Fields that are not intended as the customer-facing catalog.  
**Prior GREEN claim:** VOID. STATUS = NOT GREEN.

### A–N forensic answers

| # | Question | Authoritative answer |
| --- | --- | --- |
| A | Where starter templates are defined | Code master: `lib/contracts/starters.ts` → `WEDDING_VENUE_AGREEMENT_CONTENT` / `CONTRACT_STARTER_MASTERS` (`CTR-01`) |
| B | Where seeded for a venue | `lib/contracts/provision.ts` → `provisionContractStarters` / `seedContractStarters` inserts into `contract_templates` with `source_master_key = 'CTR-01'` |
| C | Where existing rows live | `public.contract_templates` (per venue). Jen's Fancy: `6260b3e1-87a9-4e14-a10a-e1cf9756892b` |
| D | Sandbox starter IDs | `6260b3e1…` — name “Wedding Venue Agreement”, `is_default=true`, `source_master_key='CTR-01'` |
| E | Copied vs dynamic | **Copied.** Masters are code fixtures; venue Library rows are independent DB content. Provision skips if `source_master_key` or same name already exists — **does not refresh content**. |
| F | Multiple sources? | Yes: (1) code master, (2) persisted Library row(s). Picker is a third surface (`MERGE_FIELDS`). They drifted. |
| G | Picker source | `MERGE_FIELDS` in `lib/contracts/constants.ts` → `components/contracts/contract-builder.tsx` (`MERGE_FIELDS.map`) and template form |
| H | Supported allowlist | Same `MERGE_FIELDS` array (picker = advertised catalog) |
| I | Descriptions/help | `MergeFieldMeta.description` on each `MERGE_FIELDS` entry |
| J | Merge acceptance | `buildContractMergeData` (`lib/contracts/service.ts`) + `buildMergeData` (`lib/contracts/merge.ts`). Legacy always-resolve for access/ceremony/reception/balance |
| K | Other references | Message templates use separate `MESSAGE_MERGE_FIELDS` (keep `coordinator_name` there — out of scope). Contract tests assert many of the operational keys |
| L | Picker-only change? | **Insufficient.** Persisted Sandbox starter still contains obsolete tokens; drafts cloned from it stay polluted |
| M | Code-starter-only change? | **Insufficient.** Provision never overwrites existing `CTR-01` rows |
| N | Reintroduction risk | `addContractStarterAgain` / new-venue `seedContractStarters` re-copy code master — must fix master **and** migrate existing `source_master_key` rows |

### Balance contradiction (exact paths)

| Surface | Value | Source |
| --- | --- | --- |
| Package / SERVICES section (`{{package_section}}`) | `Remaining: $11,250.00` | `formatPackageSection` ← `commercial_selections.total_amount − deposit_amount` |
| Balance section (`{{balance_remaining}}`) | `Balance remaining is not listed yet.` | `formatBalanceRemaining(computePortalScheduleTotals(…).remaining)` **only when a payment_schedules row exists for the event** |

When no payment schedule exists, balance falls back to `MISSING_BALANCE_REMAINING` even though selection deposit/total already imply remaining. **Two financial paths for the same concept.** Proven on signed Rebecca contract and Jennifer’s Wilma-style render.

### Persisted Sandbox starter tokens (live `6260b3e1…`)

`event_spaces`, `venue_access_hours`, `ceremony_summary`, `reception_summary`, `coordinator_name`, `package_section`, `included_items_summary`, `additional_items_summary`, `payment_schedule_summary`, `contract_total`, `balance_remaining` (+ core identity fields).

Code master (`starters.ts` at audit time) already diverged: ceremony/hours are policy placeholders; **no** `{{balance_remaining}}`. Sandbox Library still has the polluted sync from the prior Smart Field pass.

### Product decision (locked 2026-09-28)

1. Starter templates contain **only** intentionally supported Smart Fields.  
2. Unsupported / problematic fields removed from starter **content**, picker, catalog, seed, and migrations that recreate old content.  
3. Do not “fix” by leaving dead fields that only render fallbacks.  
4. Existing `source_master_key = 'CTR-01'` rows must be migrated.  
5. Customer-authored templates (`source_master_key` null) are **not** mutated.  
6. Resolvers may remain for **legacy** drafts that still contain removed tokens (no raw `{{token}}` at Preview/Send), but those keys must not be advertised.

### Keep / remove matrix (authoritative)

| Field | In picker (pre) | In Sandbox starter | Resolver | Authoritative SoT? | Useful as catalog field? | **Decision** | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- |
| venue_name | Y | Y | Y | venues.name | Y | **KEEP** | Core party identity |
| venue_address | Y | Y | Y | venue address | Y | **KEEP** | Core |
| venue_phone | Y | Y | Y | venues.phone | Y | **KEEP** | Core |
| venue_email | Y | Y | Y | venues.email | Y | **KEEP** | Core |
| client_name | Y | Y | Y | required signers / primary | Y | **KEEP** | Core party |
| first_name | Y | N | Y | clients.first_name | Y | **KEEP** | Picker-only OK |
| last_name | Y | N | Y | clients.last_name | Y | **KEEP** | Picker-only OK |
| client_email | Y | Y | Y | clients.email | Y | **KEEP** | Core |
| client_phone | Y | Y | Y | clients.phone | Y | **KEEP** | Core |
| event_name | Y | Y | Y | events.name | Y | **KEEP** | Core event |
| event_date | Y | Y | Y | event/client date | Y | **KEEP** | Core event |
| event_type | Y | Y | Y | event/client type | Y | **KEEP** | Core event |
| guest_count | Y | Y | Y | event/client guests | Y | **KEEP** | Core event |
| today_date | Y | Y | Y | generation time | Y | **KEEP** | Signature date |
| contract_title | Y | N | Y | contract title | Y | **KEEP** | Meta |
| event_spaces | Y | Y | Y | assignments / space_id | Partial | **REMOVE** | Not intentional catalog; polluted starter |
| venue_access_hours | Y | Y | Y | event times | Partial | **REMOVE** | Often empty → fallback noise |
| ceremony_summary | Y | Y | Y | final_details / assignments | Partial | **REMOVE** | Same |
| reception_summary | Y | Y | Y | final_details / assignments | Partial | **REMOVE** | Same |
| coordinator_name | Y | Y | Y | venue ownerName | Weak | **REMOVE** | Not reliable “coordinator” SoT |
| package_section | Y | Y | Y | commercial_selections | Y* | **REMOVE** | Embeds Remaining that fights Balance; not catalog |
| included_items_summary | Y | Y | Y | selection / order | Y* | **REMOVE** | Package detail not starter catalog |
| additional_items_summary | Y | Y | Y | order custom lines | Partial | **REMOVE** | Same |
| payment_schedule_summary | Y | Y | Y | payment_schedules | Only if schedule | **REMOVE** | “No schedule” vs known selection totals |
| contract_total | Y | Y | Y | selection / schedule | Y* | **REMOVE** | Belongs with venue payment terms until schedule SoT is productized |
| balance_remaining | Y | Y | Y | **schedule only** | Broken | **REMOVE** | Contradicts package Remaining; must not be advertised |
| vendors_on_file | N | N | fallback | none | N | **DEFERRED** | Already out of picker |

\* Resolver quality is not enough to keep a field in the customer-facing catalog.

### Remediation plan (implementation follows this audit)

1. Shrink `MERGE_FIELDS` to KEEP list only.  
2. Rewrite `WEDDING_VENUE_AGREEMENT_CONTENT` to use only KEEP tokens; package/payment/spaces/schedule sections become venue-policy placeholders.  
3. Idempotent migration: `UPDATE contract_templates SET content = <new master> WHERE source_master_key = 'CTR-01'`.  
4. Legacy resolution: keep resolving removed keys in `buildMergeData` / `buildContractMergeData` for old drafts; **fix `balance_remaining` SoT** to use selection remaining (`total − deposit`) when no payment schedule exists so in-flight polluted content is not contradictory.  
5. Tests: catalog/picker/starter/migration/balance consistency + signer regressions.  
6. Deploy + human-facing proof on exact image — only then GREEN.

---

## 2026-09-28 product correction (supersedes KEEP/REMOVE matrix above)

Jennifer locked: remove only fields with **no reliable source**. Preserve and repair fields with real booking/proposal SoT.

`22f09ea4` overcorrected. The matrix rows that marked `event_spaces`, `package_section`, included/additional items, `payment_schedule_summary`, `contract_total`, and `balance_remaining` as **REMOVE** are **void**.

Authoritative table and A/B/C/D: `docs/qa/contract-smart-field-system/RECONCILIATION.md`.
