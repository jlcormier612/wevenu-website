# Architecture Delta — Program 2, Phase 2B (Slice 1: Coordinator Inbox + Rollout Flag)

**Status:** First slice of Phase 2B complete 2026-07-21 — the coordinator-facing unified Messaging inbox, flag-gated, plus a real backend gap closed before any UI could depend on it. **Not yet done, named explicitly below:** the Lead/Client detail page's Conversation tab, the couple portal's Conversation view, search extension, and notification source-swap. Those are the next slice(s), not silently folded in or dropped.
**Format:** Per the venue owner's request, every completed phase (or bounded slice) gets one of these, now including a Future Optionality section per standing request.

---

## What became canonical

- **Every Client now has a `relationship_id`, populated at creation time regardless of origin.** This closes the exact gap `docs/architecture-delta-phase-2a-backend.md` named and deferred: a Client created directly (`createClient_`, no originating Lead) previously had no path to a Relationship at all. `lib/clients/repository.ts`'s `insertClient` — the single function both `createClient_` and `convertLeadToClient` already funneled through — now resolves it: inherited directly from the Lead when converting, resolved/created via `find_or_create_relationship` when created directly.
- **`resolve_relationship_id_for_client()` simplified from a three-table join to a single-column read**, now that Clients carry their own `relationship_id`. Every existing caller (the Phase 2A sync triggers, the portal RPCs) picked this up automatically — no caller changes needed, since the function's signature never changed.
- **`venues.conversation_experience_enabled`** is the real, working per-venue rollout flag `docs/conversation-experience-cutover.md`'s staged rollout depends on — built following the exact precedent of `venues.tour_scheduling_enabled`, surfaced through `getCurrentVenue()` like every other venue setting.
- **The coordinator's main-nav "Messaging" page is now a real, working gate**: a server component checks the flag and renders either the untouched legacy inbox or the new unified `ConversationInbox` — no flash of the wrong experience, no client-side flicker.
- **The new `ConversationInbox`** delivers the guiding principle directly: one list (Relationships, not Clients — a Lead who hasn't converted yet already has a row), one thread per relationship merging every channel, a small channel tag on every bubble instead of a channel-specific silo, and a channel selector on compose. Mobile behavior collapses to a single pane below the tablet breakpoint, per the cutover document's section 5.
- **The unread badge (`/api/messages/unread`) is now flag-aware**, reading from `get_conversation_unread_count` or `get_couple_unread_count` depending on the same per-venue flag — a venue mid-rollout never sees a badge that disagrees with which inbox it actually lands on. `components/shell/sidebar-nav.tsx` itself is untouched.

## What legacy systems were removed

None. `LegacyMessagingInbox` (the pre-cutover component, renamed but otherwise byte-identical) and every legacy table remain fully live and are what every venue sees by default (`conversation_experience_enabled` defaults to `false`). This slice is purely additive.

## What sources of truth were eliminated

None yet — same reasoning as Phase 2A. What changed is that the one real remaining gap in the *new* source of truth (Clients without a Lead) is now closed, which matters because Phase 2B's whole premise is that the new system is trustworthy enough to show to a real coordinator.

## What Trust Risks closed

None directly targeted. But closing the Client-with-no-Lead gap now, before any UI depends on it, prevents a live bug that would otherwise have surfaced as "some coordinators' conversations are just missing" the moment a dogfood venue happened to have a directly-created client — exactly the kind of thing this project's verification discipline exists to catch before a user does.

## What complexity was reduced

- One resolver function got simpler (a join collapsed to a column read) as a direct result of closing the gap properly instead of patching around it.
- The rollout mechanism reuses an existing, already-understood pattern (`tour_scheduling_enabled`) rather than inventing a new kind of flag/config system.
- The legacy inbox required zero changes to participate in the gate — it was extracted into its own file unchanged, and `page.tsx` shrank to a five-line conditional. The two experiences don't know about each other.

## What's explicitly deferred, not silently dropped

- **The Lead/Client detail page's "Messages" tab is untouched** — still the old email-thread accordion. Becoming a "Conversation" section reading the same data is the next slice.
- **The couple portal's message view is untouched** — still the old couple-chat-only component, still can't show a couple an email sent to them. Cutting it over to `get_portal_conversation`/`send_portal_conversation_message` is next.
- **Search is not yet extended** — `search_global` still doesn't include Conversation messages. The relationship-resolution design is written (`docs/conversation-experience-cutover.md` §8); it isn't built.
- **The digest engine still reads `message_threads`**, not the new `conversations` table — the source-swap described in the cutover document's §7 hasn't happened yet, so a flagged-on venue's daily digest is currently checking the wrong table for its own experience. **This should be closed before any real venue (even a dogfood one) is flagged on**, since otherwise the coordinator's one existing notification habit silently stops reflecting reality — named here specifically so it isn't missed.
- **No attachments** — matches the already-documented Phase 3/4 sequencing.
- **The actual rollout (flagging on a real venue) has not happened.** This slice makes it *possible*; deciding to flip the flag for the internal dogfood venue is a separate, deliberate action per the confidence-gated stages already agreed.

## Future Optionality

- **A per-venue flag, not a single global switch**, means dogfooding, beta, and eventual default-on can all coexist simultaneously across different venues without any of them affecting each other — this was already the plan, but it's worth naming that the mechanism itself is now real, not just described.
- **The channel selector's option list is exactly the schema's channel check constraint, spelled out once (`CHANNEL_META`).** Adding a channel later (per Phase 2A's Future Optionality note — SMS, in particular) is a one-line addition to that map, not a UI redesign.
- **The gate lives at the page-component level, not deep in shared layout code** — a future third state (e.g., a "new UI, old data temporarily" transitional mode, if ever needed) could be added without touching `sidebar-nav.tsx` or any other shared chrome.

## Verification summary — and an honest limit

- **Backend**, verified with the same rolled-back-transaction discipline as every prior phase: a directly-created Client (no Lead) now resolves a real `relationship_id`; `resolve_relationship_id_for_client` returns the same value as the raw column read; `get_portal_conversation` for such a client now returns a real (if empty) conversation instead of `{"error":"no_relationship"}`.
- `tsc --noEmit` and `npm run build` both clean, including the new component, the page-level gate, and the extracted legacy component.
- **What was not verified, and should be before flagging on any real venue: a live, interactive click-through of the new UI in a browser.** This environment's sandboxed network access did not permit reaching a locally running dev server (the TCP connection succeeds but no HTTP response is ever received, on every port tried) — so unlike the backend work, this slice's actual runtime behavior (does the list load, does clicking a row load its thread, does sending a message actually appear) has only been verified by type-checking, build success, and careful manual code review, not by using it. Stated plainly rather than implied: **do a real click-through before this is trusted with the internal dogfood venue.**
