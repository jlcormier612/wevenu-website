# Wevenu V1.0 Adoption Architecture

**Status:** Pre-Sprint 107 design document  
**Date:** 2026-07-06  
**Scope:** Activation score model, engagement event schema, milestone celebrations, team activation, daily digest, Beta Command Center, infrastructure signals  

---

## Design Principles

This document is built on three foundational distinctions:

**Records ≠ Engagement.** A venue that imports 50 couples has records. A venue whose couples log into their portals every Sunday has engagement. The score reflects the latter, not the former.

**Data can be exported. Relationships cannot.** The moment another human (a couple, a vendor, a team member) participates inside Wevenu, the relationship continuity lives here. That is the moat.

**Three recommendations maximum.** The activation engine may rank hundreds of signals internally. It surfaces no more than three actions at a time, ordered by expected activation impact. More than three is cognitive overload.

---

## 1. Activation Score Model

### Scoring Dimensions (100 pts total)

#### Dimension 1 — Setup (20 pts)
Foundation. Necessary but not sufficient. Creates records, not relationships.

| Signal | Points | Type |
|---|---|---|
| Venue profile ≥ 80% complete (name, description, contact, spaces, brand) | 10 | Record |
| Availability configured + at least one package created | 10 | Record |

**Rationale:** A venue that hasn't configured these basics can't operate. But these points don't predict retention — they predict readiness to engage.

---

#### Dimension 2 — Couple Engagement (30 pts)
The strongest irreversibility dimension. Once a couple logs into her portal and starts updating her guest list, that relationship continuity lives in Wevenu.

| Signal | Points | Type |
|---|---|---|
| First couple portal invite sent | 5 | Record |
| **First couple portal opened** | **15** | **Engagement** |
| 3+ distinct couples with portal activity in last 30 days | 10 | Engagement |

**Rationale:** Portal invite sent = a coordinator's action. Portal opened = a couple's choice. That's the distinction. The 15-point weight on first couple portal open is intentional — it is the single most predictive activation event.

---

#### Dimension 3 — Workflow Completion (25 pts)
Full-loop usage. Proves Wevenu handles real work, not just data storage.

| Signal | Points | Type |
|---|---|---|
| **First contract signed inside Wevenu** | **10** | **Engagement** |
| **First invoice paid** | **10** | **Engagement** |
| First timeline with at least one vendor assigned | 5 | Record |

**Rationale:** A venue that has closed a complete contract→invoice→payment loop inside Wevenu has replaced a workflow, not just a spreadsheet. That's irreversible.

---

#### Dimension 4 — Team Adoption (15 pts)
"Jennifer's system" → "Our system." The team activation threshold is the moment Wevenu becomes institutional, not personal.

| Signal | Points | Type |
|---|---|---|
| First team member (non-owner) invited | 3 | Record |
| **First team member first login** | **7** | **Engagement** |
| Team member other than owner active in last 14 days | 5 | Habit |

**Rationale:** The 7-point weight on first team member login is what distinguishes an invitation sent (easy) from a habit shared (hard). Both matter; only one predicts retention.

---

#### Dimension 5 — Habit Formation (10 pts)
Behavioral patterns. The difference between a tool people use and one they depend on.

| Signal | Points | Type |
|---|---|---|
| 7+ active days in last 30 (any team member) | 5 | Habit |
| Luv recommendation acted on (at least once) | 5 | Habit |

**Rationale:** Active days is a streak proxy without streak anxiety. Luv recommendation acted on indicates the venue has extended trust to the AI layer — the highest-value habit signal.

---

### Score Phases and Language

| Score | Internal Name | User-Facing Language |
|---|---|---|
| 0–29 | Getting Started | "Your Venue Setup: {n}% Complete" |
| 30–49 | Building Foundation | "Your Venue Setup: {n}% Complete" |
| 50–69 | Building Momentum | "Your venue is {n}% connected" |
| 70–84 | Almost There | "You're almost fully connected" |
| 85–100 | Fully Connected | "Your venue is fully connected" |

**The number always shows. The frame around it changes as the relationship matures.** A venue at 40% feels like they're setting up. A venue at 75% is not still setting up — they're operating.

---

### Gap Analysis Rules

The gap analysis surfaces the top three highest-impact actions the venue has not yet completed. Ordering rules:

1. **Engagement events before record events.** "Send your first portal invite" ranks above "add a package" because one leads to a relationship crossing a threshold.
2. **Easiest first within equal impact tiers.** If two actions have similar point value, surface the one with fewer steps.
3. **Maximum three.** Always. Even if twelve items are incomplete.

**Display format (Sprint 108):**
```
To reach 70%:
→ Send your first couple portal invite   +15 pts
→ Invite a team member                    +7 pts
→ Sign your first contract in Wevenu     +10 pts
```

**Language rule:** Use the second person, present tense, action-first. "Send your first couple portal invite" not "Couple portal invites have not been sent."

---

### Score Computation

- Computed on-demand + cached with a 1-hour TTL (same pattern as VendorHealthScore)
- Stored in `venue_activation_scores` table: `venue_id`, `score`, `dimension_scores jsonb`, `computed_at`
- Recomputed eagerly after key actions: portal invite sent, team member invited, contract signed, invoice paid
- Previous score stored to enable delta display: "↑ +12 this week"

---

## 2. Engagement Event Schema

### Two-layer architecture

**Layer 1 — Event log** (`engagement_events`): Every engagement event that occurs. Used by the Beta Command Center, Luv pattern detection, and activation history.

**Layer 2 — First-engagement cache** (`venue_activation_state`): Denormalized first-X timestamps for fast score computation. These are immutable once set — a venue's `first_couple_portal_open_at` never changes even if that couple is later deleted.

---

### `engagement_events` table

```sql
CREATE TABLE engagement_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id      uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  event_type    text NOT NULL,        -- see event type enum below
  actor_type    text NOT NULL,        -- 'venue_user' | 'couple' | 'vendor' | 'team_member'
  actor_id      uuid,                 -- nullable (anonymous portal visits)
  entity_type   text,                 -- 'couple' | 'event' | 'vendor' | 'contract' | 'invoice' | 'task'
  entity_id     uuid,
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  metadata      jsonb                 -- flexible payload per event type
);

CREATE INDEX engagement_events_venue_id_occurred_at ON engagement_events(venue_id, occurred_at DESC);
CREATE INDEX engagement_events_event_type ON engagement_events(event_type);
```

### Event Type Enum

**Couple engagement:**
- `couple.portal_invite_sent`
- `couple.portal_opened` ← **highest-value event**
- `couple.portal_returned` (subsequent visits)
- `couple.guest_list_updated`
- `couple.todo_completed`

**Vendor engagement:**
- `vendor.invitation_sent`
- `vendor.invitation_accepted` ← **engagement event**
- `vendor.portal_opened`
- `vendor.task_completed`
- `vendor.document_uploaded`

**Workflow:**
- `contract.sent`
- `contract.signed` ← **engagement event**
- `invoice.sent`
- `invoice.paid` ← **engagement event**
- `timeline.entry_created`
- `timeline.vendor_assigned`

**Team:**
- `team.member_invited`
- `team.member_first_login` ← **engagement event**
- `team.member_returned`

**Luv:**
- `luv.recommendation_viewed`
- `luv.recommendation_acted_on` ← **engagement event**
- `luv.draft_generated`

**Habit:**
- `session.daily_digest_opened`
- `session.mobile_login` (user_agent detection)
- `session.wedding_day_login` (login on or within 24h of an event_date)

---

### `venue_activation_state` table

Denormalized first-occurrence cache. Immutable once set. Never updated, only inserted.

```sql
CREATE TABLE venue_activation_state (
  venue_id                       uuid PRIMARY KEY REFERENCES venues(id),
  
  -- Setup
  profile_completed_at           timestamptz,
  availability_configured_at     timestamptz,
  first_package_created_at       timestamptz,

  -- Couple engagement
  first_portal_invite_sent_at    timestamptz,
  first_couple_portal_open_at    timestamptz,  -- ← immutable after set
  third_couple_portal_active_at  timestamptz,  -- when 3+ couples are active

  -- Workflow
  first_contract_signed_at       timestamptz,  -- ← immutable after set
  first_invoice_paid_at          timestamptz,  -- ← immutable after set
  first_vendor_assigned_at       timestamptz,

  -- Team
  first_team_invite_sent_at      timestamptz,
  first_team_member_login_at     timestamptz,  -- ← immutable after set
  team_member_active_14d_at      timestamptz,  -- last time this was true

  -- Habit
  first_7_active_days_at         timestamptz,
  first_luv_action_at            timestamptz,

  -- Meta
  current_active_streak_days     integer DEFAULT 0,
  updated_at                     timestamptz DEFAULT now()
);
```

**Immutability rule:** Any `first_X_at` column is set exactly once via `INSERT ... ON CONFLICT DO NOTHING` or `UPDATE ... WHERE first_X_at IS NULL`. Never overwritten. This ensures the activation history is trustworthy even if records are deleted or merged.

---

## 3. Milestone Celebration Framework

### The Rule

> **A celebration fires when a relationship crosses a threshold — not when a record is created.**

A record is created by one person's action. A threshold is crossed when another person's participation confirms the relationship.

### Milestone Definitions

| Milestone ID | Trigger | Message |
|---|---|---|
| `first_couple_portal_open` | `first_couple_portal_open_at` set | "Your first couple just logged into their portal." |
| `first_vendor_accepted` | `vendor.invitation_accepted` event | "{Vendor} just accepted their vendor invitation." |
| `first_contract_signed` | `first_contract_signed_at` set | "{Couple} just signed their contract." |
| `first_invoice_paid` | `first_invoice_paid_at` set | "Your first payment just came in." |
| `first_team_login` | `first_team_member_login_at` set | "{Name} just logged in for the first time." |
| `activation_50` | Score crosses 50 | "You're halfway to a fully connected venue." |
| `activation_70` | Score crosses 70 | "You've reached 70% — your venue is fully operational." |
| `activation_90` | Score crosses 90 | "Your venue is almost fully connected." |
| `first_event_completed` | Event date passed + venue marked complete | "Congratulations on completing {Event Name}." |
| `first_wedding_day_login` | `session.wedding_day_login` event | (internal only — flags the venue in Beta Command Center) |

### Delivery Rules

- `notification_type = "milestone_celebration"` — separate from operational alerts; venues can't disable these in V1 (they're too important for trust-building)
- **In-app only in Sprint 108.** Email layer added when notification engine matures.
- **Idempotent.** Each milestone fires exactly once per venue. Stored in `venue_milestones` table: `venue_id`, `milestone_id`, `fired_at`.
- **Maximum one celebration per session.** If three thresholds cross in the same session, queue them and fire on next login. Rapid-fire celebrations feel hollow.

### What Doesn't Qualify

- "You created a new contract template" — record, not relationship
- "You uploaded a document" — record
- "Your profile is complete" — record (surfaces as a gap analysis action, not a celebration)
- "You added 10 vendors" — record (vendor added ≠ vendor engaged)

---

## 4. Team Activation Model

### Member States

Each team member has a lifecycle:

```
invited → accepted → first_login → recurring_active → [inactive]
```

The activation score counts:
- Invitation sent (record, low weight)
- First login (engagement event, high weight)
- Active in last 14 days (habit, ongoing)

### Team Activation Sub-Score (0–100, feeds into Dimension 4)

| State | Sub-Score |
|---|---|
| Owner only, no invitations | 0 |
| 1 staff invited, not yet logged in | 20 |
| 1 staff logged in at least once | 50 |
| 1 staff active in last 14 days | 70 |
| 2+ staff active in last 14 days | 90 |
| 2+ staff + owner all active last 7 days | 100 |

### Team Activation Display

```
Team
─────────────────────
Owner          Active   ✓
Sarah (Coord.) Active   ✓
Mike (Asst.)   Invited  ·

2 of 3 team members active
```

### "Jennifer's System" → "Our System" Threshold

The team crosses from personal tool to institutional system when:
- At least one non-owner team member has logged in 5+ times
- At least one task has been assigned to (and completed by) a non-owner

Both conditions must be true. The first proves habit. The second proves the product handles real operational handoffs.

---

## 5. Daily Digest Strategy

### Purpose

The digest closes the notification gap between "I should check Wevenu" and "Wevenu will tell me." It is not a summary of everything — it is a prioritized action list for the next 24 hours.

### Content Rules

**Sections (in priority order):**

1. **Urgent** — overdue tasks, unanswered inquiries older than 24h, expiring contracts
2. **Due today** — tasks due today, tours scheduled, follow-ups flagged
3. **Recent wins** — completed tasks, signed contracts, paid invoices from last 24h
4. **One Luv observation** — the highest-signal observation from the last 24 hours. One sentence. No more.

**Hard limits:**
- Maximum 5 items total (not 5 per section — 5 total)
- If nothing is urgent or due today and no wins in last 24h: **the digest does not send**
- The digest never sends on consecutive days with identical content (de-duplication by content hash)

### Delivery

- 8:00am venue local time (not 8:00am UTC — timezone-aware)
- Subject line: "3 things need your attention today" (exact count) or "A quiet day ahead — one thing to note" (1 item) or "Nothing urgent today — here's what Luv noticed" (wins/observation only)
- Single CTA per digest: the highest-priority action item
- Footer: "View everything in Wevenu →"

### What the digest is not

- Not a feed of all activity (that's the notification center)
- Not a marketing email
- Not an engagement bait ("You have unread notifications!") — only sends with real content

---

## 6. Beta Command Center

The Beta Command Center is an internal dashboard for the Wevenu team, not for venues. It shows activation health across the beta cohort. Built in Sprint 108, accessed at `/admin/beta`.

### Six Panels

**Panel 1 — Activation Distribution**  
Histogram: how many beta venues are in each phase (Getting Started / Building Foundation / Building Momentum / Almost There / Fully Connected).  
Target at 90-day beta: ≥50% in "Building Momentum" or above.

**Panel 2 — At-Risk Venues**  
Venues with no engagement event in the last 7 days AND activation score below 50%.  
Columns: venue name, current score, last engagement event, days since last activity, highest-value incomplete action.  
This is the CS intervention list.

**Panel 3 — Milestone Funnel**  
Ordered conversion: How many venues have reached each milestone?  
`Created → First Couple → Portal Invite Sent → Portal Opened → Contract Signed → Invoice Paid → Team Active → First Wedding Day`  
Shows the biggest drop-off points for product prioritization.

**Panel 4 — Feature Adoption**  
Per-feature usage rates: import wizard, portal invites sent, Luv recommendations acted on, daily digest opened, mobile logins, wedding day logins.  
Purpose: identify which features are landing and which are being ignored.

**Panel 5 — Infrastructure Indicators**  
Count of venues that have crossed each infrastructure signal threshold (see Section 7).  
This is the "how many venues can't leave?" panel.

**Panel 6 — Velocity**  
Week-over-week change in average activation score across the cohort.  
A cohort that is collectively accelerating is healthy. A cohort that is plateau-ing needs an intervention (onboarding flow, CS outreach, or product change).

---

## 7. Infrastructure Signals

### The Threshold Question

A venue has crossed from software to infrastructure when **removing Wevenu would require notifying at least one other person.** That is the precise definition. Before that moment, one person can switch tools on a Tuesday without consequence. After it, they can't.

### Quantitative Signals (all measurable, all stored as engagement events)

**Signal 1 — The Portal Relationship**  
At least 3 distinct couples have opened their portal.  
*Why:* At 3+ couples, the venue can't move without migrating active relationships. At 1, it's still "my one test couple."

**Signal 2 — The Team Dependency**  
At least one non-owner team member has logged in 5+ times in the last 30 days.  
*Why:* A colleague who depends on the system is a social constraint on leaving. Leaving requires a team conversation, not a personal decision.

**Signal 3 — The Workflow Lock**  
At least one complete contract-to-payment loop has been completed inside Wevenu.  
*Why:* If the financial workflow ran through Wevenu, the audit trail lives here. Leaving means reconciling that history elsewhere.

**Signal 4 — The Vendor Network**  
At least 3 vendors have accepted invitations and logged into the Vendor Portal.  
*Why:* Vendors who have accepted and used the portal have an account. Migrating away means asking them to re-onboard to a different system.

**Signal 5 — The Wedding Day**  
At least one login on or within 24 hours of an event_date (the `session.wedding_day_login` event).  
*Why:* This is the highest-stakes operational moment. If a coordinator reached for Wevenu on a wedding day, the product has replaced the clipboard. That's irreversible.

**Signal 6 — The Digest Habit**  
Daily digest opened at least 3 times in the last 7 days.  
*Why:* Opening the digest is a behavioral signal that Wevenu is part of the morning routine. Routine is infrastructure.

---

### The Infrastructure Score

A venue gets one point per signal reached. 0–6.

| Score | Status |
|---|---|
| 0–1 | Evaluating |
| 2–3 | Adopting |
| 4–5 | Dependent |
| 6 | Infrastructure |

**Beta target:** ≥70% of venues at Dependent or Infrastructure at 90-day mark.

---

### The Notification Test (qualitative)

Before any beta venue reaches "Dependent" status, run this test manually:

> If this venue stopped using Wevenu tomorrow, who besides the venue owner would notice?

The answers, in order of signal strength:
1. A couple who has been using her portal (strongest)
2. A vendor who has accepted an invitation and has upcoming events assigned
3. A team member who uses Wevenu as their daily work surface
4. The venue owner themselves, because their morning routine is built around the digest

If the answer is "only the owner," the venue is not yet infrastructure.

---

## Implementation Notes for Sprint 108

**Schema priority order:**
1. `engagement_events` table + indexes (read by everything else)
2. `venue_activation_state` table (denormalized cache for fast score computation)
3. `venue_milestones` table (idempotent celebration tracking)
4. `venue_activation_scores` table (computed scores with TTL)

**Services:**
- `recordEngagementEvent(venueId, type, actorType, actorId?, entityType?, entityId?, metadata?)` — write to both tables in one call
- `computeActivationScore(venueId)` — reads `venue_activation_state`, returns full score breakdown
- `checkAndFireMilestones(venueId)` — called after any engagement event, fires celebrations if new thresholds crossed

**Hard constraint:** Activation score computation must be readable without any JOIN chains. `venue_activation_state` exists specifically so the score function reads one row, not ten tables.

---

*This document defines the adoption model. Sprint 107 (Collaboration) builds the team infrastructure this model requires. Sprint 108 builds the score, events, celebrations, digest, and command center. Sprint 108.5 validates that the infrastructure signals are reachable from a real wedding-day workflow on mobile.*
