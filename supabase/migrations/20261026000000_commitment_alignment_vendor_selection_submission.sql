-- ============================================================================
-- Commitment Alignment Sprint — Vendor Selection Submission
--
-- docs/commitment-lifecycle-architecture.md §9: today, each vendor pick
-- reveals to the venue (and fires a venue notification) the instant the
-- couple clicks "Choose this vendor" — select_event_vendor_recommendation
-- sets selected_at = now() immediately, with no Submit gate at all.
--
-- Fix: split the couple's private choice from the venue-visible commitment.
-- picked_at (new) is the couple's own private draft state — freely
-- toggleable, never notifies, never visible to the venue. selected_at
-- (existing column, UNCHANGED meaning) becomes exclusively a Commitment
-- fact, now set only by submit_vendor_list — which means the existing
-- venue-facing UI (components/events/vendors/event-vendor-recommendations-
-- section.tsx's "Chosen by {clientName}" badge) and the existing
-- _trigger_vendor_selection_notification DB trigger both keep working
-- completely unchanged, since they already key off selected_at, not the
-- RPC that used to set it.
--
-- V1's shortlist model (multiple picks per category, not exclusive choice)
-- is preserved as-is — Submit commits the couple's whole current picked
-- set in one action, not a single choice.
-- ============================================================================

alter table public.event_vendor_recommendations
  add column picked_at timestamptz;

-- ── vendor_selection_submissions — append-only history, one row per Submit ──
create table public.vendor_selection_submissions (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients(id) on delete cascade,
  venue_id      uuid not null references public.venues(id) on delete cascade,
  event_id      uuid not null references public.events(id) on delete cascade,
  snapshot      jsonb not null,
  selected_count integer not null default 0,
  created_at    timestamptz not null default now()
);

create index vendor_selection_submissions_event on public.vendor_selection_submissions (event_id, created_at desc);

alter table public.vendor_selection_submissions enable row level security;

create policy vendor_selection_submissions_venue_select
  on public.vendor_selection_submissions for select
  using (venue_id = current_user_venue_id());

grant select on public.vendor_selection_submissions to authenticated;

-- ── toggle_vendor_pick — the couple's private Draft-stage action ────────────
create or replace function public.toggle_vendor_pick(p_access_token text, p_client_id uuid, p_recommendation_id uuid, p_picked boolean)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_session_venue_id uuid;
begin
  select s.venue_id into v_session_venue_id
  from public.client_portal_sessions s
  where s.access_token = p_access_token and (s.expires_at is null or s.expires_at > now());
  if v_session_venue_id is null then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;

  if not exists (select 1 from public.clients c where c.id = p_client_id and c.venue_id = v_session_venue_id) then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  update public.event_vendor_recommendations evr
  set picked_at = case when p_picked then coalesce(picked_at, now()) else null end
  from public.events e
  where evr.id = p_recommendation_id
    and evr.event_id = e.id
    and e.client_id = p_client_id
    and evr.venue_id = v_session_venue_id;

  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.toggle_vendor_pick(text, uuid, uuid, boolean) to anon, authenticated;

-- ── submit_vendor_list — the couple's Commitment Lifecycle Submit event ─────
-- Syncs selected_at to exactly match the current picked_at state (adds and
-- removes), so a resubmission is the full, current source of truth — same
-- shape as Guest List/Seating's resubmission behavior. Never mutates a
-- prior submission's snapshot; always inserts a new one.
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

  -- Commit: picked-but-not-yet-selected rows become selected now (this is
  -- the only write the existing venue-notification trigger ever fires on —
  -- unchanged, still correct); previously-selected rows the couple has
  -- since un-picked are cleared (the trigger's own null-check means this
  -- never fires a stale "selected" notification).
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

  return jsonb_build_object('ok', true, 'submissionId', v_submission_id, 'selectedCount', v_count);
end $$;

grant execute on function public.submit_vendor_list(text, uuid) to anon, authenticated;

-- ── get_event_vendor_recommendations — extended with the couple's own
--    private pickedAt state, alongside the existing venue-visible selectedAt ──
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
      'pickedAt',     evr.picked_at,
      'selectedAt',   evr.selected_at
    ) order by vnd.category, vnd.business_name
  ), '[]'::jsonb) into v_recommendations
  from public.event_vendor_recommendations evr
  join public.vendors vnd on vnd.id = evr.vendor_id
  where evr.event_id = v_event_id;

  return jsonb_build_object('recommendations', coalesce(v_recommendations, '[]'::jsonb));
end $$;

-- select_event_vendor_recommendation is fully superseded — its only caller
-- (app/api/portal/vendors/route.ts) now calls toggle_vendor_pick, and its
-- old immediate-reveal behavior is exactly the gap this migration closes.
-- Confirmed no other callers before dropping.
drop function if exists public.select_event_vendor_recommendation(text, uuid, uuid);

notify pgrst, 'reload schema';
