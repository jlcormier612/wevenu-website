-- Sprint 108: Activation & Retention Engine
--
-- Creates:
--   1. engagement_events          — append-only event log
--   2. venue_activation_state     — denormalized first-X cache (write-once)
--   3. venue_milestones           — idempotent celebration tracking
--   4. venue_activation_scores    — computed score cache
--   5. venue_staff.last_active_at — team member activity tracking
--   6. venue_notification_preferences columns — digest opt-out + callout dismiss
--   7. record_engagement_event()  — write to log + update state atomically
--   8. compute_venue_activation_score() — reads one row, computes 100-pt score
--   9. check_relationship_milestones()  — fires celebrations after engagement events
--  10. get_beta_adoption_overview()     — cross-venue admin query (SECURITY DEFINER)
--  11. Backfill venue_activation_state from existing data
--
-- Phase labels (user spec):
--   0–39:   "Your Venue Setup"
--   40–69:  "Your Venue is Connected"
--   70–89:  "Almost Fully Connected"
--   90–100: "Fully Connected"

-- ── 1. engagement_events ──────────────────────────────────────────────────────

create table public.engagement_events (
  id          uuid        primary key default gen_random_uuid(),
  venue_id    uuid        not null references public.venues(id) on delete cascade,
  event_type  text        not null,
  actor_type  text        not null, -- 'venue_user' | 'couple' | 'vendor' | 'team_member'
  actor_id    uuid,
  entity_type text,
  entity_id   uuid,
  occurred_at timestamptz not null default now(),
  metadata    jsonb
);

create index engagement_events_venue_id_occurred_at
  on public.engagement_events (venue_id, occurred_at desc);
create index engagement_events_event_type
  on public.engagement_events (event_type);

alter table public.engagement_events enable row level security;

create policy "engagement_events_select"
  on public.engagement_events for select to authenticated
  using (venue_id = public.current_user_venue_id());

create policy "engagement_events_insert"
  on public.engagement_events for insert to authenticated
  with check (venue_id = public.current_user_venue_id());


-- ── 2. venue_activation_state ─────────────────────────────────────────────────

create table public.venue_activation_state (
  venue_id                      uuid primary key references public.venues(id) on delete cascade,

  -- Setup
  profile_completed_at          timestamptz,
  availability_configured_at    timestamptz,
  first_package_created_at      timestamptz,

  -- Couple engagement
  first_portal_invite_sent_at   timestamptz,
  first_portal_open_at          timestamptz,
  third_couple_portal_active_at timestamptz,

  -- Workflow
  first_contract_signed_at      timestamptz,
  first_invoice_paid_at         timestamptz,
  first_vendor_assigned_at      timestamptz,
  first_task_completed_at       timestamptz,

  -- Vendor
  first_vendor_accept_at        timestamptz,

  -- Team
  first_team_invite_sent_at     timestamptz,
  first_team_member_accept_at   timestamptz,
  first_team_member_login_at    timestamptz,
  team_member_active_14d_at     timestamptz,
  first_team_task_completed_at  timestamptz,

  -- Habit
  first_7_active_days_at        timestamptz,
  first_luv_action_at           timestamptz,

  -- Meta
  current_active_streak_days    integer     default 0,
  updated_at                    timestamptz default now()
);

alter table public.venue_activation_state enable row level security;

create policy "activation_state_select"
  on public.venue_activation_state for select to authenticated
  using (venue_id = public.current_user_venue_id());

create policy "activation_state_insert"
  on public.venue_activation_state for insert to authenticated
  with check (venue_id = public.current_user_venue_id());

create policy "activation_state_update"
  on public.venue_activation_state for update to authenticated
  using (venue_id = public.current_user_venue_id());


-- ── 3. venue_milestones ───────────────────────────────────────────────────────

create table public.venue_milestones (
  venue_id     uuid        not null references public.venues(id) on delete cascade,
  milestone_id text        not null,
  fired_at     timestamptz not null default now(),
  shown_at     timestamptz,
  metadata     jsonb,
  primary key (venue_id, milestone_id)
);

create index venue_milestones_venue_unshown
  on public.venue_milestones (venue_id, fired_at)
  where shown_at is null;

alter table public.venue_milestones enable row level security;

create policy "milestones_select"
  on public.venue_milestones for select to authenticated
  using (venue_id = public.current_user_venue_id());

create policy "milestones_update"
  on public.venue_milestones for update to authenticated
  using (venue_id = public.current_user_venue_id());
-- No direct insert or delete: milestones are fired by SECURITY DEFINER functions only.


-- ── 4. venue_activation_scores ───────────────────────────────────────────────

create table public.venue_activation_scores (
  venue_id         uuid primary key references public.venues(id) on delete cascade,
  score            integer     not null default 0,
  previous_score   integer,
  phase            text        not null default 'setup',
  phase_label      text        not null default 'Your Venue Setup',
  dimension_scores jsonb       not null default '{}',
  gaps             jsonb       not null default '[]',
  computed_at      timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.venue_activation_scores enable row level security;

create policy "activation_scores_select"
  on public.venue_activation_scores for select to authenticated
  using (venue_id = public.current_user_venue_id());


-- ── 5. Column additions ───────────────────────────────────────────────────────

alter table public.venue_staff
  add column if not exists last_active_at timestamptz;

alter table public.venue_notification_preferences
  add column if not exists daily_digest_enabled    boolean not null default true,
  add column if not exists digest_intro_dismissed  boolean not null default false,
  add column if not exists last_digest_hash        text,
  add column if not exists last_digest_sent_at     timestamptz;


-- ── 6. record_engagement_event ───────────────────────────────────────────────

create or replace function public.record_engagement_event(
  p_venue_id    uuid,
  p_event_type  text,
  p_actor_type  text,
  p_actor_id    uuid    default null,
  p_entity_type text    default null,
  p_entity_id   uuid    default null,
  p_metadata    jsonb   default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  insert into public.engagement_events
    (venue_id, event_type, actor_type, actor_id, entity_type, entity_id, metadata)
  values
    (p_venue_id, p_event_type, p_actor_type, p_actor_id, p_entity_type, p_entity_id, p_metadata)
  returning id into v_event_id;

  -- Ensure activation state row exists
  insert into public.venue_activation_state (venue_id)
  values (p_venue_id)
  on conflict (venue_id) do nothing;

  -- Write-once updates via COALESCE(existing, now())
  case p_event_type
    when 'couple.portal_invite_sent' then
      update public.venue_activation_state
      set first_portal_invite_sent_at = coalesce(first_portal_invite_sent_at, now()),
          updated_at = now()
      where venue_id = p_venue_id;
    when 'couple.portal_opened' then
      update public.venue_activation_state
      set first_portal_open_at = coalesce(first_portal_open_at, now()),
          updated_at = now()
      where venue_id = p_venue_id;
    when 'vendor.invitation_accepted' then
      update public.venue_activation_state
      set first_vendor_accept_at = coalesce(first_vendor_accept_at, now()),
          updated_at = now()
      where venue_id = p_venue_id;
    when 'contract.signed' then
      update public.venue_activation_state
      set first_contract_signed_at = coalesce(first_contract_signed_at, now()),
          updated_at = now()
      where venue_id = p_venue_id;
    when 'invoice.paid' then
      update public.venue_activation_state
      set first_invoice_paid_at = coalesce(first_invoice_paid_at, now()),
          updated_at = now()
      where venue_id = p_venue_id;
    when 'task.completed' then
      update public.venue_activation_state
      set first_task_completed_at = coalesce(first_task_completed_at, now()),
          updated_at = now()
      where venue_id = p_venue_id;
    when 'team.member_invited' then
      update public.venue_activation_state
      set first_team_invite_sent_at = coalesce(first_team_invite_sent_at, now()),
          updated_at = now()
      where venue_id = p_venue_id;
    when 'team.member_accepted' then
      update public.venue_activation_state
      set first_team_member_accept_at = coalesce(first_team_member_accept_at, now()),
          updated_at = now()
      where venue_id = p_venue_id;
    when 'team.member_first_login' then
      update public.venue_activation_state
      set first_team_member_login_at = coalesce(first_team_member_login_at, now()),
          updated_at = now()
      where venue_id = p_venue_id;
    when 'team.task_completed' then
      update public.venue_activation_state
      set first_team_task_completed_at = coalesce(first_team_task_completed_at, now()),
          updated_at = now()
      where venue_id = p_venue_id;
    when 'luv.recommendation_acted_on' then
      update public.venue_activation_state
      set first_luv_action_at = coalesce(first_luv_action_at, now()),
          updated_at = now()
      where venue_id = p_venue_id;
    else
      null;
  end case;

  return v_event_id;
end;
$$;


-- ── 7. compute_venue_activation_score ────────────────────────────────────────

create or replace function public.compute_venue_activation_score(p_venue_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state        public.venue_activation_state%rowtype;
  v_venue        public.venues%rowtype;
  v_prev_score   integer;

  v_dim1  integer := 0;  -- Setup            (20 pts)
  v_dim2  integer := 0;  -- Couple Engagement (30 pts)
  v_dim3  integer := 0;  -- Workflow          (25 pts)
  v_dim4  integer := 0;  -- Team Adoption     (15 pts)
  v_dim5  integer := 0;  -- Habit Formation   (10 pts)

  v_score        integer;
  v_phase        text;
  v_phase_label  text;

  v_profile_pct  integer;
  v_has_package  boolean;
  v_team_active  boolean;
  v_active_days  integer;

  v_gap_items jsonb[] := '{}';
  v_gaps      jsonb;
begin
  select * into v_state from public.venue_activation_state where venue_id = p_venue_id;
  select * into v_venue from public.venues where id = p_venue_id;
  select score into v_prev_score from public.venue_activation_scores where venue_id = p_venue_id;

  -- ── Dim 1: Setup (20 pts) ──────────────────────────────────────────────────

  v_profile_pct := (
    (case when v_venue.name        is not null and v_venue.name != '' then 1 else 0 end) +
    (case when v_venue.email       is not null then 1 else 0 end) +
    (case when v_venue.phone       is not null then 1 else 0 end) +
    (case when v_venue.address_line1 is not null then 1 else 0 end) +
    (case when v_venue.venue_type  is not null then 1 else 0 end) +
    (case when v_venue.capacity    is not null then 1 else 0 end) +
    (case when v_venue.logo_url    is not null then 1 else 0 end) +
    (case when v_venue.website     is not null then 1 else 0 end)
  ) * 100 / 8;

  if v_profile_pct >= 80 then
    v_dim1 := v_dim1 + 10;
  else
    v_gap_items := array_append(v_gap_items,
      jsonb_build_object('action', 'Complete your venue profile', 'pts', 10, 'href', '/settings'));
  end if;

  select exists(
    select 1 from public.packages where venue_id = p_venue_id and is_active = true limit 1
  ) into v_has_package;

  if v_state.first_package_created_at is not null or v_has_package then
    v_dim1 := v_dim1 + 10;
  else
    v_gap_items := array_append(v_gap_items,
      jsonb_build_object('action', 'Create your first package', 'pts', 10, 'href', '/library/packages'));
  end if;

  -- ── Dim 2: Couple Engagement (30 pts) ─────────────────────────────────────

  if v_state.first_portal_invite_sent_at is not null then
    v_dim2 := v_dim2 + 5;
  else
    v_gap_items := array_append(v_gap_items,
      jsonb_build_object('action', 'Send your first couple a portal invite', 'pts', 5, 'href', '/clients'));
  end if;

  if v_state.first_portal_open_at is not null then
    v_dim2 := v_dim2 + 15;
  else
    v_gap_items := array_append(v_gap_items,
      jsonb_build_object('action', 'Get your first couple to open their portal', 'pts', 15, 'href', '/clients'));
  end if;

  if v_state.third_couple_portal_active_at is not null then
    v_dim2 := v_dim2 + 10;
  else
    v_gap_items := array_append(v_gap_items,
      jsonb_build_object('action', 'Have 3+ couples active in their portals', 'pts', 10, 'href', '/clients'));
  end if;

  -- ── Dim 3: Workflow (25 pts) ──────────────────────────────────────────────

  if v_state.first_contract_signed_at is not null then
    v_dim3 := v_dim3 + 10;
  else
    v_gap_items := array_append(v_gap_items,
      jsonb_build_object('action', 'Sign your first contract in Wevenu', 'pts', 10, 'href', '/clients'));
  end if;

  if v_state.first_invoice_paid_at is not null then
    v_dim3 := v_dim3 + 10;
  else
    v_gap_items := array_append(v_gap_items,
      jsonb_build_object('action', 'Receive your first payment in Wevenu', 'pts', 10, 'href', '/clients'));
  end if;

  if v_state.first_vendor_assigned_at is not null then
    v_dim3 := v_dim3 + 5;
  else
    v_gap_items := array_append(v_gap_items,
      jsonb_build_object('action', 'Assign a vendor to a timeline entry', 'pts', 5, 'href', '/events'));
  end if;

  -- ── Dim 4: Team Adoption (15 pts) ─────────────────────────────────────────

  if v_state.first_team_invite_sent_at is not null then
    v_dim4 := v_dim4 + 3;
  else
    v_gap_items := array_append(v_gap_items,
      jsonb_build_object('action', 'Invite a team member', 'pts', 3, 'href', '/settings/team'));
  end if;

  if v_state.first_team_member_login_at is not null then
    v_dim4 := v_dim4 + 7;
  else
    v_gap_items := array_append(v_gap_items,
      jsonb_build_object('action', 'Have a team member log in for the first time', 'pts', 7, 'href', '/settings/team'));
  end if;

  select exists(
    select 1 from public.venue_staff
    where venue_id = p_venue_id
      and is_owner = false
      and is_active = true
      and last_active_at >= now() - interval '14 days'
    limit 1
  ) into v_team_active;

  if v_team_active then
    v_dim4 := v_dim4 + 5;
  else
    v_gap_items := array_append(v_gap_items,
      jsonb_build_object('action', 'Keep a team member active in the last 2 weeks', 'pts', 5, 'href', '/settings/team'));
  end if;

  -- ── Dim 5: Habit Formation (10 pts) ──────────────────────────────────────

  select count(distinct (occurred_at at time zone coalesce(v_venue.timezone, 'UTC'))::date)::integer
  into v_active_days
  from public.engagement_events
  where venue_id = p_venue_id
    and occurred_at >= now() - interval '30 days';

  if v_active_days >= 7 then
    v_dim5 := v_dim5 + 5;
  end if;

  if v_state.first_luv_action_at is not null then
    v_dim5 := v_dim5 + 5;
  end if;

  -- ── Total + Phase ────────────────────────────────────────────────────────

  v_score := v_dim1 + v_dim2 + v_dim3 + v_dim4 + v_dim5;

  if v_score >= 90 then
    v_phase := 'full';       v_phase_label := 'Fully Connected';
  elsif v_score >= 70 then
    v_phase := 'almost';     v_phase_label := 'Almost Fully Connected';
  elsif v_score >= 40 then
    v_phase := 'connected';  v_phase_label := 'Your Venue is Connected';
  else
    v_phase := 'setup';      v_phase_label := 'Your Venue Setup';
  end if;

  -- ── Top-3 gaps (highest pts first) ──────────────────────────────────────

  select coalesce(jsonb_agg(g order by (g->>'pts')::integer desc), '[]'::jsonb)
  into v_gaps
  from unnest(v_gap_items) as g;

  v_gaps := (
    select coalesce(jsonb_agg(x), '[]'::jsonb)
    from (
      select jsonb_array_elements(v_gaps) as x
      limit 3
    ) sub
  );

  -- ── Upsert score ─────────────────────────────────────────────────────────

  insert into public.venue_activation_scores
    (venue_id, score, previous_score, phase, phase_label, dimension_scores, gaps, computed_at, updated_at)
  values (
    p_venue_id, v_score, v_prev_score, v_phase, v_phase_label,
    jsonb_build_object(
      'setup',            v_dim1,
      'couple_engagement', v_dim2,
      'workflow',         v_dim3,
      'team',             v_dim4,
      'habit',            v_dim5
    ),
    v_gaps,
    now(), now()
  )
  on conflict (venue_id) do update set
    previous_score   = venue_activation_scores.score,
    score            = excluded.score,
    phase            = excluded.phase,
    phase_label      = excluded.phase_label,
    dimension_scores = excluded.dimension_scores,
    gaps             = excluded.gaps,
    computed_at      = excluded.computed_at,
    updated_at       = excluded.updated_at;

  -- ── Fire score-threshold milestones ──────────────────────────────────────

  if v_score >= 70 then
    insert into public.venue_milestones (venue_id, milestone_id)
    values (p_venue_id, 'activation_70')
    on conflict (venue_id, milestone_id) do nothing;
  end if;

  if v_score >= 90 then
    insert into public.venue_milestones (venue_id, milestone_id)
    values (p_venue_id, 'fully_connected')
    on conflict (venue_id, milestone_id) do nothing;
  end if;

  return jsonb_build_object(
    'score',      v_score,
    'phase',      v_phase,
    'phaseLabel', v_phase_label,
    'dimensions', jsonb_build_object(
      'setup',             v_dim1,
      'coupleEngagement',  v_dim2,
      'workflow',          v_dim3,
      'team',              v_dim4,
      'habit',             v_dim5
    ),
    'gaps',       v_gaps,
    'computedAt', now()
  );
end;
$$;


-- ── 8. check_relationship_milestones ─────────────────────────────────────────

create or replace function public.check_relationship_milestones(p_venue_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state   public.venue_activation_state%rowtype;
  v_fired   text[] := '{}';
begin
  select * into v_state from public.venue_activation_state where venue_id = p_venue_id;
  if not found then return '[]'::jsonb; end if;

  if v_state.first_portal_open_at is not null then
    insert into public.venue_milestones (venue_id, milestone_id)
    values (p_venue_id, 'first_couple_portal_open')
    on conflict (venue_id, milestone_id) do nothing;
    if found then v_fired := array_append(v_fired, 'first_couple_portal_open'); end if;
  end if;

  if v_state.first_vendor_accept_at is not null then
    insert into public.venue_milestones (venue_id, milestone_id)
    values (p_venue_id, 'first_vendor_accepted')
    on conflict (venue_id, milestone_id) do nothing;
    if found then v_fired := array_append(v_fired, 'first_vendor_accepted'); end if;
  end if;

  if v_state.first_contract_signed_at is not null then
    insert into public.venue_milestones (venue_id, milestone_id)
    values (p_venue_id, 'first_contract_signed')
    on conflict (venue_id, milestone_id) do nothing;
    if found then v_fired := array_append(v_fired, 'first_contract_signed'); end if;
  end if;

  if v_state.first_invoice_paid_at is not null then
    insert into public.venue_milestones (venue_id, milestone_id)
    values (p_venue_id, 'first_payment_received')
    on conflict (venue_id, milestone_id) do nothing;
    if found then v_fired := array_append(v_fired, 'first_payment_received'); end if;
  end if;

  if v_state.first_team_member_login_at is not null then
    insert into public.venue_milestones (venue_id, milestone_id)
    values (p_venue_id, 'first_team_member_joined')
    on conflict (venue_id, milestone_id) do nothing;
    if found then v_fired := array_append(v_fired, 'first_team_member_joined'); end if;
  end if;

  return to_jsonb(v_fired);
end;
$$;


-- ── 9. get_beta_adoption_overview ────────────────────────────────────────────

create or replace function public.get_beta_adoption_overview()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows jsonb;
begin
  select jsonb_agg(row_to_json(r))
  into v_rows
  from (
    select
      v.id                                          as venue_id,
      v.name                                        as venue_name,
      coalesce(s.score, 0)                          as score,
      coalesce(s.phase_label, 'Your Venue Setup')   as phase_label,
      -- Risk: score < 50 AND no engagement event in last 7 days
      (coalesce(s.score, 0) < 50 and not exists (
        select 1 from public.engagement_events ee
        where ee.venue_id = v.id
          and ee.occurred_at >= now() - interval '7 days'
      ))                                            as risk_flag,
      -- Team counts
      (select count(*) from public.venue_staff vs
       where vs.venue_id = v.id and vs.is_owner = false)         as team_invited,
      (select count(*) from public.venue_staff vs
       where vs.venue_id = v.id and vs.is_owner = false
         and vs.accepted_at is not null)                          as team_accepted,
      (select count(*) from public.venue_staff vs
       where vs.venue_id = v.id and vs.is_owner = false
         and vs.last_active_at >= now() - interval '14 days')    as team_active,
      -- Vendor counts
      (select count(*) from public.vendor_invitations vi
       where vi.venue_id = v.id)                                  as vendors_invited,
      (select count(*) from public.vendor_invitations vi
       where vi.venue_id = v.id and vi.status = 'accepted')       as vendors_claimed,
      -- Couple portal counts
      (select count(*) from public.client_portal_sessions cps
       where cps.venue_id = v.id)                                 as portals_created,
      (select max(cps.last_accessed_at) from public.client_portal_sessions cps
       where cps.venue_id = v.id)                                 as last_portal_access,
      -- Last login (any engagement event)
      (select max(ee.occurred_at) from public.engagement_events ee
       where ee.venue_id = v.id)                                  as last_engagement_at,
      v.created_at                                                as venue_created_at
    from public.venues v
    left join public.venue_activation_scores s on s.venue_id = v.id
    order by coalesce(s.score, 0) desc
  ) r;

  return coalesce(v_rows, '[]'::jsonb);
end;
$$;


-- ── 10. Backfill venue_activation_state ──────────────────────────────────────

insert into public.venue_activation_state (
  venue_id,
  profile_completed_at,
  first_package_created_at,
  first_contract_signed_at,
  first_invoice_paid_at,
  first_team_invite_sent_at,
  first_team_member_accept_at
)
select
  v.id,
  v.setup_completed_at,
  (select min(p.created_at) from public.packages p where p.venue_id = v.id),
  (select min(c.signed_at)  from public.contracts c where c.venue_id = v.id and c.signed_at is not null),
  (select min(pli.paid_at)
   from public.payment_line_items pli
   join public.payment_schedules ps on ps.id = pli.schedule_id
   where ps.venue_id = v.id and pli.paid_at is not null),
  (select min(vs.invited_at)  from public.venue_staff vs where vs.venue_id = v.id and vs.is_owner = false and vs.invited_at is not null),
  (select min(vs.accepted_at) from public.venue_staff vs where vs.venue_id = v.id and vs.is_owner = false and vs.accepted_at is not null)
from public.venues v
on conflict (venue_id) do nothing;
