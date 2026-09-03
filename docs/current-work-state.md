# Current Work State

**Last verified:** 2026-09-02. Email/Resend E2E is PASS. SMS is gated on
Twilio Primary Compliance Profile approval (`in-review`). Do not purchase a
US number or create a Messaging Service until that profile is `twilio-approved`.

This is a living session-handoff document: current branch, active work, and
verified status, so a new session can continue correctly without the old
conversation. It is not the release-readiness ledger — for feature-by-feature
launch-trust status see `docs/platform-status-snapshot.md` (last reconciled
2026-08-11; now stale relative to later work and due its own reconciliation
pass — not done as part of this work).

---

## NEXT SESSION START HERE

1. **Booking Prepare / Handoff Phases 1–6 are complete.** Honest booked
   handoff, Recommend → Review → Apply, invite-at-Release (K.1), Financial
   Readiness (K.2, not a gate), Communications review, and Event Experience
   review. Claude independently reviewed the current implementation and
   found it **READY TO COMMIT**. `npm test` 1143 pass; `npx tsc --noEmit`
   clean. **Phase 7 live certification is still pending deployment** — do
   not Book This Lead / create a test invitation until the new image is
   live and a later turn is directed to certify. Audit remains
   `docs/booking-prepare-release-audit.md`.
2. **K.3, K.5, K.6, and K.7 remain unresolved product decisions** and were
   intentionally not changed. Do not invent a release-without-planning
   gate, change Venue Planning reminder start, add a default Booked
   welcome Automation, or auto-confirm Events at Book This Lead.
3. **Event Experience Profiles** (foundation + bounded surface activation)
   ship with this work. Do not redesign the portal, flatten the Wedding
   experience, or implement specialized Celebration of Life / Anniversary /
   Corporate / General Event content yet.
4. **Luv launch-readiness** ships with this work. Do not redesign Luv,
   build a Decision Engine, delete the old dashboard widget, or
   consolidate Anthropic call sites.
5. **Provisioning gate:** Twilio Primary Customer Profile
   `BUc864a49a4cddc4ec348cff74d4d18095` (Hello to Cheers) is API status
   `in-review`. Twilio emailed Business Profile Submission Confirmation;
   they may contact within 24 hours for identity/usage verification. No
   further applicant action until approved or rejected.
6. **Do not** buy a US phone number or create a Messaging Service while the
   profile is under review. Resume number purchase only after
   `twilio-approved`. Target number still available last check:
   `+18788679681` (SMS/MMS/Voice, `address_requirements: none`).
7. **Account credentials** are in AWS secret `htc/sandbox/twilio`
   (`TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` populated 2026-09-02 14:14 EDT;
   `TWILIO_MESSAGING_SERVICE_SID` empty until a Messaging Service exists).
   The previous sandbox deploy (`84b98bd`, task def `:86`) is the build
   Phase 7 was blocked on. After this commit is deployed, confirm the
   running image is no longer `84b98bd` before any live booking test.
   Do not put credentials in git, `.env`, or browser-visible config.
8. Email/Resend E2E is **PASS**. Do not revisit unless this SMS phase breaks
   it.
9. SMS application code is already implemented. Do not redesign it. No
   venue-facing Twilio wizard.

---

## Current product/release phase

Actively shipping features toward release; no formal release-candidate label
is currently in force in the repo.

## Current branch

`main`.

## Current active work

**Booking Prepare → Release — Phases 1–6 complete (READY TO COMMIT).**
Claude independently reviewed the current implementation and found no
incomplete work, known defects, or scope creep requiring cleanup.
Phase 1: honest booked-page checklist. Phase 2: recommend → review →
explicit Apply. Phase 3 (K.1): invitation moves from Book This Lead /
create Client to explicit Client Planning Release. `inviteClient` skips
a new send when a pending or accepted invitation already exists.
Release without email still releases planning. Phase 4 (K.2): Financial
Readiness on Prepare is visibility only — existing contracts/schedules/
lines, no hard gate, no new financial records. Phase 5: Communications
review on Prepare — invitation state + configured Booked-stage
Automations, visibility only. Phase 6: Event Experience review on
Prepare — existing resolver/presentation, read-only. Venue Planning,
Event status, and conversion gates are unchanged.
**Phase 7 live certification is still pending deployment.** Do not run
it until directed after the new sandbox image is healthy.

**Unresolved product decisions (intentionally unchanged):** K.3 (release
without Client Planning), K.5 (Venue Planning reminder start), K.6
(default Booked welcome Automation), K.7 (Event status at conversion).

**Event Experience Profiles — foundation + bounded activation.**
One canonical resolver: `event_type → experience_profile → customer
presentation`. PortalContext carries the resolved profile. Three customer
surfaces now consume it (Home launch heading/prompt, RSVP title/description/
website links, hosted-site hero eyebrow). Wedding customer wording on those
surfaces is preserved. Specialized non-wedding content is not implemented.

**Luv launch-readiness — minimal fix pass.** No autonomous sending.

**Twilio / SMS sandbox provisioning** remains gated on Primary Compliance
Profile approval. CloudFormation injects `TWILIO_ACCOUNT_SID`,
`TWILIO_AUTH_TOKEN`, and `TWILIO_MESSAGING_SERVICE_SID` into the venue-app
task from `htc/${EnvironmentName}/twilio`. Messaging Service SID stays empty
until a number can be purchased.

---

## Event Experience Profiles (locked)

`event_type` is the domain classification stored on Lead / Client / Event.

`experience_profile` is the presentation family. It is not a second Client
or Event entity.

Canonical resolver:

- `lib/event-experience/resolve.ts` (`resolveExperienceProfile`,
  `resolveExperienceProfileId`, `resolveExperienceProfileForClientEvent`)
- Profile catalog: `lib/event-experience/profiles.ts`
- Public barrel: `lib/event-experience/index.ts`

Locked profiles:

| Profile id | Internal label | Customer default title | Wedding-specific |
|---|---|---|---|
| `wedding` | Wedding | Your Wedding | yes |
| `celebration_of_life` | Celebration of Life | Your Celebration of Life | no |
| `anniversary` | Anniversary | Your Anniversary Celebration | no |
| `corporate` | Corporate | Your Event | no |
| `general_event` | General Event | Your Event | no |

Customers must never see the words “General Event”. Fallback for null /
unknown / unrecognized types is `general_event`.

Mapping (stored `event_type` values):

- **Wedding:** `wedding`, `elopement`, `engagement_party`, `rehearsal_dinner`, `reception`
- **Celebration of Life:** `celebration_of_life`
- **Anniversary:** `anniversary`
- **Corporate:** `corporate`, `corporate_event` (inquiry alias)
- **General Event:** remaining CRM types (`birthday`, `shower`, `gala`, `retreat`, `quinceanera`, `other`) plus explicit inquiry aliases `social_event` / `birthday_milestone` and any unrecognized value

Attached to customer context in `resolvePortalContext()`
(`lib/portal/service.ts`) as `PortalContext.experienceProfile`, preferring
`event.eventType` then `client.eventType`.

### Implemented this phase

- Canonical profile catalog + resolver
- PortalContext wiring
- Explicit `social_event` / `birthday_milestone` stored-value mappings (same resulting profile)
- Playbook planning-title Anniversary removed from the Wedding-family set (`formatClientPlanningTitle`)
- Profile-driven copy on three surfaces only:
  - Portal Home `YourWeddingSection` heading/prompt
  - RSVP metadata + website links
  - Hosted-site hero eyebrow
- Tests for mappings, Anniversary playbook titles, Wedding wording preserved, non-wedding surfaces no longer asserting wedding

### Intentionally unimplemented

- Redesign of portal Home / Journey / Memories / People / launch-card internals
- Hosted-site footer, `/w/[slug]` metadata, invite emails
- Specialized Celebration of Life, Anniversary, Corporate, or General Event content
- Rewriting duplicate event-type vocabularies (listed below)
- Multi-event-per-client
- Venue Booking Workspace terminology cleanup
- Unifying inquiry vs CRM event-type lists

### Duplicate / conflicting event-type systems (do not rewrite in this phase)

- **Canonical CRM picker:** `EVENT_TYPES` in `lib/leads/constants.ts` (also re-exported by `lib/clients/constants.ts`). Used by leads, clients, events, calendar, playbooks, floor-plan/timeline templates.
- **Public inquiry list (different keys):** `PUBLIC_INQUIRY_EVENT_TYPES` in `lib/inquiry-form/constants.ts` — `corporate_event`, `social_event`, `birthday_milestone`; no Celebration of Life.
- **Tour scheduler leftover labels-as-values:** `components/tours/tour-scheduler.tsx` uses display strings (`"Wedding"`, `"Corporate Event"`, …) as option values, not CRM keys.
- **Playbook planning titles:** `WEDDING_PLANNING_TITLE_EVENT_TYPES` in `lib/playbooks/constants.ts` is `{wedding, elopement, engagement_party}`. Anniversary is no longer in this set. `rehearsal_dinner` / `reception` remain Wedding-profile types but were never in this helper (unchanged).
- **Timeline starters:** `lib/timeline-templates/starters.ts` seeds `eventType: "wedding"` only.
- **Label helper aliases:** `eventTypeLabel()` in `lib/leads/constants.ts` maps inquiry keys to labels but is not a profile resolver.

---

## Recently completed work (already on `main`)

Most recent first:

- **`5807aee`** (2026-09-02) — Fix Resend delivery webhook Svix verification.
- **`d8f21b5`** — Business Snapshot tile equal heights.
- **`6773223`** — Calendar “Related to” searchable picker.
- **`efe1789`** — Communication trust surface (composer, send trust, inbound
  email → `conversation_messages`, Setup/Help).
- Email/Resend live E2E **PASS** on sandbox (outbound, delivery webhook,
  inbound reply into the same conversation).

## Known open issues

- **Twilio SMS E2E blocked** on Primary Compliance Profile review. Account is
  active, type Full, ~$20 balance. Console number purchase failed with a
  generic error because the profile is inactive until `twilio-approved`.
- `docs/platform-status-snapshot.md` is stale vs current `main`.
- Root `npm run lint` reports a large baseline; not triaged as part of this
  work.

## Important product decisions

- Texting is a required launch capability, not deferred.
- Twilio and Resend are platform-level, not venue Settings.
- STOP / START / HELP are Twilio Messaging Service compliance, not an
  application reimplementation.
- Hello to Cheers is event-type adaptive, not wedding-only. One Event
  Experience system. Client is the global customer entity. Couple is
  contextual wedding language. Booking is commercial/report language, not a
  competing customer workspace entity.

## Current test/typecheck/lint status

Phases 1–6 + Luv launch-readiness (2026-09-02): Claude independent
completion review **READY TO COMMIT**. `npm test` 1143 pass;
`npx tsc --noEmit` clean. Phase 7 live E2E is pending sandbox
deployment of this commit. Root `npm run lint` baseline is still
untriaged.

## Follow-up work (this phase only)

When the Primary Compliance Profile is `twilio-approved`:

1. Purchase one US SMS-capable number (retry `+18788679681` if still listed).
2. Create a Hello to Cheers Messaging Service, attach the number, configure
   inbound `https://app.sandbox.hellotocheers.com/api/messaging/sms-inbound`
   and status `https://app.sandbox.hellotocheers.com/api/messaging/sms-status`,
   keep Twilio STOP/START/HELP.
3. Put `TWILIO_MESSAGING_SERVICE_SID` into `htc/sandbox/twilio` and force a
   new venue-app ECS deployment.
4. Run the live SMS E2E table (outbound, inbound same conversation, opt-out,
   >160, emoji, unsigned webhook 401).
5. Stop. Do not start unrelated release-readiness work.
