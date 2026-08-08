# Couple Home — Phase 1 Current-State Inventory

Inventory date: 2026-08-08  
Scope: Couple / client portal **Home** surface only. No redesign recommendations. No application code changes.

---

## 1. Current architecture

### Exact route and entry path

| Item | Value |
|------|--------|
| **Canonical Home URL** | `/p/{accessToken}` with default section `overview` (no hash, or `#overview`) |
| **Login entry** | `/client/login` → `signInClientAction` → `getMyPortalUrl()` → redirect to `/p/{access_token}` |
| **Invite accept entries** | `/client/accept`, `/client/accept-participant` → redirect to `/p/{accessToken}` |
| **There is no `/client` Home page** | `/client/*` is auth only (login / accept). Home lives under the portal token route. |
| **Layout** | `app/(portal)/layout.tsx` — light-theme token override; no venue staff chrome |
| **Page** | `app/(portal)/p/[token]/page.tsx` — `PortalPage` |
| **Shell / Home section** | `components/portal/portal-shell.tsx` — `PortalShell` + `OverviewSection` |
| **Nav label for Home** | `NAV_ITEMS` entry `{ id: "overview", label: "Home", icon: "🏠" }` |

Deep-links: after legal gate clears, `window.location.hash` sets `activeSection` (e.g. `#tasks`, `#guests`). Default when no hash: `"overview"`.

### SSR data loaded by `PortalPage`

```
resolvePortalContext(token)          → RPC get_portal_context
resolvePortalTasks(token)            → RPC get_portal_tasks
resolvePortalVendorTasks(token)      → RPC get_portal_vendor_tasks
resolvePortalTimeline(token)         → RPC get_portal_run_of_show
resolvePortalLegalGate(token)        → legal service (couple portal identity + gate status)
```

On successful context resolve, page comments note `get_portal_context` updates `last_accessed_at`; engagement fires via `recordEngagementEvent({ eventType: "couple.portal_opened" })` inside `resolvePortalContext`.

### Page / component tree (Home path)

```
PortalPage (app/(portal)/p/[token]/page.tsx)
└── PortalShell (components/portal/portal-shell.tsx)
    ├── [gate] WelcomeExperienceGate | “Preparing your workspace”
    ├── sticky header
    │   ├── venue logo / couple name / venue name / event date
    │   ├── Export my data → /api/portal/export?token=…
    │   ├── CoupleNotificationBell (components/portal/couple-notification-bell.tsx)
    │   └── Account → setActiveSection("account")
    ├── NAV_ITEMS row (Home, Tasks, Timeline, Documents, Payments, Messages, Venue Guide, Preferred Vendors)
    ├── main — when activeSection === "overview":
    │   └── OverviewSection
    │       ├── Hero (inline)
    │       ├── YourVenueCards
    │       │   ├── VenueTeamCard
    │       │   ├── NextStepsCard  ← buildUnifiedTaskList (lib/portal/unified-tasks.ts)
    │       │   ├── PaymentsCard
    │       │   ├── TimelineCard
    │       │   └── WeddingPlanningProgressCard
    │       ├── YourWeddingSection
    │       │   ├── WebsiteLaunchCard
    │       │   ├── GuestsLaunchCard
    │       │   ├── BudgetLaunchCard
    │       │   ├── SeatingLaunchCard
    │       │   ├── PlansLaunchCard
    │       │   └── StoryLaunchCard
    │       ├── KeepsakeSection (when daysUntil < -3) …
    │       │   ├── FeedbackFlow / ReferralCard / MemoriesSection (conditional)
    │       ├── WeddingDaySection (when -3 ≤ daysUntil ≤ 14) …
    │       │   └── WeddingDayPortal when daysUntil === 0
    │       └── multi-column card pool
    │           ├── LuvDailyCard
    │           ├── RequestsSummaryCard (components/portal/requests-section.tsx)
    │           ├── KeyDatesCard
    │           ├── MemoryStrip (if latestJournalEntry)
    │           ├── PlanningJourney (if event && daysUntil > 14)
    │           ├── WeddingSnapshotCard (if daysUntil null or > -3)
    │           ├── SeasonalInspirationCard (if event && daysUntil null or > 14)
    │           ├── WeddingJourneySection
    │           ├── ComingUpCard
    │           ├── VenueNoteCard
    │           └── LuvIntroCard (components/luv/luv-intro-card.tsx; one-time)
    ├── footer: venue name only
    └── FloatingLuvWidget → LuvAskSection (components/portal/luv-ask-section.tsx) — all sections including Home
```

### Hooks / client state used on Home

| State | Where set | Used on Home for |
|-------|-----------|------------------|
| `activeSection` | PortalShell (default `"overview"`) | Which surface renders |
| `guestStats` | `GET /api/portal/guests` after legal clearance | Guests launch, Snapshot, Luv, Journey milestones |
| `todoCount` | `TodoSection` `onCountChange` only when Plans/todos section mounts | Plans launch + Snapshot — **not fetched on Home mount** |
| `profile` | `GET /api/portal/profile` | Story/Plans launch status; `latestJournalEntry` → MemoryStrip |
| `recentActivity` | `GET /api/portal/activity` | LuvDailyCard weekly completion message |
| `showLuvIntro` | `GET /api/portal/luv-intro` (`seen === false`) | LuvIntroCard |
| `needsLegalAcceptance` / legal docs | SSR + `GET /api/portal/legal` | Blocks entire workspace including Home |

Per-card local `useEffect` fetches (team, payments, documents, website, budget, seating, key-dates, requests, questionnaire, timeline entries, etc.) are listed in §3.

### Permissions / role checks

| Mechanism | Behavior on Home |
|-----------|------------------|
| **Portal session token** | All RPCs/API routes validate `p_token` / token query (SECURITY DEFINER portal RPCs). Invalid token → `notFound()` at page. |
| **`accessLevel`** on `PortalContext` (`couple` \| `planning` \| `financial` \| `view_only`) | Typed and returned by `get_portal_context`; **Home `OverviewSection` does not branch on it**. Participant permission levels are used in `OurPeopleSection` (not Home cards). |
| **Legal Welcome gate** | Hard gate before any Home UI (`WelcomeExperienceGate` or pending empty-docs screen). |
| **Task `canComplete` / `visibility`** | Used in Next Steps / Wedding Day checklists for labeling; next-steps filter is incomplete vs completed via `buildUnifiedTaskList`, not a separate role check on the card. |
| **Feature flags** | **None found** in portal Home / `components/portal` paths. Behavior is date-bracket and data-driven, not flag-gated. |

### Navigation dependencies

- Single operational nav row (`NAV_ITEMS`) — Home is first.
- Couple-owned destinations (Website, Guests, Seating, Budget, Plans/todos, Our Story) are **not** in the header row; Home launch cards call `onNavigate(section)`.
- Account is header-only (`Settings` icon).
- Export is a direct download link, not a section.
- Floating Ask Luv can navigate to Venue Guide.
- Notification bell can navigate via notification link hashes (`sectionFromLink`).

---

## 2. Component inventory

| Component | File | Role on Home |
|-----------|------|--------------|
| `PortalPage` | `app/(portal)/p/[token]/page.tsx` | Server page; loads context/tasks/timeline/legal |
| `PortalShell` | `components/portal/portal-shell.tsx` | Client shell; nav; mounts Overview |
| `OverviewSection` | same | Home composition |
| `YourVenueCards` | same | “Your Venue” operational block |
| `VenueTeamCard` | same | Team list + Message CTA |
| `NextStepsCard` | same | Top incomplete unified tasks + Open Tasks |
| `PaymentsCard` | same | Balance / next payment / Pay Now |
| `TimelineCard` | same | Next 2 timed entries + View Timeline |
| `WeddingPlanningProgressCard` | same | Composite % bar |
| `YourWeddingSection` | same | “Your Wedding” launch grid |
| `LaunchCard` | same | Shared quiet launch tile |
| `WebsiteLaunchCard` / `GuestsLaunchCard` / `BudgetLaunchCard` / `SeatingLaunchCard` / `PlansLaunchCard` / `StoryLaunchCard` | same | Per-destination launch tiles |
| `LuvDailyCard` | same | Single coaching message |
| `RequestsSummaryCard` | `components/portal/requests-section.tsx` | Attention count → Tasks |
| `KeyDatesCard` | portal-shell | Next venue key date + up to 3 more |
| `MemoryStrip` | portal-shell | Latest journal teaser → Story |
| `PlanningJourney` | portal-shell | Milestone dots + required-task % |
| `WeddingSnapshotCard` | portal-shell | At-a-glance cells |
| `SeasonalInspirationCard` | portal-shell | Season + tips + décor ideas |
| `WeddingJourneySection` | portal-shell | Hard-coded celebration milestones |
| `ComingUpCard` | portal-shell | Bracket static tips → todos |
| `VenueNoteCard` | portal-shell | Static venue-voice quote |
| `LuvIntroCard` | `components/luv/luv-intro-card.tsx` | One-time Luv intro |
| `WeddingDaySection` / `WeddingDayPortal` | portal-shell | Final stretch / wedding day / just married |
| `KeepsakeSection` / `FeedbackFlow` / `ReferralCard` / `MemoriesSection` | portal-shell | Post-wedding keepsake |
| `CoupleNotificationBell` | `components/portal/couple-notification-bell.tsx` | Header inbox |
| `FloatingLuvWidget` | portal-shell | Persistent Ask Luv FAB |
| `WelcomeExperienceGate` | `components/legal/welcome-experience-gate.tsx` | Pre-Home legal gate |
| `buildUnifiedTaskList` | `lib/portal/unified-tasks.ts` | Next Steps synthesis |
| Observation helpers | `lib/luv/portal-observations.ts` | Luv + countdown copy |

---

## 3. Data-source inventory

### Server (page load)

| Source | Mechanism | Tables / domain (via RPC / service) |
|--------|-----------|-------------------------------------|
| Portal context | `get_portal_context` | Portal session, clients, events, venues (incl. brand colors, logo, hero image, contact) |
| Venue tasks | `get_portal_tasks` | Event / venue tasks visible to couple |
| Vendor tasks | `get_portal_vendor_tasks` | Vendor tasks projected to couple |
| Timeline | `get_portal_run_of_show` | Timeline sections/entries for couple |
| Legal gate | `resolveCouplePortalLegalIdentity` + `getCouplePortalLegalGateStatus` | Legal documents / acceptances |
| Engagement | `recordEngagementEvent` | Activation engagement events |

### Client fetches used while Home (overview) is mounted

| API | Primary RPC / service | Home consumers |
|-----|----------------------|----------------|
| `GET /api/portal/legal` | Legal acceptance engine | Gate refresh |
| `GET /api/portal/guests` | `get_couple_guests` | Guest stats |
| `GET /api/portal/profile` | `get_couple_profile` | Profile, journal, inspiration counts |
| `GET /api/portal/activity` | `get_recent_activity` | LuvDailyCard |
| `GET /api/portal/luv-intro` (+ POST mark) | `get_luv_intro_seen` / `mark_luv_intro_seen` | Intro card |
| `GET /api/portal/venue-team` | `get_portal_venue_team` | VenueTeamCard |
| `GET /api/portal/requests` | `get_portal_requests` | NextStepsCard, RequestsSummaryCard |
| `GET /api/portal/payments` | `get_portal_payments` | NextSteps, PaymentsCard, Progress |
| `GET /api/portal/questionnaire` | `get_questionnaire_for_portal` | NextSteps, Progress, LuvDaily |
| `GET /api/portal/documents` | `get_couple_documents` (+ related) | NextSteps, Progress |
| `GET /api/portal/timeline` | `get_portal_run_of_show` | TimelineCard |
| `GET /api/portal/key-dates` | `get_portal_key_dates` → `client_key_dates` | KeyDatesCard, LuvDaily |
| `GET /api/portal/website` | `get_my_website` | WebsiteLaunchCard |
| `GET /api/portal/budget` | `get_portal_budget` | BudgetLaunchCard |
| `GET /api/portal/seating` | `get_seating_data` | SeatingLaunchCard |
| `GET /api/portal/notifications` | `get_couple_notifications` → `couple_notifications` | Bell |
| `GET /api/portal/export` | Export handler | Header download |
| Keepsake-only: anniversary / post-wedding / memories / feedback / referral / upload | respective RPCs | KeepsakeSection |
| Wedding-day-only: run-of-show + participants | `get_portal_run_of_show`, `get_couple_participants` | WeddingDayPortal |

### Static / client-computed (no fetch)

- Day brackets: `getSuggestionBracket(daysUntil)`
- Copy banks: `COMING_UP_BY_BRACKET`, `SUGGESTIONS_BY_BRACKET`, `INSPIRATION_CONTENT`, `SEASON_CONTENT`, `SOCIAL_PROOF_BY_BRACKET`, `NEXT_MILESTONE_BY_BRACKET`, `VenueNoteCard` hard-coded quote
- Readiness % from required `initialTasks`
- Composite progress from tasks + payments + contracts + questionnaire

---

## 4. Visible-content inventory

Ownership legend: **venue-provided** | **couple-owned** | **shared** | **system-generated**

### A. Chrome (visible whenever Home is showing; also on other sections)

| Element | Component | Purpose | Data source | User action | Destination | Duplicated elsewhere? | Ownership |
|---------|-----------|---------|-------------|-------------|-------------|----------------------|-----------|
| Venue logo | PortalShell header | Branding | `context.venue.logoUrl` | none | — | Venue Guide / public site | venue-provided |
| Couple name | header | Identity | client first + partner names | none | — | Hero | system-generated from client record |
| Venue name | header | Branding | `context.venue.name` | none | — | Hero, footer | venue-provided |
| Event date (sm+) | header | Context | `context.event` | none | — | Hero | shared |
| Export my data | header link | Data export | export API | download | file download | Account-ish capability | couple-owned data export |
| Notification bell + unread badge | CoupleNotificationBell | Inbox | `/api/portal/notifications` | open / clear / navigate | hash sections | Messages may overlap content | system-generated |
| Account (settings) button | header | Account | — | navigate | `account` section | — | system / navigation |
| Nav: Home | NAV_ITEMS | Section switch | — | navigate | `overview` | — | system / navigation |
| Nav: Tasks (+ badge of completable incomplete tasks + vendor tasks) | NAV_ITEMS | Section switch | `initialTasks`, `initialVendorTasks` | navigate | `tasks` | Next Steps / hero Review Tasks | shared |
| Nav: Timeline | NAV_ITEMS | Section switch | — | navigate | `timeline` | TimelineCard / hero | shared |
| Nav: Documents | NAV_ITEMS | Section switch | — | navigate | `documents` | Next Steps contracts | shared |
| Nav: Payments | NAV_ITEMS | Section switch | — | navigate | `payments` | PaymentsCard | shared |
| Nav: Messages | NAV_ITEMS | Section switch | — | navigate | `messages` | VenueTeam Message | shared |
| Nav: Venue Guide | NAV_ITEMS | Section switch | — | navigate | `guide` | Floating Luv guide nav | venue-provided |
| Nav: Preferred Vendors | NAV_ITEMS | Section switch | — | navigate | `vendors` | — | venue-provided |
| Footer venue name | footer | Branding | venue name | none | — | Header | venue-provided |
| Ask Luv FAB | FloatingLuvWidget | Concierge chat | opens LuvAskSection | open panel | guide (optional) | LuvDailyCard voice overlaps | system-generated |

### B. Hero (always on overview)

| Element | Heading / copy | Component | Purpose | Data source | User action | Destination | Duplicated? | Ownership |
|---------|----------------|-----------|---------|-------------|-------------|-------------|-------------|-----------|
| Backdrop | — | OverviewSection hero | Atmosphere | `venue.heroImageUrl` or brand gradient | none | — | Venue Guide may reuse hero | venue-provided |
| Venue name eyebrow | venue name | hero | Welcome hierarchy | `context.venue.name` | none | — | header | venue-provided |
| Welcome line | “Welcome to your wedding home.” | hero | Welcome | static | none | — | — | system-generated |
| Couple names | `{first} & {partner}` | hero | Identity | client | none | — | header | shared |
| Countdown | “N Days Until…” / “Today Is…” / “Married …” | hero | Urgency | `event.eventDate` / end | none | — | Snapshot, Wedding Day | system-generated |
| Event date line | formatted range | hero | Date | event | none | — | header | shared |
| Fallback | “Your planning journey has begun.” | hero | Empty event | no event | none | — | — | system-generated |
| Tagline | “Your venue team is here…” | hero | Reassurance | static | none | — | VenueNoteCard tone | system-generated |
| CTA Continue Your Journey | button | hero | Enter couple plans | — | click | `todos` | Plans launch | couple-owned |
| CTA Review Tasks | button | hero | Venue work | — | click | `tasks` | Next Steps / nav | shared |
| CTA Message Venue | button | hero | Comms | — | click | `messages` | VenueTeam / nav | shared |
| CTA View Timeline | button | hero | Timeline | — | click | `timeline` | TimelineCard / nav | shared |

### C. Your Venue block

| Element | Heading | Purpose | Data | Action | Destination | Duplicated? | Ownership |
|---------|---------|---------|------|--------|-------------|-------------|-----------|
| Section label | “Your Venue” | Group ops | static | — | — | — | system / navigation |
| Meet Your Venue Team | “👋 Meet Your Venue Team” | Intro team | `get_portal_venue_team` (up to 3) | mailto / Message | email / `messages` | Account / guide contact | venue-provided |
| Empty team copy | “Your venue team will appear here.” | Empty | empty array | — | — | — | system-generated |
| Your Next Steps | “✅ Your Next Steps” + readiness % bar | Prioritized work | unified list from tasks+requests+payments+questionnaire+documents | list display only; Open Tasks | `tasks` | full UnifiedTasksSection | shared / venue needs |
| Next Steps empty | “You’re all caught up…” | Empty | no incomplete | Open Tasks | `tasks` | — | system-generated |
| Payments | “💳 Payments” | Money status | schedules/line items | Pay Now / View | `payments` | PaymentSection | shared |
| Payments empty / all paid | schedule empty / “All paid up ✦” | Empty/done | — | View Payments | `payments` | — | system-generated |
| Timeline | “🕒 Timeline” | Next times | timeline entries with `entryTime` (2) | View Timeline | `timeline` | Timeline section | shared |
| Timeline empty | “Your Timeline is being built…” | Empty | — | View Timeline | `timeline` | — | system-generated |
| Wedding Planning Progress | “Wedding Planning Progress” + % | Composite completion | required tasks + paid lines + signed contracts + questionnaire submitted | display only | — | readiness on Next Steps / Snapshot overlap metrics | shared |

### D. Your Wedding block

| Element | Label | Status line | Data | Action | Destination | Duplicated? | Ownership |
|---------|-------|-------------|------|--------|-------------|-------------|-----------|
| Section label | “Your Wedding” | — | static | — | — | — | system / navigation |
| Wedding Website | 🌐 | Published ✓ or N% complete | website API + `WEBSITE_ALL_SECTIONS` | navigate | `website` | Website section | couple-owned |
| Guest List | 👥 | “N invited, M confirmed” | guestStats | navigate | `guests` | Snapshot / Journey guests | couple-owned |
| Budget | 💰 | “$spent of $total” | budget API | navigate | `budget` | Budget section | couple-owned |
| Seating | 🪑 | unassigned count / All seated | seating API | navigate | `seating` | Seating section | shared / couple-owned |
| Plans | ✨ | ideas count or todo count | profile.inspirationPhotos / todoCount | navigate | `todos` | TodoSection; Coming Up | couple-owned |
| Our Story | 💍 | Written ✓ | profile.ourStory | navigate | `story` | Story section / MemoryStrip | wedding story |

### E. Mode overlays (date-gated, stacked after Your Wedding — not exclusive full-page replacements)

Comments say “replaces”; **implementation adds these below venue/wedding blocks**; only some multi-column cards hide based on `du`.

#### E1. Keepsake (`du < -3`)

| Element | Purpose | Data | Action | Destination | Ownership |
|---------|---------|------|--------|-------------|-----------|
| Married duration hero | Post-wedding identity | computed from `du`, anniversary | none / display | — | system-generated |
| Anniversary countdown / Happy anniversary | Milestone | event date | none | — | system-generated |
| Note from venue | Anniversary messages | `get_portal_anniversary_messages` | none | — | venue-provided |
| Luv anniversary observations | Coaching | `getAnniversaryObservations` | none | — | system-generated |
| Your Journey timeline | Narrative milestones | static phases + event date | none | — | system-generated / story |
| Feedback flow (≥7 days, once) | Venue + platform feedback | POST feedback APIs | submit | stays on Home | shared + system |
| Feedback thank-you | Confirmation | post-wedding status | none | — | system-generated |
| Referral card (rating ≥4) | Referral | POST referral | submit | — | venue-provided funnel |
| Memories | Upload/view photos | memories API + upload | add/upload | — | couple-owned / shared visibility |

#### E2. Wedding Day band (`-3 ≤ du ≤ 14`)

| Mode | Elements | Data | Action | Ownership |
|------|----------|------|--------|-----------|
| Just Married (`du < 0`) | “Just Married.” celebration | `du` | none | system-generated |
| Wedding Day (`du === 0`) | Ceremony countdown; Luv msgs; full day timeline; wedding-day tasks; key people Call | run-of-show, participants, tasks `milestoneKind === "event_day"` | Call / view | venue + shared + system |
| Final Details (`1–14`) | Countdown observation; Final Details Checklist | `getCountdownObservation`; tasks `milestoneKind === "final_stretch"` | display (checkbox visual only on Home) | venue needs / system |

### F. Multi-column card pool

| Element | Heading | Purpose | Data | Action | Destination | Duplicated? | Ownership |
|---------|---------|---------|------|--------|-------------|-------------|-----------|
| Luv says… | “Luv says…” | One coaching message / day | priority chain (key dates, overview obs, activity, questionnaire, milestone/social proof, getLuvMessage) | sometimes navigate | `todos` if actionable | Tasks / Plans coaching themes | system-generated |
| Requests summary | “N requests need…” / “You’re all caught up” | Request attention | portal requests | click | `tasks` (not requests section) | Requests filter in Tasks; `requests` section still exists | venue needs |
| Key Dates | next label + date + note | Venue calendar | `client_key_dates` via RPC | none | — | Venue booking workspace key dates | venue-provided |
| Memory strip | “💗 A Moment From Your Journey” | Journal teaser | `profile.latestJournalEntry` | click | `story` | Story/Journey journal | wedding story |
| Wedding Journey (dots) | “🌸 Wedding Journey” | Stage path + % | daysUntil + required readiness | none | — | Planning Progress / Snapshot % | system-generated |
| Your Snapshot | “🌿 Your Snapshot” | Metrics grid | du, guests, todoCount, readiness | none | — | launch cards metrics | mixed |
| Seasonal Inspiration | “Seasonal Inspiration” | Season narrative + tips + décor | event month + bracket banks | + Add → todos | `todos` | Coming Up content affinity | couple-owned guidance / system |
| Your Wedding Journey (milestones) | “Milestones worth celebrating” | Progress narrative | guestStats; **website/invitations hard-coded false** | none | — | Guests launch; website reality not wired | system-generated |
| Coming Up | “💗 Coming Up” | Static stage tips | bracket bank | click row | `todos` | Seasonal tips | system → couple-owned |
| From Your Venue | “💌 From Your Venue” | Warm quote | **hard-coded string**; signed “The {venueName} Team” | none | — | Hero tagline tone | presented as venue; **system-generated copy** |
| Luv intro | “Welcome! I’m Luv.” | One-time intro | luv-intro seen flag | CTA / dismiss | Tasks (CTA) | Floating Luv | system-generated |

### G. Empty / loading / status indicators specific to Home

- Next Steps skeleton pulse while loads.
- Cards return `null` while loading (team, payments, timeline, progress, key dates, requests, LuvDaily) — no permanent empty shell for some.
- RequestsSummaryCard returns null if no requests or no actionable/upcoming/recent slice.
- KeyDatesCard returns null if no key dates.
- WeddingPlanningProgressCard returns null if `total === 0`.
- Legal pending: “Preparing your workspace”.

---

## 5. Content categorization

Each Home-visible element assigned to **exactly one** category.

### VENUE NEEDS FROM COUPLE

- Next Steps incomplete items (venue tasks, requests, unsigned contracts, unpaid items, sent questionnaire)
- Requests summary card
- Hero “Review Tasks”
- Final Details Checklist / wedding-day couple tasks
- Wedding Planning Progress (composite of venue-required systems)
- Next Steps readiness % (required venue tasks)

### SHARED PLANNING

- Timeline card + hero “View Timeline” + nav Timeline
- Payments card + nav Payments
- Documents/contracts surfaced in Next Steps / Progress
- Messages CTA / Venue Team Message / nav Messages
- Seating launch (floor plan shared with venue)
- Preferred Vendors nav (venue directory)
- Venue Guide nav
- Notification bell (household + venue messaging signals)
- Questionnaire as operational item (also venue needs)

### COUPLE-OWNED PLANNING

- Hero “Continue Your Journey”
- Your Wedding launches: Website, Guests, Budget, Plans
- Coming Up tips → todos
- Seasonal Inspiration “+ Add” tips
- Snapshot guest/todo cells (couple data)
- Plans status from inspiration/todos
- Memories upload (keepsake)

### WEDDING STORY / MEMORY

- MemoryStrip / journal teaser
- Our Story launch
- Keepsake married hero, anniversary, journey narrative, venue anniversary notes
- Just Married / wedding-day emotional surfaces (celebration framing)
- Wedding Journey milestones section (celebration framing)

### SYSTEM / NAVIGATION

- Entire sticky header chrome (except where listed above as destination CTAs counted by destination category — nav itself is SYSTEM)
- NAV_ITEMS row
- Footer
- Floating Ask Luv FAB chrome
- Legal Welcome / Preparing gate
- Export my data
- Account settings button
- Hero venue welcome machinery that is pure UI (gradient, florals)
- LuvDailyCard / LuvIntroCard / VenueNoteCard (static system coaching voice)
- PlanningJourney dots UI
- Date-bracket routing logic itself
- Hard-coded VenueNoteCard quote

---

## 6. Duplication analysis

| Home location | Destination page/section | What is duplicated | Unique value on Home vs pure repeat |
|---------------|--------------------------|--------------------|-------------------------------------|
| Next Steps list | Tasks (`UnifiedTasksSection`) | Same `buildUnifiedTaskList` synthesis; top 5 incomplete only; titles only (no complete-in-place) | Summary + readiness bar; still Open Tasks for real work |
| Hero Review Tasks / Nav Tasks | Tasks | Entry to same destination | Nav badge count is chrome-only unique |
| PaymentsCard | Payments | Balance, next due, progress | Condensed status only |
| TimelineCard | Timeline | First timed entries | Preview of 2 times only |
| RequestsSummaryCard | Tasks (navigate) / Requests section still routable | Request attention counts | Home forces Tasks destination, not Requests detail UI |
| Website/Guests/Budget/Seating/Plans/Story launches | Respective sections | Status numbers | Presence/status only; editing lives elsewhere |
| MemoryStrip | Story / Journey journal | Latest entry body/media | Single teaser |
| Coming Up / Seasonal tips | Plans (`todos`) | Suggested planning ideas | Suggestions not persisted until user adds in todos |
| Venue Team Message | Messages | Messaging entry | Team roster + mailto unique to Home |
| Wedding Planning Progress vs Next Steps readiness vs Snapshot readiness | Tasks / Payments / Documents / Questionnaire | Overlapping % concepts with different formulas | Home-only composite progress formula |
| LuvDailyCard vs Floating Luv vs Final Details Luv | Ask Luv / Guide | Coaching voice | Different surfaces; Home card is passive |
| Key Dates | (no couple section; venue-authored list also on venue dashboard) | Date list | Couple-facing condensed next date |
| Wedding Journey milestones vs Guests launch | Guests / Website | Guest-started / RSVP signals | Website/invitations milestones **not connected to live website publish state** |
| Hero countdown vs Snapshot days / Final Details countdown | — | Same day math | Multiple displays of `daysUntil` |
| Wedding-day run-of-show preview | Timeline / run-of-show | Day schedule | Emotional wedding-day framing |

No recommendation on consolidation — observed only.

---

## 7. Current prioritization behavior

### What appears first / above the fold

Fixed vertical order in `OverviewSection`:

1. Hero (large, `min(64vh, 560px)`)
2. Your Venue (team, next steps, payments, timeline, then progress bar)
3. Your Wedding launch grid
4. Date-mode band (Keepsake **or** WeddingDaySection when applicable)
5. Multi-column balanced pool (CSS `columns-1 lg:columns-2`) — visual order among pool cards is **DOM order**, not priority sorting across cards

Legal gate precedes everything.

### Which tasks are prioritized (Next Steps)

`buildUnifiedTaskList`:

1. Include venue tasks (all), actionable incomplete requests, sent contracts with `signToken`, unpaid/non-cancelled payment line items, questionnaire when `status === "sent"`, timeline submit when unpublished (Home passes `timelineHasUnpublishedChanges: false` → **timeline submit never appears on Home Next Steps**).
2. Filter `!completed`.
3. Sort: items with `dueDate` first, ascending; undated last; stable for undated.
4. Slice first **5**.

Completed tasks do not appear in the list (empty state: “all caught up”). Progress % still counts required complete tasks.

### Overdue prioritization

- Unified sort is **due-date chronological only** — no explicit boost for `status === "overdue"` vs pending with earlier due date.
- PaymentsCard outstanding filter is `status !== "paid"`; next payment = outstanding with dueDate, sorted ascending (overdue dates appear first if earlier).
- PortalTask has `overdue` status; Home Next Steps does not special-case it beyond date order.

### Venue-required vs couple-created

| Kind | How distinguished on Home |
|------|---------------------------|
| Venue-required tasks | `isRequired` drives readiness % and Progress card task portion; `canComplete` drives “Your task” badges in Final Details |
| Couple personal todos | Separate `todos` section / Plans launch; **not** in Next Steps; suggestions push users to create couple todos |
| Coming Up / Seasonal tips | System suggestions, not venue tasks |

### Recent activity / new info

- `get_recent_activity` → `totalThisWeek` used in LuvDailyCard after higher-priority signals miss.
- Notification bell polls every 60s.
- Requests card highlights needingAction counts with rose border when > 0.
- Luv intro shows once until dismissed/mark seen.

### Deadline influence

- Days-until brackets drive Coming Up, Seasonal Inspiration, Luv social-proof/milestone rotation, suggestion sets.
- Mode switches: Final Details ≤14; Wedding Day = 0; Just Married -3…-1; Keepsake < -3.
- Key date within 7 days wins LuvDailyCard message.
- Payment next due by earliest date.

### Completed items appearance

- Next Steps: hidden.
- Progress bar: included in numerator.
- RequestsSummary: can show “N recently completed” when no needingAction.
- Wedding Journey milestones: “Done ✓” badges for completed keys.
- Payments “All paid up”.
- Final Details checklist filters `status !== "complete"` (completed hidden).
- Wedding-day tasks same incomplete filter.

### Personalized content

- Names, event dates, venue brand CSS vars, venue hero/logo/name
- Guest/payment/website/budget/seating live stats
- Day-bracket personalized copy
- Luv observation heuristics (guests, readiness, days)
- Anniversary personalization post-wedding
- Journal memory if exists
- **Not personalized:** VenueNoteCard body text (fixed quote); Wedding Journey website/invitations always incomplete; `todoCount` unless Todos visited in-session

---

## 8. Dependencies

### Package / import dependencies (Home-critical)

- `@/lib/portal/service`, `@/lib/portal/types`, `@/lib/portal/unified-tasks`
- `@/lib/luv/portal-observations`
- `@/lib/legal/*` + WelcomeExperienceGate
- `@/lib/requests/portal` (via RequestsSummaryCard API)
- `@/lib/couple-notifications/service`
- `@/components/portal/website-editor` (`ALL_SECTIONS` for website %)
- `@/components/luv/luv-intro-card`
- Sonner toasts (feedback/referral errors)
- Supabase server client + portal SECURITY DEFINER RPCs
- Client auth session table `client_portal_sessions` for `/client/login` → `/p/...`

### Cross-section destinations Home navigates to

`todos`, `tasks`, `messages`, `timeline`, `payments`, `website`, `guests`, `budget`, `seating`, `story`, `account`, `guide` (via Luv), plus notification-driven hashes.

### External systems

- Stripe checkout URLs return to `/p/{token}?payment=…` (payments flow, not Home-specific).
- Mailto / tel links from team and wedding-day contacts.

---

## 9. Feature flags

**None identified** for Couple Home / portal overview.

No `featureFlag` / `FEATURE_` usage under `components/portal`. Visibility is controlled by:

- Legal acceptance state
- Presence/absence of data (empty → null/message)
- `daysUntil` thresholds and brackets
- One-time Luv intro persistence RPC
- Post-wedding feedback/referral submission flags from `get_portal_post_wedding_status`

---

## 10. Open questions discovered during inventory

1. **Is “replaces planning” intentional for Keepsake/Wedding Day?** Comments claim replacement, but Hero + Your Venue + Your Wedding remain; only some pool cards gate on `du > 14` / `du > -3`. Which is the product source of truth?
2. **Should `todoCount` load on Home?** Currently remains `0` until `TodoSection` mounts, so Plans/Snapshot can under-report personal todos on a cold Home visit.
3. **Why does Home Next Steps force `timelineHasUnpublishedChanges: false`?** Timeline submit items present on Tasks may never appear in the Home list.
4. **Should Home respect `accessLevel` (`financial`, `view_only`, etc.)?** Context exposes it; Overview does not filter cards (e.g. Budget/Payments may still render for restricted sessions depending on API denials).
5. **VenueNoteCard authorship:** presented as venue voice but hard-coded in code — is a venue-editable note missing from inventory wiring?
6. **WeddingJourneySection:** `website` and `invitations` milestones are hard-coded `false` — intentional stub or incomplete wiring vs `WebsiteLaunchCard` / guest invitation progress APIs?
7. **Requests navigation:** Summary goes to `tasks`, while `RequestsPortalSection` remains a navigable section id — is Requests meant to stay deeply linked only?
8. **Next Steps items are non-clickable** (title list only); only “Open Tasks” acts — intentional summary UX?
9. **Duplicate progress metrics** (Next Steps required %, Wedding Planning Progress composite %, Snapshot venue tasks %) — do they intentionally use different formulas for different stories?
10. **Overdue boost:** Portal tasks have `overdue` status; unified Home sort ignores status beyond due date — intentional?
11. **`/client` mental model:** User-facing docs often say “/client”; actual Home is `/p/{token}`. Confirm future work package language should treat `/p/...#overview` as Couples Home.
12. **Participant invitations / financial-only users:** How does Home behave when RPCs return partial errors for restricted permission — silent empty cards?

---

*End of Phase 1 inventory. No recommendations. Application code unchanged.*
