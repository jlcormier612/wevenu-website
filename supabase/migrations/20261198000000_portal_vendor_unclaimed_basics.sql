-- Couple portal preferred-vendor detail was missing venue-authored basics for
-- unclaimed vendors. Phase 8 (portal_vendor_claimed_profile) correctly gates
-- claimed-only richness (packages, FAQs, gallery, vendor-managed availability),
-- but venue-entered contact name and pricing tier belong on the couple-facing
-- card even before claim — same as website/email/phone/description.
--
-- Venue-specific promotion_headline/details are couple-facing partnership
-- copy (not special_pricing_note / notes, which stay venue-internal). Surface
-- them whenever set, claimed or not.
--
-- Intentionally still NOT returned: vvr.notes, vvr.special_pricing_note.

create or replace function public.get_venue_vendor_directory(
  p_access_token text,
  p_client_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_venue_id uuid;
  v_event_id uuid;
  v_vendors jsonb;
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

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',               vvr.id,
      'vendorId',         vnd.id,
      'name',             vnd.business_name,
      'category',         vnd.category,
      'description',      vnd.description,
      'photoUrl',         vnd.logo_url,
      'websiteUrl',       vnd.website_url,
      'email',            vnd.email,
      'phone',            vnd.phone,
      'contactName',      vnd.contact_name,
      'instagramUrl',     vnd.instagram_url,
      'facebookUrl',      vnd.facebook_url,
      'pinterestUrl',     vnd.pinterest_url,
      'tiktokUrl',        vnd.tiktok_url,
      'pricingTier',      vnd.pricing_tier,
      'preferenceLevel',  vvr.preference_level,
      'recommendationId', evr.id,
      'pickedAt',         evr.picked_at,
      'selectedAt',       evr.selected_at,
      'isAssigned',       (eva.id is not null),
      'assignmentId',     eva.id,
      'coupleVendorConversationId', (
        select c.id from public.conversations c
        where c.event_vendor_assignment_id = eva.id
          and c.conversation_kind = 'couple_vendor'
        limit 1
      ),
      'isClaimed',        vnd.is_claimed,
      'heroImageUrl',     case when vnd.is_claimed then vnd.hero_image_url else null end,
      'coverImageUrl',    case when vnd.is_claimed then vnd.cover_image_url else null end,
      'serviceArea',      case when vnd.is_claimed then vnd.service_area else null end,
      'availabilityNotes', case when vnd.is_claimed then vnd.availability_notes else null end,
      'promotionHeadline', vvr.promotion_headline,
      'promotionDetails',  vvr.promotion_details,
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
    ) order by case vvr.preference_level when 'featured' then 0 when 'preferred' then 1 else 2 end,
              vnd.category, vnd.business_name
  ), '[]'::jsonb) into v_vendors
  from public.venue_vendor_relationships vvr
  join public.vendors vnd on vnd.id = vvr.vendor_id
  left join public.event_vendor_recommendations evr
    on evr.vendor_id = vnd.id and evr.event_id = v_event_id
  left join public.event_vendor_assignments eva
    on eva.vendor_id = vnd.id and eva.event_id = v_event_id
  where vvr.venue_id = v_session_venue_id and vvr.status <> 'removed';

  return jsonb_build_object('vendors', coalesce(v_vendors, '[]'::jsonb));
end;
$$;

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
      'contactName',  vnd.contact_name,
      'instagramUrl', vnd.instagram_url,
      'facebookUrl',  vnd.facebook_url,
      'pinterestUrl', vnd.pinterest_url,
      'tiktokUrl',    vnd.tiktok_url,
      'pricingTier',  vnd.pricing_tier,
      'note',         evr.note,
      'source',       evr.source,
      'pickedAt',     evr.picked_at,
      'selectedAt',   evr.selected_at,
      'isAssigned',   (eva.id is not null),
      'assignmentId', eva.id,
      'coupleVendorConversationId', (
        select c.id from public.conversations c
        where c.event_vendor_assignment_id = eva.id
          and c.conversation_kind = 'couple_vendor'
        limit 1
      ),
      'isClaimed',    vnd.is_claimed,
      'heroImageUrl',  case when vnd.is_claimed then vnd.hero_image_url else null end,
      'coverImageUrl', case when vnd.is_claimed then vnd.cover_image_url else null end,
      'serviceArea',   case when vnd.is_claimed then vnd.service_area else null end,
      'availabilityNotes', case when vnd.is_claimed then vnd.availability_notes else null end,
      'promotionHeadline', vvr.promotion_headline,
      'promotionDetails',  vvr.promotion_details,
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
  left join public.venue_vendor_relationships vvr
    on vvr.vendor_id = vnd.id and vvr.venue_id = v_session_venue_id
  left join public.event_vendor_assignments eva
    on eva.vendor_id = vnd.id and eva.event_id = v_event_id
  where evr.event_id = v_event_id
    and (evr.source = 'venue' or evr.selected_at is not null or eva.id is not null);

  return jsonb_build_object('recommendations', coalesce(v_recommendations, '[]'::jsonb));
end;
$$;

notify pgrst, 'reload schema';
