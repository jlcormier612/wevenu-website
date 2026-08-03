-- ============================================================================
-- Vendor Venue-First Dashboard (2026-07-24)
--
-- "The vendor should always feel like they are working with a venue, not
-- browsing a marketplace." The vendor Home is being rebuilt to immerse the
-- vendor in their (usually singular) venue relationship — hero photo,
-- branding, partnership status, contacts, promotion — the same design
-- language the Couple Workspace dashboard already uses for its own venue
-- hero.
--
-- This migration also fixes a confirmed, 100%-reproducible bug: the
-- existing Venue Partnerships page (lib/vendor-partnerships/service.ts)
-- reads `venue_vendor_relationships` directly from the vendor's own
-- RLS-scoped session and embeds `venues(name, logo_url)` as a nested
-- PostgREST resource. venues' own RLS policy only recognizes
-- current_user_venue_id() (venue-staff sessions) — there is no policy
-- granting vendor sessions read access to venues directly. PostgREST
-- enforces the *joined* table's RLS using the caller's session, so the
-- embed silently returns null for every vendor, every relationship, 100%
-- of the time — hence every partnership card showing "Unknown Venue". Every
-- other vendor read in this codebase already avoids this exact trap by
-- joining venues *inside* a security definer function (get_vendor_events,
-- get_vendor_event_detail, etc.) — this migration brings Partnerships in
-- line with that established, working pattern instead of leaving it as a
-- second copy of a bug already fixed everywhere else.
-- ============================================================================

-- ── get_vendor_partnerships — replaces the direct-embed read in
--    lib/vendor-partnerships/service.ts. Same shape as VendorPartnership
--    (lib/vendors/types.ts), server-resolves venue name/logo instead of
--    relying on a client-session embed that can never succeed.
create or replace function public.get_vendor_partnerships()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor_id uuid;
begin
  v_vendor_id := current_user_vendor_id();
  if v_vendor_id is null then
    return '{"error":"unauthorized"}'::jsonb;
  end if;

  return jsonb_build_object(
    'partnerships', coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'id', vvr.id, 'venueId', vvr.venue_id, 'venueName', v.name, 'venueLogoUrl', v.logo_url,
          'status', vvr.status, 'preferenceLevel', vvr.preference_level, 'addedAt', vvr.added_at,
          'promotionHeadline', vvr.promotion_headline, 'promotionDetails', vvr.promotion_details,
          'activeEventCount', (
            select count(*) from public.event_vendor_assignments eva
            where eva.vendor_id = v_vendor_id and eva.venue_id = vvr.venue_id
          )
        ) order by vvr.added_at desc)
        from public.venue_vendor_relationships vvr
        join public.venues v on v.id = vvr.venue_id
        where vvr.vendor_id = v_vendor_id and vvr.status <> 'removed'
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.get_vendor_partnerships() to authenticated;

-- ── get_vendor_active_venue — the venue-hero/immersion data for one venue:
--    branding, this vendor's own partnership record with it, and the
--    venue's contact team. p_venue_id selects a specific relationship (for
--    the lightweight switcher, once a vendor has more than one); omitted
--    or not-owned-by-this-vendor falls back to the vendor's single most
--    recently added active relationship — the common single-venue case
--    needs zero picker UI to resolve correctly.
create or replace function public.get_vendor_active_venue(p_venue_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor_id uuid;
  v_relationship record;
begin
  v_vendor_id := current_user_vendor_id();
  if v_vendor_id is null then
    return '{"error":"unauthorized"}'::jsonb;
  end if;

  select vvr.* into v_relationship
  from public.venue_vendor_relationships vvr
  where vvr.vendor_id = v_vendor_id and vvr.status <> 'removed'
    and (p_venue_id is null or vvr.venue_id = p_venue_id)
  order by (vvr.venue_id = p_venue_id) desc nulls last, vvr.added_at desc
  limit 1;

  if v_relationship.id is null then
    return '{"error":"no_venue"}'::jsonb;
  end if;

  return jsonb_build_object(
    'venue', (
      select jsonb_build_object(
        'id', v.id, 'name', v.name, 'logoUrl', v.logo_url, 'heroImageUrl', v.hero_image_url,
        'primaryColor', v.primary_color, 'secondaryColor', v.secondary_color,
        'accentColor', v.accent_color, 'neutralColor', v.neutral_color, 'story', v.story
      )
      from public.venues v where v.id = v_relationship.venue_id
    ),
    'partnership', jsonb_build_object(
      'id', v_relationship.id, 'venueId', v_relationship.venue_id,
      'status', v_relationship.status, 'preferenceLevel', v_relationship.preference_level,
      'addedAt', v_relationship.added_at,
      'promotionHeadline', v_relationship.promotion_headline, 'promotionDetails', v_relationship.promotion_details,
      'activeEventCount', (
        select count(*) from public.event_vendor_assignments eva
        where eva.vendor_id = v_vendor_id and eva.venue_id = v_relationship.venue_id
      )
    ),
    'contacts', coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'id', s.id, 'fullName', s.full_name, 'title', s.title,
          'role', s.role, 'isOwner', s.is_owner, 'email', s.email
        ) order by s.is_owner desc, case s.role when 'owner' then 0 when 'manager' then 1 when 'coordinator' then 2 else 3 end, s.full_name)
        from public.venue_staff s
        where s.venue_id = v_relationship.venue_id and s.is_active = true
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.get_vendor_active_venue(uuid) to authenticated;
