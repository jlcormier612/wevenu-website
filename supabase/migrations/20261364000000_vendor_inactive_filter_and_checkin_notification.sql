-- Phase 1 Vendor Network repair:
-- 1) Replace stale venue_vendor_relationships status <> 'removed' predicates
--    (terminal state is 'inactive' since 20260723000000).
-- 2) Fix vendor check-in notification trigger to use vendors.business_name.
--
-- Semantics applied per call site:
--   Client directory / new pick  → status <> 'inactive'  (invited + active)
--   Vendor active-venue hero     → status <> 'inactive'
--   Vendor partnerships list     → all statuses (historical; status returned)
--   Venue health RLS             → status <> 'inactive'
--   Recommendations list         → hide inactive venue-sourced rows unless
--                                  already selected or assigned (history)

-- ── Couple directory pick ───────────────────────────────────────────────────
create or replace function public.toggle_directory_vendor_pick(
  p_access_token text,
  p_client_id uuid,
  p_vendor_id uuid,
  p_picked boolean
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_session_venue_id uuid;
  v_event_id uuid;
  v_rec_id uuid;
  v_picked_at timestamptz;
begin
  select s.venue_id into v_session_venue_id
  from public.client_portal_sessions s
  where s.access_token = p_access_token and (s.expires_at is null or s.expires_at > now());
  if v_session_venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  if not exists (
    select 1 from public.clients c
    where c.id = p_client_id and c.venue_id = v_session_venue_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  -- Approved directory only: invited or active (never inactive).
  if not exists (
    select 1 from public.venue_vendor_relationships vvr
    where vvr.venue_id = v_session_venue_id
      and vvr.vendor_id = p_vendor_id
      and vvr.status <> 'inactive'
  ) then
    return jsonb_build_object('ok', false, 'error', 'not_in_directory');
  end if;

  select e.id into v_event_id
  from public.events e
  where e.client_id = p_client_id and e.venue_id = v_session_venue_id
    and e.status not in ('cancelled', 'complete')
  order by e.event_date
  limit 1;
  if v_event_id is null then
    return jsonb_build_object('ok', false, 'error', 'event_not_found');
  end if;

  select id into v_rec_id
  from public.event_vendor_recommendations
  where event_id = v_event_id and vendor_id = p_vendor_id;

  if v_rec_id is null then
    if not p_picked then
      return jsonb_build_object('ok', true, 'recommendationId', null, 'pickedAt', null);
    end if;
    insert into public.event_vendor_recommendations (
      venue_id, event_id, vendor_id, note, picked_at, source
    ) values (
      v_session_venue_id, v_event_id, p_vendor_id, null, now(), 'couple'
    )
    returning id, picked_at into v_rec_id, v_picked_at;
    return jsonb_build_object(
      'ok', true,
      'recommendationId', v_rec_id,
      'pickedAt', v_picked_at
    );
  end if;

  update public.event_vendor_recommendations
  set picked_at = case when p_picked then coalesce(picked_at, now()) else null end
  where id = v_rec_id
  returning picked_at into v_picked_at;

  return jsonb_build_object(
    'ok', true,
    'recommendationId', v_rec_id,
    'pickedAt', v_picked_at
  );
end;
$$;

-- ── Couple approved-vendor directory ────────────────────────────────────────
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
  where vvr.venue_id = v_session_venue_id and vvr.status <> 'inactive';

  return jsonb_build_object('vendors', coalesce(v_vendors, '[]'::jsonb));
end;
$$;

-- ── Recommended-for-you: preserve history, hide inactive venue-sourced ──────
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
    and (evr.source = 'venue' or evr.selected_at is not null or eva.id is not null)
    and (
      coalesce(vvr.status, 'inactive') <> 'inactive'
      or evr.selected_at is not null
      or eva.id is not null
    );

  return jsonb_build_object('recommendations', coalesce(v_recommendations, '[]'::jsonb));
end;
$$;

-- ── Vendor partnerships: keep historical inactive rows (status in payload) ──
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
        where vvr.vendor_id = v_vendor_id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

-- ── Vendor home immersion: never treat inactive as the active venue ─────────
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
  where vvr.vendor_id = v_vendor_id and vvr.status <> 'inactive'
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

-- ── Venue health RLS: non-inactive relationship ─────────────────────────────
drop policy if exists venues_see_vendor_health_scores on public.vendor_health_scores;
create policy venues_see_vendor_health_scores
  on public.vendor_health_scores for select
  using (
    exists (
      select 1 from public.venue_vendor_relationships vvr
      join public.venues v on v.id = vvr.venue_id
      where vvr.vendor_id = vendor_health_scores.vendor_id
        and vvr.status <> 'inactive'
        and v.owner_user_id = auth.uid()
    )
    or
    exists (
      select 1 from public.vendor_users vu
      where vu.vendor_id = vendor_health_scores.vendor_id
        and vu.user_id = auth.uid()
        and vu.is_active = true
    )
  );

-- Service role needs vendor_users for fixture/ops (table lacked GRANT).
grant select, insert, update, delete on public.vendor_users to service_role;

-- ── Arrival notification: use business_name (name column removed in 104.5) ──
-- Preserves existing semantics: only fires null → timestamp; clearing does not
-- notify; create_venue_notification failure semantics unchanged (perform).
create or replace function public._trigger_vendor_checkin_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor_name text;
begin
  if OLD.checked_in_at is not null then return NEW; end if;
  if NEW.checked_in_at is null then return NEW; end if;

  select business_name into v_vendor_name
  from public.vendors
  where id = NEW.vendor_id;

  perform public.create_venue_notification(
    NEW.venue_id,
    NEW.event_id,
    'vendor_checked_in',
    coalesce(v_vendor_name, 'Vendor') || ' has arrived',
    'Checked in and ready for setup',
    '/events/' || NEW.event_id::text || '/today',
    '🤝'
  );

  return NEW;
end;
$$;

notify pgrst, 'reload schema';
