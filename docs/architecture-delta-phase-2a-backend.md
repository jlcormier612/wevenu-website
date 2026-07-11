# Architecture Delta — Program 2, Phase 2A (Backend: Backfill, Sync, RPCs)

**Status:** Phase 2A complete 2026-07-20. Backend only, fully verified — no UI reads any of this yet. `message_threads`/`messages` and `couple_threads`/`couple_messages` remain the live systems for the entire duration of this phase; Phase 2B (UI cutover) is a separate go/no-go decision, not an automatic continuation.
**Format:** Per the venue owner's request, every completed Program 2 phase (or bounded slice of one) gets one of these — measuring simplification, not just delivery. Starting this phase, a **Future Optionality** section is added per standing request: what this phase enables without committing to it.

---

## What became canonical

- **Every historical message now has a canonical home in `conversation_messages`**, backfilled from both legacy systems (`messages` → `channel='email'`, `couple_messages` → `channel='portal'`), correctly re-attributed to the Relationship each message's Lead/Client ultimately belongs to — not to the fragmented per-email `message_threads` rows or the per-client `couple_threads` row those messages originally lived in.
- **Two shared resolver functions** — `resolve_relationship_id_for_thread_entity()` (handles `message_threads`' three possible anchors: lead, client, or event) and `resolve_relationship_id_for_client()` — are now the one path from "a legacy thread" to "its Relationship." Both the one-time backfill and the forward-sync triggers call the same two functions, so the two can't quietly diverge on mapping rules the way independently-written duplicate logic would.
- **A full set of Conversation RPCs exists and is verified**: venue-side (`get_conversation_inbox`, `get_conversation`, `send_conversation_message`, `get_conversation_unread_count`) and portal-side, token-authenticated (`get_portal_conversation`, `send_portal_conversation_message`). None are called by any UI yet — Phase 2B's entire job is now a frontend exercise against an already-verified backend, not a combined frontend-and-backend risk.
- **The coordinator inbox projects customer names from Lead/Client, never from `venue_customer_relationships`' own stored name fields.** This was a deliberate design decision during this phase, not an accident: `venue_customer_relationships.first_name`/`last_name` are a creation-time convenience, and letting a display view read them directly would have created exactly the kind of second source of truth Engineering Standard #10 exists to prevent. `get_conversation_inbox` instead prefers the most recent Client's name, falling back to the most recent Lead's, live at read time.

## What legacy systems were removed

None yet, on purpose. `message_threads`/`messages`/`couple_threads`/`couple_messages` are fully intact and still the only systems any real user interacts with. Removing them is explicitly Phase 2B's job, after the UI cutover, not this phase's.

## What sources of truth were eliminated

None yet in the sense of "retired" — but a **temporary, intentional second source of truth was introduced and named as such**: for the duration of 2A→2B, a message sent through the still-live legacy UI exists in both the old table and (mirrored via trigger) `conversation_messages`. This is not the kind of silent, accidental duplication Engineering Standard #9 warns about — it's a deliberately bounded bridge, with an explicit removal point (2B retires the legacy tables and the sync triggers together), not a permanent parallel system.

## What Trust Risks closed

None directly targeted this phase. But verification surfaced and fixed a real bug with the exact shape TR-M7 was about — see Verification summary below; it's substantial enough to call out on its own rather than bury it.

## What complexity was reduced

- One mapping ruleset (the two resolver functions) instead of what would otherwise have been four independent pieces of logic: backfill-for-messages, backfill-for-couple_messages, sync-trigger-for-messages, sync-trigger-for-couple_messages each reasoning about lead/client/event resolution on their own.
- Phase 2B inherits zero backend risk. Every RPC it will call already exists, is already RLS-scoped, already access-level-gated, and was already tested against real per-role sessions — the only remaining work is UI.
- The forward-sync bridge means the historical backfill did not have to be a single, high-stakes, must-run-exactly-once-in-production event performed under time pressure at cutover — it can run today, with new messages continuously catching up in the background, and 2B can begin whenever the team is ready rather than being forced into a single migration weekend.

## What's explicitly deferred, not silently dropped

- **The Client-with-no-Lead gap** (`clients.lead_id` is nullable; a directly-created Client has no path to a `relationship_id` today): every resolver returns null for these, every RPC returns a clear `{"error":"no_relationship"}` rather than guessing or crashing. Not a live problem yet (nothing reads these RPCs from a UI), but it must be closed before Phase 2B, since by then every portal user needs a working conversation. Named here so it can't be quietly rediscovered as a production bug during 2B.
- **No UI changes** — coordinator Messages tab, main-nav Messaging inbox, and couple portal message view are all untouched.
- **No attachment backfill** — `couple_message_attachments` rows are not migrated; matches the already-documented "no attachments this phase" scope (Phase 3/4).
- **Read-state is backfilled once, not kept in perfect real-time sync during the bridge** — the one-time backfill carries over existing read timestamps faithfully, but a message read in the *old* UI during the 2A→2B window won't retroactively update `conversation_messages`' read timestamp. Acceptable because nothing consumes the new system's read state yet; Phase 2B should re-verify read counts look sane at the moment of cutover rather than assume this.
- **Vendor conversations** — `conversations.vendor_relationship_id` exists and is exercised by nothing yet; intentionally out of scope until vendor messaging is prioritized.

## Future Optionality

What this phase's design enables later without having committed to any of it now:

- **New channels (SMS, voicemail, push) are a code change, not a schema migration.** `conversation_messages.channel_metadata` (jsonb) already absorbs whatever a new channel needs to store (provider IDs, phone numbers); the `channel` check constraint just needs a new allowed value.
- **Vendor messaging can be turned on without touching this phase's schema.** `conversations.vendor_relationship_id` and the venue-side RPCs are anchor-agnostic in structure (the portal-side RPCs are couple-specific by design, but a parallel `get_vendor_conversation`-style RPC would follow the identical pattern already proven here).
- **Any future system that needs "what Relationship does this belong to"** (Phase 3's Asset model, the Relationship Timeline, future reporting) has a tested, reusable resolution path in the two shared resolver functions, rather than needing to invent its own lead/client/event-chasing logic.
- **The bridge pattern itself (shared resolver + best-effort mirror trigger that logs rather than swallows failures) is reusable** for any future "retire a legacy table in favor of a new canonical one" project in this codebase — not unique to messaging.
- **None of this commits the venue owner to a timeline for Phase 2B.** The legacy systems keep working indefinitely if needed; the bridge has a real (if small) ongoing cost — one extra trigger-fired write per message — but no expiry forcing a rushed cutover.

## Remaining Phase 2A work

None — this phase is complete as scoped. Phase 2B (UI cutover, retirement of legacy tables and the sync bridge) is next, pending a separate go/no-go, with the Client-with-no-Lead gap closed first.

## Verification summary

- **Backfill correctness**, tested with synthetic historical data in a rolled-back transaction: a Lead converted to a Client, two legacy `messages` rows (one outbound, one inbound) and two `couple_messages` rows (one per side, with read timestamps) all correctly merged into one conversation, correctly ordered by `sent_at`, correct `sender_type`/`channel` mapping, read timestamps carried over faithfully from the couple side.
- **A real bug was caught and fixed during this verification, not after — the same shape as TR-M7.** The forward-sync triggers' `ON CONFLICT` clause didn't match the partial unique index it was meant to target (a partial index's `WHERE` predicate must be repeated in the `ON CONFLICT` target for Postgres to recognize it), so every sync insert was silently failing — and the trigger's blanket `exception when others then return new` swallowed the error completely, exactly like TR-M7's webhooks returning `{"ok":true}` despite failing. Live-testing the trigger path specifically (not just the backfill query) surfaced it: a new message sent through the legacy tables produced zero mirrored rows. Fixed two ways: the `ON CONFLICT` target now matches the index exactly, and the exception handler now `RAISE WARNING`s with the real error instead of silently discarding it — a broken bridge will be visible in the database logs, not indistinguishable from a healthy one.
- **Forward-sync bridge**, re-verified after the fix: a message inserted into `messages` (trigger enabled, not disabled for the test) correctly appears in `conversation_messages` within the same transaction; same for `couple_messages`. Re-running the (idempotent) backfill query against an already-synced row correctly inserts zero additional rows.
- **New RPCs**, tested end-to-end with real per-role `authenticated` sessions (not superuser) and a real portal token: `send_conversation_message` (venue) and `send_portal_conversation_message` (couple) both write correctly; `get_conversation_inbox` shows the right conversation with the right projected display name and correct unread counts; `get_conversation` and `get_portal_conversation` correctly mark messages read and zero out the appropriate unread counter; `get_conversation_unread_count` reflects it.
- **Access-level gating**, tested directly: a `view_only` portal session is blocked from `send_portal_conversation_message` (`{"ok":false,"error":"insufficient_access"}`) but can still read via `get_portal_conversation`; an invalid token returns `{"error":"invalid_token"}` rather than any real data.
- **RLS/cross-venue isolation**, tested with two real venues and two real owner sessions: each coordinator's `get_conversation_inbox()` shows only their own venue's conversations, confirmed by name, not just by count.
- **The named Client-with-no-Lead gap**, tested directly: a Client with `lead_id = null` produces `{"error":"no_relationship"}` from both portal RPCs — a clear, honest failure, not a crash or wrong data.
- `tsc --noEmit` and `npm run build` both clean, including the new `lib/conversations/repository.ts`/`service.ts` layer.
- Migration recorded in `supabase_migrations.schema_migrations` (version `20260720000000`); the corrected migration file was re-applied from a clean drop to confirm the committed file — not just a live-patched database — reproduces the fully working state.
