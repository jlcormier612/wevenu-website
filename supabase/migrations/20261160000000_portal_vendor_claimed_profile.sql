-- Program 4, Initiative C, Phase 8 (2026-07-23) — "If a Vendor has claimed
-- their profile, display: Expanded gallery, Packages, Venue-specific
-- promotions, FAQs, Availability, Social links, Contact information. If
-- not claimed, display the Venue-authored version." get_event_vendor_
-- recommendations previously returned the same flat shape regardless of
-- claim state; this adds isClaimed plus the claimed-only fields (null/[]
-- when unclaimed, so the couple UI can key off isClaimed alone).

create or replace function public.get_event_vendor_recommendations(p_access_token text, p_client_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_venue_id uuid;
  v_event_id         uuid;
  v_recommendations  jsonb;
begin
  select s.venue_id into v_session_venue_id
  from public.client_portal_sessions s
  where s.access_token = p_access_token and (s.expires_at is null or s.expires_at > now());

  if v_session_venue_id is null then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  if not exists (
    select 1 from public.clients c
    where c.id = p_client_id and c.venue_id = v_session_venue_id
  ) then
    return jsonb_build_object('error', 'unauthorized');
  end if;

  select e.id into v_event_id
  from public.events e
  where e.client_id = p_client_id and e.venue_id = v_session_venue_id
    and e.status not in ('cancelled', 'complete')
  order by e.event_date
  limit 1;

  if v_event_id is null then
    return jsonb_build_object('recommendations', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',           evr.id,
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
      'note',         evr.note,
      'pickedAt',     evr.picked_at,
      'selectedAt',   evr.selected_at,
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
    ) order by vnd.category, vnd.business_name
  ), '[]'::jsonb) into v_recommendations
  from public.event_vendor_recommendations evr
  join public.vendors vnd on vnd.id = evr.vendor_id
  left join public.venue_vendor_relationships vvr on vvr.vendor_id = vnd.id and vvr.venue_id = v_session_venue_id
  where evr.event_id = v_event_id;

  return jsonb_build_object('recommendations', coalesce(v_recommendations, '[]'::jsonb));
end;
$$;
