# Conversation Lifecycle Design

**Status:** Design proposal — not yet implemented. This is the lifecycle-first pass requested before Program 2 Phase 2 begins; it revises (and should be read as superseding) the schema sketch in `docs/program-2-implementation-plan.md`'s Phase 2 section, which was written transport-first.
**Relationship to other docs:** `docs/domain-model.md`'s Conversation entity is the concept this document goes deep on. `docs/contract-lifecycle-design.md` is the sibling document for Contract's lifecycle — same treatment, different entity.

---

## The reframe

The instinct to avoid: designing "a thread that holds messages," then bolting a channel field onto each message. That produces a system whose natural unit is still the *message* — you'd still think in terms of "the email thread" or "the text conversation," just unified into one table. That's transport-first design wearing a Conversation-shaped costume.

The correct unit is the **relationship itself**. A venue doesn't have "an email thread with Emma & James that also happens to contain some texts" — it has *a relationship with Emma & James* that has, so far, involved an inquiry, a tour, some emails, a text about parking, a phone call the coordinator logged by hand, and will involve more of all of that before the wedding and after it. The Conversation is the durable record of that relationship's communication — not a container that happens to be long-lived.

This distinction has concrete design consequences, worked through below.

---

## 1. What a Conversation is anchored to

**A Conversation anchors to the Lead identity, not the Client identity, and not the Event.**

This is the single most important correction from the original Phase 2 sketch (which keyed `conversations.client_id`). Reasoning:

- Communication starts at first contact — before a Client record exists, often before there's even a confirmed event. An inquiry-form message, a tour-booking confirmation, a phone call logged the day someone first called — all of this happens while the person is still a Lead.
- Program 2 Phase 1 already established Lead as the one canonical, persistent identity for a person across their *entire* relationship with the venue, regardless of entry point (`docs/architecture-delta-phase-1.md`). A Client record is a *later stage* of that same Lead's lifecycle (`clients.lead_id` always points back), not a new identity.
- If Conversation anchored to Client, every message that happened before conversion would need to be retroactively reattached at the moment of conversion, or would be permanently orphaned from the "real" conversation. Anchoring to Lead means the conversation is already correct and complete the moment conversion happens — nothing moves, nothing merges.
- This makes Phase 1's Lead deduplication work a genuine *prerequisite* for Phase 2, not just nice-to-have prior art: if the same person could still end up as two Lead records, they'd end up as two Conversations too, recreating the exact fragmentation this phase exists to close.

For a Vendor relationship, the anchor is the vendor relationship record (`venue_vendor_relationships`) — the same logic applies: the relationship with a vendor outlives any single booking or event.

**Schema implication:** `conversations.lead_id` (not `client_id`), with `vendor_relationship_id` as the alternate anchor for vendor conversations — exactly one of the two is set.

## 2. Does a Conversation have a lifecycle of its own, or does it inherit one?

**It inherits one. A Conversation has no independent status field.**

A support-ticket model would give Conversation its own states — open, resolved, closed, reopened. That's wrong here, because a venue relationship doesn't resolve and close the way a support ticket does. Emma & James' conversation doesn't "close" after their wedding — it goes quiet, and it's exactly as valid to see three years later when they email asking about hosting their anniversary party, or when their friend mentions "Emma said you were great" and a coordinator wants the context.

Concretely: no `status` column. What a UI needs — "is this relationship currently active," "does this need attention" — is *computed*, the same way Calendar Entry was established in Phase 1 as a projection with no owned state:

- **Active** — an open Lead/Client relationship with recent activity or an upcoming Event.
- **Dormant** — no recent activity, no upcoming Event, but the relationship (Lead/Client record) still exists. Not archived. Not closed. Just quiet.
- **Needs attention** — an unanswered inbound message past some threshold, regardless of overall dormancy.

All three are read-time labels derived from `last_message_at`, the linked Lead/Client's own status, and Event dates — never a state a coordinator manually sets on the Conversation itself. This is a direct application of Engineering Standard #7's lesson generalized: don't give a projection its own writable state, or it will eventually disagree with the thing it's supposed to reflect.

## 3. Multiple people, one Conversation

Emma, James, Emma's mother, and the day-of planner might all message the venue. That's **one Conversation with four Participants**, not four conversations.

`conversation_participants` records who can appear in and contribute to the conversation — a venue Team Member, the primary Lead/Client, a Contact (per the existing `client_contacts` model, itself already scoped with a `portal_role`), or a Vendor user. Every message is attributed to whichever participant sent it (`sender_type` + `sender_id`), but attribution is a property of the message, not a fork in the conversation. "I'm looking at Emma & James' conversation" stays true regardless of which of the four people said the most recent thing in it.

This also means Contact-level `portal_role` restrictions (TR-G4) extend naturally here: a Contact scoped to `view_only` can see the conversation but not send into it; one scoped to `financial` might not see the conversation at all, depending on how conversation visibility is scoped per role — a decision for the access model in Phase 2's implementation, not this document, but worth flagging now so it isn't retrofitted later the way TR-G4 had to be.

## 4. Messages vs. relationship milestones — related, not merged

The instinct to resist here: since the goal is "the whole story of the relationship in one place," it's tempting to fold `lead_activities`/status-change history into the Conversation itself. Don't — that conflates two different entities the Domain Model already separates deliberately (Conversation vs. the activity/audit trail behind Lead, Contract, Payment, etc.).

Instead: a **Relationship Timeline** view *composes* Conversation messages and the relevant Lead/Client/Contract/Payment activity log entries, read-only, sorted chronologically — the same pattern Calendar uses to compose Events/Tours/Payments-due without owning any of them. A coordinator gets "everything that happened with Emma & James, in order" as a *view*, without Conversation's own schema needing to know about contracts, payments, or lead status changes. This keeps Conversation's actual responsibility narrow (communication) while still delivering the "one relationship, one story" experience the venue owner is asking for.

## 5. Continuity across multiple events, referrals, and re-engagement

If Emma & James book their wedding, then years later come back for a vow renewal, or refer their sister (a distinct person, a new Lead) — the anchor-to-Lead-identity design handles both correctly without special-casing:

- Emma & James returning: same Lead identity (or the Client record traced back to it), same Conversation, picks up exactly where it left off. No "reopening" step, because it was never closed.
- The sister: a new, distinct Lead (Phase 1's dedup logic wouldn't and shouldn't merge her with Emma & James — different person, different email), a new Conversation. The *referral relationship* between the two conversations is a fact worth capturing eventually (perhaps as a lightweight reference on the new Lead, `referred_by_lead_id`), but that's Lead-model scope, not something Conversation needs to represent directly.

## 6. What "creating" a Conversation actually means

Given Conversation has no independent lifecycle and anchors to an identity that's created at first contact, a Conversation row should be **provisioned automatically the moment a Lead (or vendor relationship) exists** — not explicitly created by a coordinator clicking "start a conversation," and not lazily created on first message. In practice: a database trigger or the same `find_or_create_lead()`-style path from Phase 1 ensures a Conversation row exists alongside every Lead. This means "does a conversation exist for this person" is never a question the system has to answer — it always does, the same way a Lead's activity log always exists once the Lead does, even if it's empty.

---

## Revised schema sketch

```sql
create table conversations (
  id                  uuid primary key default gen_random_uuid(),
  venue_id            uuid not null references venues(id),
  lead_id             uuid references leads(id),
  vendor_relationship_id uuid references venue_vendor_relationships(id),
  last_message_at     timestamptz,
  venue_unread        int not null default 0,
  contact_unread      int not null default 0,
  created_at          timestamptz not null default now(),
  constraint conversations_one_anchor check (
    (lead_id is not null)::int + (vendor_relationship_id is not null)::int = 1
  )
);
-- One conversation per Lead / per vendor relationship — not per Client, not per Event.
create unique index conversations_lead_uniq on conversations(lead_id) where lead_id is not null;
create unique index conversations_vendor_uniq on conversations(vendor_relationship_id) where vendor_relationship_id is not null;

create table conversation_participants (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  participant_type text not null check (participant_type in ('venue_staff','lead_or_client','contact','vendor')),
  participant_id   uuid not null, -- venue_staff.id / clients.id / client_contacts.id / vendor_users.id, per participant_type
  created_at      timestamptz not null default now()
);

create table conversation_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_type     text not null check (sender_type in ('venue_staff','lead_or_client','contact','vendor','system')),
  sender_id       uuid,
  channel         text not null check (channel in ('email','sms','portal','internal_note','phone_log','voicemail','push')),
  body            text not null,
  body_html       text,
  channel_metadata jsonb not null default '{}',
  sent_at         timestamptz not null default now(),
  venue_read_at   timestamptz,
  contact_read_at timestamptz
);

create table conversation_message_events (
  id           uuid primary key default gen_random_uuid(),
  message_id   uuid not null references conversation_messages(id) on delete cascade,
  event_type   text not null, -- delivered, bounced, opened, clicked, failed
  occurred_at  timestamptz not null default now(),
  payload      jsonb
);
```

No `status` column on `conversations`. No per-conversation "close/reopen" action anywhere in the service layer. `last_message_at`/unread counts remain as denormalized convenience fields (maintained by trigger, same pattern as today's `couple_threads`), not lifecycle state.

## What this changes from the original Phase 2 sketch

- **Anchor:** `lead_id`, not `client_id` — the identity that exists from first contact and persists through conversion, per Phase 1.
- **No `status` field** — activity/dormancy is computed, not stored, matching the Calendar Entry projection principle.
- **Provisioning:** a Conversation exists automatically alongside its Lead/vendor relationship, not created explicitly or lazily on first message.
- **Scope stays narrow:** Conversation is communication only. The "whole relationship story" experience is delivered by a composed Relationship Timeline view, not by merging Lead activity/audit history into Conversation's own schema.

Everything else from the original sketch (Participants, Messages, channel-as-a-property-not-a-table, no attachments this phase, migration strategy, order of implementation, risks, Trust Risks closed) still holds and should be read alongside this document.
