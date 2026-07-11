# Communication Platform — Next Phase

**Status: Design only, no code.** Written in response to "Communication Platform - Next Phase" (2026-07-12): "Now that Email and SMS are working, stop adding channels. The next work is designing the Communication experience." This document designs the Message Template Library, Sequences, Booking Workflows, and Communication Timeline — workflow and UX only, nothing implemented.

**Revised 2026-07-13 (first pass).** Two changes from the original draft, both from direct product decisions:
1. Sequences (§3) is now grounded in a competitive review of five real, established products in this exact market (§1) — reusing proven interaction patterns rather than designing a workflow system from scratch, per instruction.
2. §0 and §5's framing has been corrected. The original draft treated the three-communication-system finding as something implementation needed to resolve *before* or *alongside* Templates/Sequences work. That's wrong, and has been fixed: **the goal is one communication experience for the venue, not necessarily one implementation immediately.** Consolidation happens only where it's actually necessary for a seamless experience — which turns out to be narrower than the original draft assumed (see §5.1).

**Revised 2026-07-13 (second pass), immediately before implementation.** Competitor patterns validated common mechanics, but the product decisions below are driven by venue workflow, not competitor parity — per explicit instruction not to let §1 override that. Four changes: Sequences now has two distinct modes rather than one uniform mechanism (§3.0); Cross-Channel Templates is a firm decision, not an open question (§2.5); a standing product principle is named below, to be kept in mind through implementation, not just this document; and the UI-facing name for "Sequences" is addressed head-on (§3.6) — `sequence` stays the internal/engineering term, but the product should not expose CRM language to a venue coordinator, matching the precedent already set by Client Planning / Venue Planning.

> ### Guiding principle — carries through implementation, not just this document
>
> **Communication should never require a venue to remember what to send next.** The system either sends it automatically, or clearly indicates that manual communication is still appropriate right now. Planning remains the primary operating system after booking — communication is never a second place a coordinator has to separately keep track of.

---

## 0. Grounding facts

**There are three separate communication systems live in this codebase today, not one.** This wasn't obvious until traced end-to-end, and it's still an important fact — just not a blocking one (see §5.1 for why). In order of how real/connected each one is:

1. **Sprint 95 portal chat** (`couple_threads` / `couple_messages` — "Separate from the existing message_threads/messages tables," per its own migration comment). This is the **default, currently-active system**: the venue's main "Messaging" nav (`LegacyMessagingInbox`, despite the name) calls `/api/messages` → `get_couple_inbox` / `send_couple_message`; the couple's portal "Messages" tab (`PortalMessageSection`) calls `/api/portal/messages` → `get_portal_messages` / `send_portal_message`. Both read and write the **same table** — this is a real, working, bidirectional conversation. Its limitation: in-app only. No real email or SMS goes through it.
2. **Legacy entity messaging** (`message_threads` / `messages`, `lib/messaging/`) — scoped to a lead, client, or event rather than an ongoing relationship. This is where **real outbound email actually happens** (genuine Resend integration: send, inbound-reply webhook, delivery tracking). Used for one-off sends (a questionnaire link, a tour confirmation) more than an ongoing back-and-forth.
3. **Conversations** (`conversations` / `conversation_messages`, `lib/conversations/`) — the newest system, and architecturally the *closest thing to what this document is asked to design*: one thread per relationship, multiple channels (`email | sms | portal | internal_note | phone_log | voicemail | push`) in one chronological list. Feature-flagged off by default (`conversationExperienceEnabled`). Real SMS was wired into it last (send + inbound + signature verification). **Its "portal" channel does not reach the couple's actual portal Messages tab** — that tab is still reading from system #1 above.

**Other grounding facts:**
- **No Message Template concept exists anywhere.** The closest precedent is Contracts' merge-field system (`MERGE_FIELDS`, `{{couple_name}}`-style tokens, resolved by `lib/contracts/merge.ts`) — a real, working pattern this document reuses rather than inventing a new one.
- **No Sequence/automation/drip concept exists anywhere.** Entirely new — which is exactly why §1 reviews proven external patterns before designing it.
- **A scheduled-job mechanism already exists** (`/api/notifications/process`, `/api/digest`, `CRON_SECRET`-gated) that periodically processes `task_reminders` and sends digest emails. This is the natural home for a Sequence's "send the next step" cadence — the pattern to extend, not a new scheduler to build.
- **"Stop on booking" already has a clean hook**: the lead pipeline's `won` stage triggers `convertLeadToClient()` (see `docs/booking-workspace-design.md` §0) — the same point Booking Creation automation hooks into.
- **"Stop on task completion" already has a clean hook**: the auto-complete trigger mechanism (`triggerAutoComplete`, wired this session for `payment_received`, `document_uploaded`, `vendor_selected`) — the same event a Sequence's exit rule would listen for.
- **"Stop on reply" is channel-fragmented today**: an email reply is caught by the legacy inbound webhook (system #2); an SMS reply is caught by the inbound webhook built for Conversations (system #3). §5.1 addresses how this is handled without waiting on full consolidation.

---

## 1. Competitive review — HoneyBook, Dúbsado, Táve, Planning Pod, Tripleseat

Reviewed against the seven areas named in the request: Message Templates, Scheduled Sends, Sequences, Auto Responses, Enrollment Rules, Exit Rules, Communication History. All five are real, established products serving this same market (wedding/event vendors and venues specifically); findings below are drawn from each product's own help documentation, with confidence flagged where documentation was thin or unavailable (Táve's docs are mid-migration following its VSCO acquisition, and several other primary sources returned errors on direct fetch — those are marked accordingly rather than treated as equivalent to confirmed findings).

### 1.1 Message Templates — validates the plan already in §2

Every product uses a merge-field/token system essentially identical to what §2.3 already proposes: HoneyBook's "Smart Fields," Dúbsado's "Smart Fields," Táve's `{{double.curly}}` tokens, Tripleseat's merge fields. This is a genuinely universal, proven pattern — high confidence in reusing it as designed.

Categorization varies but Tripleseat's approach is the closest precedent to §2.2's proposal: four fixed template *types* tied to a stage of the sales/event lifecycle (Lead, Document, Discussion/General, Payment) — the same idea as this document's category list being a hint toward *where a template surfaces*, not a freeform tag system. HoneyBook instead uses user-created folders + favorites + content-type filtering, a more flexible but less structured approach.

**One unanimous finding directly affects §2.5**: no product actually shares template *content* across Email and SMS. HoneyBook's SMS is a narrow, non-authorable system-reminder feature (session/payment reminders only, no general template library). Dúbsado, Táve, and Planning Pod have no native SMS at all — only third-party integrations with entirely separate template systems. Tripleseat's SMS (via a Kenect integration) has its own separate inbox with no shared templates. The 2026-07-13 decision (§2.5) — share the variable vocabulary, never the written content — actually lands closer to what every reviewed competitor does than the original draft's more ambiguous "shared where appropriate" language did. Worth noting as validation after the fact, not as the reason the decision was made.

### 1.2 Scheduled Sends — a real gap in the original draft, now added (§3.5)

Every product with a real compose flow treats this as a **distinct, simpler feature from Sequences**: a single message, scheduled for a future date/time, independent of any multi-step automation. HoneyBook (up to 18 months out, cancelable), Dúbsado (preset offsets or custom date/time, unavailable for messages with attachments), Táve ("in 5 minutes" / "at 8am" / custom), Tripleseat (explicit Send Now/Send Later toggle, though only in its Email Blast tool — a Capterra reviewer notes the everyday Discussion compose flow lacks this). Planning Pod is the one product where this wasn't found documented at all.

The original draft of this document didn't separate Scheduled Sends from Sequences — that's a gap, fixed in §3.5 below. This is the single clearest "reuse a proven pattern" takeaway from the whole review: a lightweight "send this specific message later" option, sitting *next to* Sequences rather than requiring a full Sequence to be built for a one-off delayed send.

### 1.3 Sequences — the real structural finding

**None of the five products has a visual, branching sequence builder.** HoneyBook comes closest with Yes/No conditional branching based on project state (contract signed, file viewed, etc.) inside its "Automations 2.0." Every other product — Dúbsado, Táve, Planning Pod (which appears to have no sequence engine at all, only a fixed roster of single transactional emails), and Tripleseat — implements what *looks* like a multi-step sequence as a **set of independent trigger → single-action rules** that collectively produce a sequence-like cadence, not one ordered/branching step list a contact visibly moves through. Tripleseat's "Automated Discussions" are explicitly this: to build a 3-touch cadence, a venue creates three separate automation rules, each independently triggered.

**This directly validates §3.1's existing design** (a named, ordered list of steps with relative-offset delays) as already at or above the sophistication most of this category actually ships — the linear, step-list model is not a compromise relative to what's proven; it's what four of the five reviewed products approximate through separate rules anyway, and Wevenu's version would be more legible (one visible sequence, not N independent rules a coordinator has to mentally reassemble).

Delay mechanics are consistently relative-offset (Dúbsado explicitly recommends relative triggers over fixed dates "except for time-sensitive campaigns"; Táve's delay lives inside the send-email action itself) — validates §3.1 unchanged.

### 1.4 Auto Responses — collapses into Sequences, with one exception worth keeping separate

Across four of the five products, "auto response to a new inquiry" is not a distinct feature — it's just a Sequence/Automation/Workflow whose trigger is "new lead created" and whose first step has zero delay (HoneyBook, Dúbsado, Táve, Tripleseat all confirm this exact pattern; Planning Pod has a named "Lead Auto-Reply" but it's a fixed system email, not a customizable sequence). **This means §3 doesn't need a separate "Auto Response" mechanism — an Auto Response is simply a Sequence with a specific enrollment trigger and an immediate first step, which §3.2's enrollment rules already support.**

The one exception worth naming as a genuinely distinct, separate pattern: **HoneyBook's Out-of-Office feature** — a manually-toggled, date-ranged, throttled (once per project per 7 days) blanket auto-reply covering *multiple* inbound trigger types at once (contact forms, scheduler inquiries, lead ads, new project messages), explicitly separate from its Automations engine, with a return-digest summary. This is a different use case from an always-on new-lead nurture sequence — "I'm away, cover everything for two weeks" vs. "always respond to new inquiries this way." Worth naming as a future addition once Sequences exist, not designed further here — flagged, not scoped.

### 1.5 Enrollment Rules — HoneyBook is the precedent to emulate breadth from

HoneyBook has by far the richest documented trigger vocabulary: contact/lead form submitted, meeting scheduled, session events, questionnaire submitted, contract signed, payment made, **project stage changed**, **tags added**. This directly validates §3.2's plan to hook Sequence enrollment into real, already-observable events in this codebase (pipeline stage, task completion, tour-without-follow-up) rather than a narrower form-submission-only trigger set like Planning Pod's. Aim for HoneyBook's breadth, using Wevenu's own existing observable events rather than inventing new ones.

### 1.6 Exit Rules — the real finding, and it changes how §3.3 should be framed

**Not one of the five reviewed products has a documented, first-class "stop this sequence if the contact replies / books / completes something" exit rule.** This held up across targeted, repeated searching on all five:
- HoneyBook gets closest via generic conditional branching (a step can check project state and route accordingly) — but that's a manually-designed branch, not a system-wide automatic exit rule.
- Dúbsado offers only manual Pause/Hold gates — no automatic exit condition exists in its documented action list.
- Táve, Planning Pod, and Tripleseat have **no exit mechanism found at all** — consistent with their flatter, rule-based (rather than stateful multi-step) architecture, where "exiting mid-sequence" doesn't clearly apply.

**This is not a gap in the research — it's a real, consistent gap in this entire competitive set.** The three exit rules named in the original request (stop on reply, stop on booking, stop on task completion) are not features to copy from a competitor, because none of them have built this well. What §3.3 already proposed — hooking directly into real, existing events already firing in this codebase (`triggerAutoComplete`, the `won`-stage transition, the inbound-reply webhooks) — would put Wevenu's exit-rule handling ahead of the entire reviewed competitive set, not behind it. Confidence in that design goes up, not down, from this research; it's just not "borrowed" from anywhere, because there was nothing to borrow.

### 1.7 Communication History — validates the Booking Workspace decision already made

Every product with more than one project-scoping level shows the same two-tier pattern already decided in `docs/booking-workspace-design.md` §2.2: a project/event-scoped default view, plus a separate contact/client-level rollup across that contact's full history (HoneyBook's "Contact workspace," Dúbsado's Address Book explicitly aggregating "past interactions... across all of their projects"). Planning Pod and Tripleseat are the exceptions — both appear to have **no cross-event rollup at all**, only a per-event/per-booking view (Tripleseat's cross-event visibility is limited to a data export report, not a browsable timeline). This validates §2.2's decision directly: booking-scoped default view with full relationship history reachable is the stronger, proven pattern, not the weaker one.

**Also confirmed: no product natively unifies Email and SMS (or any other channel) into one chronological history.** Every product with SMS at all keeps it in a fully separate inbox (Tripleseat's Kenect integration explicitly has "its own inbox... like an email inbox, but for texts," distinct from its Discussions tab). This means §5's "one conversation across Email, SMS, and Portal messages" goal — once the consolidation work in §5.1 actually lands — would be a genuine differentiator, not table stakes. Worth knowing that going in: this is the one area across all seven where Wevenu's design target is ahead of, not caught up to, what this category has actually shipped.

---

## 2. Message Template Library

### 2.1 What a template is

A named, reusable message body with a category and a set of variables — conceptually identical to how Contract templates already work (`MERGE_FIELDS`, a starter `DEFAULT_TEMPLATE_CONTENT`, an `isDefault` flag), extended to Email and SMS instead of contract documents. Validated as a universal pattern in §1.1.

### 2.2 Categories

Fixed, small, venue-editable-in-content-not-in-taxonomy — matching the existing convention used for `DocumentCategory` and `TaskCategory` elsewhere in this codebase (a fixed enum, not a freeform tag system), and matching Tripleseat's lifecycle-stage-tied template types (§1.1). Proposed starting set, informed by what already generates real outbound messages today: **Inquiry Follow-Up, Tour, Booking Confirmation, Planning Reminder, Payment Reminder, Vendor Coordination, Post-Event, General.** Each category is a hint for *where a template shows up as a suggestion* (e.g., Payment Reminder templates surface when composing from a Payments-linked task), not a hard restriction on where it can be used.

### 2.3 Variables

Reuses the merge-field pattern already proven in Contracts — and confirmed universal across every reviewed competitor (§1.1) — rather than inventing new syntax: `{{client_name}}`, `{{event_date}}`, `{{venue_name}}`, `{{coordinator_name}}`, plus new ones specific to Planning context — `{{task_name}}`, `{{days_until_event}}` — since templates are meant to be triggered *from* Planning tasks (§4). Resolution happens the same way `lib/contracts/merge.ts` already resolves contract merge fields: read the real field, substitute, never leave a raw `{{token}}` in a sent message. A variable with no value available (e.g., `{{task_name}}` used in a template not sent from a task) should block sending with a clear reason, not send a broken message with an empty gap.

### 2.4 Import existing templates

Directly reuses the "Bring Your Existing Checklist" pattern shipped for Planning Templates (`docs/planning-templates-import.md`) rather than designing something new: a coordinator pastes an email/text they already use, picks a category, and Luv proposes a structured template (subject + body for email, body only for SMS, with likely variables flagged) that opens for review before saving — never auto-saved, same "system proposes, human confirms" discipline. The same refinement that landed on Planning Templates import applies here identically: **the venue's existing wording is the source of truth; Luv organizes and identifies variables, it doesn't rewrite tone or invent content.**

### 2.5 Cross-channel templates — decided 2026-07-13

Firm decision, not an open design question: **merge fields stay consistent across channels; content never does.** The same variable set (`{{client_name}}`, `{{event_date}}`, etc. — §2.3) is available whether a coordinator is writing an email template or an SMS template, so a coordinator never has to learn two different variable vocabularies depending on channel. But a template's actual written content — subject + body for email, body for SMS — is **always independently authored per channel**, never defaulted, copied, or assumed shared. Email and SMS are different enough as communication styles (length, tone, formality) that treating one as the "real" content and the other as a derived/trimmed version would produce a template that reads well in one channel and awkwardly in the other. A template belongs to one or both channels; if both, it holds two genuinely separate, independently editable content variants under one name/category/variable-set — never a single shared body.

This resolves what the original draft flagged as an open question (§1.1 — no reviewed competitor shares templates across channels at all). The decision here isn't "prove it's the same content," it's narrower and cleaner: share the *vocabulary* a coordinator writes with, never the *writing* itself.

---

## 3. Sequences

### 3.0 Two modes, not one — decided 2026-07-13

The mechanics in §3.1–§3.5 are shared, but **when and how a Sequence is the primary tool changes at the moment of booking**, and this document previously treated Sequences as roughly uniform across that line. It isn't:

- **Before booking, Sequences are a primary capability.** A Sales Sequence — new-inquiry follow-up, a nurture cadence for a lead that's gone quiet — is a first-class, freestanding thing a coordinator builds and manages on its own terms. Nothing else is driving that communication; the Sequence *is* the tool.
- **After booking, Communication supports Planning — it does not replace it.** Planning tasks should drive reminders and follow-up wherever possible, not the other way around. This means the preferred post-booking pattern is a **task-linked reminder** (§4's existing "Planning task gains an optional link to a Sequence" mechanism), not a coordinator separately building and managing a freestanding Sequence disconnected from any task. A freestanding post-booking Sequence isn't forbidden — a pre-event countdown series genuinely doesn't belong to one specific task — but task-linked should be the default reach, not the exception, and Planning's task list stays the place a coordinator looks to understand what's happening, never a second communication-specific dashboard competing for that role.

Practically, this changes nothing about §3.1–§3.5's mechanics — a Sequence is a Sequence either way. It changes what the *product* steers a coordinator toward building, and where a Sequence's context/origin should push it to live once built (§3.2's enrollment rules, §4's task link).

### 3.1 What a sequence is

A named, ordered list of steps, each step referencing one Message Template (§2) plus a delay before it sends relative to the previous step (or relative to enrollment, for the first step) — the same relative-offset pattern Planning and Timeline templates already use (`daysOffset`), applied to a time-since-enrollment axis instead of time-relative-to-event-date. Confirmed in §1.3 as matching or exceeding the actual sophistication shipped by four of the five reviewed competitors, who approximate a sequence via multiple independent single-step rules rather than one visible ordered list.

### 3.2 Enrollment rules

A contact enters a Sequence in one of two ways, matching how every other automatic-vs-manual mechanism in this codebase is already split, and matching HoneyBook's trigger breadth (§1.5) as the target to aim for:
- **Manual**: a coordinator enrolls a specific lead/client into a Sequence from their record — an explicit, visible action, not silent.
- **Rule-based**: a Sequence is configured to auto-enroll on a real, existing event this codebase can already observe — a lead entering a specific pipeline stage, a Planning task becoming overdue, a tour completing with no follow-up sent (this last one already has a real observation surfaced today via Luv's "Completed tours without follow-up" insight (`lib/luv/observations.ts`) — a Sequence turns that existing *observation* into an existing *action*, which is a meaningful upgrade in kind, not a new mechanism).

An Auto Response (§1.4) is not a separate mechanism — it's a Sequence enrolled on "new lead created" with a zero-delay first step. No additional design needed beyond what this section already specifies.

### 3.3 Exit rules

Three named explicitly in the request. Per §1.6, none of these are proven patterns to copy — they're a real gap across the entire reviewed competitive set, which makes getting them right a genuine differentiator, not a checklist of features to match:

- **Stop on reply.** An email step's reply is observable via the legacy inbound webhook; an SMS step's reply is observable via the Conversations inbound webhook already built. A Sequence step records *which system* it went out through, so the exit check knows where to look. This doesn't require the systems to be merged first (see §5.1) — it requires the Sequence engine to check the right existing inbound path per channel, which already exists for both email and SMS today.
- **Stop on booking.** Hooks into the same `won`-stage transition Booking Creation automation (`docs/booking-workspace-design.md` §1) already hooks into — a lead-nurture Sequence should stop the moment that lead becomes a client, for the same reason Booking Creation fires at that exact moment.
- **Stop on task completion, where appropriate.** "Where appropriate" matters here too: this only makes sense for a Sequence explicitly tied to a Planning task in the first place (e.g., a "final payment reminder" Sequence tied to the Final Payment task) — not every Sequence has a task to watch. Reuses the exact auto-complete trigger event (`triggerAutoComplete`) already firing for `payment_received` / `document_uploaded` / `vendor_selected` — a Sequence exit is just one more listener on an event that already exists, not a new completion-detection mechanism.

### 3.4 What a Sequence is not

Worth stating plainly since it's easy to over-scope: a Sequence is not a replacement for Planning reminders (`task_reminders`, the existing due/overdue/escalation email system) — that mechanism already exists, already works, and already fires from Planning tasks directly. A Sequence is for *multi-step, templated, timed* communication a venue wants to run deliberately (a 5-email nurture sequence for a new inquiry, a 3-text pre-event countdown) — a different, coarser-grained tool than a single task's reminder cadence, not a wholesale replacement for it.

### 3.5 Scheduled Sends — a distinct, simpler sibling to Sequences

Not in the original draft — added per §1.2's finding that every reviewed competitor with a real compose flow treats this as its own lightweight feature, separate from full Sequences. A coordinator composing a single message (from a template or from scratch) can pick a future send time instead of sending immediately — no steps, no enrollment rules, no exit rules, just "send this one thing later." This sits next to Sequences as a simpler tool for a simpler need, using the same scheduled-job infrastructure named in §0 rather than requiring a one-step Sequence to be built for what is, in every reviewed product, a one-click option on the compose box itself.

### 3.6 Naming — not "Sequences" in the UI

`sequence` stays the internal/engineering term (the underlying table, the codebase vocabulary) — nothing in §3.1–§3.5 changes because of this section. But nothing here should be exposed to a coordinator as "Sequences," "Enrollment," or "Exit" either. This is the same move already made for Client Planning / Venue Planning — a real technical concept (a playbook applied to an event) got a name a venue owner actually says, and the internal `playbook_templates` table never needed to change to make that true. Same shape of decision here.

**Recommended user-facing noun: "Series."** Reads naturally in exactly the phrasing a coordinator would actually use — a Follow-Up Series, a Welcome Series, a Reminder Series — without needing a single umbrella term to cover every use case, the same way "Planning Template" is the category and "Standard Wedding" is the specific instance a coordinator actually names and talks about:
- Pre-booking (§3.0): **"Follow-Up Series"** as the default/generic instance name a new one starts with — directly matches the "Inquiry Follow-Up" category already proposed in §2.2, so the category name and the object name a coordinator sees line up instead of introducing a second vocabulary.
- Post-booking, task-linked (§3.0, §4): **"Reminder Series"** — or, more often, no separate name at all, since §3.0's preference is for these to live inside a Planning task as "this task sends reminders automatically" rather than surface as a separately-managed object a coordinator navigates to.
- A starter/default one a venue might begin from: **"Welcome Series"** — matches the user's own suggestion directly, and reads naturally as the first thing a new inquiry receives.

**Section-level naming**, extending the same lens: the settings/library area this all lives in should be called **"Communication"** (matching "Planning" as a single-word top-level section, not "Communication Platform" or "Communication Hub"), with "Series," "Templates," and the Timeline as the things inside it — mirroring how "Planning" contains Templates and Tasks today.

**Worth carrying the same lens further at implementation time**, though not decided here since it wasn't explicitly asked: "Enrollment Rules" and "Exit Rules" are exactly as CRM-flavored as "Sequences" was. A natural, low-risk extension already implied by the same principle: **"Starts when..."** and **"Stops when..."** as the actual UI copy, rather than "Enrollment trigger" / "Exit condition." Flagged as a strong candidate, not committed to as a decision the way "Series" is above.

---

## 4. Booking Workflows

This section is largely already designed in `docs/booking-workspace-design.md` §4 ("Communication supports Planning, doesn't replace it") — restated and extended here with the vocabulary this document adds, and sharpened by §3.0's decision that post-booking communication follows Planning rather than standing beside it:

- **Planning remains the primary operating system.** Templates and Series are tools *Planning tasks reach for*, not a parallel system competing with Planning for the coordinator's attention. A task's "Send reminder" action should open a pre-filled message using a template appropriate to that task's category (§2.2), not a blank compose box.
- **Communication exists to reduce manual chasing — and per the guiding principle above, a coordinator should never have to remember to check whether it's still needed.** A Payment Reminder Series enrolled on a payment-linked task exits automatically the moment that payment completes (§3.3) — the venue sets it up once, it does the chasing, Planning still owns the source of truth for whether the payment happened. Where no automatic Series is set up for a task, the task itself should make it obvious that manual follow-up is the current expectation — never a silent gap the coordinator has to notice on their own.
- **The concrete connection point**: a Planning task gains an optional link to a Series (or a single Template, for a one-off) the same way it already gains an `actionType` link to Vendors/Payments/Documents/Guest List (`docs/booking-workspace-design.md` §3.1) — same mechanism, extended to point at communication instead of only at other platform sections. Per §3.0, this task-linked path is the default reach for post-booking communication — a freestanding, task-less Series remains possible (a pre-event countdown has no single task to attach to) but isn't the primary pattern the product steers a coordinator toward once a lead becomes a booking.

---

## 5. Communication Timeline

### 5.1 Consolidate only where it's actually necessary — not a blocking prerequisite

The original draft of this document treated the three-system finding in §0 as something that had to be resolved *before* Templates/Sequences work could safely proceed. That was wrong, and is corrected here: **the goal is one communication experience for the venue, not necessarily one implementation immediately.** Templates and Sequences (§2, §3) can be built now, targeting Conversations (system #3, §0), without waiting on full consolidation.

**Correction (2026-07-14, discovered during Phase 2 implementation):** this section originally claimed "their actual channels (email, SMS) already work end-to-end through Conversations today." That was only true for SMS. Conversations' real-time compose box has an "Email" channel option in its dropdown, but selecting it and clicking Send does **not** actually call Resend — it's DB-only, exactly like "portal," just not flagged as such at the time. Scheduled Sends (Phase 2, `lib/scheduled-messages/processor.ts`) sends real email independently of that gap — a scheduled message resolves and sends for real regardless of whether the *immediate* compose path does — so this didn't block Phase 2. But the gap itself is real and is logged to `docs/product-backlog.md` ("Immediate Email Send in Conversations Isn't Real") rather than silently left uncorrected in this document.

**The one place this genuinely matters, narrowed down:** a Sequence step or Scheduled Send using the **"portal"** channel option would write to `conversation_messages` in a way the couple's real portal Messages tab (still reading from system #1) would never show them — a message that looks sent but is functionally invisible. The fix is narrow, not a blocking prerequisite for the whole feature: **don't offer "portal" as a channel choice in Sequences or Scheduled Sends until the portal-reads-from-Conversations gap is closed.** Email and SMS ship now. Portal joins once that specific, scoped gap closes — not before, and not as a reason to delay email/SMS-based Templates and Sequences in the meantime.

Legacy entity messaging (system #2) doesn't need a decision before Sequences can ship either — a Sequence step is just another way real email/SMS gets sent through Conversations; it doesn't require legacy messaging to be folded in or retired first. That question (§6) stays open, addressed whenever it's actually forcing a decision, not on a schedule set by this document.

### 5.2 What the unified timeline looks like

Chronological, single scrollable thread, each message tagged with its channel (the `ConversationChannel` type and `CHANNEL_META` icon/label mapping already exist and already render this exact tag today — `components/conversations/conversation-thread.tsx`). No separate tabs or folders per channel — channel is metadata on a message, never a navigation destination, which is already the explicit design principle documented in that component today ("Channel is a transport, never a destination"). This document's contribution on top of what exists: Sequence-sent messages appear in this same timeline, tagged with which Sequence and step produced them, so a coordinator scrolling the history sees "this was the 2nd email in the Payment Reminder sequence" rather than an unexplained message with no origin. Per §1.7, this level of channel unification is not something any reviewed competitor has actually shipped — it's a real differentiator once §5.1's narrow portal gap closes, not a catch-up feature.

### 5.3 Relationship-based, and what that means for pre-booking contacts

A Conversation already anchors to a `venue_customer_relationship`, which already exists for leads (not just booked clients) — so "relationship-based" already covers the full lifecycle from first inquiry through post-event, not just post-booking. This is worth stating because it could be misread as scoped to Booking Workflows (§4) only — it isn't. A Sequence enrolled on lead creation, sending its steps by email, and a Booking Workflow reminder sent by SMS after booking are the same conversation, continuously, today — no dependency on §5.1's portal-gap work for the email/SMS case.

---

## 6. Conflicts & open questions — summary

1. **Three communication systems exist, not one (§0)** — no longer a blocking finding (§5.1). Templates and Sequences target Conversations directly, using its already-working email/SMS channels now.
2. **"Portal" as a Sequence/Scheduled Send channel (§5.1)** — narrowly deferred until the couple's actual portal Messages tab reads from Conversations. Everything else in this document is not gated on this.
3. **"Stop on reply" is channel-fragmented (§3.3)** — not blocking; each channel's exit check hooks into its own already-working inbound system (legacy webhook for email, Conversations webhook for SMS).
4. **What happens to legacy entity messaging (§5.1)** — fold into Conversations' email channel, keep as a separate pre-relationship tool, or both. Named, genuinely open, but not forcing a decision before Sequences can ship.
5. **Existing `couple_threads`/`couple_messages` history** — needs a real migration/backfill path into Conversations whenever the portal-gap work in §5.1 actually happens; not designed further here.
6. **Cross-channel templates (§2.5) — Decided 2026-07-13.** Merge fields shared and consistent across channels; content always independently editable, never assumed shared. No longer open.
7. **HoneyBook-style Out-of-Office (§1.4)** — named as a real, distinct pattern worth a future addition once Series exist; not scoped in this document.
8. **UI-facing naming beyond "Series" (§3.6)** — "Starts when.../Stops when..." proposed for Enrollment/Exit Rules as a strong candidate, not a committed decision the way "Series" is.

---

## 7. What this document deliberately does not do

No code, no schema, no migrations. Where a section names a new field, table, or mechanism (Sequence steps, Template variables, the task↔Sequence link), that identifies the *shape* of the work for whoever scopes implementation — not a spec to build from directly. Existing architecture — the merge-field pattern, the auto-complete trigger mechanism, the scheduled-job infrastructure, the Conversations channel model — is treated as fixed and extended, never redesigned.
