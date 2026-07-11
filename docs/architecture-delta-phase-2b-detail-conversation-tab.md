# Architecture Delta — Program 2, Phase 2B (Slice 2: Lead/Client Detail Conversation Tab)

**Status:** Second coordinator-side slice complete 2026-07-21, flag-gated behind `venues.conversation_experience_enabled`. Per explicit instruction, this is where Phase 2B **stops** — no further UI work (couple portal cutover, search, notification source-swap) until a real coordinator walkthrough of what exists now.
**Format:** Every completed phase gets an Architecture Delta. Starting this phase, per standing request, it opens with the simplification question rather than appending it as an afterthought.

---

## How did this phase make the product simpler for a venue owner?

Before this slice, replying to a couple from Emma & James' own Lead or Client record meant one of two things: an email-only "Messages" tab that couldn't see or send a portal chat message, or leaving the record entirely to find their thread in the separate main-nav Messaging inbox. A coordinator working a lead had to remember which of two systems held the conversation, and often had to leave the page they were already on to use the other one.

Now: the same "Conversation" tab, right where "Messages" used to be, shows every message on every channel, in order, and lets the coordinator reply without leaving Emma & James' record at all. The tab doesn't say "Relationship," "Opportunity," or "Conversation ID" anywhere — it just shows the conversation. One fewer system to remember, one fewer navigation away from the record a coordinator is already looking at, zero new concepts asked of them. That is the whole measure of this slice's success, more than anything below it.

## What became canonical

- **`leads.relationship_id` and `clients.relationship_id` are now exposed all the way up through the application layer** (`Lead`/`Client` types, both repositories) — previously they existed in the database from Phase 2/2A/2B slice 1 but nothing in `lib/` read them. The Lead/Client detail pages are the first real callers.
- **`ConversationThread`** (`components/conversations/conversation-thread.tsx`) is now the one shared implementation of "show messages, let someone reply" — used identically by the main-nav inbox and the new detail-page tab. There is exactly one place this logic exists, not two components that happen to look similar today and drift apart tomorrow.
- **`getConversationIdForRelationship`** is the one resolver from "a Relationship I already know about" to "its Conversation" — a plain RLS-scoped read, not a new RPC, since the caller already has an authenticated venue session and nothing SECURITY DEFINER would add.

## What legacy systems were removed

None. `MessagesSection` (the legacy email-only tab content) is untouched and is exactly what renders when `conversation_experience_enabled` is false — which is every venue by default.

## What sources of truth were eliminated

None new. This slice is a second UI surface reading the same Phase 2A backend the main inbox already reads — no new backend logic, no new source of truth.

## What Trust Risks closed

None directly. Worth naming what this slice *prevents*, though: before it, a coordinator viewing a Lead's "Messages" tab could reasonably believe they were seeing the complete correspondence, when a portal chat message sent through the main inbox would be invisible there. That's a real trust gap in the legacy experience (part of what TR-C1 named), now closed for any venue on the new experience — not by fixing the old tab, but by replacing it with one that has no such blind spot.

## What complexity was reduced

- One thread-rendering implementation instead of what would have been two (inbox version, detail-tab version) had `ConversationThread` not been extracted first.
- The detail-page tab required no new backend work at all — it's entirely a consumer of Phase 2A/2B-slice-1 infrastructure that already existed and was already verified.

## What's explicitly deferred, not silently dropped

- **The "Send Questionnaire" shortcut** that today's `MessagesSection` offers (a one-click email with a questionnaire link) has no equivalent in the new Conversation tab yet. Minor, but real — named so it isn't rediscovered as a regression later.
- **No message count badge on the tab** for the new experience (the legacy tab shows a numeric badge from thread counts; the new one doesn't fetch a count just to populate a badge). A deliberate, minor scope cut for this slice, not an oversight.
- **Everything already named as deferred in the coordinator-inbox delta** (couple portal, search extension, digest engine source-swap, attachments) is still deferred, unchanged.

## Future Optionality

- **`ConversationThread` being a single shared component** means any future third surface that needs to show a Conversation (a vendor detail page, once vendor messaging exists; a future Relationship Workspace hub page) gets it for free, without a third implementation to keep in sync.
- **The relationship_id now flowing through the Lead/Client application layer** means any future feature that needs to know "what's the enduring identity behind this record" (Assets in Phase 3, Activity Timeline) has a ready-made, typed path to it — not just a database column nobody in `lib/` reads yet.

## An honest evaluation against the five questions this slice was built against

Per explicit instruction, this tab was evaluated against user experience, not just whether it works — the following is a candid self-assessment, not a claim that all five are unambiguously solved:

1. **"Does it feel like I'm simply working with Emma & James?"** — Reasonably yes: the tab lives inside her own record, is labeled "Conversation," and no architectural vocabulary (Relationship, Opportunity, relationship_id) appears anywhere in the UI.
2. **"Can I immediately understand what's happening without thinking about where information lives?"** — Mostly yes, with one real gap caught and fixed during this pass: channel icons (phone, portal, email) initially had no visible hover label, only a screen-reader `aria-label` — a coordinator glancing at an unfamiliar icon had nothing to confirm what it meant. Fixed with a native tooltip before calling this done, not left for someone to notice later.
3. **"Does everything I need feel like it's naturally part of one workspace?"** — Yes for messaging specifically: no separate page, no separate list to search through, just a tab alongside Notes/Tasks/Activity/Documents on the same record.
4. **"Does this reduce clicks and mental context switching?"** — Yes, measurably: replying via portal chat previously required leaving the Lead/Client record for the main-nav inbox; it now requires zero navigation.
5. **"Would a non-technical venue owner describe this as easy after a few minutes?"** — Likely yes for the core read/reply loop. The one honest reservation: the channel selector, while defaulting sensibly to Portal, is a small decision point a fully non-technical user doesn't strictly need to see on day one. Not changed in this pass, because the right next step is real usage, not more of my own guessing at what to simplify further — named here as the first concrete candidate for progressive disclosure once real coordinator feedback exists.

## Verification summary — and the same honest limit as the last slice

- **Backend read path**, verified with a rolled-back transaction and a real per-role `authenticated` session: `getConversationIdForRelationship`'s exact query resolves the correct conversation for a Lead's relationship, RLS-scoped correctly.
- `tsc --noEmit` and `npm run build` both clean across every changed file, including the two detail-page server components, the two client components, the extracted `ConversationThread`, and the `Lead`/`Client` type + repository changes (plus a third caller, `lib/dashboard/service.ts`'s own separate `mapLead`, caught by the type checker and fixed in the same pass — an instance of Engineering Standard #9's lesson, not a surprise).
- **Not verified: an actual interactive click-through.** Same environment limitation as the coordinator-inbox slice — this sandbox cannot reach a locally running dev server to exercise the tab in a browser. Type-checking, a clean build, and careful manual review stand in for that here, not a substitute for it.

## Recommended next step, per explicit instruction

**Stop here.** Do a real coordinator walkthrough — main-nav inbox and this detail-page tab together — before any couple portal work begins. The coordinator experience is where people spend their day; validating it feels natural now is exactly what makes the (higher-risk) portal rollout lower-risk later, per the sequencing already agreed. This delta's own honest gaps (the tooltip fix, the channel-selector prominence question) are the kind of thing a five-minute real walkthrough will surface far better than continued guessing.
