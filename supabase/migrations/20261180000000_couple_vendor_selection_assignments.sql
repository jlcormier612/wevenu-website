-- ============================================================================
-- Couple vendor selection → operational assignment (venue-preferred model)
--
-- Closes the gap where couple Submit only wrote a shortlist
-- (event_vendor_recommendations.selected_at) while venue Assign created
-- event_vendor_assignments (conversation trigger, availability, invites).
--
-- Also lets couples pick from the full preferred directory ("All Our Vendors"),
-- not only the event's Recommended for You list — picking upserts a
-- recommendation row (source='couple') so the existing submit path stays
-- the single Commitment gate.
--
-- Messaging: venue↔vendor thread provisions via existing AFTER INSERT trigger
-- event_vendor_assignments_provision_conversation. Creates venue↔vendor and
-- (via 20261181000000) couple↔vendor threads. Couple Messages stays
-- venue-only; assigned vendors are messaged from Preferred Vendors.
-- ============================================================================

-- Who originated the recommendation row: venue curation vs couple directory pick.
alter table public.event_vendor_recommendations
  add column if not exists source text not null default 'venue'
    check (source in ('venue', 'couple'));

-- ── Directory pick — upsert recommendation + private picked_at ──────────────
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

  -- Vendor must be on the venue's preferred network (not a global marketplace).
  if not exists (
    select 1 from public.venue_vendor_relationships vvr
    where vvr.venue_id = v_session_venue_id
      and vvr.vendor_id = p_vendor_id
      and vvr.status <> 'removed'
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

grant execute on function public.toggle_directory_vendor_pick(text, uuid, uuid, boolean)
  to anon, authenticated;

-- ── Directory read — join pick / selection / assignment for this couple ─────
drop function if exists public.get_venue_vendor_directory(text);

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
      'instagramUrl',     vnd.instagram_url,
      'facebookUrl',      vnd.facebook_url,
      'pinterestUrl',     vnd.pinterest_url,
      'tiktokUrl',        vnd.tiktok_url,
      'preferenceLevel',  vvr.preference_level,
      'recommendationId', evr.id,
      'pickedAt',         evr.picked_at,
      'selectedAt',       evr.selected_at,
      'isAssigned',       (eva.id is not null),
      'assignmentId',     eva.id,
      'isClaimed',        vnd.is_claimed,
      'heroImageUrl',     case when vnd.is_claimed then vnd.hero_image_url else null end,
      'coverImageUrl',    case when vnd.is_claimed then vnd.cover_image_url else null end,
      'pricingTier',      case when vnd.is_claimed then vnd.pricing_tier else null end,
      'serviceArea',      case when vnd.is_claimed then vnd.service_area else null end,
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

grant execute on function public.get_venue_vendor_directory(text, uuid) to anon, authenticated;

-- ── Recommendations — include source + assignment state for team UI ─────────
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
      'source',       evr.source,
      'pickedAt',     evr.picked_at,
      'selectedAt',   evr.selected_at,
      'isAssigned',   (eva.id is not null),
      'assignmentId', eva.id,
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
  left join public.venue_vendor_relationships vvr
    on vvr.vendor_id = vnd.id and vvr.venue_id = v_session_venue_id
  left join public.event_vendor_assignments eva
    on eva.vendor_id = vnd.id and eva.event_id = v_event_id
  where evr.event_id = v_event_id
    -- Recommended tab stays venue-curated; couple directory drafts stay on
    -- All Our Vendors until Submit (then selected/assigned still visible here).
    and (evr.source = 'venue' or evr.selected_at is not null or eva.id is not null);

  return jsonb_build_object('recommendations', coalesce(v_recommendations, '[]'::jsonb));
end;
$$;

-- ── Submit — shortlist Commitment + idempotent assignments ──────────────────
-- Conversation auto-provisions via existing AFTER INSERT trigger
-- event_vendor_assignments_provision_conversation (20261114000000).
create or replace function public.submit_vendor_list(p_access_token text, p_client_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_session_venue_id uuid;
  v_event_id  uuid;
  v_snapshot  jsonb;
  v_count     integer;
  v_submission_id uuid;
  v_completed_task_id uuid;
  v_newly_assigned jsonb;
begin
  select s.venue_id into v_session_venue_id
  from public.client_portal_sessions s
  where s.access_token = p_access_token and (s.expires_at is null or s.expires_at > now());
  if v_session_venue_id is null then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;

  if not exists (select 1 from public.clients c where c.id = p_client_id and c.venue_id = v_session_venue_id) then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  select e.id into v_event_id
  from public.events e
  where e.client_id = p_client_id and e.venue_id = v_session_venue_id
    and e.status not in ('cancelled', 'complete')
  order by e.event_date limit 1;
  if v_event_id is null then return jsonb_build_object('ok', false, 'error', 'event_not_found'); end if;

  -- Commit shortlist: picked ↔ selected (venue notification trigger keys off selected_at).
  update public.event_vendor_recommendations
  set selected_at = case when picked_at is not null then coalesce(selected_at, now()) else null end
  where event_id = v_event_id and venue_id = v_session_venue_id
    and (picked_at is not null) != (selected_at is not null);

  select
    coalesce(jsonb_agg(jsonb_build_object(
      'recommendationId', evr.id, 'vendorId', vnd.id, 'vendorName', vnd.business_name,
      'category', vnd.category, 'note', evr.note
    ) order by vnd.category, vnd.business_name), '[]'::jsonb),
    count(*)
  into v_snapshot, v_count
  from public.event_vendor_recommendations evr
  join public.vendors vnd on vnd.id = evr.vendor_id
  where evr.event_id = v_event_id and evr.venue_id = v_session_venue_id and evr.selected_at is not null;

  insert into public.vendor_selection_submissions (client_id, venue_id, event_id, snapshot, selected_count)
  values (p_client_id, v_session_venue_id, v_event_id, v_snapshot, v_count)
  returning id into v_submission_id;

  -- Idempotent assignments for every currently-selected vendor. Does NOT
  -- remove assignments when a couple unpicks+resubmits — venue may already
  -- be coordinating. Unique (event_id, vendor_id) makes re-submit a no-op.
  with inserted as (
    insert into public.event_vendor_assignments (venue_id, event_id, vendor_id, notes)
    select v_session_venue_id, v_event_id, evr.vendor_id, 'Selected by couple'
    from public.event_vendor_recommendations evr
    where evr.event_id = v_event_id
      and evr.venue_id = v_session_venue_id
      and evr.selected_at is not null
    on conflict (event_id, vendor_id) do nothing
    returning id, vendor_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'assignmentId', i.id,
    'vendorId', i.vendor_id
  )), '[]'::jsonb)
  into v_newly_assigned
  from inserted i;

  for v_completed_task_id in
    update public.event_tasks
    set status = 'complete', completed_at = now(), completed_by = 'system'
    where venue_id = v_session_venue_id and event_id = v_event_id
      and auto_complete_trigger = 'vendor_selected'
      and status in ('pending', 'blocked', 'overdue')
    returning id
  loop
    update public.event_tasks
    set status = 'pending'
    where depends_on_event_task_id = v_completed_task_id and status = 'blocked' and venue_id = v_session_venue_id;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'submissionId', v_submission_id,
    'selectedCount', v_count,
    'newlyAssigned', coalesce(v_newly_assigned, '[]'::jsonb),
    'eventId', v_event_id,
    'venueId', v_session_venue_id
  );
end;
$$;

notify pgrst, 'reload schema';
