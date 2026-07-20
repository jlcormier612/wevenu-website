# Hosted Experience Platform — Phase 3 Implementation Report

Closes Phase 3 (Publishing Model & Version History) of `docs/hosted-experience-platform-architecture-spec.md`. Phases 4–6 remain specification only.

## What Shipped

| # | File | Delivers |
|---|---|---|
| 1 | `supabase/migrations/20261015000000_hosted_experience_phase3_publishing_schema.sql` | `status` state machine (draft/preview/published/archived), `preview_token`, `scheduled_publish_at`/`scheduled_expire_at`, `current_version_id`, `experience_versions` table; `is_published` converted to a generated column so existing readers are unaffected |
| 2 | `supabase/migrations/20261016000000_hosted_experience_phase3_update_my_website_publishing.sql` | Publishing now writes a frozen `experience_versions` snapshot atomically with the status change; new `p_action` param for archive/unarchive |
| 3 | `supabase/migrations/20261017000000_hosted_experience_phase3_read_rpcs_publishing.sql` | `get_wedding_website` reads from the frozen snapshot for published/archived sites (live_synced sections excepted); `p_preview_token` bypasses status entirely; `get_my_website` returns `status`/`hasPendingChanges`/`previewToken` |
| 4 | `supabase/migrations/20261018000000_hosted_experience_phase3_fix_syncmode_quoting.sql` | Self-caught correction — see below |
| 5 | `app/w/[slug]/page.tsx` | Passes through a new `?preview=` query param |
| 6 | `components/portal/website-editor.tsx` | New "Publish updates" affordance, shown only when a published site has draft changes the last publish didn't include |
| 7 | `lib/wedding-website/types.ts` | `ExperienceStatus`, and `status`/`hasPendingChanges`/`previewToken`/`isPreview` added to `CoupleWebsite`/`PublicWebsite` |

## What "Publishing Is a Commitment" Actually Means Here

The most consequential behavioral change in this phase, stated plainly: **before this phase, every save to a published site was instantly visible to guests.** There was no draft/live separation at all — editing a live wedding website was editing it in front of guests in real time. This phase closes that gap the same way Invoice-send and Event Order finalize already work elsewhere in this platform: publishing takes a snapshot; guests see the snapshot; further edits accumulate in the draft; nothing guests see changes until the couple deliberately commits again.

What freezes and what doesn't, precisely:
- **Frozen at publish**: Collection, Color Story, Typography Style, accent color, and every section whose `sync_mode` is `one_time_copy` or `manual` at that moment — including a *manually-entered* Schedule (when `schedule_sync` is off), which is real authored content and should freeze like anything else.
- **Never frozen, always live**: any section whose `sync_mode` is `live` at snapshot time (Schedule when `schedule_sync` is on; RSVP, always) — plus the platform-computed pieces that were already always-live before this phase and stayed that way: the top-level event/countdown, couple names, RSVP counts, and view analytics.

## Design Decisions Made During Implementation

1. **`is_published` became a generated column rather than being removed.** Two real, existing readers (`lib/luv/observations.ts`, `app/api/portal/invite/route.ts`) do a plain `.eq("is_published", true)` filter. A generated column (`status = 'published'`) behaves identically to a normal column for every SELECT/WHERE use, so neither file needed to change — the migration checked this by grep before deciding, not by assumption.
2. **The Studio's basic Publish/Unpublish toggle needed no changes at all** — `togglePublish()` already sent `isPublished: true`/`false`, which is exactly the commitment action `update_my_website` now performs. What *did* need a new affordance: re-publishing after further edits, since the old toggle only ever flips `true` when going from unpublished to published — clicking it a second time while already published would have unpublished the site. A new, separately-labeled "Publish updates" button was added, shown only when the draft has actually changed since the last publish (`hasPendingChanges`, computed server-side by comparing `couple_websites.updated_at` to the current version's `published_at`).
3. **Archive/Unarchive is a new, additive `p_action` parameter rather than overloading the boolean**, since a 4-state machine can't be expressed by one boolean without ambiguity. No Studio UI was built for it in this pass — the backend is real and tested, but archiving remains reachable only via direct RPC call today, the same kind of "backend-ready, UI not yet built" scope boundary drawn in earlier phases.
4. **Scheduled publish/expire got their columns but no automation.** Building a cron job to act on `scheduled_publish_at`/`scheduled_expire_at` isn't something that can be meaningfully live-tested within a single session — there's no way to verify a time-based trigger fired correctly without actually waiting for the time to pass. Rather than ship untested automation, the columns exist and are ready for a future phase to wire up.
5. **`couple_website_stats`, a pre-existing dead view, was found blocking the `is_published` column rebuild.** It selects `is_published` directly and has zero references anywhere in application code — confirmed by grep, not assumed. Rather than deleting it (not asked for) or using `CASCADE` (which would silently drop it without recreating it), it was dropped and recreated identically in the same migration. Flagged here as a minor, incidental Engineering Cleanup candidate, consistent with how similar dead objects have been handled throughout this review series — documented, not acted on unprompted.

## Regression Self-Caught During Implementation

Two, this time — worth being direct about both:

1. **A real logic bug**, not a signature/overload issue: the snapshot-building code in `update_my_website` originally decided what to freeze based on `es.owner = 'live_synced'` (the section's *structural* category) instead of `es.sync_mode = 'live'` (its *current behavioral state*). Since a Schedule section's `owner` is always `live_synced` regardless of whether the couple has `schedule_sync` on or off, this would have incorrectly discarded a manually-entered schedule's real content at every publish. Caught during code review, before ever applying the migration — fixed to check `sync_mode` instead, matching the design distinction the migration's own comments describe.
2. **A quoting bug caught live, after the first apply**: `get_wedding_website`'s snapshot-reading branch referenced `jsonb_to_recordset` column aliases as `s.syncMode`/`s.sortOrder` (unquoted), which Postgres folds to lowercase — not matching the quoted camelCase aliases declared in the column list, which must match the JSON key's actual case exactly. This didn't surface until the function was actually *called* (publishing, then loading the public page), the same general shape of issue as the Stabilization pass's headline bug — a function body error invisible until a real code path executes it. Fixed with a corrective migration (`20261018000000`), not an edit to the already-applied one, consistent with this project's standing discipline.

## Live Validation

Real client, event, and portal-session tokens; every RPC called with real parameter shapes. This phase's test matrix was necessarily the most behaviorally detailed of the three, since the whole point is a temporal guarantee, not just a data shape:

- **First publish**: created version 1, guest site correctly resolved with the published content.
- **The core guarantee**: edited the draft's Home title *after* publishing — confirmed the Studio (`get_my_website`) immediately showed the new draft title with `hasPendingChanges: true`, while the **public site kept showing the original, version-1 title**, completely unaffected.
- **Re-publish**: sent `isPublished: true` again while already published — confirmed a new version 2 was created, `hasPendingChanges` reset to `false`, and the public site *then* updated to the new title. Queried `experience_versions` directly and confirmed both versions 1 and 2 exist with their own distinct, correctly frozen content — real version history, not just a single overwritten pointer.
- **Live sections never freeze**: turned `scheduleSync` on and published, then added a brand-new real Timeline entry *after* that publish — confirmed the guest site's schedule showed the new entry immediately, with no re-publish needed, while the Home title on the same response stayed frozen at its last-published value in the same request.
- **Archive**: confirmed the public URL kept resolving (`status: "archived"`, no error) — bookmarked guest links survive archiving, as designed. Unarchive correctly returned the site to `published`.
- **Preview token**: confirmed a token-bearing request bypasses the status check entirely, showing the live, unpublished draft — tested both while the site was published (showing newer draft content the public route wouldn't yet show) and while in `draft` status (a site never published at all, where the normal route correctly still 404s).
- **Unpublish**: confirmed the public route reverts to `{"error": "not_found"}`.
- `tsc --noEmit` clean throughout, aside from the same two pre-existing, unrelated stale `.next` entries noted in every prior report this session.

All test data — one client, one event, one portal session, one `couple_websites` row (cascading to its `experience_sections` and both `experience_versions` rows), one real Timeline entry, one relationship record — created through real paths and fully removed, verified at zero.

## Recommendation: Phase 3 Complete

Ready to proceed to Phase 4 (Guest Personalization — "preview as this guest," unifying the two RSVP surfaces) whenever you'd like.
