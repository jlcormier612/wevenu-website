# Wedding Website Product Capabilities — Release Readiness Assessment

Phase 6 of the platform's release-readiness review. This covers the CURRENT, already-shipped Wedding Website feature — not the separate, purely-design-only Wedding Website Redesign initiative (`docs/wedding-website-design-recommendation.md` and its v2), which remains 100% unimplemented and out of scope here except as a source of prior claims to independently re-verify.

## Methodology

That redesign document's own internal audit ("Part 1 — Fix first: these are bugs, not design gaps") named five specific defects in the current feature. Rather than take those on faith, every one was independently re-verified against current code and, wherever possible, against the live running application — and in the process, live testing surfaced a sixth, far more severe defect the prior audit never caught, because it only manifests when the Save action is actually exercised end-to-end rather than read from code.

A real client, event, and couple-portal session were created through real app paths (the same `create_client_atomic` RPC and `client_portal_sessions` mechanism a coordinator actually uses), and every RPC a real couple's browser calls — `get_my_website`, `update_my_website`, `get_wedding_website`, `get_rsvp_context`, `submit_rsvp`, `add_couple_guest` — was called exactly as the app calls them, with the same parameter shapes taken directly from the current route handlers. Where the normal write path itself turned out to be broken (see below), a direct database write was used *only* to get a test row into a state where the read/public-render side could still be exercised and verified live — clearly distinguished from testing the real path itself. All test data was created and fully removed afterward, with a verified-empty final check.

---

## The Headline Finding: The Studio Cannot Save Anything

**`update_my_website` — the single RPC behind every Save action in the Wedding Website Studio, and the only way a `couple_websites` row is ever created — is unconditionally broken. It fails on every call, for every couple, for every field, every time.**

The function's upsert is `insert into couple_websites (...) values (...) on conflict (client_id) do update set updated_at = now() returning id into v_site_id` (`supabase/migrations/20260701700000_sprint70_theme_palettes.sql:160-164`). This requires a unique constraint or unique index on `client_id`. Live-verified directly against the running database: no such constraint or index exists and never has — `couple_websites` has a primary key on `id`, a unique index on `slug`, and a plain (non-unique) index on `client_id` (`supabase/migrations/20260629100000_couple_website.sql:71-72`), confirmed exhaustively via a direct `pg_constraint`/`pg_indexes` query against the live database, not inferred from migration text alone. Calling the RPC — with the exact parameter shape `app/api/portal/website/route.ts` always uses — fails immediately with Postgres error `42P10: there is no unique or exclusion constraint matching the ON CONFLICT specification`. This was reproduced twice, identically, confirming it isn't a one-time fluke: the very first call (which should create the row) fails, and a second, independent call fails the same way, because Postgres validates the `ON CONFLICT` target before it even checks whether a conflict exists — there is no code path through this function that succeeds.

Practical effect: a couple can never create a wedding website, set a slug, choose a theme, publish, set a password, or save a single content field, through any UI the product exposes. Every other finding in this report about what the Studio *does* once saved (palette not applying, font pairing dead, etc.) is downstream of a save that, today, cannot happen at all. This appears to be a genuine "shipped but never actually exercised end-to-end" defect — the function was almost certainly tested by reading its SQL, not by clicking Save in a browser, since the bug is unconditional and would have been caught immediately by anyone who tried.

A related, lower-severity discovery from the same testing: both `update_my_website` and the public `get_wedding_website` have **multiple co-existing overloaded signatures** in the live database — `CREATE OR REPLACE FUNCTION` only replaces a function when its parameter list matches exactly; every time a migration added a new parameter (`p_theme_palette`, `p_font_pairing`, `p_section_order`, `p_session_id`, `p_page`), it silently created an *additional* overload rather than replacing the old one. The real app's route handlers always pass the full, current parameter set, so this doesn't break production callers today — confirmed live, calling with a partial parameter set produces a `PGRST203` "could not choose the best candidate function" error, while the real app's full call shape resolves correctly. But the old, dead overloads are still live and callable, which is real migration debt independent of the ON CONFLICT bug.

---

## What Held Up Well

**Timeline/Schedule integration is genuinely live-synced today**, not aspirational — `get_wedding_website` reads `timeline_entries`/`timeline_sections` directly on every call, filtered to guest-visible audiences, the same table the coordinator's own Booking Timeline uses (`supabase/migrations/20260812000000_guest_timeline_publishing.sql:88-106`). This is real evidence the platform's central thesis — the website as a live surface of data Wevenu already knows, not a fourteenth place to retype it — already works for at least one section, and is the template the (paused) redesign correctly wants to extend elsewhere.

**RSVP data itself is real and rich.** Live-tested: `get_rsvp_context` returns genuine per-guest state — identity, prior RSVP status, household members, meal options, custom questions — not a stub. `rsvpStats` on the public site is a live count against `couple_guests`, not a cached or stale number.

**Password gate mechanics work as designed, just insecurely** — live-tested: the correct plaintext password grants access, an incorrect one is cleanly rejected. The gate isn't broken; it's built on a genuinely weak foundation (see below).

**Studio and public-site responsiveness are real**, not a desktop-only afterthought — both use fluid typography and real breakpoints, unlike some other areas audited earlier in this review series.

**The theme collection check constraint is not stale** — a claim in the prior design-doc audit turned out to be outdated by the time of this assessment: `couple_websites.theme`'s check constraint was widened to include all 8 current collections (`romance`, `coastal`, `champagne`, `velvet`, plus the original 4) by `supabase/migrations/20260701680000_sprint68_website_studio.sql`, confirmed directly against the live constraint definition. Worth naming because it's exactly the kind of claim this methodology exists to catch either direction — confirming real bugs and retiring stale ones.

---

## Architecture Issues

**1. [Blocker] The Studio save path is completely non-functional** — see Headline Finding above. Fix requires a migration: add a real unique constraint on `couple_websites.client_id` (or change the upsert's conflict target to match what actually exists, e.g. `id` with a prior lookup). This is the single highest-priority item in this entire report.

**2. [High] The public RPC silently dropped theme personalization — a regression, not a gap.** Live-tested: a website row was set with an explicit `theme_palette`, `font_pairing`, and `section_order` (via direct write, since the normal path is broken — see above), then read back through the real public `get_wedding_website` RPC with the exact parameter shape `/w/[slug]/page.tsx` uses. The response correctly included `theme` and `accentColor`, but contained no `themePalette`, `fontPairing`, or `sectionOrder` keys at all. Tracing the migration history: Sprint 70 (`20260701700000_sprint70_theme_palettes.sql:99-108`) added these three fields to the function's return object and they worked; a later migration (`20260812000000_guest_timeline_publishing.sql`), whose stated purpose was only to fix Timeline sync, redefined the function from an older base and silently reintroduced the pre-Sprint-70 field set, dropping all three. `get_my_website` (the Studio's own read RPC) was never regressed — the Studio still correctly shows a couple's choices — so this is specifically a guest-facing-render regression: a couple who successfully saved a palette, font, or custom section order (once Issue #1 above is fixed) will never see it reflected on their own published site.

**3. [Medium] Password storage and comparison are genuinely plaintext, live-confirmed end to end.** The `password` column's own migration comment says "bcrypt or plain text (compare in function)" and it was always the latter — live-tested: the raw stored value read back from the database was the exact plaintext password with no hashing of any kind, and the comparison in every version of `get_wedding_website` across every migration is a raw `!=` string check. Combined with the already-known fact that the password travels as a `?p=` URL query parameter (browser history, server/CDN access logs, `Referer` leakage), this is a real, live, unresolved security gap for a feature explicitly marketed as private/password-protected.

**4. [Low] The `schedule_sync` toggle has its own, independent write-path bug.** Distinct from Issue #1: this one field bypasses the RPC pattern entirely and is written via a direct `.update()` call (`app/api/portal/website/route.ts:54-61`) from the couple's token-based (`anon`-role) session. Live-tested: an `anon`-role write attempt against `couple_websites.schedule_sync` fails with an explicit `permission denied` error — there is no RLS policy or grant permitting this table to be written directly by any role. Even once Issue #1 is fixed, this specific toggle will still fail silently (the route code doesn't check the update's error before returning success).

---

## Product Completion Items

1. **Font Pairing is a fully dead control, at the application-code layer even once the RPC issue above is fixed.** `resolveTheme()` (`components/wedding-website/wedding-website.tsx:288-296`) takes only `collectionKey`/`paletteKey` — it has no parameter for font pairing at all, so all heading/body fonts come from the fixed per-collection defaults. The picker exists in the editor, is genuinely saved and read back correctly by the Studio's own preview data — but the Studio's *preview* uses the same renderer, so even the live preview never visibly changes when a couple picks a different font pairing. A dead control that appears to save successfully is worse than no control.
2. **Bridal party photos are a half-built feature, more precisely than "fully dead."** The public renderer is fully ready to display a member's photo (`wedding-website.tsx:1101-1104`, a real conditional `<img>`), but the editor (`BridalPartyEditor`, `components/portal/website-editor.tsx:632-675`) has no upload control, URL field, or any way to set `photoUrl` at all — only name/role/note. The harder half (image upload) was never finished; the easier half (rendering it once set) was.
3. **Two inconsistent RSVP experiences on the same site, live-confirmed to behave differently, not just look different.** The personalized token page (`/rsvp/{token}`) is a real, rich experience — meal options, custom questions, household members. The embedded on-site lookup form does no server-side validation before showing the RSVP form: live-tested, its "found" state is purely a client-side string-length check (`> 10` characters), and only the final submit actually validates the token — confirmed live, submitting a garbage-but-long token is accepted through to the form and only rejected (`{"ok": false, "error": "invalid_rsvp_link"}`) at that final step. A guest who mistypes their code gets shown a working-looking RSVP form before discovering, at the end, that nothing they entered was ever tied to a real invitation.

## Engineering Cleanup Items

1. **`sections_enabled` is fully dead on the render path** — stored, round-tripped through every RPC, even passed into the Studio's preview state, but never read anywhere by the actual renderer (confirmed via full-file grep, zero hits) and has no toggle UI in the editor either. Sections are shown/hidden purely by content presence today; this column and its plumbing are vestigial.
2. **Duplicate, superseded RPC overloads** for `update_my_website` and `get_wedding_website` (see Headline Finding) — safe to drop the older signatures once confirmed unused by anything outside this codebase's own route handlers.

## Product Decisions (open questions, not defects)

These are the substance of the paused Wedding Website Redesign initiative, restated here only to be clear they are *not* part of this readiness verdict — genuinely undecided product direction, not bugs to fix before Ready:
- Whether Story/Cover Photo/Venue Details move from "one-time copy, silently goes stale" to a visible "synced from Planning, refresh available" model.
- Whether to unify the two RSVP surfaces into one, and whether to build a "preview as this guest" mode into the Studio.
- Whether/how deeply to integrate Event Order ("what's included"), Floor Plans (venue orientation), and Travel/logistics data as live or guided sections.
- The typography-bundling, motion-system, and photo/composition recommendations from the redesign's Part 5 — real design direction, explicitly awaiting a separate go-ahead before any implementation, per the existing project record.

---

## Recommendation: **Not Ready**

The headline finding alone settles this: a feature whose only save path is unconditionally broken cannot be called release-ready, independent of how any other part of it behaves. This is more severe than any single finding in the three prior "Not Ready" or "Almost Ready" phases of this review — it isn't a missing UI wire onto a working backend (Key Dates) or a gap at the edges of an otherwise-solid system (Booking Financial Architecture, Seating); the core write path itself does not function, for anyone, ever, today.

Once Architecture Issue #1 is fixed, the feature underneath is in better shape than that single finding suggests — Timeline sync is real, RSVP data is rich and real, the password gate's *mechanics* work correctly (just insecurely), and responsiveness is genuinely handled on both Studio and public site. This reads as a feature that was largely finished and then broken by a later, unrelated migration and an untested upsert clause — not a feature built as a shell from scratch.

### Prioritized Findings

1. **[Architecture / Blocker] Studio save is completely non-functional** — missing unique constraint breaks the only write path for every couple, every field, always.
2. **[Architecture / High] Public site silently ignores a couple's palette, font, and section order** — a regression from an unrelated later migration, not a never-built gap.
3. **[Architecture / Medium] Password gate is genuinely plaintext, stored and compared, and travels as a URL query parameter.**
4. **[Architecture / Low] `schedule_sync` toggle has its own independent, silent write failure** via an ungranted direct table write.
5. **[Product Completion] Font Pairing is dead even in the Studio's own live preview**, not just the public site.
6. **[Product Completion] Bridal party photo upload was never built**, though the display side is ready and waiting.
7. **[Product Completion] The embedded RSVP lookup form shows itself as "found" before any server-side validation occurs.**
8. **[Engineering Cleanup] Dead `sections_enabled` plumbing and duplicate RPC overloads** from incremental `CREATE OR REPLACE` migrations.
9. **[Product Decision, not a defect] The full data-integration and design-system direction from the paused Redesign initiative** remains genuinely open and is not part of this verdict.
