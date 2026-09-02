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

1. **Provisioning gate:** Twilio Primary Customer Profile
   `BUc864a49a4cddc4ec348cff74d4d18095` (Hello to Cheers) is API status
   `in-review`. Twilio emailed Business Profile Submission Confirmation;
   they may contact within 24 hours for identity/usage verification. No
   further applicant action until approved or rejected.
2. **Do not** buy a US phone number or create a Messaging Service while the
   profile is under review. Resume number purchase only after
   `twilio-approved`. Target number still available last check:
   `+18788679681` (SMS/MMS/Voice, `address_requirements: none`).
3. **Account credentials** (stable unless Auth Token is rotated) belong in
   AWS secret `htc/sandbox/twilio` as `TWILIO_ACCOUNT_SID` +
   `TWILIO_AUTH_TOKEN`. Leave `TWILIO_MESSAGING_SERVICE_SID` empty until the
   Messaging Service exists. Do not put credentials in git, `.env`, or
   browser-visible config.
4. Email/Resend E2E is **PASS**. Do not revisit unless this SMS phase breaks
   it.
5. SMS application code is already implemented. Do not redesign it. No
   venue-facing Twilio wizard.

---

## Current product/release phase

Actively shipping features toward release; no formal release-candidate label
is currently in force in the repo.

## Current branch

`main`.

## Current active work

**Twilio / SMS sandbox provisioning** — platform-level. CloudFormation injects
`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_MESSAGING_SERVICE_SID`
into the venue-app task from `htc/${EnvironmentName}/twilio`. Deploy workflow
treats those keys as required communication secrets. Messaging Service SID
stays empty until the Primary Compliance Profile is approved and a number can
be purchased.

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

## Current test/typecheck/lint status

Not re-run this session. Last Communication-path check (2026-09-01):
`npx tsc --noEmit` clean; `npm test` 1006 passing.

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
