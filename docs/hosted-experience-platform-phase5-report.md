# Hosted Experience Platform — Phase 5 Implementation Report

Closes Phase 5 (Luv Integration) of `docs/hosted-experience-platform-architecture-spec.md`. Phase 6 remains specification only.

## What Shipped

| # | File | Delivers |
|---|---|---|
| 1 | `supabase/migrations/20261020000000_hosted_experience_phase5_guided_refresh.sql` | `mark_section_synced(token, sectionKey)` — stamps `experience_sections.last_synced_at` when a refreshed guided-section value is accepted and saved |
| 2 | `app/api/portal/website/sync-section/route.ts` | Route wrapping `mark_section_synced` |
| 3 | `components/portal/website-editor.tsx` | `SyncBadge` component ("Sourced from Planning · synced [date]" + Refresh); wired into `HomeEditor`/`StoryEditor`; new change-notification nudge card + handlers |
| 4 | `supabase/migrations/20261021000000_hosted_experience_phase5_guest_concierge.sql` | `get_guest_concierge_context(rsvp_token)` — guest-token-authenticated, returns venue ops info + the couple's own published dress_code/faq/travel/things_to_do content |
| 5 | `app/api/rsvp/concierge/route.ts` | Route wrapping the context RPC + a guest-appropriate Claude system prompt |
| 6 | `components/wedding-website/guest-concierge.tsx` | `GuestConciergeWidget` — collapsed-by-default, curated-questions concierge, mounted after a looked-up guest's `RsvpPage` |
| 7 | `supabase/migrations/20261022000000_hosted_experience_phase5_change_nudges.sql` | `website_change_nudges` table; `get_website_change_nudges` (on-demand detect/upsert/self-clear); `dismiss_website_change_nudge` |
| 8 | `app/api/portal/website/change-nudges/route.ts` | GET (detect + list) / POST (dismiss) |
| 9 | `app/api/portal/invite/route.ts` | New `emailType: "update"` branch + optional `message` field, reusing the existing invite-email pipeline |
| 10 | `integrations/supabase/proxy.ts` | Added `/api/rsvp` to the public-path allowlist (guest-token routes, not session-authenticated) |
| 11 | `app/api/portal/website/route.ts` + `supabase/migrations/20261023000000_fix_website_content_double_encoding.sql` | **Unrelated pre-existing bug fix** — see below |

## The Three Deliverables, What They Actually Do

**Guided-section refresh.** `experience_sections.last_synced_at` has existed since Phase 2 but nothing ever wrote to it. The Studio's Home and Story editors (the platform's only two `owner = 'guided'` sections) now show a small "Sourced from Planning · synced [date]" line with an explicit **Refresh** button. Refresh re-fetches `get_website_suggestions` live (the existing suggestion RPC needed no changes — it already re-queries live data on every call, it was just never re-invoked after the Studio's initial mount). Accepting a refreshed value (tapping a suggested photo, or "Use this story") only updates the in-memory form — the couple still reviews it and presses the existing Save button, at which point `mark_section_synced` stamps the timestamp. Nothing is ever silently overwritten.

**Guest-facing concierge.** `get_guest_concierge_context` is a guest-token twin of the couple-facing `get_venue_info_for_portal`/`luv-ask` pattern, plus the couple's own dress_code/faq/travel/things_to_do content — read through the same published-snapshot-or-live-draft resolution `get_wedding_website` uses, so the concierge can never describe something the guest can't also see on the actual page. The widget itself (`GuestConciergeWidget`) is intentionally restrained per this phase's explicit instruction to keep Luv "a hospitality concierge rather than a conversational interface": collapsed behind a small "Questions about the day? Ask Luv →" link, a handful of curated quick-tap questions (what to wear, parking, weather, hotels), and exactly one question/answer visible at a time with a "Ask something else" reset — never a growing chat thread like the couple portal's "Ask Luv."

**Change-notification nudges.** Scoped to the concrete example the spec itself gives: the Schedule section, when live-synced, changing after the site was published while guests have already RSVP'd. `get_website_change_nudges` runs its detection on-demand (same request-time-generation pattern as `generate_venue_recommendations`, no new cron), upserts a row keyed on `(website_id, section_key)`, and self-clears once the trigger condition no longer holds (e.g. after a re-publish resets the baseline). The couple sees a small card in the Studio: "Your Day-of Schedule was updated after your website was published — 'Ceremony' now shows 4:00 PM..." with a **Notify guests who've RSVP'd** action, which reuses the existing `/api/portal/invite` email pipeline (new `emailType: "update"`) rather than building a second send path, targeting only guests whose `rsvpStatus !== "pending"`.

## Design Decisions Made During Implementation

1. **Guided-section refresh reuses `get_website_suggestions` unchanged** rather than adding a new "diff" RPC — it already does a live re-pull on every call; the only real gap was that nothing ever called it again after mount, and nothing recorded when a refresh was accepted. Both gaps closed with the smallest possible surface: one new RPC (`mark_section_synced`) and a client-side re-fetch.
2. **The change-nudge table is couple-portal-scoped, not reused from `luv_recommendations`.** `luv_recommendations` is structurally venue-coordinator-scoped (`venue_id` FK, `venue_users` RLS) with no per-couple concept — extending it would have meant bolting a client_id path onto a table designed around a different actor. A new, small, purpose-built table matching the same shape (upsert-by-key, self-clearing, dismiss/complete) was more honest than forcing a fit.
3. **Scoped to Schedule only**, consistent with Phase 2's own finding that `venue_managed` (and, practically, every other live-synced section besides Schedule and RSVP) has no real occupants today. Generalizing the detection to arbitrary live-synced sources is explicitly deferred until a second one exists with real content to watch.
4. **"Notify guests" reuses the existing invite-email pipeline** rather than a new send path — same Resend integration, same dev-mode console-log fallback, same HTML template shell, just a new subject line and CTA copy for the `update` variant.

## A Significant, Unrelated Bug Found and Fixed During Live Testing

While live-testing the guest concierge (which reads the couple's published dress_code content), the dress_code field came back as a **JSON string**, not a nested object, in both `couple_websites.content` and the mirrored `experience_sections.content`. Traced to its root cause and fully proven, not just suspected:

- `app/api/portal/website/route.ts` called `JSON.stringify(contentValue)` before passing it as `p_content_value` to `update_my_website`, a **jsonb-typed** RPC parameter. `supabase-js` already serializes RPC parameters for the request; stringifying first meant the parameter arrived at Postgres as a JSON *string* scalar rather than a native object, and got stored that way.
- Proved by calling `update_my_website` directly with a native `::jsonb` object (bypassing the route): stored correctly as an object. Calling the real route with the same content: stored as a string. Confirmed reproducible for `home`, `dress_code`, and `travel`.
- **Guest-visible impact**: `components/wedding-website/wedding-website.tsx`'s section renderers read fields like `content.dress_code?.formality` — `undefined` on a string value — so affected sections silently rendered empty/fallback with no error anywhere. This is not new to Phase 5; it predates this phase and likely predates the Hosted Experience Platform entirely.

Per the user's explicit direction once this was surfaced, fixed immediately as a standalone correction rather than folded into Phase 5's own scope:
- **Code fix**: removed the redundant `JSON.stringify` in the route (one line).
- **Data repair**: `supabase/migrations/20261023000000_fix_website_content_double_encoding.sql` — a narrowly-scoped, idempotent repair that unwraps any jsonb value which is a string containing what looks like JSON (`{...}` or `[...]`), across `couple_websites.content`, `experience_sections.content`, and `experience_versions.snapshot` (frozen published versions carry the same corruption if it existed at publish time).
- **Live-verified end-to-end**: re-saved dress_code through the real (fixed) route — stored as a proper object; confirmed on the actual public page HTML that "Cocktail attire — think garden party chic." now renders, where it silently rendered nothing before the fix.
- **Migration history integrity**: ran a full `supabase db reset --local` after adding the repair migration — the entire chain, including this new migration, replayed cleanly from empty.

One incidental environment note surfaced while chasing this: this dev server's file watcher did not reliably pick up edits to *existing* route files (new files were picked up fine) — likely related to the iCloud-synced project directory. A clean dev-server restart was needed twice to confirm fixes actually took effect; worth remembering if a future fix "doesn't seem to apply" despite the source clearly being correct.

## Errors and Fixes (Phase 5's Own New Code)

1. **Route ordering bug, self-caught during live testing**: `app/api/rsvp/concierge/route.ts` originally checked `ANTHROPIC_API_KEY` before validating the guest token, so an invalid token got the same generic "not configured" response as a valid one — masking the security boundary. Fixed by validating the token first (returning 401 for an invalid one) regardless of whether Anthropic is configured. Confirmed live: valid token → configured-fallback message; invalid token → `401 {"error":"invalid_token"}`.
2. **Proxy allowlist gap**: `/api/rsvp/concierge` initially redirected to `/login` — `/api/rsvp/*` wasn't in `integrations/supabase/proxy.ts`'s `PUBLIC_PATHS` (only `/rsvp` the page path, and `/api/portal`, were listed). Added `/api/rsvp` alongside the other guest/token-authenticated API groups.

## Live Validation

Real venue, client, event, two guests (one attending, one pending), a published wedding website with real dress_code/travel content, a real Timeline entry added after publish, and a real portal session — all created through real app paths (guest creation via `/api/portal/guests`, RSVP submission via `/api/portal/rsvp`, website content/publish via `/api/portal/website`) except account-scaffolding rows (venue, venue_staff, client, event, portal session, venue_operational_info, the Timeline entry) which were seeded directly via SQL since standing up a full authenticated venue-owner signup flow is infrastructure outside this phase's scope, not the feature under test.

- **Guided refresh**: `mark_section_synced` confirmed to set `last_synced_at` on the correct section row via the real route.
- **Guest concierge — context correctness**: `get_guest_concierge_context` confirmed to return the guest's event/venue/couple info, the venue's operational info (parking, policies, ceremony instructions, rain plan, accommodations, FAQs), and the couple's dress_code content, all sourced from real saved data.
- **Guest concierge — security**: invalid token → `401 invalid_token`; valid token with no `ANTHROPIC_API_KEY` configured in this environment → graceful "not set up yet" fallback (the same fallback pattern the existing couple-facing "Ask Luv" uses; this environment has never had a real Anthropic key configured for either feature, so the actual Claude call itself is unverified here but is identical boilerplate to the already-proven `luv-ask` route).
- **Change nudges — detection**: correctly detected the post-publish Timeline change with an accurate, specific summary ("'Ceremony' now shows 4:00 PM"); correctly required both `schedule_sync = true` and at least one non-pending RSVP.
- **Change nudges — dismiss**: dismissing a nudge correctly removes it from the active list on next fetch.
- **Change nudges — notify**: **not fully live-tested.** `/api/portal/invite` resolves `client_portal_sessions` via a direct table `SELECT`, which depends on RLS policies scoped to an authenticated venue-staff or couple browser session (cookie-based) — not reachable via a bare token in an unauthenticated request. Confirmed this is pre-existing and unrelated to Phase 5: the original `emailType: "invitation"` fails identically under the same bare-token test. The new `emailType: "update"` branch's logic (subject line, CTA, template) was verified by code review rather than an end-to-end send, consistent with this being a pre-existing limitation of that route's auth model, not something this phase changed.
- The content double-encoding fix: see the dedicated section above.
- `tsc --noEmit` clean throughout aside from the same two pre-existing, unrelated stale `.next` entries noted in every prior report this session.

All test data (venue, venue_staff, client, event, portal session, two guests, website, timeline entry, venue_operational_info, the one change-nudge row) was created for this phase and fully removed via a full `supabase db reset --local`, which also served as final confirmation that the complete migration chain — including the new repair migration — replays cleanly from empty. Post-reset counts for all Phase 5 test identifiers confirmed at zero.

## Recommendation: Phase 5 Complete

Ready to proceed to Phase 6 (Event-Neutral Generalization) whenever you'd like — noting, per the spec, that this is explicitly sequenced last and deliberately deferred until the object model has been proven on weddings, which Phases 1–5 have now done.

Separately: the `/api/portal/invite` route's reliance on a directly-authenticated session (rather than the SECURITY-DEFINER-RPC-plus-portal-token pattern used everywhere else in this platform) means it's untestable via a bare token and may be worth a closer look on its own timeline — flagged here as an observation, not a Phase 5 defect.
