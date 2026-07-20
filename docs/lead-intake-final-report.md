# Lead Acquisition & Intake — Final Report

**Status: Complete.** Verified via clean `tsc --noEmit`, clean `npm run build`, and a full local migration replay from empty (`supabase db reset --local`) — including the three refactored RPCs and the new dev seed fixture. All confirmed with real queries, not just successful application.

Full research and decisions are in `docs/lead-intake-architecture-assessment.md` and `docs/lead-intake-implementation-plan.md`. This report covers what shipped, what changed from the original plan during implementation, and judgment calls made along the way.

---

## What shipped

**One canonical pipeline**, replacing three independently-written, already-drifted implementations:

```
Source Adapter → Normalize → Validate → Log Attempt → Abuse Check
  → Relationship Resolution → Lead Creation → Activity Logging
  → Automation Trigger → Assignment Hook → Notification
```

- **Data layer**: `lead_sources` (a real, registrable reference table — no more free-text drift), `lead_intake_attempts` (the audit trail — raw payload + normalized payload kept separately, forever, plus confidence score, relationship/lead links, and processing timestamps), a new `ingest_lead()` core RPC, and `find_or_create_relationship` fixed to be the one genuine relationship-matching implementation in the codebase (the no-email exact-name fallback that only existed inline in `create_lead_atomic` is now in the shared function itself).
- **Reactivation policy, implemented and verified**: every new inquiry always creates a new Lead; a matching email always links to the existing Relationship. Verified directly — the same email submitted after its first Lead was marked `won` produced a second, distinct Lead on the same Relationship, not a reopened one.
- **TypeScript orchestration** (`lib/lead-intake/`): `pipeline.ts` is the one place Normalize, Validate, logging, rate limiting, Turnstile, automation triggering, and the assignment hook happen — every entry point (public form, tour widget, manual entry, CSV import, the new email parser) calls into it rather than re-implementing any of that.
- **Assignment Hook**: a literal, explicit no-op stage (`lib/lead-intake/assignment.ts`) — out of scope per your direction, but the pipeline already calls it, so future routing logic is a one-file change.
- **Layered abuse protection**: honeypot (unchanged) + DB-based rate limiting (no new infrastructure — reuses the intake log) + Cloudflare Turnstile, wired as an escalation (required only once a caller is near the rate-limit threshold, not default friction). Turnstile is inert until you provision a site key — the forms work exactly as before without it.
- **The Email Intake Engine** — the one real external source, built generic per your direction: a venue forwards inquiry-notification emails from anywhere (The Knot, WeddingWire, their own inbox) to a per-venue address, and a Claude-based extractor (reusing the same direct-Anthropic-call pattern as Luv's existing CSV/PDF import assist) pulls out inquiry fields with a 0–100 confidence score. High/medium confidence leads flow through the full pipeline including automation; low-confidence leads still create immediately (same object, same visibility as every other source) but automation is held until a coordinator confirms the details — the one place confidence is allowed to change pipeline behavior.
- **Monitoring**: a small "Lead Intake Health" panel in Settings reading directly from `lead_intake_attempts` — submission volume, rejection breakdown, recent activity — closing the "is my form actually working" blind spot the research found.
- **Notification reliability**: the three previously-silent email sends (inquiry confirmation, inquiry coordinator-notification, tour coordinator-notification) now record their outcome onto the intake attempt log.

---

## What changed from the plan during implementation

1. **`triggerSequencesForRelationship` return type widened** (`Promise<void>` → `Promise<string[]>`, and its client parameter widened to accept the admin client too) — a small, backward-compatible extension needed so the pipeline could log which automation fired. Every existing caller ignores the new return value; no behavior change for them.
2. **CSV import's free-text `source` column** needed a bridge: real-world spreadsheet exports contain values like "The Knot" or "website-form" that don't match the new registered vocabulary. Added `resolveLeadSourceKey()` (`lib/leads/constants.ts`) — maps known variants, falls back to `other` while preserving the original text in `source_data.original_source_label` rather than silently discarding it.
3. **A "Returning relationship" indicator** was added to the Lead detail page (a count of other Leads sharing the same Relationship) — this is what makes the reactivation-policy decision visible to a coordinator instead of just correct in the database.

---

## Judgment calls

1. **Coordinator-notification vs. confirmation-email status share one `notification_status` field per attempt.** When both fire (public form path), the coordinator notification's outcome is what's recorded last and therefore wins — deliberate, since "did the venue find out" matters more than "did the inquirer's auto-reply land." Not a bug; a prioritization.
2. **The Email Intake Engine's low-confidence threshold (<50) holds Automation but not Lead creation or Activity logging.** Building a separate pending-review queue for low-confidence leads was explicitly avoided — it would make this source behave differently from every other one, which is exactly the fragmentation this initiative exists to remove.
3. **QR code capture and Facebook/Instagram Lead Ads are not built.** Per your explicit sequencing (email intake first, QR second, Facebook/Instagram third), these remain future thin adapters over the now-proven pipeline — no code for either exists yet, and none should be inferred from anything shipped here.
4. **Abuse hardening stopped at rate limiting + escalation-only Turnstile.** No IP-hashing, no persistent ban list, no CAPTCHA-by-default — matching your explicit "layered, not intrusive" instruction.

---

## The migration replay surfaced real, pre-existing schema drift — fixed, not worked around

Per your instruction to fix the migration history itself rather than patch around it: the full replay from empty caught two places where the *seed fixture* (not the Lead Intake migrations themselves — those replayed cleanly on the first attempt) assumed an older schema shape than what years of incremental migrations had actually left behind:

- `couple_guests.group_label` no longer exists — superseded by `is_wedding_party`/`dietary_tags`/`household_id` from later Guest Experience work. Fixed in the seed, not the schema (the schema itself is correct and current).
- `vendors` no longer carries `venue_id`, `is_preferred`, or `notes` — Vendor Marketplace work made `vendors` a shared, cross-venue directory, with the per-venue relationship (preference level, notes, status) living in `venue_vendor_relationships`. Fixed in the seed to use the current, correct model.

Both are evidence the *migration history itself* is sound (every migration replayed in order with no errors) — the drift was purely in my own seed assumptions, based on reading early-history migration files without cross-checking against the schema's actual current state. Confirmed directly against the live post-reset schema before finalizing, not guessed.

---

## New: a real development seed (`supabase/seed.sql`)

Per your request, this repository now has its first seed file. Runs automatically on `supabase db reset --local` (and a fresh `db start`), producing in under a minute:

- 1 venue ("Seed Venue") with an owner and a manager
- Login: `owner@example.com` / `manager@example.com`, password `devpassword123` (local dev only)
- 1 couple (Emma & Jordan) with a confirmed event 90 days out
- 1 signed contract
- 5 guests across RSVP states (attending/declined/maybe/pending)
- 1 preferred vendor
- 1 sent invoice
- A 5-entry day-of timeline

This is a fixed development fixture, not demo/showcase content — deliberately small and deterministic.

**One unavoidable consequence, flagged directly**: `db reset --local` wipes `auth.users`, so your previous local login (`jen@wevenu.com` / Daisy Venues) no longer exists — Supabase Auth passwords are hashed and can't be reconstructed, so there was no way to preserve it through the reset. Use the new seed's `owner@example.com` login, or sign up fresh through the app's own onboarding.

---

## Verification performed

- `tsc --noEmit` and `npm run build`: clean, including the new `/api/leads/email-intake` route appearing in the build's route list.
- Full local migration replay from empty: every migration (including the three-RPC refactor) applied in order with no errors.
- Direct functional tests against the live local database (not just migration success):
  - New inquiry → new Lead + new Relationship.
  - Same email, after the first Lead was marked `won`, submitted again → new Lead, same Relationship, `isReturningRelationship: true` — confirms the reactivation-policy fix.
  - Invalid `source` value → rejected by `ingest_lead`.
  - No-email exact-name relationship fallback → second "Ron Cormier"-style submission matched the same Relationship instead of forking a duplicate.
  - Post-reset, re-ran the new-inquiry test against the fresh seeded venue to confirm the whole pipeline works identically on a clean database, not just the one that had accumulated incremental migrations.
- **Not performed**: live browser testing of the public form/tour-widget/Turnstile UI, or an actual inbound email through Resend's real infrastructure (no browser tool or live email-sending environment available in this session). The email extraction logic itself was not tested against a real Anthropic API call (requires `ANTHROPIC_API_KEY`, not configured in this environment) — its correctness rests on code review and the same pattern already proven in Luv's CSV/PDF import assist, not a live extraction test.

## Explicitly not in this pass

- Lead assignment/routing (hook only, per your direction).
- QR code capture, Facebook/Instagram Lead Ads (sequenced next, as thin adapters).
- Any Knot/WeddingWire-specific code (the Email Intake Engine is generic by design).
- Retry/dead-letter queues for failed notifications (failures are now visible, not auto-retried).
