-- ============================================================================
-- Sprint 71 — Vendor Recommendations
-- Extends the vendor directory with couple-facing display fields and
-- replaces the binary is_preferred with a three-tier preference_level.
-- Adds a portal RPC so couples can discover their venue's preferred vendors.
-- ============================================================================

alter table public.vendors
  add column if not exists description      text,
  add column if not exists photo_url        text,
  add column if not exists pricing_tier     text
    check (pricing_tier in ('budget', 'moderate', 'luxury')),
  add column if not exists preference_level text not null default 'recommended'
    check (preference_level in ('featured', 'preferred', 'recommended')),
  add column if not exists display_order    integer not null default 0,
  add column if not exists is_active        boolean not null default true;

-- Migrate existing preferred flag into the new tier column
update public.vendors
   set preference_level = 'preferred'
 where is_preferred = true;

-- Index for portal queries (venue → active, sorted by tier then order)
create index if not exists vendors_portal
  on public.vendors (venue_id, is_active, preference_level, display_order, name);

-- ── Portal RPC ────────────────────────────────────────────────────────────────

create or replace function public.get_portal_vendors(p_token text)
returns jsonb
language plpgsql security definer
as $$
declare
  v_venue_id   uuid;
  v_event_date date;
begin
  select v.id, e.event_date
    into v_venue_id, v_event_date
    from client_portal_sessions cps
    join events  e on e.id = cps.event_id
    join venues  v on v.id = e.venue_id
   where cps.token = p_token
     and cps.expires_at > now()
   limit 1;

  if v_venue_id is null then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  return jsonb_build_object(
    'daysUntilWedding', (v_event_date - current_date)::integer,
    'vendors', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id',              vnd.id,
          'name',            vnd.name,
          'category',        vnd.category,
          'preferenceLevel', vnd.preference_level,
          'description',     vnd.description,
          'photoUrl',        vnd.photo_url,
          'websiteUrl',      vnd.website,
          'instagramUrl',    vnd.instagram_url,
          'pricingTier',     vnd.pricing_tier,
          'email',           vnd.email
        ) order by
          case vnd.preference_level
            when 'featured'  then 1
            when 'preferred' then 2
            else                  3
          end,
          vnd.display_order,
          vnd.name
      ), '[]'::jsonb)
      from public.vendors vnd
     where vnd.venue_id = v_venue_id
       and vnd.is_active = true
    )
  );
end;
$$;

grant execute on function public.get_portal_vendors(text) to anon, authenticated;

notify pgrst, 'reload schema';
