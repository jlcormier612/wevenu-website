# Wedding Website Stabilization Plan

Status: **Plan only — no code written yet.** This is the review gate before implementation, per the working agreement: capability evaluation is paused, and this plan addresses only the confirmed implementation defects from `docs/wedding-website-product-capabilities-release-readiness-assessment.md` that prevent the feature from operating at all. It does not touch the Product Completion items, Engineering Cleanup items, or Product Decisions from that assessment — those remain explicitly deferred to the Wedding Website Product Enhancement initiative that follows this stabilization.

## Scope Boundary

Three confirmed defects meet the bar of "prevents normal operation," and only these three are addressed here:

1. The Studio cannot save anything, ever, for any couple.
2. The public site doesn't reflect the palette and section order a couple actually saved.
3. The "sync schedule from Booking Timeline" toggle silently fails to persist.

**Explicitly out of scope for this plan** (confirmed real, but none of them prevent a couple from creating, editing, saving, publishing, and having guests view a working site once the three defects above are fixed):
- Font Pairing having no visual effect — restoring the RPC field (part of Fix 2 below) is data-layer correctness; making `resolveTheme()` actually consume it and change typography is new rendering logic, not a restoration, and belongs to the Enhancement phase.
- No bridal-party photo upload UI.
- The two RSVP surfaces' inconsistent depth.
- Plaintext password storage/comparison — a real, separate security gap, not an operational-failure defect (the gate functions correctly today, just insecurely). Deferred, not dropped — worth its own dedicated pass, same treatment as the previously-flagged, still-open `luv_rollups`/`vendor_health_scores` RLS gap from earlier in this review series.
- Dead `sections_enabled` plumbing (no operational impact).
- All data-integration, typography-system, motion, and composition direction from the paused Redesign initiative.

---

## Defect 1 — The Studio cannot save anything

**Root cause.** `update_my_website`'s upsert is `insert into couple_websites (...) on conflict (client_id) do update ... returning id` (`supabase/migrations/20260701700000_sprint70_theme_palettes.sql:160-164`). This requires a unique constraint or index on `client_id`. None was ever created — `couple_websites` has a primary key on `id` and a unique index on `slug` only; `client_id` has a plain, non-unique index (`supabase/migrations/20260629100000_couple_website.sql:71-72`). Confirmed directly against the live database's `pg_constraint`/`pg_indexes`, not inferred. Every call fails with `42P10`.

**Fix.** Add the missing constraint. The domain model already assumes exactly one website per client — `get_my_website` looks up `where client_id = ... and venue_id = ...` expecting a single row, and the Studio has never offered a "second website" concept. The constraint the function was written assuming should simply exist:

```sql
alter table public.couple_websites
  add constraint couple_websites_client_id_key unique (client_id);
```

This is a pure schema addition. No application code changes, no RPC signature changes — `update_my_website` already assumes this constraint; it just needs to be real.

**Layer:** Database schema only.

---

## Defect 2 — Public site ignores the couple's saved palette and section order

**Root cause.** Sprint 70 added `themePalette`, `fontPairing`, `sectionOrder` to `get_wedding_website`'s return object and they worked. A later migration (`20260812000000_guest_timeline_publishing.sql`), whose stated purpose was unrelated (live Timeline-sync for the Schedule section), redefined the function from an older base and silently dropped all three fields — a regression, not a gap. Live-confirmed: a row with explicit `theme_palette`/`font_pairing`/`section_order` values returns none of them through the current public RPC, while `theme` and `accentColor` correctly pass through.

**Fix.** Restore the three fields to the current function's return object, without touching the Timeline-sync logic the later migration correctly added — this is a merge of the two prior versions' intent, not a revert:

```sql
-- inside get_wedding_website's jsonb_build_object(...), add:
'themePalette', v_site.theme_palette,
'fontPairing',  v_site.font_pairing,
'sectionOrder', v_site.section_order,
```

Two of these three have an **immediate, complete visual effect** the moment this ships, because the consuming code was already written correctly and has simply never received the data: `components/wedding-website/wedding-website.tsx:657` already calls `resolveTheme(site.theme, site.themePalette)`, and `:670` already falls back to `site.sectionOrder` when present. Restoring the field is the entire fix for palette and section order.

`fontPairing` is different: `resolveTheme()` has no parameter or logic for it at all (confirmed — its signature is `(collectionKey, paletteKey)` only). Restoring it to the RPC response is still worth doing here, for data-parity with `get_my_website` and so the type (`PublicWebsite`) matches reality — but it will have **no visible effect** until a future enhancement teaches `resolveTheme()` to consume it. That rendering work is explicitly deferred, per the Scope Boundary above; only the data-layer restoration happens now.

**Companion cleanup, same migration:** `get_wedding_website` currently exists as two co-existing overloads in the live schema (an older 2-parameter version and the current 4-parameter version), because `CREATE OR REPLACE FUNCTION` only replaces an exact signature match — every added parameter created a new overload instead of replacing the old one. The real app always calls the 4-parameter form and is unaffected, but the dead 2-parameter overload is a live landmine for any future caller that passes a partial argument set (confirmed live: it produces an unresolvable "ambiguous function" error). Drop it in the same migration:

```sql
drop function if exists public.get_wedding_website(text, text);
```

**Layer:** Database (RPC redefinition + overload cleanup). No application code changes — the consuming components already handle these fields correctly.

---

## Defect 3 — `schedule_sync` toggle doesn't persist

**Root cause.** Every other field on `couple_websites` is written exclusively through the `security definer` `update_my_website` RPC — the correct, established pattern for this domain (confirmed: no self-referencing RLS hazard exists here specifically because nothing bypasses that pattern, elsewhere). `schedule_sync` is the one exception: `app/api/portal/website/route.ts:54-61` does a direct `supabase.from("couple_websites").update({ schedule_sync })` call. The couple's session is a custom portal token, not Supabase Auth, so this request runs as `anon` — and `anon` has no UPDATE grant on this table at all. Live-confirmed: an `anon`-role write attempt returns an explicit `permission denied` error, and the route code doesn't check the update's error before returning success, so the couple sees no indication anything failed.

**Fix — bring it into the existing pattern rather than opening a new write path.** The architecturally consistent fix is adding `schedule_sync` as a normal parameter of `update_my_website`, exactly like every other field, not granting `anon` direct table access (which would be a step backward — the one write path this domain has kept consistently RPC-only):

```sql
-- add to update_my_website's parameter list:
p_schedule_sync boolean default null,
-- add to its body, alongside the other "if p_x is not null then update ..." blocks:
if p_schedule_sync is not null then
  update public.couple_websites set schedule_sync = p_schedule_sync, updated_at = now() where id = v_site_id;
end if;
```

**Companion cleanup, same migration:** `update_my_website` has the same multi-overload situation as `get_wedding_website` (three co-existing signatures from incremental `CREATE OR REPLACE` calls across Sprint 68/70). Drop the two superseded ones once the new 14-parameter version is in place.

**Application-layer change required** (the only one in this whole plan): `app/api/portal/website/route.ts` — remove the direct `.update()` block for `scheduleSync`, and instead pass `p_schedule_sync: scheduleSync ?? null` into the existing `update_my_website` RPC call alongside the other parameters.

**Layer:** Database (RPC signature + overload cleanup) + application (one route file, removing a workaround rather than adding one).

---

## Migration Summary

| # | File | Fixes | Type |
|---|---|---|---|
| 1 | `supabase/migrations/20261004000000_wedding_website_stabilization_client_unique.sql` | Defect 1 | Add unique constraint |
| 2 | `supabase/migrations/20261005000000_wedding_website_stabilization_public_rpc.sql` | Defect 2 | `get_wedding_website` redefine + drop stale overload |
| 3 | `supabase/migrations/20261006000000_wedding_website_stabilization_schedule_sync.sql` | Defect 3 | `update_my_website` redefine (+`p_schedule_sync`) + drop stale overloads |

Plus one application file: `app/api/portal/website/route.ts` (Defect 3's companion change).

All three migrations are independent of each other in terms of *creation* (none needs another to be created first), but Defect 1's constraint must exist for `update_my_website` to actually succeed end-to-end — so migration 1 should land before the acceptance testing below is run, regardless of file-apply order.

---

## Acceptance Criteria

Explicit pass/fail per the five operations named, tested live with a real client/portal-session, not a subjective read:

| Operation | Before | After (pass condition) |
|---|---|---|
| **Create** — first-ever Studio load for a couple with no existing website | `{"code":"42P10", ...}` — no row ever created | A `couple_websites` row is created, exactly once, no error |
| **Edit** — change one content field (e.g. Story text) | Fails the same way as Create (same broken upsert) | Saves without error; reading back via `get_my_website` returns the new value |
| **Save (repeat)** — a second save on the same, now-existing row | Fails identically (the bug isn't specific to first-creation) | Succeeds without error; confirms the fix holds under the real "row already exists" condition, not just the empty-table case |
| **Save (full customization)** — theme, theme_palette, accent_color, font_pairing, section_order, slug, password, schedule_sync all set in one pass | Would fail before reaching any field-level check | Every field persists; `get_my_website` reads back all of them correctly, including `schedule_sync` (previously silently lost) |
| **Publish** — toggle `isPublished` true, then resolve `/w/{slug}` | Unreachable (no row ever existed to publish) | The public route resolves the site; toggling `isPublished` false makes it correctly return not-found again |
| **Public rendering — palette** | A saved non-default palette never appears publicly | The public `get_wedding_website` response includes `themePalette`, and the rendered page visibly applies it (via the already-correct `resolveTheme` call) |
| **Public rendering — section order** | A saved custom order is always overridden by `DEFAULT_ORDER` | The public response includes `sectionOrder`, and the page renders sections in the saved order |
| **Public rendering — font pairing (data only)** | Field absent from the response entirely | Field is present and correct in the response — **visual application is explicitly not part of this criterion**, per the Scope Boundary |
| **`schedule_sync` persistence** | Toggling it in the Studio silently fails; reload shows the old value | Toggling it persists through a reload, confirmed via `get_my_website` |

---

## Validation Plan

Same live-testing methodology as every other phase of this review: a real client, event, and portal-session token, created through real app paths; every RPC called with the exact parameter shape the real route handlers use, not a convenience subset. Each row of the acceptance table above gets a real pass/fail, not an inferred one. All test data created for validation is fully removed afterward with a verified-empty final check, matching every prior phase.

After validation passes, `docs/wedding-website-product-capabilities-release-readiness-assessment.md`'s recommendation gets updated to reflect the stabilized baseline, and the Wedding Website Product Enhancement initiative begins from the previously-defined product vision (`docs/wedding-website-design-recommendation.md` and its v2) — none of which is affected by, or a dependency of, this stabilization plan.
