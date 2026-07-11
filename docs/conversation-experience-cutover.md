# Conversation Experience Cutover — Phase 2B Design

**Status:** Design only — no code, no schema. Written before Phase 2B implementation begins, per explicit request: get confident in the user experience before touching the UI.
**Relationship to other docs:** `docs/conversation-lifecycle-design.md` and `docs/lead-identity-architectural-exploration.md` established *what* Conversation is and *what it anchors to*. `docs/architecture-delta-phase-2a-backend.md` confirms the backend is real, verified, and not yet wired to any UI. This document is about what a coordinator and a couple actually *see and do* once it is.

---

## What exists today (grounding, not aspiration)

Two unrelated messaging systems live side by side right now:

1. **Main-nav "Messaging"** (`app/(app)/messaging`) — a two-pane chat inbox: couple-threads on the left (name, avatar, last-message preview, unread pill), a chat view on the right (date-grouped bubbles, "Seen" receipts, attachments). This is **portal chat only** — one thread per Client.
2. **The Lead/Client detail page's "Messages" tab** (`components/messaging/messages-section.tsx`) — email-style, not chat: subject lines, accordion threads (in practice, one thread per email actually sent — every send creates a new `message_threads` row), sender name and Sent/Failed status. No unread badges, no receipts, no attachments here.
3. **The couple's own portal** shows only their side of #1 — a couple **cannot see** an email the coordinator sent them through #2. That blind spot is real today, not a hypothetical risk.
4. **Notifications** are a once-daily digest email only (`lib/notifications/digest-engine.ts`), folding in one line — "N unanswered messages, >24h old" — alongside overdue tasks. Nothing real-time, no push, no per-message alert.
5. **Search** already exists as a ⌘K command palette (`components/shell/command-palette.tsx`) backed by a `search_global` SQL function that unions Leads, Events, Vendors, Guests, Documents, and Tasks. **Messages are not searchable anywhere today** — not in the palette, not within either messaging surface.

Every section below is a decision about replacing #1–#3 with one thing, and extending #4–#5 to cover it — not inventing new concepts from nothing.

---

## Guiding principles

**1. A venue should never have to wonder where a conversation happened.**

The Relationship is always the home. Email, portal chat, phone log, SMS, voicemail — these are transports, not destinations. A coordinator should never need to remember "I think that was an email" to go find something; there is exactly one place a conversation with Emma & James lives, regardless of which channel carried any given message into or out of it. Every decision below — the single inbox, the channel tag instead of a channel-specific folder, search resolving to Relationships rather than message type — is this one principle applied to a specific surface. When a future decision is unclear, this is the test to apply first.

**2. The venue should experience customers, not architecture.**

Relationship is the correct architectural model — but it should almost disappear from the UI. A coordinator should simply feel like they're opening "Emma & James," with everything they need already there, never like they're navigating a data model. Getting the architecture right (Relationship as the enduring identity, Lead as an Opportunity within it, Conversation anchored correctly) is necessary but not sufficient — it's possible to get all of that exactly right and still ship a UI that makes a coordinator think in those terms, which is a failure dressed as a success. This is why the target for the rest of Program 2 isn't a list of screens being replaced one at a time — it's a single **Relationship Workspace**: the one place a venue naturally starts every interaction with a customer. See `docs/product-completion-roadmap.md` principle 5.

Every decision from here on should be checked against both principles: does it keep the Relationship as the one true home (principle 1), and does it keep the architecture invisible behind the customer (principle 2)?

---

## 1. How venues experience Conversations

**One nav item, one list, one thread — the visual language barely changes; what changes is what's inside it.**

The main-nav "Messaging" page keeps its exact current shape (list on the left, thread on the right, chat bubbles) — that shape already works and coordinators already know it. What changes:

- Each row in the list is now a **Relationship**, not a Client — so a Lead who hasn't converted yet already has a row, and a returning couple's anniversary inquiry lands in the *same* row as their wedding, not a new one.
- Each bubble in the thread carries a small **channel tag** (an envelope for email, a chat icon for portal, a phone icon for a logged call) instead of living in a channel-specific silo. A coordinator scrolling a thread sees the inquiry-form message, the coordinator's own email reply, a logged phone call, and a portal message about parking — in that order, as one continuous story.
- The compose box gains a small **channel selector** (defaults to Portal, since that's the highest-frequency case today) — sending an email instead is one dropdown away, not a different button on a different page.
- The Lead/Client detail page keeps a "Conversation" section, but it is now a *view into the same data*, not a second data set — opening it from the detail page and opening it from the main inbox show the identical thread, just with different surrounding context (the detail page also shows the Event, Contract, Payment status alongside; the inbox doesn't).

```
┌─ Messaging ──────────────────────────────────────────────────────────┐
│ ● Emma & James           2h    │  Emma & James                       │
│   ✉ Following up on...          │  ──────────── Today ────────────    │
│                                  │                                     │
│   Bloom & Co (vendor)     1d    │        ✉ Thanks for reaching out!   │
│                                  │                          10:14 AM  │
│ ○ The Hendersons          3d    │                                     │
│   💬 Perfect, see you then      │  💬 Can't wait for the tour!         │
│                                  │  9:02 AM                           │
│                                  │                                     │
│                                  │  📞 Called to confirm headcount —  │
│                                  │  120 guests, confirmed.  Yesterday │
│                                  │                                     │
│                                  │ ┌─────────────────────────────┐   │
│                                  │ │ [💬▾] Type a message...   ➤ │   │
│                                  │ └─────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

## 2. What concepts disappear

- **"Message thread" as a per-send object.** Today, every single outbound email creates its own `message_threads` row — there is no real concept of "the ongoing email thread with this lead," just a pile of one-off threads. That entire shape disappears. A message is just a message, in one Conversation.
- **Two separate messaging surfaces.** There will no longer be a "did I check the Messages tab or the Messaging inbox" question — that distinction, and the memory overhead of maintaining it, goes away.
- **The couple's blind spot.** A couple will see everything sent to them, regardless of which channel the coordinator used. "I emailed them, why don't they see it in their portal" stops being a real support question.
- **Channel-siloed unread state.** Today only the couple-chat side has an unread concept at all; email has none. That asymmetry disappears — every message, on every channel, contributes to one unread count per relationship.
- **"Which inbox has my new message."** A coordinator won't triage two different unread badges (there's currently only one, for portal chat) — there will be exactly one number, in one place, meaning "these relationships need attention."

## 3. What concepts merge

- The Client-detail "Messages" tab, the main-nav "Messaging" inbox, and the couple portal's message view become **three different windows onto the same Conversation** — not three data sets that happen to look similar.
- "Sending an email" and "sending a portal message" merge into **one send action** distinguished only by a channel selector.
- A Lead's pre-conversion inquiry-era messages and a Client's post-conversion planning messages merge into **one uninterrupted thread** — conversion becomes invisible to the conversation, exactly as designed back in the lifecycle document.
- The **"New Message" compose form** (subject/body/to) and the **chat input box** merge into one compose control; "subject" becomes an optional field that only appears when Email is the selected channel, not a separate mental mode.

## 4. How Activity Timeline and Conversation relate

These are **two different views over an overlapping set of facts, not two names for the same screen.**

- **Conversation** is where a coordinator *talks* to a relationship — the frequent, transactional surface. It shows messages only, presented as a chat.
- **Activity Timeline** (not yet built — Phase 3/4 territory, referenced here only to place Conversation correctly relative to it) is where a coordinator *understands* a relationship — a read-only, composed feed interleaving Conversation messages with Lead/Contract/Payment/Event milestones ("Contract signed," "Deposit received," "Tour completed," "Wedding day"). It answers "what's the whole story here," not "let me reply."

The right UX pattern is two tabs on the same relationship detail page, not two competing inboxes:

```
┌─ Emma & James ─────────────────────────────────────┐
│  [ Conversation ]   Timeline                        │
│  ─────────────────                                  │
│   (chat view, as in section 1 — this is where you   │
│    type and send)                                    │
└───────────────────────────────────────────────────┘

┌─ Emma & James ─────────────────────────────────────┐
│   Conversation   [ Timeline ]                        │
│                  ─────────                          │
│   🎉 Wedding day — Jun 14, 2027                      │
│   💰 Deposit received — $2,500           2 days ago  │
│   ✉ "Thanks for reaching out!"           3 days ago  │
│   📝 Contract signed                     1 week ago  │
│   (read-only — click a message to jump into the      │
│    Conversation tab at that point)                    │
└───────────────────────────────────────────────────┘
```

Messages appear on the Timeline as **compact log lines**, not full chat bubbles — clicking one jumps into the Conversation tab scrolled to that point. This keeps Conversation's own job narrow (communication, per the lifecycle design) while still delivering "one relationship, one story" without merging Conversation's schema with the activity log, exactly as already decided.

## 5. How mobile should behave

There is no native app today — "mobile" means the responsive web app. Two different questions hide inside "how should mobile behave," and they deserve different answers:

**Layout (in scope for Phase 2B):** the two-pane list+thread view collapses to a single pane below the usual tablet breakpoint — tap a relationship in the list, it takes over the screen with a back arrow, exactly like every mobile messaging app already trains people to expect. The channel selector on compose becomes a bottom sheet rather than an inline row of icons (more thumb-friendly). This is a standard responsive pattern, low risk, and doesn't require deciding anything new.

**Push notifications (explicitly out of scope, named rather than assumed):** `push` already exists as an allowed channel value in the schema, which could be read as implying phone-buzzes-when-a-message-arrives already works. It doesn't, and building it is a real, separate project — it requires either a installable PWA with a registered service-worker push subscription, or a native/wrapped app, neither of which exists today. Until that's decided, "mobile notification" realistically means: the unread badge in the mobile nav (works today, no new infrastructure), and the existing daily digest email (already reaches a phone via any mail client, no new infrastructure). Recommend treating true push as a distinct future decision — not bundled into Phase 2B, and not silently assumed to already exist because the schema has a slot for it.

## 6. Unread/read behavior

The schema already tracks this at two granularities — per-conversation aggregate counts (`venue_unread`/`contact_unread`) and per-message timestamps (`venue_read_at`/`contact_read_at`). The UX should only expose the aggregate one:

- **Opening a conversation marks every not-yet-read message from the other side as read**, automatically — no explicit "mark as read" click. This is exactly today's couple-chat behavior already; the change is that it now also covers messages that arrived by email or were logged from a phone call, which today have no read-state at all.
- **The badge is per-relationship, not per-message.** A coordinator sees "this relationship has unread activity" (a dot, a count), never a granular "3 of 5 messages unread" — that level of detail exists in the data for correctness and for the digest engine's threshold logic, but surfacing it in the UI would be noise most people don't want.
- **A manual "mark as unread"** (flag something to come back to later) is a reasonable future addition, common in mature inbox UIs — not required for cutover, worth naming so it isn't forgotten if requested later.

## 7. Notification behavior

**Conversation owns history. Notifications only surface change — they are not a second place history lives.**

This distinction matters more than it first appears. It's tempting to build a "notifications" system that stores its own record of what happened ("Emma sent a message," logged and kept) — don't. A notification is a transient pointer that something changed in a Conversation the venue already owns; the moment it starts accumulating its own durable history of *what was said*, it has become an unaccountable second copy of Conversation's own job, in the exact shape Engineering Standard #10 warns against. Concretely: a notification is allowed to say "new activity in Emma & James' conversation" and link to it — it should never itself be the place a coordinator goes to read what was actually said. If a notification is deleted, dismissed, or expires, nothing about the relationship's actual history is affected, because none of it ever lived there.

With that boundary held:

- **Day one: point the existing digest engine at the new data, change nothing else.** `sendDailyDigests()` already queries "how many threads have unread, stale messages" once a day and folds it into an email a coordinator already receives. Swapping its source query from `message_threads.is_read` to `conversations.venue_unread`/`last_message_at` is exactly the kind of "new source of truth, update every reader" work Engineering Standard #7 already calls for — and it means the coordinator's existing notification habit doesn't change at all during cutover.
- **In-app, real-time**: Supabase Realtime is already part of this stack — a lightweight subscription that updates the unread badge and, if a coordinator is already sitting on the Messaging page, live-appends a new message without a manual refresh, is a contained, worthwhile addition for Phase 2B rather than a bigger project. This is additive polish, not required for correctness — flagging it as a scoped stretch goal, not assuming it's free.
- **What's explicitly not being built now**: true push notifications (phone buzzes with the app closed) — see Mobile, above. Don't let the schema's `push` channel value imply otherwise.

## 8. Search — thinking this through conceptually before any code

The concern named directly: will this still feel intuitive once there are thousands of messages, assets, contracts, and activities. Two different questions are bundled inside that, and they have different answers.

**Is raw performance a risk?** No, and it's worth saying plainly why not: this is bounded, per-venue data. Even a very active, decade-old venue is looking at low tens of thousands of messages, not millions — a Postgres trigram or full-text index handles that comfortably. "Thousands of records" is not, on its own, a scale problem for this kind of search. Treating it like one would be solving a problem this system doesn't have.

**Is relevance/organization a risk?** Yes, and this is the real thing to design for. A flat list of 200 matching messages, contracts, and activities, all ranked against each other by one opaque score, stops being intuitive well before "thousands" — it's already hard to scan at a few dozen. The fix isn't a smarter ranking algorithm; it's a different *shape* of result — and the guiding principle above answers it directly: **search should resolve to Relationships, not to individual messages or entities.**

A coordinator searching "parking" isn't looking for a message — they're looking for *who they need to go talk to*. The message, contract, or activity that matched is evidence *why* a given Relationship surfaced, not the primary thing being searched for. Concretely:

1. **The first-class result is the Relationship. Messages, contracts, and activities are the reason it matched, shown as supporting evidence underneath — not as independent, competing result rows.** This is stronger than "group by Relationship" as a display tactic; it's a claim about what search *is for* in this system. Two matching messages and one matching contract for Emma & James should never be able to outrank Emma & James herself, or push her below a less-relevant Relationship that merely has more matching rows. This is the same anchor discipline as everything else in Program 2, applied to search specifically: Relationship is the thing that exists; messages, contracts, and activities are how you got there.
2. **Extend the existing `search_global` union, don't build a parallel search.** The command palette already unions Leads/Events/Vendors/Guests/Documents/Tasks into one ranked list with type labels and an emoji/kind indicator. Conversation messages (and, later, Contracts/Assets/Activities) should be a new branch in that same union, resolved *up* to their owning Relationship before display — this is the existing extensible pattern doing exactly the job it was built for, and it's the same "compose, don't duplicate" discipline as everything else in this program (a second, bespoke message-search system would be exactly the kind of redundant concept Engineering Standard #9 flags).
3. **Two distinct search intents need two distinct entry points, not one box trying to do both jobs:**
   - **Search within this conversation** (like Cmd+F in a single thread) — fast, scoped, no ranking complexity needed, answers "did we already discuss parking with this couple."
   - **Search everything** (the existing ⌘K palette, extended) — answers "which couple asked about parking," a rarer, heavier cross-relationship question that can tolerate more UI (type filter chips, grouped results) because it's used less often.
4. **Message results need snippet highlighting, not a truncated first line.** A Lead's name or an Event's title is short and structured; a message body is long free text. Showing "...confirm your final headcount of **120 guests** for the..." (matched term in context) is the difference between search being useful and being a list of things to manually re-read. This is specific to message content and doesn't apply to the existing entity types the same way — worth calling out as new work, not an extension of the current truncate-to-N-characters behavior.
5. **Default ordering: type-grouped, then most-recently-active first within each group** — not a single blended relevance score. This keeps the mental model simple and matches how coordinators actually think ("show me the messages that match, most recent first," not "trust an algorithm to know what I meant").

```
⌘K  parking
┌────────────────────────────────────────────────┐
│  Emma & James                                     │
│    💬 "...confirm the parking situation for..."    │
│       2 days ago                                  │
│    ✉ "Re: parking for guest arrival"    3 wks ago │
│                                                    │
│  The Hendersons                                   │
│    ✉ "Re: parking for 120 guests"      3 wks ago │
│                                                    │
│  [ All  Leads  Events  Messages  Documents  Tasks ]│
└────────────────────────────────────────────────┘
```

Note the shape: **Relationship names are the results; matching messages nest underneath as the reason.** There is no separate "Messages" section competing with a "Relationships" section — a match in a message *is* a match on its Relationship, surfaced together, never as two peer entries a coordinator has to reconcile.

No code is implied by any of this — the point of this section is confidence that the *shape* (resolves to Relationships, extending the existing union, two intents not one, snippets for text) holds up before anyone writes a query.

## 9. Rollout strategy

**Migration principle: preserving historical relationship context is more important than simplifying the migration.** Where any future decision trades off "this backfill/cutover step would be easier" against "this would flatten or lose some nuance of what actually happened in a relationship's history," the historical context wins. A migration that's a little more work but leaves every relationship's full story intact is the right trade every time; a simpler migration that quietly loses the thread of *why* a conversation looks the way it does is not an acceptable shortcut, even under schedule pressure.

Phase 2A's forward-sync bridge means this cutover is not a one-way door forced on a deadline — that's the asset to spend. Progression between stages is **confidence-gated, not date-gated**: a stage ends when its criteria are met, not when a calendar says so.

**The coordinator experience and the couple portal are not cut over in parallel, by explicit decision.** The coordinator inbox is the higher-risk surface — it's where coordinators spend their whole day, and it's the one the "venue should experience customers, not architecture" principle is judged against first. The couple portal keeps working exactly as it does today, untouched, until the coordinator side has been validated as feeling completely natural — not just functionally correct.

1. **Internal dogfood — coordinator side only.** Wevenu's own test venue(s) run the new coordinator Conversation UI (main-nav inbox, and the Lead/Client detail page's Conversation tab) while every real venue, and the couple portal for every venue including the dogfood one, keeps the current experience untouched.
   - **Success criteria to advance:** every historical message backfilled for the dogfood venue(s) is verifiably present and correctly attributed (spot-checked against the old UI, not just row counts); the forward-sync bridge has run with zero unresolved `RAISE WARNING`s in the logs for at least one full workflow cycle (inquiry → conversion → planning messages); internal users report the merged conversation reads as *one coherent story*, not as visibly-stitched-together fragments from two old systems; **the coordinator experience feels natural enough that Relationship, Opportunity, and Conversation as concepts have genuinely receded — the workspace reads as "Emma & James," not as a database view** — confirmed by actually using it, not by code review or a type-check passing.
2. **Opt-in beta, per venue — coordinator side only.** A small number of consenting real venues flip the flag for their coordinator experience. Their couple portal is still untouched. Because the legacy tables and UI are untouched underneath (Phase 2A's bridge design), turning the flag back off is a safe, real rollback — not a data-loss risk.
   - **Success criteria to advance:** no beta venue reports a "where did my message history go" moment; no data-integrity issue found (a message present in the old UI but missing, misattributed, or duplicated in the new one); beta coordinators, asked directly, say they'd be upset to go back to the old two-surface experience — a real signal of genuine improvement, not just absence of complaints.
3. **Couple portal cutover begins — only now, and only once stages 1-2 above are validated.** The couple-facing Conversation view (fixing the "can't see an email sent to me" blind spot) is a new, separate go/no-go, not an automatic continuation of the coordinator rollout. It gets its own dogfood → opt-in beta pass, following the same shape.
4. **Default-on, with a bounded escape hatch, for both sides.** New venues start here by default; existing venues are prompted to switch, with a temporary "switch back" option for a defined window rather than an indefinite one.
   - **Success criteria to advance:** the switch-back option is used rarely enough that its usage rate, not a fixed date, is what signals readiness to remove it; support/confusion volume related to the new experience has leveled off rather than trending upward as more venues adopt it.
5. **Full retirement.** Retire `message_threads`/`messages`/`couple_threads`/`couple_messages` and remove the sync bridge — exactly the step Phase 2A's Architecture Delta already named as the intended endpoint.
   - **Success criteria to advance:** every venue has been stable on the new experience (both sides) with the switch-back option unused for a meaningful stretch; a final reconciliation pass confirms the legacy tables contain nothing that isn't already faithfully represented in `conversation_messages`.

Two things worth stating plainly to whoever is reading this before it starts:

- **No data loss is possible at any step**, by construction — the backfill already ran, the bridge keeps both sides current, and nothing is deleted until step 5. This is what makes "gradual and reversible" a credible plan rather than a hopeful one.
- **This is a real workflow change for coordinators**, not just a backend refactor — two familiar surfaces become one. A short "what's new" callout at the moment a venue's flag flips (not a silent swap) is worth the small effort; muscle memory for "check the Messages tab" vs. "check Messaging" doesn't disappear just because the code merged them.

---

## The question to keep asking throughout Phase 2B

**Does this make the Relationship page the place a venue naturally starts every interaction?**

Every decision in this document — the single inbox, channels as transports not destinations, search resolving to Relationships, Conversation and Activity Timeline as two views of one story, notifications as a pointer rather than a second history — is in service of that one outcome. If Phase 2B is implemented well, this stops being a messaging feature and becomes the **Relationship Workspace**: the front door to how a venue runs its business, and the target for every remaining Program 2 phase, not just this one (`docs/product-completion-roadmap.md` principle 5). That's the bar to keep checking against as implementation decisions come up that this document didn't anticipate.
