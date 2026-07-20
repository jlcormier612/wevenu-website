-- ============================================================================
-- Timeline Implementation — Owner / Lock State / Visibility
-- docs/client-workspace-product-architecture.md §12 (approved 2026-07-16),
-- generalized by docs/commitment-lifecycle-architecture.md.
--
-- timeline_entries today has no Owner or Lock State at all — only a flat
-- `audiences` array (conflating coordinator/portal/guest visibility, per
-- docs/client-workspace-collaboration-architecture.md §9 Finding 6) and a
-- `client_editable` boolean. This migration adds the two missing axes,
-- reconciles the audiences vocabulary to the approved terms, and retires
-- client_editable (fully superseded by owner + lock_state).
-- ============================================================================

-- ---- Owner: who authored this item -----------------------------------------
-- "shared" deliberately omitted (approved 2026-07-17) — Delegation (§7)
-- already covers cross-party edit rights structurally; no worked example
-- for a third owner state exists anywhere in the approved design.
alter table public.timeline_entries
  add column owner text check (owner in ('venue', 'client'));

-- Backfill from the only existing proxy for authorship: a couple-created
-- row was always force-tagged audiences = {couple} by add_portal_timeline_entry.
update public.timeline_entries
set owner = case when 'couple' = any(audiences) then 'client' else 'venue' end;

alter table public.timeline_entries
  alter column owner set default 'venue',
  alter column owner set not null;

-- ---- Lock State: can this item be changed right now -------------------------
-- Venue-owned operational milestones are locked by default (the structural
-- skeleton the client plans inside of, per §12) — applied uniformly to
-- existing rows too, not just new ones, since it's a single consistent rule
-- and always one click to unlock. Client-owned rows default editable.
alter table public.timeline_entries
  add column lock_state text check (lock_state in ('editable', 'locked'));

update public.timeline_entries
set lock_state = case when owner = 'venue' then 'locked' else 'editable' end;

alter table public.timeline_entries
  alter column lock_state set default 'editable',
  alter column lock_state set not null;

-- ---- Visibility vocabulary reconciliation ------------------------------------
-- internal->venue, couple->client, guest->guests, vendor->vendors (matching
-- §12's own plural/singular terms exactly), wedding_party added (a genuine
-- new audience, not a rename), public dropped (confirmed dead: valid in the
-- old constraint/type, zero UI anywhere, never set by any real code path).
alter table public.timeline_entries drop constraint timeline_entries_audiences_check;

update public.timeline_entries
set audiences = coalesce((
  select array_agg(translated)
  from (
    select distinct case elem
      when 'internal' then 'venue'
      when 'couple'   then 'client'
      when 'guest'    then 'guests'
      when 'vendor'   then 'vendors'
      else null
    end as translated
    from unnest(audiences) as elem
  ) t
  where translated is not null
), '{}');

-- A row whose only old tag was the dropped 'public' value would otherwise
-- end up empty (visible to no one) — default it back to venue-only rather
-- than silently orphaning it.
update public.timeline_entries set audiences = '{venue}' where audiences = '{}';

alter table public.timeline_entries
  add constraint timeline_entries_audiences_check
    check (audiences <@ '{venue,client,wedding_party,guests,vendors}'::text[]);

alter table public.timeline_entries alter column audiences set default '{venue}';

-- Same vocabulary reconciliation on the reusable templates table.
alter table public.timeline_template_items drop constraint if exists timeline_template_items_audiences_check;

update public.timeline_template_items
set audiences = coalesce((
  select array_agg(translated)
  from (
    select distinct case elem
      when 'internal' then 'venue'
      when 'couple'   then 'client'
      when 'guest'    then 'guests'
      when 'vendor'   then 'vendors'
      else null
    end as translated
    from unnest(audiences) as elem
  ) t
  where translated is not null
), '{}');
update public.timeline_template_items set audiences = '{venue}' where audiences = '{}';

alter table public.timeline_template_items
  add constraint timeline_template_items_audiences_check
    check (audiences <@ '{venue,client,wedding_party,guests,vendors}'::text[]);

-- ---- client_editable retired --------------------------------------------------
-- Fully superseded by owner='client' AND lock_state='editable'.
alter table public.timeline_entries drop column client_editable;

-- Partial indexes on the old vocabulary values are now stale — replace.
drop index if exists timeline_entries_guest_facing;
drop index if exists timeline_entries_vendor_facing;
create index timeline_entries_guest_facing on public.timeline_entries (event_id) where 'guests' = any(audiences);
create index timeline_entries_vendor_facing on public.timeline_entries (event_id) where 'vendors' = any(audiences);
