# Hello to Cheers — Starter Message Library Implementation

**Status:** Implemented (Message starters only — not Questionnaire/Contract/etc.)  
**Date:** 2026-08-11  
**Product name:** Hello to Cheers  

Approved customer-facing copy lives in code as protected masters:

`lib/message-templates/starters.ts`

Do **not** rewrite that copy in this report or in code without a new product approval.

---

## 1. Final 11-message inventory

| Key | Name | Category | Subject |
|-----|------|----------|---------|
| MSG-01 | New Inquiry Response | `inquiry_follow_up` | Thank you for reaching out to {{venue_name}} |
| MSG-02 | Tour Confirmation | `tour` | Your tour at {{venue_name}} is confirmed |
| MSG-03 | Tour Reminder | `tour` | A reminder about your tour at {{venue_name}} |
| MSG-04 | Tour Follow-Up | `tour` | It was wonderful having you at {{venue_name}} |
| MSG-05 | Proposal Follow-Up | `inquiry_follow_up` | Checking in on your proposal from {{venue_name}} |
| MSG-06 | Contract Reminder | `booking_confirmation` | Your agreement with {{venue_name}} is ready to review |
| MSG-07 | Final Details Reminder | `planning_reminder` | A few final details for {{event_date}} |
| MSG-08 | Final Guest Count Reminder | `planning_reminder` | Final guest count for {{event_date}} |
| MSG-09 | Almost Here | `planning_reminder` | Your celebration at {{venue_name}} is almost here |
| MSG-10 | Payment Reminder | `payment_reminder` | Payment reminder from {{venue_name}} |
| MSG-11 | Post-Event Thank You | `post_event` | Thank you for celebrating with us |

**Production token bodies (as approved for ship):**

- MSG-02 body includes `{{tour_datetime}}` (preferred production rendering).  
- MSG-10 body includes `{{payment_amount}}` and `{{payment_due_date}}` (payment-context production body).  
- MSG-03 supports `{{tour_datetime}}` in the vocabulary; approved body does not require it.

---

## 2. Token matrix

| Token | Real today | Source | Resolution | Absent behavior |
|-------|------------|--------|------------|-----------------|
| `venue_name` | Yes | `venues.name` | Always in merge map | Empty string if venue missing (existing pattern) |
| `client_name` | Yes | Client/lead display name | Relationship merge context | Empty string |
| `coordinator_name` | Yes | Sending staff name when known; else venue owner / venue name | Conversation send prefers current staff | Empty string |
| `event_date` | Yes | Event or lead event date | Formatted long US date | Empty string → token blanked by known key |
| `days_until_event` | Yes | Computed from event date | Integer string | Empty string |
| `event_name` | Yes | Event name | Only added when non-empty | Token left literal if used without event |
| `tour_datetime` | Yes | `tour_appointments.scheduled_at` in venue timezone | Only added when a live appointment resolves | Token left literal → **send blocked** |
| `payment_label` | Yes | `payment_line_items.label` | Only when line resolves | Literal → send blocked |
| `payment_amount` | Yes | `payment_line_items.amount` via `formatMoney` | Only when line resolves | Literal → send blocked |
| `payment_due_date` | Yes | `payment_line_items.due_date` via `formatDate` | Only when line resolves | Literal → send blocked |
| `task_name` | Yes when provided | Explicit pin / compose opts | Only when set | Literal → send blocked |

Engine: `lib/shared-merge/tokens.ts` (unchanged mechanics).  
Vocabulary / `buildMergeData`: `lib/message-templates/merge.ts`.  
Live tour/payment loaders: `lib/message-templates/merge-context.ts`.

Customer-facing gate: `resolveForCustomerSend` / `assertCustomerSafeMergedContent` — unresolved `{{tokens}}` never ship.

---

## 3. Provisioning behavior

1. **Masters** = code fixtures in `STARTER_MESSAGE_MASTERS` (not DB rows). Venue users cannot edit masters.  
2. **New venue create** (`submitVenueSetup`) calls `seedStarterMessageTemplates(venueId)` (admin client), mirroring inventory seed.  
3. **Existing venues** hitting Message Templates Library call `ensureStarterMessageTemplatesForCurrentVenue()` (idempotent).  
4. **Per master ensure rules:**  
   - If a venue row already has `source_master_key = MSG-XX` → skip.  
   - Else if a same-named template exists with **exact** subject/body/category match → adopt by setting `source_master_key` (no overwrite).  
   - Else if a same-named template exists but content differs → **skip** (preserve customization). Venue can use “Add starter again.”  
   - Else → insert new venue-owned copy tagged with `source_master_key`.  
5. **Add starter again** (`addStarterMessageAgain`): always inserts a **new** row with a unique name (`Name`, then `Name (Starter)`, then `Name (Starter 2)`…). Never updates an existing row.

Column: `message_templates.source_master_key`  
Migration: `supabase/migrations/20261268000001_message_starter_library.sql`

---

## 4. Migration behavior (existing templates)

There was **no prior Hello to Cheers master catalog** for these 11 messages in DB.  

- Unrelated venue-authored templates: untouched.  
- Exact content matches (unlikely pre-seed): adopted with master key.  
- Same name / different body: left alone; no silent replace.  
- Re-open Library after deploy: missing keys provisioned under the rules above.

---

## 5. Permission behavior

- Venue RLS on `message_templates` unchanged (`venue_id = current_user_venue_id()`).  
- Delete remains Owner/Manager via `message_templates_delete_gate`.  
- Masters are not table rows — Staff/Coordinator/Manager/Owner cannot alter Hello to Cheers masters; they only edit venue copies.  
- Cross-venue: all merge loaders filter by `venue_id` (+ relationship’s lead/client).

---

## 6. Tour-context implementation

- Table: `tour_appointments`  
- Format: venue timezone via `Intl` (`formatTourDatetimeForCustomer`)  
- Selection: optional `scheduled_messages.merge_tour_appointment_id` pin; else soonest upcoming non-cancelled/completed/no_show for the lead; else most recent active past tour (for follow-up).  
- **Reschedule:** status filters exclude cancelled rows; send-time resolution reads the live appointment — scheduled messages store raw tokens, not a freeze of the old wall clock.  
- If MSG-02 is sent/scheduled with no resolvable tour → processor/conversation send **fails** with a clear message (no literal `{{tour_datetime}}` to the customer).

---

## 7. Payment-context implementation

- Tables: `payment_schedules` + `payment_line_items`, scoped through `clients.relationship_id` + `venue_id`.  
- Selection: optional `merge_payment_line_item_id` pin (must belong to that client’s schedules); else soonest `pending|overdue|processing` line by `due_date`.  
- Paid-only plans without unpaid lines → payment tokens won’t resolve → MSG-10 send blocked until context exists.  
- Cross-client leakage prevented by schedule membership check.

---

## 8. Send paths (existing architecture)

| Path | Behavior |
|------|----------|
| Conversation one-off | `sendConversationMessage` → `resolveForCustomerSend` with live merge context |
| Scheduled Sends | Body stored with raw tokens; `processDueScheduledMessages` resolves at send |
| Sequences | Still materialize template body into `scheduled_messages`; processor resolves at send |

No second engine / second send pipeline.

---

## 9. Preview

`substituteSampleMergeFields` includes samples for tour/payment tokens. Stored templates remain tokenized. Preview does not write.

---

## 10. UI

- Library page ensures starters on load.  
- “Starter” badge on tagged templates.  
- “Hello to Cheers starters” control: add missing / add individual master again.  

Path: `/communication/templates`

---

## 11. Validation results

| Check | Result |
|-------|--------|
| Unit tests `lib/message-templates/merge.test.ts` | **10/10 pass** |
| Exact master inventory / categories / MSG-02 & MSG-10 tokens | Pass |
| Preview clears all starter tokens with samples | Pass |
| Customer-safe gate blocks unresolved payment/tour tokens | Pass |
| Tour datetime format in America/New_York | Pass |
| Migration applied on local `supabase_db_wevenu-website` | Pass (`source_master_key`, merge pin columns, service_role insert/update grant) |
| Provision both local completed venues | Pass — 11/11 created each |
| Exact approved content match | Pass — 11/11 |
| Idempotent re-provision | Pass — all skipped |
| Customize MSG-01 + Add starter again | Pass — custom preserved; new row `New Inquiry Response (Starter)` with original master body |
| `supabase migration up` full history | Blocked by pre-existing remote/local migration drift (this migration SQL applied directly) |
| Full Owner/Manager/Coordinator/Staff browser matrix | Requires authenticated UI session — architecture uses existing RLS; no permission model change |

---

## 12. Files touched (primary)

- `lib/message-templates/starters.ts` — approved masters  
- `lib/message-templates/merge.ts` — vocab + customer-safe resolve  
- `lib/message-templates/merge-context.ts` — tour/payment loaders  
- `lib/message-templates/provision.ts` — provision / re-copy  
- `lib/message-templates/{constants,preview,types,repository}.ts`  
- `lib/message-templates/merge.test.ts`  
- `lib/scheduled-messages/{repository,processor,types}.ts`  
- `lib/conversations/service.ts`  
- `lib/venue/service.ts` — seed on venue create  
- `app/(app)/communication/templates/{page,actions}.ts(x)`  
- `components/communication/{message-template-list,add-hello-to-cheers-starters}.tsx`  
- `supabase/migrations/20261268000001_message_starter_library.sql`  

---

## 13. Out of scope (next packages)

Questionnaire, Contract, Brochure, Inventory, Event Order, Timeline, Floor Plan starters — not implemented here.
