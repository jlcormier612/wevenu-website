# Attention message navigation

**Status: IMPLEMENTING** — root cause confirmed; Inbox deep-link fallback ready for Sandbox deploy.

## Root cause

Attention / Message History built `href` only from `leadId` / `clientId`, resolved by joining `conversations.relationship_id` → `leads`/`clients`.

On Fancy Sandbox, most newest failures belong to **orphan relationships** (e.g. SmsConsent browser fixtures): `venue_customer_relationships` exists, conversation exists, but **no lead or client row** has that `relationship_id`, and `inbox_owner_*` ids are null. Result: first Attention page **20/20 `href=null`**.

Valid destination already exists: Inbox deep-link `/messaging?conversation={id}` (`ConversationInbox` + `?conversation=`).

## Fix (minimal)

1. Carry `conversationId` on conversation-sourced history/issue rows.
2. Shared `messageDestinationHref`: client → lead → Inbox conversation deep-link.
3. Also honor `inbox_owner_lead_id` / `inbox_owner_client_id` when set.
4. Same helper on Communication Health issue links (same gap).

No status-mapping, count, webhook, or data mutations.

## Evidence to follow

- Unit: `lib/communication/message-destination.test.ts`
- Browser after Sandbox deploy: Attention first page href coverage + click opens Inbox thread
