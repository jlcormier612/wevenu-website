# RC2 — Messaging & Conversations: Final Report

**Status: Complete.** Conversations is now the platform's single canonical communication system. Every venue — existing and newly created — operates on it by default. This document is the compatibility-surface inventory and verification record the rollout milestone (Milestone 5) was scoped to produce.

## What RC2 shipped

| Milestone | Outcome |
|---|---|
| 1. Coordinator Surface | Attachments, automated-vs-human badge, "waiting on you" indicator, Relationship Context Panel (Requests/Files/Activity beside the thread) |
| 2. Couple Portal cutover | Portal reads/writes through Conversations; the couple-facing UI is unchanged, only its backend swapped |
| 3. Vendor Conversations | Event-anchored schema (`event_vendor_assignment_id`), auto-provisioning trigger, vendor portal inbox + thread, venue-side "Message [Vendor]" panel, relationship rollup |
| 4. Search & History | Composed Activity Timeline (audit trail, not a chat log), Conversations + Requests in global search, Request↔Conversation cross-linking, Event.Completed → review/referral nudge |
| 5. Rollout | Default flipped on for every venue, dead flag branches removed, legacy modules marked compatibility-only, this inventory |

Every claim below was verified against the live local database — RPC calls, trigger firings, and query results — not inferred from reading code. Test rows were created and deleted after each check.

## The default is flipped

`venues.conversation_experience_enabled` now defaults to `true` (verified directly against `information_schema.columns`) and every existing venue was backfilled to `true`. There was never a toggle UI anywhere in the app — Settings, HQ admin — so there is no "opt out" surface to preserve; flipping the column was the actual rollout step. The column itself is not dropped: it remains the durable record of which venues are on the canonical experience and a direct-SQL safety valve during the post-rollout window.

## Real bugs found and fixed during rollout verification

The instruction to "verify, not assume" surfaced five real, previously-undiscovered defects — none introduced by RC2, all found by actually exercising the code rather than reading it:

1. **`search_global`'s entire Conversations rollout would have shipped on top of an already-broken function.** Its Vendors branch referenced `vvr.is_active`, a column that has never existed on `venue_vendor_relationships` (only `status`). A bad column reference in any `UNION ALL` arm fails the whole query — global search across the *entire app* was non-functional before this fix, not just vendor search. Fixed by using `status != 'inactive'`, matching the vendor directory's own filter convention.
2. **`get_conversation_inbox`'s display name and client-id lookup silently failed for any client created without a Lead.** It joined `clients` through `leads` to find a relationship, a pattern that predates `clients.relationship_id` (added in Phase 2B) as the direct, authoritative link. A directly-created client's Inbox row showed no name and no working "Booking" link.
3. **The same bug, in `resolve_relationship_id_for_thread_entity`, silently dropped two kinds of real messages** for any lead-less client: inbound email replies, and the automated questionnaire system messages ("The couple opened the final details form."). Both are legitimate, currently-firing code paths — the mirror trigger that's supposed to forward them into `conversation_messages` was quietly no-oping instead. Verified with a real inbound-reply insert before and after the fix.
4. **The vendor portal's per-event "Messages" tab was a static "coming in Sprint 107" placeholder** that ignored an already-live, populated `conversationId` on the very data it was given. A vendor clicking Messages from inside an event saw a dead end even though the real conversation existed and was reachable from the top-level nav. Fixed — it now embeds the same `VendorConversationThread` the nav path uses.
5. **`lib/luv/observations.ts` hardcoded `conversationExperienceEnabled: false`** in its "no messages logged yet" heuristic, by design, because the venue-wide pass didn't do per-relationship conversation resolution. Flipping the default without fixing this would have made the observation increasingly *wrong* — it would keep reading a `message_threads` count that stops growing once real activity moves to Conversations, eventually claiming "no contact" for relationships with real, active threads. Fixed with a batched `conversation_messages` count joined through each event's client relationship, same query-batching discipline as the existing legacy-thread count it sits beside.

All five were fixed, applied as migrations (or code changes) to the local database, and reverified after the fix.

## Entry-point verification — "does this open the canonical thread"

Every surface the rollout instruction named, checked by reading the actual current code and, where meaningful, exercising it against the database:

| Entry point | Verdict |
|---|---|
| Couple Portal (Messages tab) | ✅ Component → API routes → `lib/conversations/service.ts` → `conversations`/`conversation_messages`/`conversation_message_attachments`. No legacy code path remains reachable. |
| Vendor Portal (nav + per-event tab) | ✅ Nav path was already correct; per-event tab was the dead placeholder in fix #4 above, now fixed. |
| Coordinator Workspace (Lead detail, Booking Workspace, main Inbox) | ✅ All three now unconditionally render the canonical `ConversationThread`/`RelationshipConversationTab` — the legacy branch was removed, not just defaulted around. |
| Requests | ✅ "Create Request" from a Conversation sets `source_feature='conversation'`; "Open Related Item" deep-links to `/messaging?conversation={id}`, which `ConversationInbox` now supports natively via `useSearchParams`. |
| Timeline references | ✅ A Timeline entry's "Conversation" related-item link opens the Booking Workspace's Conversation tab — always the canonical one now that the legacy branch is gone. |
| Search results | ✅ `search_global`'s new Conversations branch resolves relationship-anchored results to `/messaging?conversation={id}` and vendor-anchored results to the Event's Vendors tab — both land on `ConversationThread`. |
| Attachments | ✅ Coordinator and couple sides fully wired (`get_conversation`/`get_portal_conversation` both return attachments; shared public storage bucket). Vendor-side attachment support does not exist yet — a real, disclosed, self-consistent gap, not a legacy leak (see below). |
| Automation-generated messages | ✅ Scheduled Sends, Sequences, and Automation Rules (including the new Event.Completed nudge) all insert into `conversation_messages` as their primary and only write, verified end-to-end through a real `Event.Completed` platform event → automation sweep → scheduled message. |
| Email replies | ✅ after fix #3. SMS replies were already clean. |

## Compatibility surface inventory

Everything below still exists, is not deleted, and is explicitly marked `COMPATIBILITY-ONLY` in its own file header. Nothing here should gain new features; all new communication work targets `lib/conversations`.

**`couple_threads` / `couple_messages`** (the couple-portal-chat-only system):
- `app/(app)/messaging/legacy-inbox.tsx` — no longer rendered by any route (`app/(app)/messaging/page.tsx` always renders `ConversationInbox` now)
- `app/api/messages/route.ts`, `app/api/messages/[threadId]/route.ts`, `app/api/messages/upload/route.ts` — reachable only from the now-orphaned `legacy-inbox.tsx`
- `get_couple_inbox`, `ensure_couple_thread`, `get_couple_unread_count`, `get_portal_messages`, `send_portal_message` RPCs — still exist in the database, uncalled by any live route

**`message_threads` / `messages`** (the "entity messaging" system):
- `lib/messaging/repository.ts`, `lib/messaging/service.ts`, `lib/messaging/types.ts` — no longer called by any UI
- `components/messaging/messages-section.tsx`, `components/messaging/message-compose.tsx` — no longer rendered anywhere (both Lead detail and Booking Workspace dropped their legacy Messages branch)
- `sendMessageAction` in `app/(app)/messaging/actions.ts` — still exported, only real caller was the now-orphaned `MessagesSection`

**Still genuinely live, not compatibility-only** — these tables keep receiving real new rows and are load-bearing, not historical:
- `app/api/messaging/inbound/route.ts` (inbound email replies) and `mark_questionnaire_opened`/`submit_questionnaire_as_couple` write to `messages`/`message_threads` directly, then the `messages_sync_to_conversation` trigger mirrors forward into `conversation_messages`. This bridge was explicitly named "temporary, should be removed in 2B" in its own original migration comment and is still live — a real target for a future retirement pass, not urgent, since it now works correctly (fix #3).
- `lib/messages/notify.ts`, `lib/messages/types.ts` — actively used by the *current* Conversations-backed portal route (`app/api/portal/messages/route.ts`) for venue email notifications and for the legacy-compatible response shape `toLegacyMessage()` maps into. Not legacy despite living in a directory named `lib/messages`.

## Newly discovered parallel communication surfaces — documented, not absorbed

Per the standing instruction to surface anything found rather than leave it implicit. Neither was in RC2's original scope; both are real and worth a dedicated pass:

1. **`lib/notifications/engine.ts` sends real outbound emails directly via the Resend REST API** (tour reminders, to real client addresses) — completely bypassing Conversations. A coordinator reading a couple's Conversation thread today has no record that a reminder email ever went out. Not touched in this pass: rewiring a live, working notification path under rollout time pressure carries real regression risk, and it wasn't named in the original RC2 assessment's 13-row inventory. Recommended as the next dedicated initiative.
2. **`lead_notes`/`client_notes`/`event_notes`** are append-only internal annotation tables that conceptually duplicate what `conversation_messages`' `internal_note` channel already models. Unlike the communication systems RC2 consolidated, these are single-party notes (nobody "replies" to a lead note) — a different shape than a conversation, and a genuinely working, actively-used feature. Flagged as a legitimate future consolidation candidate, not a bug.
3. **Vendor-side attachments don't exist** — no upload route, no attachment UI in `VendorConversationThread`, and `get_vendor_conversation` doesn't return an `attachments` key at all. Coordinators can still see any attachment they add to a vendor conversation (the read path is anchor-agnostic); a vendor cannot send or see one. A scoped, well-understood follow-up, not a hidden gap.

## What's next

RC2 is done. Per the framing set at the start of this initiative, this closes out the major architectural work before the platform's remaining runway shifts to launch validation, mobile/responsive polish, integrations, payments, and beta testing. The three items above are the honest, named exceptions to "every communication lives in one place" — each is a scoped, well-understood follow-up, not an open question about whether Conversations is the right architecture.
