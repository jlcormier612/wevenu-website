# Email Intake Self-Service — Design Plan

**Sprint 3, Item 2. Design only — no implementation. Waiting for approval.**

**Date:** 2026-07-21

---

## ⚠️ Read this first: two pre-existing bugs found during research, more urgent than the self-service UX itself

This assessment was scoped as "make onboarding self-service" — but tracing the pipeline end-to-end surfaced two defects that mean **Email Intake does not work at all today, for any venue**, self-service or otherwise. These predate this sprint and are unrelated to the UX gap the prompt was written to address. Flagging them separately, at the top, because they change the priority order: neither self-service UX nor anything else about this feature matters until these two are fixed.

### Bug A — every new venue's setup likely fails outright

`venues.lead_email_key` was added by `supabase/migrations/20261111000000_lead_intake_email_engine.sql` as `NOT NULL` with **no database default** (unlike its sibling `embed_key`/`tour_embed_key`, which both get a `default lower(replace(gen_random_uuid()::text,'-',''))`-style value automatically). The existing-rows backfill in that same migration covers venues that existed *before* the migration ran. But `complete_venue_setup` — the RPC that actually creates a new venue during onboarding (`supabase/migrations/20260927000000_fix_venue_setup_rls_self_reference.sql:75-113`) — has an explicit column list for its `insert into venues (...)` that was written before `lead_email_key` existed and was never updated to include it. Since the column is `NOT NULL` with no default and isn't in the insert list, **every venue-creation attempt since that migration should fail the insert** with a not-null constraint violation.

I have not live-tested venue creation as part of this research pass (this doc is research-only per the sprint's instructions), so I'm flagging this as **found by code inspection, not yet confirmed by running it** — but the code is unambiguous, and if this is real, it's a launch blocker independent of anything else in this document: a broken venue-setup wizard is more severe than a broken lead-intake channel. Recommend this be verified and, if confirmed, fixed immediately (either add a DB default matching the other keys, or add the column to `complete_venue_setup`'s insert list) regardless of what's decided about the rest of this plan.

### Bug B — the inbound webhook route is unreachable

`app/api/leads/email-intake/route.ts` (the route that actually turns a forwarded email into a Lead) is **not listed in `integrations/supabase/proxy.ts`'s `PUBLIC_PATHS`**, unlike its sibling routes (`/api/messaging/inbound`, `/api/messaging/webhook`, `/api/messaging/sms-inbound`, `/api/messaging/sms-status`), which are all correctly exempted from session-based auth with an inline comment explaining why. Because this route is missing from that list, `updateSession()` redirects any unauthenticated request to it — including Resend's own webhook call, which carries no session cookie — to `/login` before the route handler ever runs. **Every real inbound email to this endpoint is silently intercepted and dropped by the proxy today**, regardless of whether a venue has a valid `lead_email_key` or not. This is the exact same hazard class (a route that needs to be public for a provider's server-to-server call, but was left off the allowlist) already found and fixed twice this engagement for other features (the QuickBooks sync cron route, most recently).

**Recommendation: fix both of these as the true "Item 0" of this sprint, before any self-service UX work, since none of the UX below matters if the underlying channel doesn't function.** This is a one-line proxy allowlist fix (Bug B) plus either a one-line DB default or an RPC column-list fix (Bug A) — small, contained, and should be verified live (real venue creation, real webhook curl test) before moving on to the onboarding UX design below.

---

## 1. Assessment — what exists today

### 1.1 What works

- **Extraction and lead creation.** `lib/lead-intake/email-extract.ts`'s `extractInquiryFromEmail()` calls Claude directly with a marketplace-agnostic prompt and returns a 0–100 confidence score; `ingestLead()` (`lib/lead-intake/pipeline.ts`) runs the result through the same canonical pipeline every other source uses, ending in the `ingest_lead` RPC. This part of the design is sound.
- **Per-venue addressing.** `venues.lead_email_key` + `get_venue_by_lead_email_key(p_key)` correctly resolve a subaddressed inbound address (`leads+{key}@{domain}`) to a venue, the same mature pattern as `embed_key`/`tour_embed_key`.
- **Settings UI (partial).** `components/settings/website-forms-section.tsx`'s "Email intake" subsection already shows the forwarding address in a copyable code block with a copy button, when a key is present. This is a real, working start on self-service — not a stub.
- **Health data already exists.** `lead_intake_attempts` records `source`, `confidence_score`, `status`, `created_at`, `lead_id` for every attempt, including email ones (`source = 'email_parsed_generic'`). "Last email received," "last lead imported," and a confidence signal are all `WHERE source = 'email_parsed_generic'` queries away — no new columns needed to power the status dashboard this sprint asks for.

### 1.2 What currently requires "contact support" — and what actually doesn't

The literal "contact support" copy in the UI today (`website-forms-section.tsx:85`) fires when `RESEND_INBOUND_ADDRESS` (a **platform-wide** env var) is unset — i.e. it's really asking "is the whole platform's inbound-email integration switched on," not "has this specific venue been provisioned." There is no genuine admin-only or support-ticket-gated step anywhere in the code for *per-venue* enablement — because, per Bugs A and B above, there is currently no working code path that provisions a venue at all. In other words: **the "contact support" framing in today's UI is accidentally honest** (support genuinely would need to intervene, because nothing here works yet) but for the wrong reason — not because per-venue setup is intentionally gated, but because the automatic path is broken.

Once Bugs A and B are fixed, there is no remaining reason any part of enabling Email Intake should require support — every piece needed for full self-service already exists or is straightforward to add (below).

### 1.3 What's missing for genuine self-service

- **No connection/health status in the Settings UI.** The existing "Lead Intake Health" card pools all sources (form, tour, email) together with no per-source filter, even though the underlying `lead_intake_attempts.source` column already supports one.
- **No "Not Connected → Connect" state machine in the UI at all.** Today it's binary: address shown, or "contact support." There's no explicit connect action, no provider-specific instructions, no verification step.
- **No per-provider forwarding instructions** (The Knot, WeddingWire, Zola, Gmail, Outlook) anywhere in the app.
- **Unmatched-key attempts are invisible.** If a stale/mistyped forwarding address bounces off `get_venue_by_lead_email_key` with no match, a durable row is written to `lead_intake_attempts` with `venue_id: null` — but nothing surfaces this to anyone, admin or venue. Not required for the self-service flow itself, but worth a decision on whether to expose "recent unmatched attempts" as a diagnostic aid (see §3, open decision).

---

## 2. Design — the self-service flow

Matches the UX sketch in the sprint prompt almost exactly; the main design decisions are in how "Connection verification" and "Confidence" get their data, since that's where new plumbing is actually needed.

```
Status: Not Connected
        ↓
   [Connect Email Intake]  ← generates lead_email_key if the venue doesn't have one yet
        ↓
   Forwarding address shown, with a Copy button
   leads+{key}@{RESEND_INBOUND_ADDRESS domain}
        ↓
   Provider-specific instructions (tabs or an accordion, one per provider):
     - The Knot        → their lead-forwarding/notification settings
     - WeddingWire      → their storefront lead-notification settings
     - Zola             → their inquiry-forwarding settings
     - Gmail            → a filter + "Forward to" rule
     - Outlook          → an inbox rule
     (Each panel is static copy + a "these are general steps, exact menus change" disclaimer —
      this codebase has no ability to configure the other side of a third-party marketplace's
      account, so this is documentation, not automation.)
        ↓
   Status flips automatically once real signal exists:
     "Not Connected" → "Awaiting first email" → "Connected"
        ↓
   Last email received:  max(created_at)              where source='email_parsed_generic'
   Last lead imported:   max(created_at)               where source='email_parsed_generic' and status='accepted'
   Confidence:            avg(confidence_score) over the
                          last N accepted attempts, or the most recent one — see open decision below
```

### 2.1 Status derivation (no new tracking needed, per §1.1)

A venue's Email Intake status is a pure function of `lead_intake_attempts` filtered to `source = 'email_parsed_generic'` plus whether `lead_email_key` is set — no new columns, no new table:

| Status | Condition |
|---|---|
| Not Connected | `venue has never explicitly connected` (see below — this needs one small addition) |
| Awaiting first email | Connected, but zero `lead_intake_attempts` rows exist for this venue+source ever |
| Connected | At least one `lead_intake_attempts` row exists for this venue+source, ever |
| Connected, but nothing recent | Connected, and `max(created_at)` is older than some threshold (e.g. 30 days) — a soft warning state worth adding to the badge design, not in the sprint's literal spec but a natural extension of "confidence" |

**One real addition needed:** since every venue *already has* a `lead_email_key` today (once Bug A is fixed, every venue gets one automatically on creation), there's no natural "Not Connected" signal purely from key-presence — the key always exists. To genuinely support a "Not Connected → Connect" first step (rather than the address just always being visible), either:
- (a) add a boolean `venues.email_intake_connected_at timestamptz` (nullable), set the first time a venue visits/clicks "Connect Email Intake" in Settings — purely a UX gate, no functional effect on whether the address actually works (it always will, once Bugs A/B are fixed) — **recommended**, since it's the literal UX asked for and is a one-column, low-risk addition; or
- (b) skip the "Not Connected" state entirely and always show the address with instructions, treating "Connect" as informational framing rather than a real gate — simpler, but doesn't match the requested UX exactly.

Flagging (a) vs (b) as an open decision for approval (§4).

### 2.2 Confidence signal

The sprint prompt lists "Confidence" as a discrete UI element, without specifying what it means. Two reasonable interpretations, needing a decision:
- **Per-attempt confidence** — the extraction confidence score (0–100) Claude already returns for the most recent email, shown as "Last email: 82% confidence" — cheapest, already-existing data, but a single noisy data point.
- **Rolling health confidence** — a derived "how well is this working" signal blending recent acceptance rate + average confidence score over (say) the last 20 attempts — more useful for a venue deciding whether their forwarding rule is set up correctly, but is new aggregation logic (still just a query over existing data, not a new table).

Recommend the rolling version, since a single low-confidence email is far less actionable to a venue than "8 of your last 10 forwarded emails parsed cleanly."

### 2.3 Settings UI changes

- Extend `getIntakeHealthSummary()` (`lib/lead-intake/monitoring.ts`) with a `source` filter parameter, or add a sibling `getEmailIntakeStatus()` that queries `lead_intake_attempts` scoped to `email_parsed_generic` specifically.
- Replace `website-forms-section.tsx`'s binary address-or-"contact support" block with the full status-machine component described above: status badge, Connect button (if not yet connected), address + copy button, provider instruction tabs, and the last-email/last-lead/confidence row.
- The existing pooled "Lead Intake Health" card is unaffected — this is an additive, more specific view for the email channel, not a replacement.

---

## 3. Verification plan

1. **Bug A verification (do this first, live):** attempt real venue creation through the actual setup wizard against a local fixture; confirm whether it currently fails, and confirm the fix (DB default or RPC column-list update) resolves it.
2. **Bug B verification (do this first, live):** `curl` `/api/leads/email-intake` with no session cookie, confirm today's 307-to-login; confirm the proxy allowlist fix makes it reachable.
3. **End-to-end real flow**, once both bugs are fixed: create a real venue fixture, confirm it gets a `lead_email_key` automatically, simulate a real inbound email payload matching Resend's actual webhook shape, confirm a `lead_intake_attempts` row and a new Lead are created, confirm the Settings status view reflects "Connected" with the correct last-email/last-lead/confidence values immediately after.
4. **Unmatched-key case**: simulate an inbound email with a stale/invalid key, confirm the `venue_id: null` audit row is still written and nothing throws.
5. **Self-service completeness check**: walk the entire UX described in §2 as a first-time user would, confirming no step requires anything from a Wevenu admin — this is the actual acceptance criterion the sprint prompt cares about.
6. Standard `tsc --noEmit` / `next build` clean pass, real fixtures cleaned up to zero residue.

---

## 4. Open decisions needing approval before coding starts

1. **Bugs A and B — confirm these should be fixed immediately, ahead of and independent of the self-service UX work**, since they block the feature entirely regardless of UX.
2. **"Not Connected" gating mechanism (§2.1)** — recommend adding `venues.email_intake_connected_at` as an explicit one-time UX gate; confirm, or choose the simpler always-visible alternative.
3. **Confidence signal shape (§2.2)** — recommend the rolling multi-attempt version over a single last-email score; confirm.
4. **Unmatched-key visibility** — not required by the sprint's UX sketch, but the data already exists (`lead_intake_attempts` rows with `venue_id: null`). Worth a small "diagnostics" affordance, or explicitly out of scope for this pass? Recommend out of scope for now, revisit if support tickets show it's needed.
