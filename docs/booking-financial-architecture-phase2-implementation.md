# Booking Financial Architecture — Phase 2 Implementation Record

**Status: shipped and verified.** Event Order authoring, per `docs/booking-financial-architecture-roadmap.md`. Sixth document in the series.

## What shipped

- **Schema** (`supabase/migrations/20260923000000_event_order_foundation.sql`): `event_orders`, `event_order_sections`, `event_order_lines`, `event_order_activities`, plus `venues.event_order_enabled` (the same staged-rollout flag pattern already proven for the Communication Platform migration). RLS + explicit grants on every new table, matching the codebase's established `current_user_venue_id()` pattern exactly.
- **`lib/event-orders/*`** — types, repository, service. The Open → Finalized → Amended lifecycle is a two-value stored `status` plus a `revision` counter, never a three-value enum, exactly as specified in the domain model document — `eventOrderDisplayStatus()` derives "Amended" (`status = 'open' and revision > 0`) at read time so there's nothing for a raw column and a display label to ever disagree about.
- **One guard, `assertOpen()`, checked at the top of every mutation** — a Finalized Event Order is locked; every add/remove of a section or line rejects with a clear message until it's explicitly reopened. This is application-layer only (no DB constraint), matching how this codebase already enforces Invoice's own draft-only-editable rule.
- **UI**: a new "Event Order" tab on the Booking Workspace, gated by `venues.event_order_enabled` (default off — invisible unless a venue is switched on, same as `conversationExperienceEnabled`). Sections are optional; an "Add Line" sheet offers Package / Inventory / Custom sources; Package seeding produces one bundled line at `packages.base_price` (Phase 6 territory: itemized per-item pricing, not built here).
- **Zero repoints.** Existing Invoice line-item entry, the invoice's own package quick-pick, and Floor Plan placement are completely untouched — exactly as the roadmap specified for this phase.

## Applying "which module owns this" — concrete resolutions, not silent defaults

Per your instruction to continually evaluate this rather than let existing modules keep deciding by default, here are the specific calls made during this build:

- **Section removal vs. its Lines.** A Section is a grouping, not an owner. Removing one unsets `section_id` on every line it contained and deletes only the Section row — the lines survive, unsectioned, exactly as the domain model document specified. This was verified directly against the real database (see below), not just asserted in code.
- **Package price at the moment a line is added.** `packages.base_price` is read once, copied into the new line's frozen `unit_price`, and never referenced again. Package remains the sole owner of the *catalog* price; the Event Order line becomes the sole owner of *this booking's* price the instant it's added. This is Catalog vs. Commitment's first real application in actual code, not just the design document's prose.
- **Inventory pricing stayed entirely out of Event Order's reach in this phase.** `inventory_items` has no price column yet — deliberately not added in this migration (see "Scoping," below) — so an inventory-referenced line requires a manually typed price every time, with zero smart pre-fill. Inventory owns nothing about pricing in Phase 2; that ownership only begins in Phase 6, on purpose.
- **The running total shown in the Event Order panel is Event Order's own number, not a stand-in for a future Invoice total.** It's a straight sum of this Event Order's lines — no tax, no fees, nothing money-mechanics-flavored. I named this explicitly in the type's own comment (`lib/event-orders/types.ts`) so nobody mistakes it for the Invoice total Phase 3 will introduce.
- **Floor Plan correspondence got its schema column now, its logic later.** `event_order_sections.floor_plan_id` exists starting in this migration (cheap, additive, avoids a second migration touching this table in Phase 4) but nothing reads or writes it yet — Floor Plan itself is completely untouched in this phase. Flagging this explicitly since it's the one place this phase's migration reaches slightly ahead of this phase's own UI, and I want that visible rather than silent.

## A new architectural finding, surfaced rather than silently applied

Building `removeSection` surfaced a principle distinct from both "Catalog vs. Commitment" and "Copy at Commitment" — worth naming on its own:

> **Grouping is disposable, commitments are not.** A Section is purely organizational — it exists to make a complex Event Order easier to build, read, and reconcile against a Floor Plan. A Line is a real, committed decision about what this event will receive. Deleting an organizational construct must never delete the substantive thing it was organizing; it may only clear the reference. The same shape will recur anywhere else this platform groups real commitments for convenience (a Playbook Milestone grouping Tasks, a Timeline Section grouping Entries) — worth checking, next time one of those gets touched, that removing the group doesn't secretly cascade into deleting what it grouped.

This is genuinely different from the other two named principles: Copy at Commitment is about *when* a value freezes; Catalog vs. Commitment is about *which entities* are safe to edit freely; this one is about *organizational structures never being load-bearing for whether something still exists*.

## Scoping decisions made during implementation

- **Phase 0's schema was never built as its own phase** — Phase 1 needed none of it, so this is the first migration in the series. I narrowed its scope to only what Phase 2 itself uses: `package_items.unit_price`, `inventory_items.default_price`, and `invoices.event_order_id` (all originally grouped into "Phase 0" in the roadmap) are deliberately **not** added yet — they'll ship in Phase 6's and Phase 3's own migrations, when something actually reads them. No nullable column sits unused for two phases waiting on a later one.
- **No line-editing UI** — quantity or price changes are remove-and-re-add, not edit-in-place. This isn't a shortcut; it mirrors the Invoice line-item editor's own established interaction exactly (`components/invoices/invoice-line-items-editor.tsx` has never had in-place editing either, only add/remove), so Event Order doesn't introduce a second, inconsistent editing pattern into the product.
- **No section rename or drag-to-reorder UI.** Sections get a name at creation and a fixed creation-order `sort_order`. Real, but small, gaps a coordinator will likely ask for once this ships — noted as the most likely first polish request, not built speculatively ahead of that ask.
- **`ensureEventOrder` is idempotent** — calling it against an Event that already has one just returns the existing id rather than erroring or duplicating, since the "Start Event Order" button has no way to know in advance whether one already exists on a stale page.

## Migration history bugs found and fixed while enabling this phase

Applying this migration required running `supabase db reset --local` for what turned out to be the first time this project's full migration history had ever been replayed start-to-finish. It failed three times, on three unrelated, pre-existing bugs — none connected to Event Order itself. Per your explicit request, documenting the reasoning for each rather than treating them as incidental:

1. **`20260708120000_sprint107_team_collaboration.sql` referenced `venue_notifications`**, a table not created until the later-numbered `20260709000000_sprint85_notifications_center.sql`. Confirmed via `git log` that both files are untouched, historical commits — sprint107 genuinely creates RLS policies directly on `venue_notifications` (lines 609-616 of that file), a real structural dependency, not a coincidental reference. **Fix**: renamed `sprint85_notifications_center.sql`'s timestamp to `20260708110000`, just before sprint107, so migration-replay order matches actual dependency order. This corrects the historical record for every future fresh database, not just this local one.
2. **The same file also referenced `venue_notification_preferences`**, created even later, in `20260710000000_sprint86_notification_preferences.sql`. Same diagnosis, same fix: renamed to `20260708115000`, after sprint85's new slot, still before sprint107. Verified via a repo-wide scan (every `on public.X` / `references public.X` pattern across every migration file, checked against each table's actual creation timestamp) that this was the *only* remaining forward-dependency of this kind anywhere in the migration history — not a spot-fix, a checked one.
3. **`20260710100000_sprint86_global_search.sql` had genuinely stale content**, not an ordering bug — it builds a search index and query against `vendors.name`, a column `20260706110000_sprint104_5_vendor_foundation.sql` had already correctly, earlier renamed to `business_name` (and removed `vendors.venue_id` entirely in favor of a `venue_vendor_relationships` join table). The migration's *timestamp* was already correct; its *SQL* was written against a schema shape that no longer existed by the time it would actually run. **Fix**: updated the index expression and the search function's Vendors branch to use `business_name` and join through `venue_vendor_relationships`, mirroring the exact join shape already established and working in `get_couple_recommended_vendors` (same file, `20260706110000`, lines ~748-753) rather than inventing a new pattern.
4. **`20260711000000_sprint108_5_beta_command_center.sql` and `20260711000001_sprint108_5_beta_command_center.sql` were byte-for-byte identical duplicate files** (confirmed via `diff` — zero output — and `git log`, both present since the same historical commit). Deleted the redundant second copy.

All four were confirmed pre-existing via git history before being touched, and the local database was fully rebuilt from a clean `db reset` afterward to prove the complete chain now replays correctly, not just far enough to unblock Event Order.

## Verified

- `tsc --noEmit` and `eslint` clean on every new and touched file (two pre-existing, unrelated issues in `event-detail.tsx` reconfirmed via `git diff` as predating this phase).
- `supabase db reset --local` completes cleanly from an empty database through all 100+ migrations, including this phase's new one — the first time this has ever been proven end-to-end for this project.
- Real-data verification, run as the simulated `authenticated` role (not superuser) via `SET LOCAL request.jwt.claims` — the same discipline used for Coordinator Tour Scheduling's verification — not just as a superuser bypassing RLS entirely:
  - Full lifecycle: start an Event Order, add a section, add a package-derived line (frozen at `base_price`), an inventory-derived line (manually priced), and a custom line; confirmed the running total sums correctly; removed the section and confirmed its lines survived, unsectioned, never deleted; finalized (status/revision/`finalized_at` all persisted correctly); reopened (confirmed it now displays as "Amended," not "Open," per the revision-based derivation).
  - **Cross-venue RLS isolation**, tested from a second, genuinely separate venue's simulated owner session: confirmed zero visibility into the first venue's Event Order rows, and confirmed a direct attempt to insert a row claiming the first venue's `venue_id` while authenticated as the second venue's owner is rejected by the RLS `with check` clause, not merely hidden on read.
  - All test data (including the second venue and its owner) cleaned up afterward; confirmed zero leftover rows.

## Not in this phase, on purpose

- Invoice does not read from Event Order yet — that's Phase 3, the highest-stakes phase in the roadmap, deliberately not started early.
- Floor Plan does not reconcile against `event_order_sections.floor_plan_id` yet — Phase 4.
- No itemized package pricing, no inventory default pricing — Phase 6.
- No `EventOrder.Finalized` Platform Event, no automation — Phase 7.

## Ready for Phase 3

The platform is fully functional for every existing workflow — nothing about Invoice, Package, Floor Plan, or Payments changed behavior in this phase. Coordinators at a venue with `event_order_enabled` off see nothing different at all. Phase 3 (Invoice repoints to read from Event Order) is next, whenever you're ready — and per the roadmap's own risk callout, it's the one phase I'd want the most rigor on before calling it done.
