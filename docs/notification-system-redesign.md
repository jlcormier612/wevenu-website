# Notification System Redesign — Design

**Status:** Design only — no code yet, explicitly requested before implementing anything. This supersedes the topic-based grouping proposed in the previous conversation turn (Leads & Referrals / Correspondence / Bookings & Contracts / Payments / Planning Activity / Vendors / Feedback & Relationship) — that grouping was still organized around the underlying event; this document reorganizes around how a venue owner experiences their work instead.
**Relationship to other docs:** Another direct application of the North Star in `docs/program-2-implementation-plan.md` — every decision here is checked against whether it reduces cognitive load for the venue owner, not just whether it's technically tidy.

---

## Four separate ideas, not one

The request bundles four distinct architectural moves. Worth naming separately before designing any of them, because conflating them is exactly how a settings page ends up as one long list of individual toggles:

1. **What a venue wants to know** (categories, grouped by experience)
2. **How they want to be told** (channels — in-app, email, SMS, push)
3. **How much configuration they should ever have to do** (profiles)
4. **Whether an unnoticed event matters enough to escalate** (attention management)

These are four orthogonal axes. A category doesn't own a channel; a channel doesn't decide urgency. Keeping them separate is what lets each one stay simple on its own.

## Current state (grounded)

- The existing table (`venue_notification_preferences`) already has a nascent, unused per-channel dimension sitting in it — `channel_email`/`channel_sms`/`channel_push` columns exist but aren't wired to anything. The architecture is closer to this design than it looks; it mostly needs activating and extending, not rebuilding.
- The current 7 event types (new inquiry, RSVP received, task completed, vendor check-in, feedback received, referral received, message received) are all real, each with a working DB trigger — see the previous turn's research. Nothing here proposes removing any of that; it's a reorganization of how they're presented and a foundation for the many more types already anticipated (payments, contracts, team activity).

---

## 1. Categories — grouped by experience, not event

**Business Critical** — things with real financial or relationship consequence if missed: new inquiry, an unanswered inquiry aging past a threshold, payment overdue *(future)*, a contract sitting unsigned *(future)*.

**Customer Communication** — activity inside a Conversation: a new message arriving, on any channel (this maps directly onto Program 2's Conversation model — one notification type covering every transport, not one per channel).

**Planning Progress** — the day-to-day mechanics of getting an event ready: task completed, RSVP received, questionnaire submitted *(future)*.

**Vendor Activity** — vendor check-in today; vendor confirmed/declined an assignment, a new vendor inquiry *(future, ties directly to the vendor onboarding design)*.

**Team Activity** — a new category, not yet backed by any existing type: a team member joins, completes an assigned task, or is active for the first time in a while. Worth building even though nothing fires it yet, since Program 2's own team-collaboration work already tracks the underlying facts (`venue_staff.last_active_at`, invitations).

**Relationship & Growth** — feedback received; anniversary/re-engagement opportunities *(future, ties to the Relationship model)*.

**Luv** — Luv's own observations and suggestions (a lead going cold, a drafted follow-up ready for review). Currently Luv is pull-only — a dashboard widget a coordinator checks, not something that pushes a notification. Making it a category is the deliberate decision to let Luv interrupt, optionally, rather than only wait to be asked.

**One honest ambiguity, not resolved by fiat:** "Referral received" could reasonably live in Business Critical (it's a lead) or Relationship & Growth (it's a sign of a happy customer). Rather than force a single canonical home, the underlying event should be free to belong to the category a venue actually experiences it as — which argues for the data model tagging a type with one *primary* category for the default view, without structurally preventing it from being surfaced under a second in the future. Not a blocker to building the rest of this.

## 2. Channels — separated from categories entirely

A venue decides *what* they want to know independent of *how*. Each category × channel is its own cell, not a single flat on/off:

|                        | In-app | Email | SMS *(future)* | Push *(future)* |
|------------------------|:------:|:-----:|:---------------:|:----------------:|
| Business Critical       |   ✓    |   ✓   |        —         |        —         |
| Customer Communication  |   ✓    |   ✓   |        —         |        —         |
| Planning Progress       |   ✓    |       |        —         |        —         |
| Vendor Activity         |   ✓    |       |        —         |        —         |
| Team Activity           |   ✓    |       |        —         |        —         |
| Relationship & Growth   |   ✓    |       |        —         |        —         |
| Luv                     |   ✓    |       |        —         |        —         |

This is a "Recommended" profile example, not a mandate — the point is the *shape*: a matrix, not a list. SMS and push stay visibly disabled until those channels are actually built (matching the existing "Future" labeling already used in the Notification Engine panel), rather than offered and silently ignored.

## 3. Notification profiles — most venues never see the matrix

**Minimal** — Business Critical only, in-app + email. For a venue that wants the phone to stay quiet.
**Recommended** — the matrix above. The shipped default.
**Everything** — every category, every available channel, on.
**Custom** — unlocks the full matrix. Picking any individual toggle away from a preset silently switches the profile to Custom — the same "pick a sensible default, only reveal the grid to someone who actually wants to touch it" shape as progressive disclosure everywhere else in this app.

Most venues should be able to set this up in one click and never open the matrix again. That's the actual measure of success here, not how complete the matrix is.

## 4. Attention management — informational vs. escalating

The deepest idea in the request, and the one most worth being honest about scope on. Two kinds of events:

- **Informational** — fires once, done. A task completed. A vendor checked in. Nothing more needs to happen.
- **Escalating** — matters more the longer it's ignored. An unanswered inquiry is the concrete example given: if nobody has replied within some threshold, it shouldn't just sit as one quiet in-app badge next to a hundred others — it should become louder (upgrade from in-app-only to also email, or surface at the top of a "needs attention" view) the longer it goes unaddressed.

What this actually requires, stated plainly so it isn't underestimated:
- A definition of **"resolved"** per escalating type — for an unanswered inquiry, the natural definition already exists in infrastructure built this session: has a `venue_staff` message been sent in that Relationship's Conversation since the inquiry arrived? If yes, resolved, escalation stops. This is a real, concrete tie-in to the Conversation model, not a new concept invented for this.
- A scheduled check (the same shape as the existing digest/reminder engines — a periodic job, not something computed on page load) that finds unresolved escalating notifications past their threshold and upgrades them.
- A place those upgraded notifications actually surface more insistently than a normal badge — likely a "Needs Attention" view, which this app already has a name for (`components/dashboard/needs-attention.tsx` already exists as a dashboard widget) — this may be an extension of that existing surface rather than a new one.

**Scope recommendation:** don't build escalation for all seven-plus categories at once. Start with the one concrete example already named — unanswered inquiries — prove the "define resolved, check on a schedule, surface more loudly" shape works end to end, then extend to other escalating types (an unpaid overdue invoice is the next obvious candidate) once that shape is validated. This is the same "one migration at a time" discipline already established for Program 2, applied to a feature instead of a schema change.

---

## What's deliberately not decided here

- Exact escalation thresholds (how long is "unanswered") — a product judgment call, not an architectural one, and probably worth being configurable per venue rather than hardcoded.
- Whether "Referral received" gets a second home, or Luv's notifications need their own finer-grained sub-types.
- The exact database shape (a new join table for category × channel × profile vs. extending the existing preferences table) — that's an implementation detail for whenever this moves from design to code, not settled here.

No code has been written for any of this. This is the checkpoint before that starts.
