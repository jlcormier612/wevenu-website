# Wedding Website Stabilization — Final Report

This closes the Wedding Website Stabilization pass approved in `docs/wedding-website-stabilization-plan.md`, addressing the three confirmed implementation defects from `docs/wedding-website-product-capabilities-release-readiness-assessment.md` that prevented the feature from operating at all.

## Implemented Fixes

| # | File | Fixes | Layer |
|---|---|---|---|
| 1 | `supabase/migrations/20261004000000_wedding_website_stabilization_client_unique.sql` | Studio save was unconditionally broken | Added `unique (client_id)` — the constraint `update_my_website`'s upsert had always assumed existed |
| 2 | `supabase/migrations/20261005000000_wedding_website_stabilization_public_rpc.sql` | Public site ignored saved palette/section order | Restored `themePalette`/`fontPairing`/`sectionOrder` to `get_wedding_website`'s return object (merged into the current Timeline-sync body, not a revert); dropped the dead 2-parameter overload |
| 3 | `supabase/migrations/20261006000000_wedding_website_stabilization_schedule_sync.sql` | `schedule_sync` toggle silently failed to persist | Added `p_schedule_sync` to `update_my_website`, following the same pattern every other field already uses; dropped the two then-superseded overloads |
| 4 | `supabase/migrations/20261007000000_wedding_website_stabilization_overload_fix.sql` | Self-correction, found during validation | Dropped one further stale `update_my_website` overload that migration 3 itself created — see "Regression Results" below |
| — | `app/api/portal/website/route.ts` | Companion to fix 3 | Removed the direct, ungranted `.update()` workaround for `scheduleSync`; now passed through the RPC like every other field |

Applied via `supabase migration up` (incremental), not a full reset — this preserved existing venue data rather than requiring it to be recreated again.

## Acceptance Criteria Results

All pass, live-tested with a real client, event, and portal-session token, using the exact parameter shapes the real route handlers use:

| Criterion | Result |
|---|---|
| Create | ✅ First save on a client with no existing website succeeded (`{"ok": true, "siteId": ...}`) — previously failed 100% of the time with `42P10` |
| Edit | ✅ Content field saved and read back correctly via `get_my_website` |
| Save (repeat, true update path) | ✅ Second save on the same, now-existing row succeeded, same `siteId`, prior content preserved alongside the new field |
| Save (full customization) | ✅ theme, theme_palette, accent_color, font_pairing, section_order, slug, and schedule_sync all persisted and read back correctly in one pass |
| Publish | ✅ `isPublished: true` made the site resolve via the public RPC with real content |
| Public rendering — palette | ✅ `themePalette` present in the public response and matches what was saved |
| Public rendering — section order | ✅ `sectionOrder` present and matches what was saved |
| Public rendering — font pairing (data only) | ✅ Field present and correct in the response; **visual application was not touched, per the explicit non-goal** — confirmed `resolveTheme()`'s signature is unchanged (still `collectionKey, paletteKey` only) |
| `schedule_sync` persistence | ✅ Toggled `false` after publish, confirmed via `get_my_website` — previously silently stayed at its old value |

## Full Lifecycle Validation

Every step requested, run in sequence against one real test site:

1. **Create** — succeeded.
2. **Save** — content persisted.
3. **Refresh the Studio** (`get_my_website`) — all fields, including the newly-restored ones, read back correctly.
4. **Edit existing content** — added a second content field.
5. **Save again** (true update path) — same `siteId`, both old and new content present, confirming the upsert's `do update` branch — not just its `insert` branch — works.
6. **Publish** — succeeded.
7. **Verify the public website** — full parity: theme, palette, font pairing, accent color, section order, content, all matched what was saved.
8. **Edit after publishing** — added a third content field and flipped `schedule_sync` to `false` in the same call.
9. **Unpublish** — the public RPC correctly reverted to `{"error": "not_found"}`.
10. **Republish** — succeeded; the public site reappeared with **every** field from every prior step intact: all three content fields, the original palette/font/section-order, and the `schedule_sync: false` from step 8 — nothing was lost or reset across the unpublish/republish cycle.

## Regression Results

One regression was found and fixed **during this same validation pass**, before it could ship as a false "done": migration 3's `create or replace function update_my_website(...)` added a 14th parameter (`p_schedule_sync`), which does not match the prior 13-parameter signature exactly — the identical "`CREATE OR REPLACE` doesn't replace across differing signatures" root cause this whole stabilization exists to close. A direct `pg_proc` query after applying migration 3 showed two live `update_my_website` overloads, not one. A fourth, corrective migration dropped the now-genuinely-dead 13-parameter version. Re-verified afterward: exactly one overload each for `get_wedding_website` and `update_my_website`, and the in-progress test site was unaffected by the correction. Noting this plainly rather than omitting it — it's a direct demonstration of why the live re-validation step matters, not just a design review.

No other regressions found:
- `resolveTheme()` is byte-for-byte unchanged — Font Pairing rendering was not touched, per the explicit instruction.
- `tsc --noEmit` clean, aside from the same two pre-existing, unrelated stale `.next` type-validator entries present before this work began (confirmed via grep — they reference routes that don't exist in the source tree).
- The bridal-party photo gap, the two RSVP surfaces, plaintext password storage, and the dead `sections_enabled` plumbing are all untouched, as scoped.

## Remaining Deferred Enhancements

Unchanged from the stabilization plan's Scope Boundary — none of these were touched, and none block calling the feature stabilized:

- Font Pairing's *visual* application (`resolveTheme()` still has no logic to consume it — the data now flows correctly, nothing renders differently yet).
- Bridal-party photo upload UI.
- Unifying the two RSVP surfaces / a "preview as this guest" mode.
- Plaintext password storage and comparison — a real, separate security gap, tracked but intentionally not part of an operational-stabilization pass.
- Dead `sections_enabled` plumbing.
- The full data-integration, typography-system, motion, and composition direction from the paused Wedding Website Redesign initiative.

## Final Stabilization Recommendation: **Stabilized**

All three confirmed implementation defects are fixed, live-validated against the original acceptance criteria plus the full ten-step lifecycle, with one self-corrected regression along the way and no others found. The Studio can now create, save, edit, publish, unpublish, and republish a wedding website, with every customization field surviving the full cycle intact, and the public site now genuinely reflects what a couple configures. All test data was created through real application workflows and fully removed, verified at zero.

Wedding Website Stabilization is formally closed. The decision on whether to proceed with the remaining Wedding Website Product Enhancements — or continue the broader Product Completion roadmap first — is yours to make next.
