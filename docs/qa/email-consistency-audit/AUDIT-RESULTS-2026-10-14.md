# Email consistency audit — consolidated results

**Date:** 2026-10-14  
**Mode:** READ-ONLY inventory reconciliation (no sends, no code/config/DNS/Production changes)  
**Serving Sandbox SHA:** `c75479e6db337037cb7730116a904b5a2711f2dc`  
**Workstream status:** **OPEN** (audit complete; confirmed defects not yet fixed)  
**Prior inventory:** `INVENTORY.md` (2026-10-13) — preserved; dispositions below supersede Status column where noted.

---

## Method

1. Re-read `INVENTORY.md`, Gate 1–3 STATUS, inquiry/tour CTA/deliverability/open-tracking QA.
2. Inspect current source for every inventory purpose (#1–#33) against HEAD / serving ancestry.
3. Re-ran focused unit suites (no provider sends):
   - `signature-path-audit.test.ts` — PASS
   - `inquire-venue-notification-branding.test.ts` — PASS
   - `venue-notification-email.test.ts` + customer inquiry sign-off — PASS
   - `duplicate-detection` / `duplicate-review` / `portal-isolation` — PASS
   - `customer-facing-branding.closeout.test.ts` — **1 fail** (stale `$500.00` expectation; product shows `$500` per `formatMoneyDisplay` — see Case A in `invoice-email-money-format-assertions/`)
4. Reused delivered Resend HTML: `docs/qa/inquiry-notification-branding/captured-email.html` (`Event type: wedding`).
5. No new Sandbox sends authorized or performed.

Classification key: **PASS — VERIFIED** · **OPEN — DEFECT** · **OPEN — VERIFICATION** · **BLOCKED — EXTERNAL** · **DEFERRED — PRE-LAUNCH** · **INTENTIONAL** (not a defect)

---

## Full inventory dispositions

| # | Purpose | Disposition | Evidence / notes |
|---|---------|-------------|------------------|
| 1 | Website inquiry → **venue** | **PASS — VERIFIED** | Branded `buildVenueNotificationEmail`; runtime Resend HTML GREEN on `5b7d35d1` (ancestor of serving). Lead CTA `/leads/{id}`. Units PASS. |
| 2 | Website inquiry → **inquirer** thank-you | **OPEN — DEFECT** | `app/api/public/inquire/route.ts` sends **text only** (no HTML shell). Subject `We received your inquiry — {venue}`. Confirmed in inventory + Gate 1 STATUS limitation. **No new delivered proof this pass** (send blocked by audit rules); source defect is unambiguous. |
| 3 | Custom public form → venue | **OPEN — DEFECT** | `forms/submit` text-only; subject `New public form lead: …`; raw `View in Hello to Cheers: …/leads` (**list**, not `/leads/{leadId}` despite `outcome.leadId`); omits partner/budget/message (route hard-codes nulls). Same class as pre-fix inquire venue path + weaker CTA. |
| 4 | Custom public form → inquirer | **OPEN — DEFECT** | Same plain-text thank-you class as #2 (`We received your message — …`). |
| 5 | Tour booked → coordinator | **PASS — VERIFIED** (source + render) | `fe50bcab` brands via `buildVenueNotificationEmail` (HTML+text, Sage CTA “View this lead”). Units + CTA preview 1280/390. **Residual:** preference-gated `tour_scheduled` queue may still email separately → see Fix group C. Runtime delivered HTML not re-captured on current SHA → note under dual-send. |
| 6 | Tour protection failure | **OPEN — DEFECT** | `notifyPaidUnbookedTour` still text-only with raw `/tours` + `/leads/{id}` URLs. Ops-facing; lower customer impact than #2–#4. |
| 7 | Tour scheduled / confirm / confirmed (couple) | **PASS — VERIFIED** | `lib/tours/communication.ts` venue brand; separate date/time lines; Confirm / Calendar CTAs. Signature-path audit + closeout units. |
| 8 | Tour reminder (couple) | **PASS — VERIFIED** | Venue brand + logo tests (`tour-reminder-email.test.ts`). |
| 9 | Obligation / reminder emails | **PASS — VERIFIED** | Shared templates / HTC staff notify; source + unit coverage. |
| 10 | Inbox / conversation send | **PASS — VERIFIED** | `wrapConversationMessageHtml`; email channel only after external accept; internal_note is record-only (not emailed). |
| 11 | Scheduled messages | **PASS — VERIFIED** | Same wrap path as #10 (source). |
| 12 | Automations | **OPEN — VERIFICATION** | Uses conversation/scheduled email paths when sending email; no dedicated runtime matrix this pass. |
| 13 | Contract invite / send | **PASS — VERIFIED** | Venue brand; signature-path audit. |
| 14 | Invoice / payment plan / payment request | **PASS — VERIFIED** | Venue brand; money display omits `.00` intentionally. Closeout test assertion stale (test debt, not product defect). |
| 15 | Commercial proposal | **PASS — VERIFIED** | Venue brand (source + prior QA). |
| 16 | Brochure | **PASS — VERIFIED** | Venue brand (source). |
| 17 | Questionnaire invite | **PASS — VERIFIED** | Conversation wrap; transactional-email-quality CTA proof artifacts. |
| 18 | Event order representation | **PASS — VERIFIED** | Conversation wrap (source). |
| 19 | Client portal invite | **PASS — VERIFIED** | Venue brand (source). |
| 20 | Contact invite | **PASS — VERIFIED** | Venue brand (source). |
| 21 | SMS consent email | **PASS — VERIFIED** | Venue brand; signature-path audit. |
| 22 | Team / owner invite | **PASS — VERIFIED** | HTC invite shell (`buildTeamInviteHtml` / owner invite). |
| 23 | Vendor invite / assignment / removal | **PASS — VERIFIED** | HTC / assignment shells (source + CTA brand work). |
| 24 | Password recovery | **PASS — VERIFIED** | HTC logo; prior branded-email results. |
| 25 | Platform templates (welcome, receipt, trial, …) | **PASS — VERIFIED** | Registry + unit; some registry-only. |
| 26 | Enrollment activate | **OPEN — VERIFICATION** | Uses `buildOwnerInviteHtml/Text` (same as team owner invite). Not runtime-verified this pass. |
| 27 | Admin onboarding email | **INTENTIONAL** | Ad-hoc `html: body.replace(…)` — internal admin tool; inventory already marked intentionally different. |
| 28 | Portal participant notify | **OPEN — DEFECT** (shell) | Thin HTML + venueColor CTA; **no** `renderBrandedEmailHtml` / logo shell. Text+HTML present. Customer-facing invite quality gap. |
| 29 | Daily digest | **PASS — VERIFIED** (source) | `lib/email/daily-digest.ts` uses `htcEmailLogoHeaderHtml` + HTML/text. Runtime send not re-proven this pass. |
| 30 | Saved report schedule | **OPEN — DEFECT** (shell) | Minimal HTML (`<p>…<a>…`) — not HTC staff notification shell. Staff-facing; lower priority. |
| 31 | Communication readiness test email | **INTENTIONAL** | Plain ops self-test; must not create conversation_message / provider_id for open-tracking E2E. |
| 32 | Luv drafts / follow-ups | **PASS — VERIFIED** (when sent) | Drafts are not emails until Inbox send (#10). Internal notes stay staff-only. |
| 33 | DB `venue_notifications` email processor | **PASS — VERIFIED** | `processVenueNotificationEmails` → `buildVenueNotificationEmail` (units). |

---

## Cross-cutting checklist (user-required themes)

| Theme | Disposition | Detail |
|-------|-------------|--------|
| Inquiry thank-you HTML + plain text | **OPEN — DEFECT** | #2 / #4 text-only; no branded HTML alternative. |
| Custom-form venue content / recipient / fields | **OPEN — DEFECT** | #3: venue recipient OK; content incomplete; CTA wrong target. |
| Tour-booking Date / Time / Duration / Contact | **PASS — VERIFIED** with nuance | Couple: separate date + time + duration. Coordinator (#5): `Date:` is datetime string; Duration + Contact name present; no separate Time label / contact email. Acceptable unless product requires separate Time line. |
| Canonical “Wedding” terminology | **OPEN — DEFECT** | Delivered inquire HTML shows `Event type: wedding` (canonical **value**). Should use `eventTypeLabel` → **Wedding**. Also in unit fixture expectations. |
| Duplicate-match alerts / multi-candidate | **PASS — VERIFIED** (behavior) + **OPEN — VERIFICATION** (delivered email) | Strong-signal detection; **best match only** in `venue_notifications` + review row; **no merge**. Type `possible_duplicate_inquiry` → `needs_email` via else-true. Delivered duplicate email not captured this pass. Multi-candidate listing is intentionally best-only (not labeled defect). |
| Lead-specific CTAs / destinations | **Mixed** | Inquire venue: PASS (`/leads/{id}`). Forms venue: **DEFECT** (`/leads`). Tour booked: PASS (`/leads/{id}` or `/tours`). |
| Recipient / venue / conversation / link correctness | **PASS** on branded paths; **DEFECT** on #3 CTA | Inbox send uses conversation recipient + venue replyTo. |
| Duplicate / merge / overwrite protection | **PASS — VERIFIED** | Duplicate review never re-parents/merges (unit). Intake duplicate-batch rejection preserved. |
| Consistent branding / rendering | **Mixed** | Branded shells PASS where wired; #2–#4, #6, #28, #30 bypass. |
| Mobile + images-blocked | **OPEN — VERIFICATION** | Viewport meta on branded shells; CTA 390 previews exist. No systematic images-blocked matrix across all purposes. Logo alt text present on HTC/venue shells. |
| Internal notes / internal-only exposure | **PASS — VERIFIED** | `internal_note` not client-visible / not emailed; inquire capture has no notes; lead notes privacy copy verified in prior lead-email-recipient QA. |
| Delivered Sandbox email where evidence insufficient | **Partial** | #1 delivered proof reused. #2–#4, #6, #28, duplicate email, dual tour send: **not** re-sent (authorization required). |

---

## Confirmed defects (implementation candidates)

### D1 — Inquirer thank-you unbranded (#2, #4) — **launch-relevant**

| Field | Value |
|-------|--------|
| Scenario | Public inquire + public form submit → prospect confirmation |
| Expected | Venue- or HTC-appropriate HTML + matching plain text; consistent with customer-facing shells |
| Actual | `sendEmail({ text })` only |
| Root cause | Routes never call `renderBrandedEmailHtml` / shared thank-you builder |
| Impact | Prospect first impression unbranded; HTML clients show plain body |
| Smallest fix | Shared thank-you builder (venue brand preferred) used by both routes; keep subjects; HTML+text |
| Must not change | Lead creation, SMS consent rules, venue notify path, delivery status semantics |
| Tests / evidence | Unit render HTML+text; optional authorized Sandbox send + Resend read |

### D2 — Custom form → venue notify (#3) — **launch-relevant**

| Field | Value |
|-------|--------|
| Scenario | `POST /api/public/forms/submit` venue alert |
| Expected | Same HTC staff shell as inquire #1; CTA `/leads/{leadId}`; include submitted fields that exist |
| Actual | Text-only; link to `/leads`; partner/budget/message forced null |
| Root cause | Parallel plain `sendEmail` bypass; CTA not using `outcome.leadId` |
| Impact | Venue ops miss branded alert + land on list; field gaps if forms later collect them |
| Smallest fix | Mirror inquire: `buildVenueNotificationEmail` + `/leads/${outcome.leadId}`; include available fields; use `eventTypeLabel` |
| Must not change | Form RPC / ingest / Wave-1 no SMS consent |
| Tests | Unit like `inquire-venue-notification-branding.test.ts`; no live send required for closure if HTML fixture matches |

### D3 — Event type shows `wedding` not `Wedding` — **launch-relevant (terminology)**

| Field | Value |
|-------|--------|
| Scenario | Venue inquiry (and form) notification body `Event type:` |
| Expected | Canonical display label (`Wedding`) |
| Actual | Raw stored value `wedding` (proven in `captured-email.html`) |
| Root cause | `String(eventType)` / missing `eventTypeLabel()` |
| Impact | Unpolished staff email; contradicts canonical vocabulary |
| Smallest fix | `eventTypeLabel(eventType)` in inquire + forms venue bodies (and any parallel copy) |
| Must not change | Stored canonical values on leads |
| Tests | Update inquire branding unit expectation to `Event type: Wedding`; render fixture |

### D4 — Tour protection coordinator alert (#6) — **non-blocking ops**

| Field | Value |
|-------|--------|
| Scenario | Paid/unbooked tour protection failure |
| Expected | HTC staff notification shell + CTA buttons |
| Actual | Plain text + raw URLs |
| Smallest fix | `buildVenueNotificationEmail` with View tours / View this lead CTAs |
| Tests | Unit render; rare path — runtime optional |

### D5 — Portal participant invite shell (#28) — **non-blocking / polish**

| Field | Value |
|-------|--------|
| Expected | Venue-branded shell (logo + wrapper) consistent with portal invites |
| Actual | Minimal HTML with colored CTA only |
| Smallest fix | `emailBrandFromVenue` + `renderBrandedEmailHtml` |
| Must not change | Token accept URL / terms copy |

### D6 — Saved report schedule shell (#30) — **non-blocking staff**

| Field | Value |
|-------|--------|
| Expected | Consistent HTC staff HTML shell (optional) |
| Actual | Bare `<p>` HTML |
| Smallest fix | Wrap with `buildVenueNotificationEmail` or HTC logo header helper |

### Residual risk (not a template defect) — dual tour emails

Side-effect `#5` + preference-gated `tour_scheduled` may produce **two** coordinator emails for one booking (`tour-booking-email-branding/AUDIT.md`). Product decision required (suppress one path). Track as **OPEN — VERIFICATION / product** under Fix group C.

---

## Launch blockers vs non-blocking

**Treat as launch-relevant (fix before launch):** D1, D2, D3  

**Non-blocking / polish / ops:** D4, D5, D6, dual-tour product decision, automations/enrollment runtime gaps, mobile images-blocked matrix  

**External / deferred:** Open/click tracking E2E — **BLOCKED — EXTERNAL** (DNS / Resend tracking CNAME); **DEFERRED — PRE-LAUNCH** per open-tracking STATUS. Gate 4 unchanged.

---

## Proposed fix grouping (smallest sensible batches)

| Group | Items | Scope |
|-------|-------|--------|
| **A — Public intake emails** | D1, D2, D3 | Inquire + forms thank-you + forms venue shell/CTA/labels. One PR. |
| **B — Ops alert leftovers** | D4 (+ optional D6) | Tour protection (+ saved report if bundled). |
| **C — Portal polish + tour dual-send** | D5 + dual-send product choice | Separate; needs product call on dual tour mail. |
| **D — Test debt** | Closeout `$500.00` assertion | Align with `formatMoneyDisplay` (no product change). |
| **E — Pre-launch** | Open/click E2E | External DNS/Resend; out of template consistency. |

---

## Regression tests & acceptance (per group)

**Group A**

- Unit: thank-you HTML contains venue brand markers + matching text; forms venue HTML uses `buildVenueNotificationEmail`, CTA `…/leads/{uuid}`, `Event type: Wedding`.
- Source guard: forms/submit imports notification builder (like inquire test).
- Acceptance: no change to lead IDs, no SMS consent on forms, inquire venue path unchanged except label helper.
- Optional: one authorized Sandbox form+inquire pair to Resend read-back (explicit auth required).

**Group B**

- Unit: protection alert HTML has logo + CTA; raw URL not sole body.
- Acceptance: appointment still not created; lead link preserved.

**Group C**

- Unit: participant invite uses `renderBrandedEmailHtml`.
- Dual-send: product-approved single path; regression that one booking → one coordinator email.

**Group D**

- Closeout test expects `Pay $500` or `Pay \$500(?:\.00)?`.

---

## Tests not safely performed

| Test | Why skipped |
|------|-------------|
| New live inquire / form / tour sends | Audit forbids unauthorized real sends |
| Gmail UI / images-blocked visual matrix | Needs delivered messages + manual client matrix |
| Open/click E2E | DNS/tracking blocked; deferred |
| Production | Forbidden |
| Destructive duplicate-merge scenarios | Review path is non-merge by design; no destructive tests |

---

## Intentionally different (not defects)

- Venue-branded client mail vs HTC staff notifications vs platform auth.
- Readiness test email plain text (#31).
- Venue-authored Inbox bodies inside branded wrapper (#10).
- Admin onboarding ad-hoc HTML (#27).
- Duplicate review notifies **best** match only (in-app + optional email).

---

## Confirmation

- **No** application code, templates, configuration, database records, Resend/DNS, or Production state changed in this audit stage.
- Prior evidence under `docs/qa/email-consistency-audit/` and linked QA folders preserved.
- Workstream remains **OPEN** until Groups A–C (as authorized) are fixed and verified.
