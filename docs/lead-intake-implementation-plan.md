# Lead Acquisition & Intake — Implementation Plan

Governing decisions from the approved assessment (`docs/lead-intake-architecture-assessment.md`), as refined in a second review pass (incorporated below — see inline notes where a decision changed from the first draft):
1. Build the unified architecture **and** prove it with one real external source: **Email-to-Lead Parsing**, built as a generic Email Intake Engine (not Knot-specific) — QR and Facebook/Instagram Lead Ads follow later as thin adapters over the same pipeline, not part of this pass.
2. **Reactivation policy**: every new inquiry always creates a **new** Lead. If the contact already has a Relationship, it links to that Relationship (so history is visible) — but Opportunities never silently reopen. *Relationships persist. Opportunities do not.*
3. **Assignment**: out of scope, but the pipeline gets an explicit, literal Assignment Hook stage so future routing plugs in without touching any source adapter.
4. **Abuse hardening**: in scope now, layered (rate limiting + honeypot + escalation-triggered Turnstile), not CAPTCHA-first.
5. **Source vocabulary**: becomes a real, enforced, extensible list (a reference table, not a CHECK-constraint enum), with a richer field set than originally proposed (§1.9).
6. **Raw payload preserved forever**, separately from the normalized payload — never just the normalized/parsed result (§1.5).
7. **Confidence scoring**, not a binary `needs_review` flag — a 0–100 score with tiered behavior (§2).
8. **The intake log is an observability/audit table, not just an abuse-prevention table** — designed to answer "what came in, from where, was it accepted, why not, which lead/relationship, how long did it take, what fired" (§1.5).

Standing principle for every decision below, per your explicit instruction: **one canonical path, one source of truth, thin adapters, no source-specific business logic in the core pipeline** — the same philosophy already used for Commitment Lifecycle. Where a slightly more generic abstraction avoids future duplication without adding real complexity today, this plan takes it; where it wouldn't (speculative generality with no near-term source to justify it), it doesn't.

---

## 1. The canonical pipeline

```
Source Adapter → Normalize → Validate → Log Attempt → Abuse Check → Relationship Resolution
   → Lead Creation → Activity Logging → Automation Trigger → Assignment Hook (no-op today)
   → Notification
```

Every current and future source (website form, tour request, manual entry, CSV, email parser, QR, Facebook, any future API) implements **only** the Source Adapter stage — translating its own payload shape into the one canonical `NormalizedLeadInput`. Nothing from Normalize onward is ever duplicated per source. This is the one architectural rule every other decision below serves.

- **Source Adapter** — per-source, thin, no business logic: maps raw payload (form fields, RPC args, CSV row, parsed email, future webhook body) into `RawIntakeInput` (the canonical *pre-validation* shape).
- **Normalize** — shared, one implementation: trims/cases strings, formats phone to E.164, parses dates to a consistent format, resolves `source` against the registry (§1.9).
- **Validate** — shared, one implementation, separate from Normalize on purpose: confirms required fields are present, `source` is a registered value, email/phone are well-formed. Returns a typed ok/error result rather than throwing, so a Source Adapter can decide what "invalid" means for its own trust tier (e.g. an email-parsed candidate with a missing phone is still valid — phone is optional for that source; a direct form submission with no email might not be).

### 1.1 Database layer — one core RPC replacing three divergent ones

New function `ingest_lead(p_venue_id uuid, p_source text, p_input jsonb, p_trust_tier text)` — `SECURITY DEFINER` (works for `anon`, `service_role`, and `authenticated` callers alike), owns:
- Relationship resolution (the fixed, single `find_or_create_relationship` — see 1.3)
- Lead insert (always a new row — see 1.4)
- `lead_activities` insert (worded per source)
- Returns `{ok, lead_id, relationship_id, is_returning_relationship}`

`create_public_lead`, `book_tour`, and `create_lead_atomic` become **thin wrappers**: each keeps its own concern (embed_key validation; tour-slot booking + overlap checks; CSV-row batch handling) and then calls `ingest_lead()` for the actual lead-creation step, instead of each reimplementing it. This is a real refactor of three live, working RPCs — done via corrective migrations (never editing an already-applied migration), verified by replaying the full local migration history from empty before considered done, per this repo's existing migration-integrity discipline.

### 1.2 TypeScript orchestration layer

New module `lib/lead-intake/`:
- `types.ts` — `RawIntakeInput`, `NormalizedLeadInput`, `IntakeResult`, `TrustTier = "direct" | "webhook" | "email_parsed" | "import" | "manual"`.
- `adapters/*.ts` — one file per source (`website-form.ts`, `tour-request.ts`, `manual-entry.ts`, `csv-import.ts`, `email-parsed.ts`), each a pure function `RawPayload → RawIntakeInput`. This is the **only** place a new source ever needs code.
- `normalize.ts`, `validate.ts` — the two shared stages above.
- `pipeline.ts` — `ingestLead(rawInput, opts)`: runs Normalize → Validate → logs the attempt (1.5) → runs the abuse check for public trust tiers (1.6) → calls the `ingest_lead` RPC → fires Series/Sequence enrollment (existing `triggerSequencesForRelationship`, unchanged, now called from one place instead of duplicated per-RPC caller) → calls the (stub) assignment hook → sends the coordinator notification with durable failure-visibility (1.7).
- `assignment.ts` — `resolveLeadOwner(leadId, venueId): Promise<string | null>` — returns `null` today. The one, explicit, literal extension point for future routing; no other file should ever need to change when routing logic is eventually built.
- Every current entry point (`app/api/public/inquire/route.ts`, `lib/tours/service.ts`'s `bookTour`, `lib/leads/service.ts`'s `createLead`, the CSV import action) is updated to call its adapter + `ingestLead()` instead of hand-rolling its own post-creation side effects.

### 1.3 Fixing the relationship-resolution drift

`find_or_create_relationship` gains the no-email exact-name fallback that today only exists, inline and duplicated, inside `create_lead_atomic`. `create_lead_atomic`'s inline copy is deleted; it calls the shared function like every other path. This closes the "three independently-written matchers" gap identified in the assessment (§3.1) — after this, there is exactly one relationship-matching implementation in the codebase, used by all trust tiers.

### 1.4 Applying the reactivation policy

`find_lead_by_email`'s use as a "reuse this existing lead" mechanism is removed from `create_public_lead` and `book_tour`. Both now: resolve the Relationship (always), then always insert a **new** `leads` row linked to it — matching the decision that Opportunities never silently reopen. The coordinator-facing Lead/Client detail view gains a "Returning relationship" indicator (surfacing prior Leads/Events/notes on the same Relationship) so the *visibility* the old reuse-behavior accidentally provided isn't lost — it's just now explicit UI, not implicit data reuse.

**CSV import keeps its own, distinct batch-level active-duplicate skip** (`findActiveDuplicate`, scoped to non-closed leads) — this is a different problem (avoiding double-importing the same spreadsheet row/overlapping historical exports within one import batch), not the live-intake reactivation question, and is preserved as-is with a clarifying comment distinguishing the two concerns.

### 1.5 `lead_intake_attempts` — the audit trail, not just an abuse gate

Designed to answer, on its own, without joining anything else: *what came in, from where, when, was it accepted, if not why not, which lead was created, which relationship matched, how long did it take, what fired afterward.*

```
id, venue_id (nullable — may not resolve for a bad embed_key/unrecognized sender)
source, trust_tier
raw_payload jsonb        -- exactly as received, untouched, forever
normalized_payload jsonb -- post Source Adapter + Normalize, pre-Validate
confidence_score smallint null   -- 0-100, only set by assisted sources (email-parsed today)
status  received|accepted|rejected_duplicate_batch|rejected_rate_limited|rejected_invalid|error
error_message text null
relationship_id uuid null
lead_id uuid null
sequence_enrollment_id uuid null   -- what automation fired, if anything
notification_status text null     -- did the coordinator-notification email actually send
ip_address text null
started_at timestamptz
completed_at timestamptz          -- (completed_at - started_at) is the processing-duration signal
created_at timestamptz default now()
```

Written **first** (a `received` row), then updated in place as the pipeline progresses — this is what makes rate-limiting possible (1.6), what future webhook sources use for idempotent retries, what closes the "intake health is completely invisible" gap (1.8), and what answers "why was this parsed wrong" or "did the source actually send a phone number" months later by pointing straight at `raw_payload` — no guessing from the normalized result backward.

### 1.6 Abuse protection — layered, not CAPTCHA-first

- **Honeypot** — unchanged, stays at the route layer.
- **Rate limiting** — new, cheap, no new infrastructure dependency: a sliding-window count query against `lead_intake_attempts` (e.g. per IP+venue and per venue-wide) run inside `ingestLead()` for `direct`/`email_parsed` trust tiers before the RPC call; over-threshold attempts are logged as `rejected_rate_limited` and return a generic failure to the caller.
- **Turnstile (Cloudflare)** — added to the public inquiry form and tour-booking widget as a widget, verified server-side when a token is present, but only **required** once an IP/venue crosses a soft threshold (escalation, not default friction). Requires a new Cloudflare Turnstile site key/secret — flagged as a dependency you'll need to provision (a free Cloudflare account is sufficient).

### 1.7 Notification reliability (closing a real, currently-silent gap)

The inquiry-confirmation, coordinator-notification, and tour-coordinator-notification emails currently discard `sendEmail()`'s result entirely — a failure is invisible. Minimal, scoped fix (not a retry/dead-letter system): each send's outcome is recorded onto its `lead_intake_attempts.notification_status`. A coordinator can now see, per lead, whether the notification actually went out.

### 1.8 Monitoring — a small, additive intake-health panel

A lightweight panel (Settings → Website & Forms, alongside the existing embed_key/form-link display) reading `lead_intake_attempts`: submissions this week, rejection breakdown, average processing time, and whether the last N attempts succeeded — enough to answer "is my form actually working" without building a new analytics subsystem.

### 1.9 Source vocabulary — `lead_sources` reference table

```
key text primary key            -- 'website', 'the_knot', 'email_parsed_generic', ...
display_name text
category text                   -- 'direct' | 'marketplace' | 'social' | 'referral' | 'import' | 'other'
connection_type text            -- 'form' | 'manual_label' | 'email_forward' | 'webhook' | 'api'
is_external boolean default false  -- third-party marketplace/platform vs internal
is_enabled boolean default true
created_at timestamptz default now()
```

Seeded with the current dropdown vocabulary (`website, referral, the_knot, wedding_wire, instagram, facebook, google, email, phone, walk_in, other`) plus this phase's new value (`email_parsed_generic`). `leads.source` gets a foreign key against this table. A future integration adds one row here — a migration, not a code or enum change — and every field beyond `key`/`display_name` is there for future use (routing rules, health-panel grouping, enable/disable a source without deleting history) even though only some are read today.

---

## 2. The Email-to-Lead Parsing Engine (the one real source for this phase)

Built as a **generic inquiry-email parser** — it extracts names, email, phone, event date, guest count, and message from whatever arrives, using no platform-specific detection logic whatsoever. It does not know what The Knot's notification email looks like, and never will by design: if a new marketplace's "Congratulations! A new inquiry..." format shows up tomorrow, it should already work, because the extraction target is "an inquiry," not "a Knot email." Any future email-only source is a zero-code addition — a venue just forwards to the same address.

- **Address convention**: reuses the existing Resend-inbound + subaddressing infrastructure already proven for reply-threading (`RESEND_INBOUND_ADDRESS`) — each venue gets `leads+{venueKey}@{inbound-domain}`, shown in Settings next to the existing embed_key/form-link. Trust model matches the existing embed_key philosophy already established in this codebase: the subaddress is the "not a secret, but not guessable" identifier — venues are instructed to only forward from trusted sources, and volume/abuse is bounded by the same rate-limiting substrate (1.6).
- **New route**, `app/api/leads/email-intake/route.ts` — deliberately **separate** from the existing reply-matching webhook (`app/api/messaging/inbound/route.ts`), keeping "this is a reply to something" and "this originates a new Lead" as distinct concerns rather than overloading one handler. Resolves venue from the subaddress, logs the attempt (raw email stored verbatim in `raw_payload`), and hands the raw email (subject + body) to extraction.
- **Extraction**: reuses the existing Luv-assisted structuring pipeline already built for CSV/PDF/DOCX import (`proposeStructuredRows`) rather than building a second LLM-extraction implementation — same prompt/schema pattern, generic "extract inquiry fields" instructions, targeting `NormalizedLeadInput` instead of an import row, returning a `confidence_score` alongside it.
- **Confidence tiers** (replacing the earlier binary `needs_review` idea): `leads.intake_confidence smallint null` (copied from the attempt row, null for non-assisted sources).
  - **High (≥80)** — creates and proceeds through the full pipeline, including Automation, exactly like any other source.
  - **Medium (50–79)** — creates and proceeds through the full pipeline, but the Lead detail view shows a "please verify these details" banner.
  - **Low (<50)** — still creates immediately (the Lead is real, visible, and logged like every other source — no separate pending queue, which would make this source behave differently from the rest, exactly the fragmentation this initiative removes) **but Automation/Sequence enrollment is deliberately held** until a coordinator confirms the extracted details — the one place confidence is allowed to change pipeline behavior, and only because auto-messaging a couple from badly-parsed data is a real, distinct risk that "please verify" banners alone don't cover.
- **Venue setup UX**: a short Settings panel explaining "forward inquiry emails from any source to this address" with a copyable address, next to the existing form-link display.

---

## 3. Work streams

| Stream | Contents |
|---|---|
| A — Data layer | `lead_sources` table + backfill + constraint; `lead_intake_attempts` table (full observability schema); `leads.intake_confidence` column; new `ingest_lead()` core RPC; refactor `create_public_lead`/`book_tour`/`create_lead_atomic` into thin wrappers; fix `find_or_create_relationship`; remove reuse-behavior from public paths |
| B — TS orchestration | `lib/lead-intake/{types,normalize,validate,pipeline,assignment}.ts` + `adapters/*`; update all existing entry points to call it |
| C — Abuse layer | Rate-limit check in the pipeline; Turnstile widget + server verification + escalation threshold |
| D — Email Intake Engine | New inbound route, subaddress venue resolution, generic Luv-assisted extraction + confidence scoring, confidence-tiered UI treatment, Settings setup panel |
| E — Monitoring | Intake-health panel in Settings |
| F — Notification reliability | Record success/failure of intake-triggered emails onto `lead_intake_attempts.notification_status` |

## 4. Verification plan

- `tsc --noEmit` + `npm run build` clean.
- Full local migration replay from empty — this phase includes a real refactor of three live RPCs, so this is not optional.
- Manual scenarios: new email → new lead + new relationship; repeat email on an *active* lead → new lead, same relationship, "returning relationship" indicator shown; repeat email on a *won/lost/cancelled* lead → new lead (not reopened), same relationship (confirms the bug fix); invalid `source` value rejected; rapid-fire submissions from one IP trigger rate-limiting; a test email to a venue's intake address produces a lead with correctly extracted fields and a confidence score, with low-confidence cases correctly holding automation.

## 5. Explicitly not in this pass

- Lead assignment/routing logic itself (hook only).
- QR code capture, Facebook/Instagram Lead Ads — sequenced next, as thin adapters over this same pipeline, once it's proven.
- Any Knot/WeddingWire-*specific* code — the Email Intake Engine is generic by design; no special-casing either platform.
- Retry/dead-letter queues for failed notification emails — failures become visible, not automatically retried.
- Full CAPTCHA-first UX — Turnstile is escalation-only.
