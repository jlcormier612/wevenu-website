# Contract Builder — Required Signers + Smart Field Scope

**Status:** AUDIT (pre-implementation)  
**Production:** untouched

## 1. Signer model (current)

### Data

- `contract_signers` rows: `signer_type` venue|client, `is_required`, per-row `sign_token`, `signer_email`, optional `client_contact_id`.
- Create path: `resolveClientSignerSeeds` → `insertContractSigners` (1 venue placeholder + N required clients).
- Send: `sendContractInviteEmails` emails **each** required client signer their own `/sign/{token}`.
- Client sign RPC (`sign_contract_signer`): client-first; when all required clients signed → stays `sent` (Awaiting Venue Signature); does **not** Fully Execute.
- Venue countersign → Fully Executed.

### Lifecycle (locked — preserve)

`Draft → Sent to Client → Awaiting Venue Signature → Fully Executed`

### Gap

| Layer | Reality |
|---|---|
| Client picker | One row per `clients` relationship (`"Lydia & Ali"`). |
| People with emails | Often on `clients.email` + `clients.partner_email`, **not** `client_contacts`. Fancy couples (e.g. Belle & Gaston) have **0 contacts**. |
| Builder UX | Required Signers only when `client_contacts` with email **length > 1**. Otherwise never shown. |
| Default seed | Single signer from primary contact **or** `clients.email` — relationship treated as one signer. |
| Draft reopen | Read-only signer list; cannot change required clients before send. |

**Conclusion:** Backend multi-signer + per-email tokens already exist. UX/seed resolution does not surface relationship people (primary + partner) when contacts are empty/sparse.

## 2. Smart Fields — registry vs contract-time source

| Token | Materialization source today | Legitimate at contract author/send? |
|---|---|---|
| `venue_*`, `today_date`, `contract_title` | Venue profile / now | **Yes** |
| `client_*`, `couple_name`, `primary_contact_*`, `first/last/full_name` | Client record | **Yes** |
| `event_name/date/type`, `guest_count` | Client / event | **Yes** (known at booking) |
| `event_spaces` | Assignments / space_id / lead planned | **Yes** if already chosen; omit when empty |
| `coordinator_name` | Venue owner | **Yes** |
| `package_section`, `included_items_summary` (package), `payment_schedule_summary`, `contract_total` | Selected Package / payment schedule | **Yes** when package exists |
| `venue_access_hours` | Event start/end/setup/teardown | **No** — operational schedule, often later |
| `ceremony_summary`, `reception_summary` | Final-details questionnaire | **No** — post-booking |
| `vendors_on_file` | `event_vendor_assignments` | **No** — post-booking |
| `balance_remaining` | Paid vs schedule **or** total−deposit projection | **No** — payment-state / not authored SoT |
| Inventory lines inside `included_items_summary` | Event Order `provenance=inventory` | **No** — assigned inventory later |

**Product rule:** Smart Field only if SoT exists at author/send. Do not invent upstream sources. Venue boilerplate belongs in the template body.

## 3. Implementation plan (this track)

1. Build signer **candidates** from contacts **plus** client primary/partner when they have emails; never treat the couple display name as one signer.
2. Always show Required Signers when a client is selected; disabled rows when a named person has no email.
3. Allow updating required client signers on **draft** before send.
4. Trim `MERGE_FIELDS` + starter tokens for deferred fields; stop filling fake defaults for them; package-only included items.
5. Preserve token-preserving draft/preview and client-first lifecycle. Sandbox only.
