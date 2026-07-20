# Lead Acquisition & Intake — Architecture Assessment

**Scope of this document:** research findings + architectural assessment for a unified Lead Intake architecture, per the release-dependency reassessment: *"A venue cannot adopt the platform if new opportunities cannot enter the CRM from their existing lead sources."* No implementation yet — this is Research + Assessment; an Implementation Plan follows once the open questions below are resolved.

---

## 1. What exists today

Every current lead-creation path funnels through exactly one of three RPCs — confirmed by an exhaustive grep (`grep -rn '.from("leads").insert'` returns zero hits outside these three functions):

| Path | Entry point | RPC | Auth mode |
|---|---|---|---|
| Public inquiry form | `app/form/[key]` (embed_key) | `create_public_lead` | SECURITY DEFINER, granted to `anon` |
| Public tour-booking widget | `app/book/[key]` (tour_embed_key) | `book_tour` | SECURITY DEFINER, granted to `anon` |
| Manual entry + CSV/file import | `/leads/new`, `/settings/import` | `create_lead_atomic` | SECURITY INVOKER, granted to `authenticated` only |

All three ultimately write into `leads` (venue-scoped) and resolve a `venue_customer_relationships` row (the durable cross-lifecycle identity a Lead/Client hangs off of). `leads.source` (free text) and `leads.source_data` (jsonb: utm_source/medium/campaign, referrer, landing_page, ip_address, user_agent) already exist as the attribution substrate — a real foundation, not a gap.

**External sources — the actual crux of this reassessment.** The Knot, WeddingWire, Facebook Lead Ads, Instagram Lead Ads, QR code capture, and email-to-lead parsing are **100% unbuilt**. The product's own Settings page (`components/settings/website-forms-section.tsx`) lists all six under a static "Future integrations" heading. `leads.source` includes `the_knot`/`wedding_wire`/`instagram`/`facebook` as dropdown values only — selecting one on manual entry just labels the lead; nothing automated writes those values. This isn't a hidden gap — it's already self-documented in `docs/product-completion-roadmap.md` as a Red-rated capability. The reassessment is correct: **today, a venue's existing lead sources cannot reach the CRM without a human retyping every inquiry by hand or exporting to CSV.**

---

## 2. Domain reality check on the six requested sources (a fact, not a preference — stated here rather than asked as a question)

These six sources are not architecturally equivalent, and treating them as one undifferentiated "integrations" bucket would be a mistake:

- **The Knot / WeddingWire**: neither offers a public, self-serve webhook/API for third-party CRMs to receive leads in real time. Their lead-notification mechanism to a venue is, today, an **email**. A real integration for these two is therefore an *email-to-lead parsing* problem, not a webhook-API problem — there is no OAuth flow or partner API to build against without a formal (and likely slow, business-development-gated) partnership. Any implementation plan that treats "Knot integration" as a discrete engineering task independent of email-parsing is solving the wrong problem.
- **Facebook Lead Ads / Instagram Lead Ads**: the opposite case — Meta has a real, documented, self-serve **Lead Ads webhook + Graph API** (subscribe to a Page, receive a `leadgen_id` via webhook, fetch full field data via Graph API using a long-lived Page token). This is a genuine, buildable webhook-push integration with real OAuth and signature verification — architecturally a different shape from Knot/WeddingWire.
- **QR code capture**: not an external integration at all — it's an internal feature (generate a venue-specific QR image encoding the inquiry/tour-booking URL with a source-attribution parameter). The only reason it doesn't exist yet is that no public entry point today reads a source-override query param — everything hardcodes `source='website'`/`'tour_scheduling'`. This is the cheapest of the six by a wide margin.
- **Email-to-lead parsing**: today inbound email (`app/api/messaging/inbound/route.ts`) is 100% reply-matching against *existing* leads/clients by exact sender-email match; an unrecognized sender is discarded with a `console.warn` and a 200 OK. Building this means a second inbound-email capability that *originates* Leads rather than matching replies to them — and it's the capability that unlocks Knot/WeddingWire (and, generically, any future source that only ever sends an email notification, including sources not on this list).

**Implication:** "one Lead Intake architecture" has to support at minimum three distinct ingestion *shapes* — (1) direct public form submission (trusted, synchronous, already built), (2) webhook-push from an authenticated external system (Meta today, generically extensible), and (3) email-parsed / lower-confidence extraction (Knot, WeddingWire, and anything else that only emails). A design that only handles shape (1) well does not actually solve the stated problem.

---

## 3. Architectural conflicts, duplication, and hidden assumptions found

### 3.1 Three RPCs, three different relationship/dedup implementations — already drifted

`find_or_create_relationship` exists specifically so that "every code path that creates a Lead must resolve a Relationship through this single function — never a second, independently-written match" (its own header comment). **This invariant is already broken**: `create_lead_atomic` (manual entry + CSV import) does not call it — it reimplements relationship matching inline, and that inline copy has a name-fallback fix (for blank-email rows) that the shared function itself still lacks. The three intake paths do not share one dedup/identity-resolution implementation today; they have three, two of which have already diverged. Any new source (email-parsed, webhook-pushed) would be a fourth if built the same way each prior source was built — ad hoc, inside its own RPC.

### 3.2 Duplicate-*Lead* policy is inconsistent, and the public paths have a known, documented, unfixed bug

- **Public form + tour widget**: `find_lead_by_email` matches on email with **no status filter** — a brand-new inquiry from an email address that already has a `won`, `lost`, or `cancelled` lead silently reopens/reuses that old lead row rather than creating a fresh opportunity. `docs/lead-identity-architectural-exploration.md` names this directly: *"a 'won' Lead getting silently reactivated by an unrelated later ask ... deciding when a Relationship's repeat contact should open a fresh Opportunity versus reuse the existing Lead is a real product decision ... that deserves its own deliberate pass."*
- **CSV import**: correctly scopes its duplicate check to *active* leads only (`not in ('won','lost','cancelled')`) — a genuine repeat inquiry years later opens a new Lead, which is very likely the right behavior. But this correct policy exists only in the import path.
- **Manual entry**: no duplicate-*Lead* check at all (only Relationship-level dedup). A coordinator manually re-entering a contact who already has an active lead gets no warning and silently creates a second, disconnected Lead row against the same Relationship.

This is exactly the kind of policy question that will matter enormously once external sources start pushing volume: a Facebook Lead Ad re-targeting a couple who already inquired six months ago, or a Knot notification for someone who already toured and was marked `lost`, are not edge cases — they're the normal case for paid-ad remarketing and long sales cycles in this industry.

### 3.3 `leads.source` has no enforced vocabulary, and has already drifted once in production

There is no DB CHECK constraint on `source` — it's free text, with the vocabulary enforced only by a UI dropdown (`lib/leads/constants.ts`). This already caused a real bug: the public form hardcoded `'website_form'` while the dropdown offered `'website'`, silently splitting analytics until a data-backfill migration fixed it (`20261101010000_engineering_cleanup_lead_source_website_mismatch.sql`). Every future automated source (a Meta webhook, an email parser) is another opportunity for exactly this class of drift if source values are chosen ad hoc per integration rather than validated against one canonical list at write time.

### 3.4 No durable, queryable log of intake *attempts* — only successes

There is no table recording "an inquiry-form submission happened" independent of whether it resulted in a committed `leads` row. Today, a failed `create_public_lead` call (bad embed key, DB hiccup) leaves literally no trace anywhere. This matters specifically because:
- **Monitoring is currently blind to intake health.** The one general-purpose dashboard (`lib/communication/health.ts`, "Communication Health") only reads `messages`/`conversation_messages` — and 3 of the 4 lead-intake-adjacent emails (inquiry confirmation, inquiry coordinator-notification, tour coordinator-notification) never write to either table, so their failures are invisible there too. No HQ surface tracks form-submission volume or RPC error rate at all.
- **Future webhook-based sources need this table architecturally, not just for observability** — a Meta Lead Ads webhook can legitimately retry a delivery (Meta's webhooks are at-least-once), and an intake log with an idempotency key is the mechanism that makes a retry a no-op instead of a duplicate lead.

### 3.5 No "system/API-initiated" trust tier exists

Today there are exactly two trust tiers: `anon` + embed-key-validated (public form/tour widget) and `authenticated` + venue-scoped (manual/CSV). A webhook-pushed lead from Meta is neither — it's a *third* trust tier: no browser, no venue-session, authenticated instead by a provider signature/secret, on behalf of a specific venue identified some other way (e.g., which Facebook Page is connected to which venue). No code path or RPC shape for this exists yet. An email-parsed lead is arguably a *fourth* tier again: authenticated only by "this arrived at a venue-specific inbound address," carrying LLM-extracted (imperfect-confidence) data rather than a human-typed or provider-guaranteed-structured payload — architecturally closer to the CSV import's "assisted, needs review" rows than to a trusted direct RPC insert.

### 3.6 No lead assignment mechanism exists at all (flagged per the review's explicit ask, not proposed as in-scope)

No `assigned_to`/`owner_id` column on `leads`; the one lookalike column (`tour_appointments.assigned_to`) is write-never, dead in practice. Every lead is venue-wide/unowned; there's no round-robin, load-based, or territory logic, and no "claim" concept. This doesn't block a source from *reaching* the CRM, but it is a real operational question the moment intake volume increases from automated sources: a venue running Facebook Lead Ads could suddenly receive far more leads per week than one from a single "someone fills out my contact form" trickle, with nobody accountable for first response. Surfacing this because the review explicitly asked for it evaluated — not proposing to build it as part of this initiative unless directed to.

### 3.7 Public-endpoint abuse protection is a single honeypot field

`create_public_lead` and `book_tour` are SECURITY DEFINER, `anon`-granted, with no rate limiting, no CAPTCHA, and no per-venue submission cap — the entire spam defense is one honeypot form field. The embed_key/tour_embed_key tokens themselves are properly unguessable (128-bit random), so this isn't a "the form is publicly enumerable" problem — it's a "an actual bad actor who has the key (e.g., scraped off a venue's public website) can submit unlimited junk leads" problem. This becomes more relevant, not less, as intake sources multiply: a bug or abuse in a *new* public-facing surface added for this initiative inherits the same thin protection.

---

## 4. What "one Lead Intake architecture" should mean

Based on the above, a genuinely unified architecture needs a single conceptual pipeline with three ingestion *shapes* feeding it, not three-plus independent RPCs:

```
                    ┌─────────────────────────────────────────┐
  Direct/trusted    │                                         │
  (form, tour       │                                         │
   widget, manual,  │        ONE canonical intake function    │
   CSV) ────────────┤──────▶ (relationship resolution +       │──▶ leads row
                     │        dedup policy + activity log +    │    (+ Relationship,
  Webhook-push       │        source-vocabulary validation +   │     lead_activities,
  (Meta Lead Ads,    │────▶   intake-attempt log, single       │     Series enrollment,
   future providers) │        implementation, not N copies)    │     notification)
                     │                                         │
  Email-parsed /     │                                         │
  lower-confidence   │────▶  (same pipeline, tagged            │
  (Knot, WeddingWire,│        needs_review / confidence,       │
   forwarded mail)   │        same downstream effects once     │
                     │        confirmed)                       │
                     └─────────────────────────────────────────┘
```

Concretely, this implies (subject to the open questions below):
- One canonical "ingest a lead" entry point that every source calls, with the relationship/dedup policy defined and enforced in exactly one place (fixing 3.1/3.2/3.3).
- A durable intake-attempt log (fixing 3.4), which also gives webhook sources the idempotency mechanism they need for provider-side retries, and gives HQ/venue-facing monitoring something to read.
- An explicit trust-tier model with a real fourth (system/API) mode for webhook sources, and a fifth (assisted/needs-review) mode for email-parsed sources, rather than only the two that exist today.
- A single source-attribution convention (query-param or webhook-payload → `source` + `source_data`) usable by every public entry point, which is what actually makes QR-code capture buildable (it becomes "generate a URL with the right params," not a new backend feature).
- Reuse of the existing "Luv-assisted structuring" pattern (already built for CSV/PDF/DOCX import) as the extraction mechanism for email-parsed sources, rather than inventing a second LLM-extraction pipeline.

---

## 5. Open questions — need your input before an implementation plan can be written

These are genuine product/scope decisions, not things I should decide unilaterally.

1. **Phase scope**: build the unifying architecture + fix the internal drift/gaps (3.1–3.5) with zero new external sources wired yet, build the architecture *and* ship the highest-leverage real source end-to-end as proof it works, or build the architecture and all requested sources now?
2. **Duplicate/reactivation policy**: when a new inquiry's email matches an existing `won`/`lost`/`cancelled` lead, should it reopen that lead, always create a fresh Lead against the same Relationship, or fall somewhere in between (e.g. reopen only within some time window)? This policy needs to be decided once and enforced everywhere, including for new automated sources.
3. **Lead assignment**: in scope for this initiative, or explicitly deferred to a later phase?
4. **Source priority**: given the domain reality in §2, which of the three buildable shapes should be prioritized — QR (cheapest, internal-only), Facebook/Instagram Lead Ads (real webhook API, Meta-side setup required per venue), or email-to-lead parsing (unlocks Knot/WeddingWire and any other email-only source, but needs LLM-assisted extraction + a review step)?
5. **Abuse hardening**: should this initiative include real bot/rate-limit protection on the public endpoints (3.7), or is that explicitly out of scope for now given pre-launch volume?
6. **Source vocabulary**: should `leads.source` become a real enforced enum (migration + backfill) as part of this work, given every new automated source is a fresh opportunity for the same drift bug that already happened once?

Answers recorded below once provided.
