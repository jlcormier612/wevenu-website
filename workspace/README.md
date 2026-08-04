# Relationship Workspace

Internal Hello to Cheers application for managing **one venue relationship, one timeline, one source of truth**.

This is a sibling Next.js app to `marketing/` — not bolted into the public site.

## How to run

```bash
cd workspace
npm install
npm run dev
```

Open [http://localhost:3002](http://localhost:3002).

> Keep this running in your own terminal — servers started by the AI agent may stop when the agent session ends.

From the repo root you can also use:

```bash
npm run dev:workspace
```

(after the root `package.json` script is present)

## Sales vs Customer Success (navigation)

One Relationship record — two filtered views. Never duplicate.

| Nav | Route | Who appears |
|-----|-------|-------------|
| **Sales** | `/sales` | Full Sales pipeline including Closed Won / Closed Lost (subscribed stay visible) |
| **Customer Success** | `/customer-success` | Subscribed / customers only (entered via successful Stripe subscribe) |
| Detail (shared) | `/relationships/[id]` | Same record from either board |

- Sales pipeline stages: Inquiry → Personal Send → Sequence Scheduled → Responded → Walkthrough Scheduled → Proposal Sent → Follow-up → Closed Won → Closed Lost
- CS lifecycle stages: Onboarding → Implementation → Live → Check-in Sequence → Healthy → Expansion → Renewal → Renewed → Needs Support
- **Flags ≠ stages.** On `/customer-success`, Row 1 is pipeline stages only; Row 2 is attention **Flags** (`?flag=`). Flags are not columns and never replace stages. Stage + flag combine with AND (e.g. `?stage=onboarding&flag=wb_pending`). Legacy `?wb=pending` still maps to `flag=wb_pending`. Values: `wb_pending`, `founder`, `payment_issue`, `at_risk`, `suspended`, `manual_billing`.
- On Stripe / manual subscribe: same Relationship ID; `salesStage` → `closed_won`; `customerSuccessStage` → `onboarding` (Launch Yourself) or `implementation` (White Glove); record appears on **both** Sales (Closed Won) and Customer Success
- Dragging to Closed Won does **not** enter Customer Success — only a successful subscribe does
- Welcome Back verification filters live on Customer Success Flags (not Sales); verification never gates checkout
- Legacy `/relationships` redirects to `/sales`

## Customer Lifecycle Engine (Phase 1)

One Relationship. Status changes. Never duplicate. Everything appends to the timeline.

### Purchase paths

| Path | How |
|------|-----|
| **1 — Public pricing** | Marketing `/pricing` → Stripe Checkout (unchanged) |
| **2 — Send Subscription Link** | Relationship → **Lifecycle actions** → creates Stripe Checkout Session with `relationship_id` metadata; email via `@shared/email` and/or copy URL. Does **not** send the public pricing page. |
| **3 — Manual Subscription** | Owner/Admin records a subscription without Stripe (`manual: true`) then enters onboarding |

### After purchase

1. Status → `subscribed` (timeline: Subscription Purchased)
2. Immediately enter onboarding:
   - **Launch Yourself** (`self_guided`) → `onboarding`, activation token, Welcome / Founder Welcome, product sync
   - **White Glove** → `white_glove_implementation`, 8-task checklist, **no** product access yet, White Glove Welcome (credentials deferred)
3. Timeline also: Subscription Activated, Welcome Workflow Started, Onboarding Created (+ White Glove Implementation Started)

### White Glove Implementation screen

- Route: **`/relationships/[id]/implementation`** (team-only)
- Link from Relationship Snapshot when WG applies
- Checklist, branding/contracts/packages/questionnaires/website notes, internal notes
- **Launch Workspace** when all 8 tasks complete (Owner/Admin override available)
- On launch: status → `active`, product sync, **Welcome Home** email with Activate Account link

### Lifecycle stages

Inquiry · Walkthrough · Subscribed · Onboarding · White Glove Implementation · **Active** · At Risk · Suspended · Reactivated · Former Customer

Aliases: `live` / `active_customer` → `active`.

### Relationship Health (Snapshot)

Same Relationship record; snapshot **display mode** only (no duplicated data):

- **Sales snapshot** when not subscribed (`!subscribedAt` / not in CS) — Sales stage, next milestone, source, last communication / days silent, sequence enrollment, walkthrough status, Welcome Back when present. Plan/Payment only mid-checkout (checkout session, pending payment, trial, or plan selected). Hides CS health score, onboarding %, website/logins, and empty renewal blocks.
- **CS snapshot** when subscribed (`subscribedAt` wins) — health + score, CS stage / lifecycle, onboarding, website published, logins / engagement, plan & payment, support, open tasks, customer since. Optional `?from=sales|customer-success` biases only when CS membership is not from subscribe.

Boards link with `?from=` for light bias. Lifecycle actions, timeline, and detail panels stay shared outside the snapshot grid.

### Failed payment dunning

Stripe `invoice.payment_failed` / `past_due` → days **0, 3, 7, 14, 21**:

- Email reminders + timeline
- Day 14 → At Risk + internal notify
- Day 21 → Suspended (`accessDisabled`, data preserved) **and** product venue hard-lock (`venues.access_disabled`) when `PRODUCT_API_BASE_URL` + `PRODUCT_SYNC_API_KEY` resolve a real venue
- Payment success → Reactivated + reactivation email + product unlock

Tick manually: `POST /api/relationships/lifecycle` with `{ "action": "tick_dunning" }` (Owner/Admin). Background cron also runs dunning via `GET|POST /api/cron/automations` (see [Automation scheduler](#automation-scheduler-sequences--workflows)).

### Renewal anniversary CS stages

Renewal anniversary = **`subscribedAt` + 1 calendar year** (UTC). Stored as `renewalDate` and set on subscribe when missing; ticks keep it in sync and roll it forward after **Renewed**.

| Auto move | When (UTC calendar days) | Soft-promote to |
|-----------|--------------------------|-----------------|
| **→ Renewal** | today ∈ [`renewalDate` − 60 days, `renewalDate`] | `renewal` |
| **→ Renewed** | today ≥ `renewalDate` + 1 day | `renewed`, then `renewalDate` += 1 year |

Soft-promote rules:

- **Support pin wins** — skip while `supportOpenCount > 0` or stage is `needs_support`; after support clears, the next tick applies
- Do not regress `renewed` → `renewal` within the same cycle (annual cycle allows `renewed` → `renewal` only when the *next* 60-day window opens after the date roll)
- Never override `suspended` / `accessDisabled`
- Manual CS board moves still force any stage
- Sets `lastAutoArrival` for `renewal` / `renewed` (highlighted on the CS board)

**When it runs**

- Cron / ops: `GET|POST /api/cron/automations` (Bearer `CRON_SECRET`) — also ticks sequences + workflows + dunning
- Manual ops: `POST /api/relationships/lifecycle` with `{ "action": "tick_renewals" }` (Owner/Admin — same gate as dunning tick)
- Local demo: lightly on `/customer-success` load and `/relationships/[id]` load when the live store is present; or `npm run tick:automations`

Logic: `shared/relationships/renewal-stages.ts` (`tickRenewalStages`).

### Owner actions (on Relationship detail)

**Always (Sales + CS, with edit/comms permission):** Set a Task · Send a Message · Make a Note

**Lifecycle:** Send Subscription Link · Copy Link · Manual Subscription · Resend Welcome · Launch Workspace · Suspend / Reactivate · Send Payment Reminder · View Billing (Stripe portal)

API: `POST /api/relationships/owner-actions` (`create_task` | `send_message` | `add_note`).

### Luv

Health-based suggestions only (WG overdue, no login after activation, onboarding stalled, payment failed, inactive) — **never auto-acts**.

### Settings

**Settings → Customer Lifecycle — White Glove timeline** (default 5–7 business days) → `workspace/.data/lifecycle-settings.json`.

### API

`POST /api/relationships/lifecycle` — see action names in `app/api/relationships/lifecycle/route.ts`.

### Jennifer test scripts

**Demo subscribed CS customer (no Stripe)** — `npx tsx workspace/scripts/seed-demo-customer.mts` (idempotent; venue **Sweet Daisy Barn & Farm** → `/customer-success` + Sales Closed Won)

**Path 2 — Send Subscription Link**

1. Sign in as Jennifer · open a prospect Relationship with owner email
2. Lifecycle actions → choose plan → **Send Subscription Link** (or Copy)
3. Confirm timeline `Subscription Link Sent` + email_sent (or dry-run)
4. Open the Checkout URL (not `/pricing`) · complete test payment in Stripe
5. Confirm status moves Subscribed → Onboarding or White Glove Implementation

**Launch Workspace**

1. Open a White Glove Relationship → **White Glove Implementation**
2. Complete the 8 checklist tasks (or use Owner Override)
3. **Launch Workspace** → status Active · Welcome Home email · activation token on timeline

**Dunning tick**

1. Relationship with `paymentStatus` failed / dunning started (or simulate via Stripe webhook)
2. `POST /api/relationships/lifecycle` `{ "action": "tick_dunning" }`
3. Confirm reminder day advances + timeline Payment Reminder / At Risk / Suspended

**Renewal auto-stages (backdated subscribedAt)**

1. Seed or open a subscribed CS customer (e.g. Sweet Daisy via `npx tsx workspace/scripts/seed-demo-customer.mts`)
2. Backdate for the window you want (UTC), then open CS / relationship **or** call the tick:
   - **→ Renewal (e.g. ~45 days out):**  
     `subscribedAt = now − (365 − 45)` days · `renewalDate = subscribedAt + 1 year` · stage not `needs_support`  
     Or: `npx tsx workspace/scripts/seed-demo-customer.mts --renewal-window`
   - **→ Renewed (day after anniversary):**  
     `subscribedAt = now − 366` days · clear open support ·  
     Or: `npx tsx workspace/scripts/seed-demo-customer.mts --renewed`
3. `POST /api/relationships/lifecycle` `{ "action": "tick_renewals" }` (or reload `/customer-success`)
4. Confirm CS column **Renewal** / **Renewed**, auto-arrival highlight, timeline “Renewal window (auto)” / “Renewed (auto)”
5. With open support on the same record: tick should **skip** (stay Needs Support); resolve support, tick again → advances

**Product hard-lock (Suspend → app blocked)**

Prereqs: migration `20261175000000_venue_account_access_lock.sql` applied; product `:3000` + workspace `:3002` running; same `PRODUCT_SYNC_API_KEY` in both; workspace `PRODUCT_API_BASE_URL=http://localhost:3000`.

1. Sign into the product app as a venue owner whose email matches a CRM Relationship owner (or set `productSync.venueId` to that venue’s real UUID)
2. In CRM → Relationship → **Suspend**
3. Confirm product logs `[product-access/lock]` and venue row has `access_disabled=true` / `account_status=suspended`
4. Refresh product or open `/dashboard` → redirects to `/billing/suspended`
5. Sign out → sign in again → lands on suspend screen (not dashboard)
6. CRM → **Reactivate** (or Stripe test `invoice.paid`) → product unlocks → `/dashboard` works again
7. Confirm no venue/client/event rows were deleted

**Inbound reply → Responded (no MX required)**

1. Pick a live Relationship id (e.g. from `/relationships/[id]` URL) in Sales stage Inquiry / Personal Send / Sequence
2. With workspace running on `:3002`:

```bash
curl -s -X POST 'http://localhost:3002/api/email/inbound' \
  -H 'Content-Type: application/json' \
  -d "{\"from\":\"prospect@example.com\",\"to\":[\"relationship+REL_ID@replies.example.com\"],\"subject\":\"Re: Hello\",\"text\":\"Thanks — yes, I'd love a walkthrough.\"}"
```

3. Dry-run first: add `"dryRun":true` or `?dry_run=1` (no writes)
4. Confirm: Sales stage → **Responded** (no regression if already further), timeline `Inbound email received`, sequence enrollments exited, Luv briefing / Today **"Responded — F/U"** surface the venue
5. Open Relationship → **Luv noticed** shows urgent “responded — follow up immediately” (draft only; never auto-sends)

If `RESEND_WEBHOOK_SECRET` is set locally, append `?secret=YOUR_SECRET` or `?test=1` (dev only).

## Project 7 — Luv (debut quality)

Luv as **Chief of Staff** for Hello to Cheers — proactive advisor, suggestions-first. Not a chatbot. Never takes action without a click.

### Daily briefing

- Surfaces on **Business Dashboard** (`/business`) as a full briefing card, and as a compact strip on **Today** (`/today`).
- Time-of-day greeting addressed to the acting user by first name (session / impersonation — Project 8) — not morning-only.
- Bullets from live/seed data with overnight counts: walkthrough requests, subscriptions, support, missing Welcome email, Welcome Back pending, kickoff overdue / incomplete, Launch Checklist, silence, walkthrough follow-ups, White Glove recommendations, expansion, support.
- CTA **Draft today's follow-ups** opens the drafts panel (batch of template drafts). Nothing sends until **Send**.

### Relationship advisor (`/relationships/[id]`)

On open, **Luv noticed** lists contextual, named suggestions (heuristic — no LLM required for detection). Copy addresses the acting user (“Jennifer, …”).

| Signal | Suggestion (example) | Primary action |
|--------|----------------------|----------------|
| Prospect **Responded** (inbound reply) | “…responded — follow up immediately.” (**Urgent**) | **Draft** / Send email |
| Subscribed, no Welcome / Founder `email_sent` | “…hasn't received their Founder Welcome email yet.” | **Send email** / Draft welcome |
| White Glove kickoff past due | “…kickoff call is overdue by 3 days.” | **Draft** kickoff email |
| White Glove kickoff incomplete | “…kickoff is on the books but not completed yet.” | **Draft** |
| Open / stale WG checklist | “I suggest sending the Launch Checklist today.” | **Draft checklist** |
| Website / Launch / Go Live open (after earlier steps) | “…waiting on implementation documents.” | **Create task** |
| Welcome Back pending | “…asked for Welcome Back pricing — verify…” | **Verify Welcome Back** |
| Same plan + WG success peer, self-guided | “This looks similar to Willow & Hearth. Recommend White Glove.” | **Draft** |
| `pricing_viewed` count ≥ 2 | “…viewed pricing 4 times before subscribing.” | Noted (info) |
| Post-walkthrough silence | “…no follow-up after the walkthrough (N days).” | **Draft** |

Also retained: positive reply, corporate / expansion, support, silence, renewal, former-customer warmth, new inquiry, overdue tasks.

Each insight: message + primary CTA + secondary actions (**Draft** / **Send email** / **Create task** / **Verify Welcome Back** / **Dismiss**). Suggestions only — no autonomous sends.

### Draft assistance

- Side panel (not a chat thread): list → expand → edit → **Copy** / **Use draft** (timeline note) / **Send** (Resend when configured; otherwise dry-run + timeline `email_sent`).
- Templates for welcome, Launch Checklist, White Glove recommend, kickoff, follow-ups, etc.; prefers Communication Library templates when ids match.
- Optional polish via `OPENAI_API_KEY` (soft-fails to templates if unset).
- Shared mailer: [`../shared/email/`](../shared/email/).

### Architecture

| Path | Purpose |
|------|---------|
| `lib/luv/*` | Briefing, relationship insights, drafts, dismissals, load helpers |
| `components/luv/*` | `LuvBriefing`, `LuvRelationshipAdvisor`, `LuvDraftPanel`, `LuvMark` |
| `app/(app)/luv/actions.ts` | Dismiss / create task / use draft / send |
| `workspace/.data/luv-dismissals.jsonl` | Per-actor dismissed insights |

Subtle dusty-rose Luv mark on Business and Relationship pages — **no “Chat with Luv” nav item**.

### Demo script (seed venues)

1. Open `/business` as Jennifer — daily briefing with overnight inquiry/subscription/support counts; **Draft today's follow-ups**.
2. Open `/today` — compact briefing strip.
3. **Meadowlane** (`rel_meadow`) — missing Welcome + pricing viewed 4×.
4. **Pinecrest** (`rel_pinecrest`) — kickoff overdue 3 days, Launch Checklist, implementation waiting, Welcome Back **Verify**.
5. **Willow & Hearth** (`rel_willow`) — kickoff incomplete + Launch Checklist.
6. **Harborview** (`rel_harbor`) — post-walkthrough follow-up.
7. **Solstice** (`rel_solstice`) — support open + similar to Willow → recommend White Glove.
8. **Cedar** (`rel_cedar`) / **Pinecrest** — Welcome Back verify CTA.
9. Dismiss an insight; refresh — stays dismissed for that actor.

### Known stubs

- Insight detection is rule-based; LLM polish is optional.
- Dismissals are per-actor JSONL append (no undo UI yet).
- Trial / renewal drip automation UI not built — templates + hooks exist in `@shared/email`.

## Program 5 — Luv for Internal Teams

See **Project 7** above (debut-quality elevation of Program 5).

## Project 8 — Team (real auth)

Users are real. Flow: **Invite → Accept → Create password → Done**.

### Demo login

| Email | Password |
|-------|----------|
| `jennifer@hellotocheers.com` | `cheers-demo` |

Jennifer (Owner) is seeded with a scrypt password hash in `workspace/.data/team-credentials.jsonl` on first boot.

### Invite

1. Sign in as Owner/Admin → **Team** (`/team`) → Invite form (name, email, role).
2. Invite token persisted in `workspace/.data/team-invites.jsonl`; pending invites listed on the page.
3. Email via `@shared/email` `sendRawEmail` (dry-run without `RESEND_API_KEY` — link still shown in UI / console).
4. Accept URL pattern: **`/invite/[token]`** (e.g. `http://localhost:3002/invite/<token>`).
5. Invitee sets password → credentials written → redirect to `/login`.

### Login & session

- `/login` — email + password against hashed credentials.
- Cookie **`ws_session`** = opaque session id stored in `workspace/.data/sessions.jsonl`.
- Session member drives permissions (role matrix unchanged).
- `proxy.ts` requires `ws_session` for all routes except `/login` and `/invite/*`.

### Impersonate (not View as)

Global **View as** is removed. Owner and Administrator get **Impersonate** on `/team/[id]`:

- Sets temporary cookie **`ws_impersonate`**.
- Banner: “Impersonating X — End impersonation”.
- Effective permissions follow the impersonated member; real session user is unchanged.
- End impersonation clears the cookie.

### Security note (Phase honesty)

File-based auth is fine for internal Phase 8 — **not production-hardened**. Passwords are hashed (scrypt); plaintext is never stored. No SSO/OAuth yet.

### Auth file paths

| Path | Purpose |
|------|---------|
| `workspace/.data/team-credentials.jsonl` | `memberId`, `passwordHash`, `acceptedAt` |
| `workspace/.data/team-invites.jsonl` | Invite tokens |
| `workspace/.data/sessions.jsonl` | Opaque sessions |
| `lib/program4/auth-store.ts` | Credentials / invites / sessions |
| `lib/program4/password.ts` | scrypt hash / verify |
| `app/invite/[token]` | Accept invite |
| `app/login` | Real login |

## Program 4 — Team Operations

Business operations layer: **team, permissions, commissions, and Jennifer’s Business Dashboard**.

### Homepage

- `/` and post-login land on **Business Dashboard** (`/business`) when the acting role has `view_business_dashboard` (Owner, Administrator, Finance).
- Day-to-day CS work lives at **`/today`** (former “Today’s Activity” dashboard).
- Legacy `/dashboard` redirects to `/today`.

### Team

- Roster at **`/team`** and detail/edit at **`/team/[id]`**.
- Invite form + pending invites on `/team` (Project 8).
- Settings → Team lists members; auth/session controls live in Settings (no View as).
- Seed: Jennifer Marshall as **Owner**, plus Sales, CS, Implementation, Support, Finance, Marketing, and Administrator samples.
- Each member: role, department, commission plan, goals, availability, territory (stub).

### Permissions

Roles: Owner, Administrator, Sales, Customer Success, Implementation, Support, Finance, Marketing, Viewer.

Permission matrix in `lib/program4/permissions.ts` (e.g. `view_relationships`, `edit_relationships`, `manage_workflows`, `view_finance`, `manage_team`, `view_commissions`, `manage_commissions`, `view_business_dashboard`, …).

- Cookie `ws_session` = logged-in team member; optional `ws_impersonate` for Owner/Admin support.
- Nav items and pages hide/redirect when the **effective** role lacks the permission.
- Not full SSO — Project 8 file-based credentials (see above).

### Commission engine

Event types: walkthrough booked, subscription sold, White Glove sold, renewal, referral, expansion.

- Plans define **percent (bps)** or **flat** rates per event (`lib/program4/seed.ts`).
- Ledger entries link team member + relationship + event; stored in `workspace/.data/commission-ledger.jsonl`.
- Auto-created on pipeline status moves (Program 3 engine hook) and backfilled from timeline when opening `/commissions`.

UI: **`/commissions`** — filter by period and rep; plans summary + ledger.

### Business Dashboard (`/business`) — Project 9

Jennifer’s company dashboard (Owner + Finance; Administrator also allowed). Calm executive numbers — not chart spam. Luv daily briefing stays at the top. Estimates vs actuals are labeled.

| Metric | Source |
|--------|--------|
| MRR / ARR | Active + trialing subscription `mrrCents` (Actual) |
| Revenue | Sum of paid invoices (Actual); `—` if none |
| Projected ARR | ARR + 60% of open-pipeline plan MRR × 12 (Estimate) |
| Churn | Former customers ÷ (subscribed+ + former) |
| Trials | Relationships in Trial + trialing subscriptions; `—` when none |
| Walkthrough → subscribed | Completed walkthroughs that reached subscribed+ |
| Inquiry → subscribed | Relationships that reached subscribed+ ÷ all relationships |
| Founders | `foundingMember` count — summary only; detail on `/founding` |
| Welcome Back | Requested / approved (verified); link to `/founding` |
| White Glove revenue | Paid invoices whose description mentions White Glove |
| Implementation capacity | Open WG checklist tasks / WG customers in onboarding |
| Launch pipeline | Open Go Live tasks / relationships near launch |
| Avg onboarding time | Mean days subscribe → live/`onboarding_completed`; `—` if no pairs |
| Subscription growth | New subs by month (simple table + bars) |

Computed in `lib/program9/business-metrics.ts` from seed and/or live data. Permission: `view_business_dashboard`.

### Founder Dashboard (`/founding`) — Project 4

Owner (and Administrator) view of the Founding Program — richer than a single “spots remaining” number.

| Metric | How it’s computed |
|--------|-------------------|
| Founder members | `foundingCount / capacity` — count of relationships with `foundingMember` |
| Remaining | `capacity − foundingCount` (`FOUNDER_PROGRAM_CAPACITY`, default 100) |
| Estimated close date | Heuristic from founder acquisition velocity over the last 30 days; `—` if fewer than 2 recent founders |
| Projected MRR | Sum of founder monthly MRR (active subscription `mrrCents`, else plan estimate) |
| Founder revenue | Estimated cumulative stub: monthly MRR × months since start |
| Welcome Back | Approved (`verified`), pending, rejected — counts from `welcomeBackRequested` relationships |

Capacity auto-decrements by counting live founding relationships (not a separate counter). Marketing pricing uses the same helper (`shared/relationships/founder-program.ts`) when the live store has data; otherwise `FOUNDER_SPOTS_REMAINING`.

- Permission: `view_founding` — **Owner** and **Administrator** only.
- Welcome Back verification (Project 5) lives on the Relationship: Approve / Reject / Needs Follow Up when pending. Permission: `manage_welcome_back` (Owner, Administrator, Customer Success). Tiles link to `/customer-success?view=list&flag=wb_pending` (etc.).
- Recent founder activity from timeline (founder status, Welcome Back, subscriptions).

### Welcome Back verification (Project 5)

Everything stays on the Relationship — no separate approval queue. Primary filter home is **Customer Success** (not Sales). Verification is honor-system / monitored after subscribe and **must not** gate checkout.

| Action | Result |
|--------|--------|
| **Approve** | `welcomeBackVerified=verified`, `foundingMember=true` (Founding pricing), timeline “Welcome Back Approved”, email `welcome_back_verified` |
| **Reject** | `welcomeBackVerified=rejected`, timeline + light `welcome_back_rejected` email |
| **Needs Follow Up** | Stays `pending`, timeline note, Task “Follow up on Welcome Back verification” |

API: `POST /api/relationships/welcome-back` with `{ relationshipId, action: "approve"|"reject"|"needs_follow_up" }`.

UI: buttons on `/relationships/[id]` when `welcomeBackRequested && welcomeBackVerified === "pending"` and the actor has `manage_welcome_back`.

### Product feedback & support resolve

All product Get Help types (`support`, `bug`, `feature`, `nps`, `general`) and marketing `/support` land on the Relationship as `openFeedbackItems` + `supportOpenCount`, with timeline / communication / team notification. Customer receives `feedback_confirmation` (dry-run without Resend). Product HQ Feedback board is unchanged.

| Action | Result |
|--------|--------|
| **Resolve** (item) | Item → `resolved`, recount `supportOpenCount`, timeline `support_resolved`; clears `status: support` → `active` when count hits 0 |
| **Resolve all** | Same for every open item (or legacy count-only rows) |

API: `POST /api/relationships/support` with `{ relationshipId, action: "resolve", itemId?, all? }`.

UI: panel on `/relationships/[id]` when open count / items exist; compact **Resolve** on Today → Open support. Permission: `edit_relationships` or `manage_communications` (Owner, Admin, CS, Support).

### Demo script

1. Sign in at `/login` as Jennifer (`jennifer@hellotocheers.com` / `cheers-demo`) → Business Dashboard.
2. Open **Founding Program** (`/founding`) — seats, close estimate, MRR, Welcome Back counts.
3. From pending tile → open a pending Welcome Back Relationship → Approve / Reject / Needs Follow Up.
4. Team → open Maya → **Impersonate** — banner appears; Founding / Commissions / Business follow her role.
5. End impersonation → back to Owner.
6. Invite a new email from `/team`; open `/invite/[token]`; set password; sign in as that user.
7. On Relationships, move a venue to **Walkthrough Scheduled** or **Subscribed** → refresh Commissions for a new pending ledger row.

### Program 4 file paths

| Path | Purpose |
|------|---------|
| `lib/program4/*` | Types, permissions, session, store, commissions, founder metrics |
| `lib/program9/business-metrics.ts` | Project 9 company dashboard metrics |
| `../shared/relationships/founder-program.ts` | Capacity + remaining helper (shared with marketing) |
| `app/(app)/business` | Business Dashboard (homepage) — Project 9 |
| `app/(app)/founding` | Founder Dashboard |
| `app/(app)/today` | Today's Activity |
| `app/(app)/team` | Team list + detail |
| `app/(app)/commissions` | Commission ledger |
| `workspace/.data/team-members.jsonl` | Team roster persistence |
| `workspace/.data/team-credentials.jsonl` | Password hashes (Project 8) |
| `workspace/.data/team-invites.jsonl` | Invite tokens (Project 8) |
| `workspace/.data/sessions.jsonl` | Login sessions (Project 8) |
| `workspace/.data/commission-*.jsonl` | Plans + ledger |

## Program 3 — Sales & Customer Success

Relationship Operating System layer: **pipeline + automated workflows + communication library**.

### Pipeline

Statuses (single field on one Relationship record):

Inquiry → Walkthrough Requested → Walkthrough Scheduled → Walkthrough Completed → Trial → Subscribed → Onboarding → White Glove Implementation → **Active** → At Risk / Suspended / Reactivated → Expansion → Referral → Renewal → Former Customer

- Legacy `live` / `active_customer` normalize to **Active**.
- **Support**, **Welcome Back**, and **Founder** are attention **flags** / overlays on the same record (not pipeline stages or separate CRM objects).
- Relationships page defaults to a **pipeline board**; toggle **List** for the table view.
- Moving a stage writes a timeline event and may auto-enroll workflows triggered on `status_enter`.
- See **Customer Lifecycle Engine (Phase 1)** above for purchase paths, WG Launch, dunning, and health.

### Communication Library

- **Communications → Library** tab: templates, sequences, branding.
- Templates support `{{venue_name}}`, `{{owner_first_name}}`, `{{plan}}`, categories (Prospect nurture, Customer check-in, Welcome Back, …), draft/approved, version history, sent/opens stubs.
- **Sequences** are first-class enrollable cadences (not only workflow expanders):
  - Ordered template steps
  - **Relative** delay: `scheduledFor = previousSentAt + delayHours` (step 0 uses enrollment time)
  - **Absolute** schedule: wall-clock `absoluteAt` in an IANA timezone (default `America/New_York`) → UTC `scheduledFor`
  - Targeting: `prospects` (before Subscribed) · `customers` (Subscribed+) · `any`
- UI: `/communications?tab=library` builder · `/sequences` list + enrollments · relationship **Enroll in sequence**
- File store: `sequences.jsonl`, `sequence-enrollments.jsonl`
- Scheduler: Vercel Cron → `GET|POST /api/cron/automations` every 10 minutes; targeted `GET|POST /api/sequences/tick`; also ticks on `/sequences` and relationship detail load; enroll ticks immediately
- Sends via `@shared/email` + timeline `email_sent` (dry-run without `RESEND_API_KEY`)
- **Stop on reply:** inbound webhook exits active/paused sequence enrollments (`exited_reply`) — cron does not change this

### Inbound email → Sales Responded

When a prospect replies to personal / sequence email:

1. Webhook `POST /api/email/inbound` matches the Relationship (see matching below)
2. Appends inbound communication + `email_received` timeline · sets `lastInboundAt`
3. `promoteSalesStage(…, "responded")` — never moves backward from Walkthrough / Proposal / Follow-up / Closed Won / etc.
4. Stops active sequence enrollments
5. Notification `prospect_responded` + Luv critical insight for F/U

**Matching (in order)**

1. Reply-To / To `relationship+{relationshipId}@inbound-domain` (set automatically on outbound when `RESEND_INBOUND_ADDRESS` is configured)
2. `In-Reply-To` / `References` → stored Resend `provider_id` on outbound `email_sent` timeline meta
3. From address → unique owner email match only (skipped if ambiguous)

**Env (workspace `.env.local`)**

| Variable | Purpose |
|----------|---------|
| `RESEND_API_KEY` / `EMAIL_FROM` | Outbound sends |
| `RESEND_INBOUND_ADDRESS` | e.g. `inbox@replies.hellotocheers.com` — enables `relationship+{id}@…` Reply-To |
| `RESEND_WEBHOOK_SECRET` | Query `?secret=` and/or Svix signature on inbound webhook (skip verify when unset for local) |
| `EMAIL_REPLY_TO` | Fallback Reply-To when inbound address unset |

**Resend setup**

1. Inbound domain + MX → Resend
2. Inbound webhook URL → `https://<workspace-host>/api/email/inbound?secret=<RESEND_WEBHOOK_SECRET>`
3. Same vars in workspace env as marketing for shared `@shared/email`

Not wired to venue messaging — Relationship CRM only.

### Absolute vs relative scheduling

| Mode | When `scheduledFor` is set | Tick behavior |
|------|----------------------------|---------------|
| Relative | Enrollment (step 0) or when prior step completes | Fires when `scheduledFor <= now` |
| Absolute | At enrollment (calendar moment in TZ) | Same — waits until that UTC instant; if already past when the step becomes ready, sends immediately |

Timezone: sequence default or per-step IANA string. Wall times are converted with `Intl` (no extra date library).

### Demo script

1. Open **Relationships** (pipeline view).
2. On a card (e.g. Lumen Hall), use **Move to** → choose another stage. Refresh the venue workspace — timeline shows “Moved to …”.
3. Open that relationship → **Enroll in sequence** (prospect or customer list) or **Start a workflow**.
4. Open **Sequences** — see enrollment; **Pause / Resume / Exit**.
5. Process due delayed / absolute steps via cron (`/api/cron/automations`), `npm run tick:automations`, or curl the tick routes (see below).
6. Open **Communications → Library** to edit templates or build sequence steps (Relative vs Absolute + datetime picker).

### Automation scheduler (Sequences + Workflows)

Delayed and absolute steps advance when a **tick** runs. Hands-off production uses Vercel Cron; local/demo still works on page load and enroll.

| Mechanism | What runs |
|-----------|-----------|
| **Vercel Cron** `*/10 * * * *` → `/api/cron/automations` | Sequences + workflows + renewal stages + payment dunning |
| Targeted routes | `GET\|POST /api/sequences/tick`, `GET\|POST /api/workflows/tick` |
| Page load | `/sequences`, workflows pages, Sales / CS / relationship detail (in-process; no HTTP auth) |
| Enroll / resume | Immediate in-process tick (unchanged) |
| In-process CLI | `npm run tick:automations` from `workspace/` |

**Env (workspace)**

| Variable | Purpose |
|----------|---------|
| `CRON_SECRET` | Required in production. Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. When unset, tick HTTP routes allow unauthenticated calls only if `NODE_ENV !== "production"` (local demo). |

Set `CRON_SECRET` in the workspace project's Vercel env (same pattern as the venue app). Declare the schedule in `workspace/vercel.json` (this app's own Vercel project — not root `vercel.json`).

**vercel.json cron**

```json
{
  "crons": [
    {
      "path": "/api/cron/automations",
      "schedule": "*/10 * * * *"
    }
  ]
}
```

**Local verification (Jennifer)**

1. `cd workspace && npm run dev` → [http://localhost:3002](http://localhost:3002)
2. Without `CRON_SECRET` (default local):

```bash
curl -sS -X POST http://localhost:3002/api/cron/automations | jq .
# or the targeted engines:
curl -sS -X POST http://localhost:3002/api/sequences/tick | jq .
curl -sS -X POST http://localhost:3002/api/workflows/tick | jq .
```

3. With a secret in `.env.local` (`CRON_SECRET=dev-cron-secret`):

```bash
curl -sS -X POST http://localhost:3002/api/cron/automations \
  -H "Authorization: Bearer dev-cron-secret" | jq .
```

Expect `401` if the header is missing/wrong when the secret is set.

4. **In-process** (no server — useful for crontab / non-Vercel hosts):

```bash
cd workspace && npm run tick:automations
```

5. Confirm a due delayed step advanced (timeline / enrollment step index) after tick — enroll still fires immediate steps without waiting for cron; inbound reply still exits sequences (`exited_reply`).

**Not on Vercel?** Cron jobs in `vercel.json` will not fire. Point any scheduler (system crontab, GitHub Actions, etc.) at:

`GET|POST https://<workspace-host>/api/cron/automations` with `Authorization: Bearer <CRON_SECRET>`

—or run `npm run tick:automations` on a schedule on the host that has the workspace data files.

### Known stubs

- Opens / performance counters are placeholders.
- Delayed steps still need a tick within the cron interval (default 10 minutes) to fire after `scheduledFor`.

### Workflows

- Nav: **Workflows** — list, builder (`/workflows/new`, `/workflows/[id]`), run viewer.
- Steps: delay, wait condition, timed/send email, internal reminder, create task, assign owner, notify team, pause, exit.
- Runs attach to a Relationship (manual enroll or status trigger).
- When a workflow step references a `sequenceId`, steps expand and inherit relative/absolute schedule fields.
- Pause / resume / exit from the run viewer or relationship detail.
- File store: `workspace/.data/workflows.jsonl`, `workflow-runs.jsonl` (seeded on first use).
- Scheduler: Vercel Cron `/api/cron/automations`; targeted `GET|POST /api/workflows/tick`; also runs on Relationships / Workflows page load; enroll ticks immediately.
- Workflows still reference templates/sequences for multi-step ops (tasks, wait conditions); dedicated sequence enrollments are preferred for nurture/check-in cadences.

## Phase 2 — Relationship Operations

Marketing site events (contact, walkthrough, newsletter, support, Stripe checkout) write into a **shared JSONL store** that this app reads.

See [`../shared/relationships/README.md`](../shared/relationships/README.md) for architecture, dedupe rules, env vars, and how to test locally.

| Env | Purpose |
|-----|---------|
| `RELATIONSHIPS_DATA_PATH` | Override data directory (default `<repo>/shared/relationships/.data`) |
| `USE_SEED_DATA` | Set `false` to skip Phase 1 seed when the live store is empty |
| `WORKSPACE_DATA_PATH` | Override Program 3/4 data dir (default `workspace/.data`) |

When the live store has at least one relationship, seed demo venues are replaced by live data (team roster comes from Program 4 seed). Program 3 overlays (status patches, local timeline/comms/tasks) still merge on top.

## Phase 1 scope

Shipped:

- App architecture + Hello to Cheers brand tokens (forest sage, heritage sage, warm gray, editorial fonts)
- Primary navigation: Business, Today, Relationships, Walkthroughs, White Glove, Tasks, Workflows, Sequences, Communications, Founder Dashboard, Commissions, Team, Reports, Settings
- TypeScript data model + in-memory seed data (10 venues across the lifecycle)
- Dashboard with actionable “Today’s Activity” buckets (`/today`)
- Relationships list + **Relationship Workspace** (snapshot + chronological timeline + progressive detail panels)
- Founder Dashboard (Owner / Admin) with seats, close estimate, MRR, Welcome Back
- Walkthrough management with stub status actions
- White Glove onboarding board — Implementation Checklist as Relationship Tasks (Project 6)
- Tasks, Communications, Reports (simple numbers/bars), Settings shell
- Notification model + unread indication in chrome
- Project 8 team invite + password login + Owner/Admin impersonation

## Auth (Project 8)

- Login required via `proxy.ts` (`ws_session` cookie)
- Demo: `jennifer@hellotocheers.com` / `cheers-demo`
- Invites: `/invite/[token]` · Impersonate from `/team/[id]` (Owner/Admin)
- File-based credentials — not production SSO (see Project 8 section)

## What’s stubbed / not in Phase 1

- Production SSO / OAuth
- Persistent database (live JSONL under `shared/relationships/.data`, Program 3/4 under `workspace/.data`, seed fallback in `lib/data/seed.ts`)
- Walkthrough Complete / Reschedule / Cancel persist via `PATCH /api/walkthroughs` + timeline
- **Add Relationship** on `/relationships` (`edit_relationships`); **Log Walkthrough** on `/walkthroughs` and relationship detail (`manage_walkthroughs`)
- Advanced analytics / chart libraries
- Territory routing (field stub only)
- Luv email delivery (simulate send only); optional OpenAI polish when `OPENAI_API_KEY` is set

## Product philosophy

Not a traditional CRM. No separate Lead / Customer / Support / Billing / White Glove modules.

**One Relationship; status changes; never duplicate records** (marketing ingest dedupes by email / venue name). White Glove work is Tasks on the Relationship.

Calendly bookings from marketing `/walkthrough` land in the same store — see [`../shared/relationships/README.md`](../shared/relationships/README.md#calendly-walkthroughs-jennifer).

## Key paths

| Path | Purpose |
|------|---------|
| `lib/types.ts` | Core entities + pipeline statuses |
| `lib/pipeline.ts` | Pipeline columns / normalize helpers |
| `lib/program3/*` | Workflows, library store, engine, seed |
| `lib/program4/*` | Team, permissions, commissions, founder metrics |
| `lib/program9/*` | Project 9 — Business Dashboard metrics |
| `lib/luv/*` | Project 7 / Program 5 — briefing, insights, drafts |
| `lib/white-glove/*` | Project 6 — checklist backfill + task Complete |
| `lib/data/seed.ts` | Placeholder venues & activity (fallback) |
| `lib/data/store.ts` | Query helpers + live store + Program 3 merge |
| `../shared/relationships/` | Shared write/read Relationship store |
| `app/(app)/*` | Authenticated screens |
| `app/api/cron/automations` | Secured cron — sequences + workflows + renewals + dunning |
| `app/api/workflows/*` | Workflow enroll + tick |
| `app/api/sequences/*` | Sequence enroll + tick |
| `lib/program3/tick-automations.ts` | Shared in-process / cron tick runner |
| `lib/cron-auth.ts` | `CRON_SECRET` Bearer gate |
| `vercel.json` | Workspace Vercel Cron schedule |
| `scripts/tick-automations.mts` | `npm run tick:automations` |
| `app/api/library` | Template / sequence / branding writes |
| `app/api/relationships` | Manual Add Relationship |
| `app/api/relationships/status` | Pipeline stage moves |
| `app/api/walkthroughs` | Log Walkthrough + Complete/Reschedule/Cancel |
| `components/layout/*` | Shell + nav |

## Brand

CSS variables mirror `marketing/app/globals.css`. Typography: Cormorant Garamond (headings) + Source Sans 3 (UI).
