-- Vendor Management — Next Iteration (2026-07-10), item 2 & 3.
--
-- A Recommendation is a distinct fact from an operational Assignment
-- (event_vendor_assignments): a recommendation is "here's a vendor we
-- suggest for this couple to consider," made before any decision, and any
-- number of vendors can be recommended (even within the same category —
-- three florist options is the whole point). An assignment is "this vendor
-- is confirmed and working this event" — a completely different, later,
-- operational fact. Keeping them as two tables keeps both honest; conflating
-- them would mean every recommended-but-not-chosen vendor shows up in
-- day-of operational views, which is wrong (confirmed with the user before
-- building this — see docs/ discussion, Vendor Management Next Iteration).

create table public.event_vendor_recommendations (
  id              uuid primary key default gen_random_uuid(),
  venue_id        uuid not null references public.venues (id) on delete cascade,
  event_id        uuid not null references public.events  (id) on delete cascade,
  vendor_id       uuid not null references public.vendors (id) on delete cascade,
  note            text,
  recommended_at  timestamptz not null default now(),
  -- Set once the client picks this one. Not exclusive across a category —
  -- V1 lets a couple select as many recommendations as they like; the
  -- coordinator interprets multiple selections as a shortlist.
  selected_at     timestamptz,
  created_at      timestamptz not null default now()
);

-- A vendor is only recommended once per event (re-recommending is a no-op,
-- not a second row) — same discipline as event_vendor_assignments.
create unique index evr_event_vendor on public.event_vendor_recommendations (event_id, vendor_id);
create index evr_event  on public.event_vendor_recommendations (event_id);
create index evr_venue  on public.event_vendor_recommendations (venue_id);

alter table public.event_vendor_recommendations enable row level security;

create policy event_vendor_recommendations_all on public.event_vendor_recommendations
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.event_vendor_recommendations to authenticated;

-- ── Portal RPCs — couple side, token-authenticated, same pattern as every ──
-- ── other portal read/write (get_portal_vendors, add_couple_todo, etc.)  ──

create or replace function public.get_event_vendor_recommendations(p_access_token text, p_client_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
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
      'selectedAt',   evr.selected_at
    ) order by vnd.category, vnd.business_name
  ), '[]'::jsonb) into v_recommendations
  from public.event_vendor_recommendations evr
  join public.vendors vnd on vnd.id = evr.vendor_id
  where evr.event_id = v_event_id;

  return jsonb_build_object('recommendations', coalesce(v_recommendations, '[]'::jsonb));
end $$;

grant execute on function public.get_event_vendor_recommendations(text, uuid) to anon, authenticated;

create or replace function public.select_event_vendor_recommendation(p_access_token text, p_client_id uuid, p_recommendation_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_session_venue_id uuid;
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

  update public.event_vendor_recommendations evr
  set selected_at = now()
  from public.events e
  where evr.id = p_recommendation_id
    and evr.event_id = e.id
    and e.client_id = p_client_id
    and evr.venue_id = v_session_venue_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.select_event_vendor_recommendation(text, uuid, uuid) to anon, authenticated;

-- ── Notify the venue the moment a couple selects a vendor ──────────────────
-- Same trigger-driven pattern as _trigger_rsvp_notification /
-- _trigger_new_lead_notification (20260709000000_sprint85_notifications_center.sql)
-- — the notification fires regardless of which code path performs the
-- selection, not just today's portal route.

create or replace function public._trigger_vendor_selection_notification()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_vendor_name text;
  v_event_name  text;
begin
  if new.selected_at is not null and old.selected_at is null then
    select business_name into v_vendor_name from public.vendors where id = new.vendor_id;
    select name into v_event_name from public.events where id = new.event_id;

    perform public.create_venue_notification(
      new.venue_id,
      new.event_id,
      'vendor_selected',
      'Vendor selected',
      coalesce(v_event_name, 'A couple') || ' selected ' || coalesce(v_vendor_name, 'a vendor') || ' from your recommendations.',
      '/events/' || new.event_id,
      '🤝'
    );
  end if;
  return new;
end $$;

create trigger vendor_selection_notification
  after update on public.event_vendor_recommendations
  for each row execute function public._trigger_vendor_selection_notification();
