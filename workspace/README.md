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
- Welcome Back verification (Project 5) lives on the Relationship: Approve / Reject / Needs Follow Up when pending. Permission: `manage_welcome_back` (Owner, Administrator, Customer Success). Tiles link to `/relationships?view=list&wb=pending` (etc.).
- Recent founder activity from timeline (founder status, Welcome Back, subscriptions).

### Welcome Back verification (Project 5)

Everything stays on the Relationship — no separate approval queue.

| Action | Result |
|--------|--------|
| **Approve** | `welcomeBackVerified=verified`, `foundingMember=true` (Founding pricing), timeline “Welcome Back Approved”, email `welcome_back_verified` |
| **Reject** | `welcomeBackVerified=rejected`, timeline + light `welcome_back_rejected` email |
| **Needs Follow Up** | Stays `pending`, timeline note, Task “Follow up on Welcome Back verification” |

API: `POST /api/relationships/welcome-back` with `{ relationshipId, action: "approve"|"reject"|"needs_follow_up" }`.

UI: buttons on `/relationships/[id]` when `welcomeBackRequested && welcomeBackVerified === "pending"` and the actor has `manage_welcome_back`.

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

Inquiry → Walkthrough Requested → Walkthrough Scheduled → Walkthrough Completed → Trial → Subscribed → Onboarding → Live → Expansion → Referral → Renewal → Former Customer

- Legacy `active_customer` normalizes to **Live**.
- **Support**, **Welcome Back**, and **Founder** are overlays on the same record (not separate CRM objects).
- Relationships page defaults to a **pipeline board**; toggle **List** for the table view.
- Moving a stage writes a timeline event and may auto-enroll workflows triggered on `status_enter`.

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
- Scheduler: `GET|POST /api/sequences/tick` (also ticks on `/sequences` and relationship detail load)
- Sends via `@shared/email` + timeline `email_sent` (dry-run without `RESEND_API_KEY`)

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
5. Hit `/api/sequences/tick` (and `/api/workflows/tick`) to process due delayed / absolute steps.
6. Open **Communications → Library** to edit templates or build sequence steps (Relative vs Absolute + datetime picker).

### Known stubs

- Opens / performance counters are placeholders.
- Delayed and absolute steps advance when tick runs (page load or cron route), not a background worker.
- Cron hint: `curl -X POST https://<host>/api/sequences/tick` on a schedule (e.g. every 5–15 minutes).

### Workflows

- Nav: **Workflows** — list, builder (`/workflows/new`, `/workflows/[id]`), run viewer.
- Steps: delay, wait condition, timed/send email, internal reminder, create task, assign owner, notify team, pause, exit.
- Runs attach to a Relationship (manual enroll or status trigger).
- When a workflow step references a `sequenceId`, steps expand and inherit relative/absolute schedule fields.
- Pause / resume / exit from the run viewer or relationship detail.
- File store: `workspace/.data/workflows.jsonl`, `workflow-runs.jsonl` (seeded on first use).
- Scheduler stub: `GET|POST /api/workflows/tick` (also runs on Relationships / Workflows page load).
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
| `app/api/workflows/*` | Workflow enroll + tick |
| `app/api/sequences/*` | Sequence enroll + tick |
| `app/api/library` | Template / sequence / branding writes |
| `app/api/relationships` | Manual Add Relationship |
| `app/api/relationships/status` | Pipeline stage moves |
| `app/api/walkthroughs` | Log Walkthrough + Complete/Reschedule/Cancel |
| `components/layout/*` | Shell + nav |

## Brand

CSS variables mirror `marketing/app/globals.css`. Typography: Cormorant Garamond (headings) + Source Sans 3 (UI).
