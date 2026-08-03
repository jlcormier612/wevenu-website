-- ============================================================================
-- Couple Portal — venue's full preferred-vendor directory (2026-07-24)
--
-- "The entire vendor list that the venue builds should be available to the
-- client through this button in the portal — like the Venue Guide, nothing
-- needs to be sent or shared." get_event_vendor_recommendations
-- (Vendor Management — Next Iteration, 2026-07-10) was deliberately scoped
-- to vendors a coordinator explicitly recommends for THIS event — real,
-- and kept — but it means a venue's whole vetted vendor network
-- (venue_vendor_relationships, built once, venue-wide, the same list that
-- powers the vendor's own "Venue Partnerships"/Dashboard experience) never
-- reaches a couple unless a coordinator also re-recommends each vendor per
-- event. This adds a second, always-live read of that same network — same
-- pattern as get_portal_venue_team / get_venue_info_for_portal: resolve
-- the token, join server-side, return everything, no per-couple curation
-- step required.
-- ============================================================================

create or replace function public.get_venue_vendor_directory(p_access_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_venue_id uuid;
  v_vendors           jsonb;
begin
  select s.venue_id into v_session_venue_id
  from public.client_portal_sessions s
  where s.access_token = p_access_token and (s.expires_at is null or s.expires_at > now());

  if v_session_venue_id is null then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',           vvr.id,
      'vendorId',     vnd.id,
      'name',         vnd.business_name,
      'category',     vnd.category,
      'description',  vnd.description,
      'photoUrl',     vnd.logo_url,
      'websiteUrl',   vnd.website_url,
      'email',        vnd.email,
      'phone',        vnd.phone,
      'instagramUrl', vnd.instagram_url,
      'facebookUrl',  vnd.facebook_url,
      'pinterestUrl', vnd.pinterest_url,
      'tiktokUrl',    vnd.tiktok_url,
      'preferenceLevel', vvr.preference_level,
      'isClaimed',    vnd.is_claimed,
      'heroImageUrl',  case when vnd.is_claimed then vnd.hero_image_url else null end,
      'coverImageUrl', case when vnd.is_claimed then vnd.cover_image_url else null end,
      'pricingTier',   case when vnd.is_claimed then vnd.pricing_tier else null end,
      'serviceArea',   case when vnd.is_claimed then vnd.service_area else null end,
      'availabilityNotes', case when vnd.is_claimed then vnd.availability_notes else null end,
      'promotionHeadline', case when vnd.is_claimed then vvr.promotion_headline else null end,
      'promotionDetails',  case when vnd.is_claimed then vvr.promotion_details else null end,
      'packages', case when vnd.is_claimed then (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', p.id, 'name', p.name, 'description', p.description,
          'price', p.price, 'priceType', p.price_type
        ) order by p.sort_order), '[]'::jsonb)
        from public.vendor_packages p
        where p.vendor_id = vnd.id and p.is_active = true
      ) else '[]'::jsonb end,
      'faqs', case when vnd.is_claimed then (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', f.id, 'question', f.question, 'answer', f.answer
        ) order by f.sort_order), '[]'::jsonb)
        from public.vendor_faqs f
        where f.vendor_id = vnd.id
      ) else '[]'::jsonb end
    ) order by case vvr.preference_level when 'featured' then 0 when 'preferred' then 1 else 2 end, vnd.category, vnd.business_name
  ), '[]'::jsonb) into v_vendors
  from public.venue_vendor_relationships vvr
  join public.vendors vnd on vnd.id = vvr.vendor_id
  where vvr.venue_id = v_session_venue_id and vvr.status <> 'removed';

  return jsonb_build_object('vendors', coalesce(v_vendors, '[]'::jsonb));
end;
$$;

grant execute on function public.get_venue_vendor_directory(text) to anon, authenticated;
