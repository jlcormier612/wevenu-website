-- Program 4, Initiative C, Phases 8/10/16 (2026-07-23) — "venue-specific
-- promotions" is the one genuinely new concept the directive introduces.
-- It is a fact about one venue-vendor pairing, not the vendor's global
-- profile (which lives on `vendors`), so it belongs on the existing
-- `venue_vendor_relationships` row, not a new table.

alter table public.venue_vendor_relationships
  add column if not exists promotion_headline text,
  add column if not exists promotion_details text,
  add column if not exists promotion_updated_at timestamptz;

-- A Partner Vendor may edit their own promotion on a relationship the
-- Venue already created; the Venue keeps full control (status,
-- preference_level, display_order, notes) via the existing
-- "venues_manage_relationships" policy. Table-level UPDATE is already
-- granted to `authenticated` (confirmed 2026-07-23), so RLS is the only
-- gate here.
drop policy if exists "vendor_users_update_own_promotion" on public.venue_vendor_relationships;
create policy "vendor_users_update_own_promotion" on public.venue_vendor_relationships
  for update using (
    venue_vendor_relationships.vendor_id = public.current_user_vendor_id()
  );

-- RLS's WITH CHECK can only see the NEW row, not OLD, so it can't by
-- itself stop a vendor from reassigning their own row to a different
-- venue_id (which would inject unwanted content into another venue's
-- directory). A trigger is the only place OLD and NEW are both visible.
create or replace function public.prevent_vendor_relationship_reassignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_vendor_id() is not null
     and (new.venue_id is distinct from old.venue_id or new.vendor_id is distinct from old.vendor_id) then
    raise exception 'Vendors may not reassign a venue partnership.';
  end if;
  return new;
end;
$$;

drop trigger if exists vvr_prevent_vendor_reassignment on public.venue_vendor_relationships;
create trigger vvr_prevent_vendor_reassignment
  before update on public.venue_vendor_relationships
  for each row execute function public.prevent_vendor_relationship_reassignment();
