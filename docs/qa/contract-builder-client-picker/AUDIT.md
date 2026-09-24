# Contract Builder client picker — forensic (no implementation)

**Status:** AUDIT ONLY — no picker/query code changed in the token-preserving draft work.  
**Production:** untouched

## Question

Why can the Contract Builder show stale / deleted / test names while a renamed current relationship is missing?

## Exact data source

`app/(app)/contracts/new/page.tsx` loads:

```ts
const [templates, clients] = await Promise.all([getTemplates(), getClients()]);
```

`getClients()` (`lib/clients/service.ts` → `lib/clients/repository.ts`):

```ts
client.from("clients").select("*").eq("venue_id", venueId)
  // optional: .eq("status", filters.status)
  // optional: name/email ilike
  .order("event_date", { ascending: true, nullsFirst: false })
```

The new-contract page passes **no filters**.

Picker labels are `clientDisplayName(firstName, lastName, partnerFirstName, partnerLastName)` from the **`clients` row**, not from `leads` and not from `venue_customer_relationships`.

## Why renamed records can be absent

| Surface | Table written |
|---|---|
| Lead workspace name edit | `leads` via `updateLeadInfo` — **does not write `clients`** |
| Client workspace name edit | `clients` + `venue_customer_relationships` (`updateClientInfo` / `relationshipContactPatch`) |

If the venue renamed the person on the **lead**, the Contract Builder still lists the **old `clients.*` name** (or a leftover test client), and the current lead name never appears as its own selectable row.

There is no picker query against `venue_customer_relationships` (the documented enduring customer identity, `clients.relationship_id`).

## Why deleted / test records remain selectable

`getClients()` does **not** exclude:

- `status = 'cancelled'`
- `exclude_from_business_reporting = true` (internal/E2E fixtures)
- orphaned `clients` rows after a lead-only delete
- historical converted clients that are no longer the active inquiry

`findActiveDuplicateClient` *does* exclude cancelled clients. The contract picker does not use that helper.

`deleteClientRecord` can remove a `clients` row (blocked if financial/signed-contract history exists). `deleteLeadRecord` is a separate path — a deleted lead can leave a `clients` row that still appears in the unfiltered picker.

## Existing contracts / historical identity

Contract **content** after Send stores resolved names (frozen customer-facing text). That must not retarget to a different person when a later rename happens.

Contract **workspace chrome** (`lib/contracts/repository.ts`) joins live `clients(first_name, last_name, partner_*)` for `clientName`. A later rename of that **same `client_id`** updates the header/list label. That is the same record, not a different person.

A draft still associated with `client_id` should keep that association. Preview/Send should resolve from that client row. Do not silently retarget `client_id` because a name changed.

## Canonical entity (recommendation for a later implementation — not done here)

The enduring relationship is `venue_customer_relationships`. Operational booking person records live on `clients`. Leads are inquiry-phase.

A future picker should likely list **current, non-deleted `clients` joined to a live relationship**, using the relationship/client current name, excluding cancelled/reporting-excluded fixtures unless explicitly requested — and must never rewrite an existing contract’s `client_id` on a rename.

## No code in this track

This audit is deliberately separate from the token-preserving Contract Builder implementation.
