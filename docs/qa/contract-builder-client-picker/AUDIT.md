# Contract Builder client picker — forensic + lifecycle fix

**Production:** untouched  
**Sandbox host:** `wvpsldwwjqdannqasrdf.supabase.co`  
**Venue:** Fancy (`a415ac52-cd74-42a6-8df7-7a8f6e71d080`)

## 1. Root cause — why Popeye was absent

The lead/workspace name is `leads`. The Contract Builder label is `clients` via `clientDisplayName`.

Popeye is **already a client**. The lead was renamed. The linked client was not.

| Record | ID | Name |
|---|---|---|
| Lead | `19e55130-e324-470a-926a-8fc9ff0eed69` | Popeye Spinach & Olive Oil |
| Linked client | `33c9c065-9783-4813-9fec-43b2398e8904` | Preview Ux930835 |
| Relationship on client | `34a9d8d4-a15d-4ea9-a301-19bb815868d4` | Preview Ux930835 |
| `leads.relationship_id` | null | — |

`clients.lead_id` = Popeye lead. Same customer. Picker listed **Preview Ux930835**, not Popeye.

`updateLeadInfo` wrote `leads` and (when `leads.relationship_id` was set) `venue_customer_relationships`. It did **not** write `clients`. This lead’s `relationship_id` was null, so the relationship stay stale too.

No second client was created. Popeye was not missing as a row — the row still had the old name.

## 2. Canonical source of truth

| Layer | Table | Role |
|---|---|---|
| Enduring identity | `venue_customer_relationships` | Name/email for inbox/identity |
| Inquiry | `leads` | Pipeline opportunity; edit surface before / during commercial-only ensure |
| Operational customer | `clients` | Booking person. `contracts.client_id`, events, payment plans, signers |
| Link | `clients.lead_id` unique | Same customer after convert / `ensureCommercialCustomerForSelection` |
| Booking | `events.client_id` | Occupying event |
| Contract | `contracts.client_id` | Stable association |

**Contract Builder canonical customer is the `clients` row** (`contracts.client_id`). A rename must update that same row, not create another client and not search `leads` independently.

After commercial-only ensure, the venue still edits the **lead**. That write must keep the linked client (and relationship) on the current identity.

After the venue edits the **client** workspace, `updateClientInfo` already writes `clients` + relationship and does not rewrite the historical lead inquiry. That remains correct.

## 3. Lifecycle

Lead created → optional quiet `ensureCommercialCustomerForSelection` / `convertLeadToClient` inserts **one** `clients` row with `lead_id` → optional Event (`events.client_id`) → Contract Builder selects that `client_id`.

Lead identity edit → `leads` + linked `clients` (same id) + relationship.

## 4. Rename behavior (now)

`updateLeadInfo`:

- updates `leads` identity
- updates the existing `clients` row where `clients.lead_id = lead.id` (identity only; no insert)
- updates `venue_customer_relationships` using `leads.relationship_id` or the linked client’s `relationship_id`
- heals `leads.relationship_id` when it was null and the client already has one

Client IDs, bookings, contracts, signers, payment plans, portals are not rewritten.

## 5. Picker eligibility

`getSelectableContractClients()` — state/relationship only. **No name-string filter.**

A client is selectable for a **new** contract when:

1. `status !== 'cancelled'`
2. `exclude_from_business_reporting` is not true
3. Current standing: linked lead is not lost/cancelled, **or** has an event, **or** has a contract, **or** has a payment schedule

Deep-link / selection `clientId` is still included unless cancelled (`ensureContractPickerClient`).

`getClients()` is unchanged (Clients CRM list, invoices, etc.).

## 6. Why previously visible stale rows drop

| Row | Why excluded |
|---|---|
| Cancelled client | `cancelled` |
| Reporting-excluded fixture | `reporting_excluded` (flag, not a name match) |
| Preview Ux912156 (no lead, no event, no contract, no plan) | `no_current_standing` |
| Green* probes with no lead/event/contract/plan | `no_current_standing` |
| Lost/cancelled lead leftover with no booking/contract/plan | `no_current_standing` |

Green* rows that still have a contract or live lead remain selectable — they have commercial standing. They are not hidden because the name contains “Green”.

Colby `e6097b70-…` (real dogfood, 5 contracts, not reporting-excluded) remains selectable.

Cindy Loo Hoo `2a1a3172-…` (live lead `proposal_sent`) remains selectable.

## 7. Duplicates / orphans — report only, no merge

No automatic merge or delete.

**Popeye / Preview Ux930835** — not a duplicate. One lead, one client, stale client name. Fix is identity propagate on the existing client id.

**Colby (two rows)** — do not merge:

| Client | Email | Flag | Lead | Standing |
|---|---|---|---|---|
| `cd0bfb86-d6b1-4998-860c-aae42f0f2c97` | commercial-spine-e2e3-colby@hellotocheers.com | reporting-excluded | `41ddc42b-…` now “Emma Carter & Jason Harrington” | event + 1 contract |
| `e6097b70-3018-4392-a7db-79d0c40f805e` | jyagnesak@yahoo.com | false | none | 5 contracts |

The excluded row is an E2E client whose originating lead was later renamed to Emma. Propagating Emma onto that client would destroy Colby’s booking identity. Live `updateLeadInfo` only runs when someone edits that lead. No backfill. Picker hides the excluded row via the reporting flag.

**Leo Park** `582cecac-…` vs lead “Leo Park & Maria Stark” — partner drift; not merged.

**Orphans:** 16 clients with no lead, no event, no contract. Excluded from the new-contract picker via `no_current_standing`. Rows left in place.

## 8. Code changes

- `lib/clients/contact-edit.ts` — `linkedClientIdentityPatch`
- `lib/clients/contract-picker.ts` — eligibility
- `lib/clients/repository.ts` — `getSelectableContractClients` (read-only)
- `lib/clients/service.ts` — `getSelectableContractClients`, `ensureContractPickerClient`
- `lib/leads/repository.ts` — `updateLeadInfo` identity propagate
- `app/(app)/contracts/new/page.tsx` — picker source

## 9. Data changes

None. No migration. No Production write. No Sandbox identity UPDATE except what a venue lead-save performs.

## 10. Tests

See `lib/clients/contract-picker.test.ts`, `lib/clients/contact-workspace.test.ts`, `lib/leads/lead-workspace-reliability.test.ts`, plus existing multi-signer / token / Smart Field tests.
