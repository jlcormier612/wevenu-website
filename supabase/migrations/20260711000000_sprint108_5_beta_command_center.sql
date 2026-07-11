-- Sprint 108.5: Beta Command Center
--
-- Builds on Sprint 108's activation engine (engagement_events,
-- venue_activation_state, venue_activation_scores, venue_milestones,
-- get_beta_adoption_overview) to power Wevenu HQ's default home page.
-- See docs/wevenu-hq-architecture.md §2 for the full design.
--
-- Creates:
--   1. venue_activation_score_history — daily score snapshots, for trend/trajectory
--   2. venue_hq_notes, venue_hq_tasks, venue_hq_crm_state — CS workflow tables
--   3. HQ cross-venue SELECT policies on the tables the Venue Detail page reads
--   4. Security fixes: three existing SECURITY DEFINER functions
--      (compute_venue_activation_score, record_engagement_event,
--      check_relationship_milestones, get_beta_adoption_overview) accepted or
--      operated on a venue_id with no internal ownership check — any
--      authenticated user could call them for a venue that wasn't theirs.
--      All four now verify the caller either owns the target venue or is an
--      HQ admin.
--   5. get_beta_adoption_overview() expanded with the raw fields the Beta
--      Command Center's scoring model (lib/hq/beta-scoring.ts) needs — health
--      status, trend, and risk signals are deliberately computed in TypeScript,
--      not SQL, so thresholds stay in one readable, tunable place during beta.

-- ── 1. venue_activation_score_history ────────────────────────────────────────

create table public.venue_activation_score_history (
  venue_id    uuid        not null references public.venues(id) on delete cascade,
  score       integer     not null,
  recorded_on date        not null default current_date,
  computed_at timestamptz not null default now(),
  primary key (venue_id, recorded_on)
);

alter table public.venue_activation_score_history enable row level security;

create policy "activation_history_select"
  on public.venue_activation_score_history for select to authenticated
  using (venue_id = public.current_user_venue_id());

create policy "activation_history_hq_select"
  on public.venue_activation_score_history for select to authenticated
  using (public.is_hq_admin());

alter table public.venue_activation_scores
  add column if not exists score_7d_ago integer;


-- ── 2. venue_hq_notes / venue_hq_tasks / venue_hq_crm_state ──────────────────
-- The Customer Success workflow tables. HQ-managed only — no venue-side access.

create table public.venue_hq_notes (
  id           uuid primary key default gen_random_uuid(),
  venue_id     uuid not null references public.venues(id) on delete cascade,
  author_id    uuid not null references auth.users(id) on delete cascade,
  -- Denormalized at write time from the author's own session — avoids a
  -- client-side join into auth.users, which isn't exposed via the data API.
  author_name  text not null,
  body         text not null,
  created_at   timestamptz not null default now()
);

create index venue_hq_notes_venue on public.venue_hq_notes (venue_id, created_at desc);
alter table public.venue_hq_notes enable row level security;

create policy "hq_notes_select" on public.venue_hq_notes for select to authenticated using (public.is_hq_admin());
create policy "hq_notes_insert" on public.venue_hq_notes for insert to authenticated with check (public.is_hq_admin() and author_id = auth.uid());

create table public.venue_hq_tasks (
  id            uuid primary key default gen_random_uuid(),
  venue_id      uuid not null references public.venues(id) on delete cascade,
  assigned_id   uuid references auth.users(id) on delete set null,
  assigned_name text,
  title         text not null,
  due_date      date,
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);

create index venue_hq_tasks_venue on public.venue_hq_tasks (venue_id, completed_at);
alter table public.venue_hq_tasks enable row level security;

create policy "hq_tasks_select" on public.venue_hq_tasks for select to authenticated using (public.is_hq_admin());
create policy "hq_tasks_insert" on public.venue_hq_tasks for insert to authenticated with check (public.is_hq_admin());
create policy "hq_tasks_update" on public.venue_hq_tasks for update to authenticated using (public.is_hq_admin());

-- One row per venue: last/next contact. Simple CRM fields, distinct from the
-- task list (a task is an actionable item; these are just two dates every CS
-- workflow wants without having to derive them from the task list).
create table public.venue_hq_crm_state (
  venue_id          uuid primary key references public.venues(id) on delete cascade,
  last_contacted_at timestamptz,
  next_contact_at   timestamptz,
  updated_at        timestamptz not null default now()
);

alter table public.venue_hq_crm_state enable row level security;

create policy "hq_crm_state_select" on public.venue_hq_crm_state for select to authenticated using (public.is_hq_admin());
create policy "hq_crm_state_upsert" on public.venue_hq_crm_state for insert to authenticated with check (public.is_hq_admin());
create policy "hq_crm_state_update" on public.venue_hq_crm_state for update to authenticated using (public.is_hq_admin());


-- ── 3. HQ cross-venue read access ────────────────────────────────────────────
-- The Venue Detail page (Overview / Activity Timeline / Engagement) reads
-- across engagement_events, milestones, team, vendor invitations, vendors,
-- clients, and portal sessions for a venue that is not the HQ admin's own
-- (HQ admins typically have no venue at all — current_user_venue_id() resolves
-- to null for them). New standalone SELECT policies, additive to the existing
-- owner/team policies on each table (Postgres ORs multiple permissive
-- policies together — this cannot narrow existing access, only extend it).

create policy "engagement_events_hq_select"
  on public.engagement_events for select to authenticated
  using (public.is_hq_admin());

create policy "milestones_hq_select"
  on public.venue_milestones for select to authenticated
  using (public.is_hq_admin());

create policy "activation_state_hq_select"
  on public.venue_activation_state for select to authenticated
  using (public.is_hq_admin());

create policy "activation_scores_hq_select"
  on public.venue_activation_scores for select to authenticated
  using (public.is_hq_admin());

create policy "venue_staff_hq_select"
  on public.venue_staff for select to authenticated
  using (public.is_hq_admin());

create policy "vendor_invitations_hq_select"
  on public.vendor_invitations for select to authenticated
  using (public.is_hq_admin());

create policy "vendors_hq_select"
  on public.vendors for select to authenticated
  using (public.is_hq_admin());

create policy "clients_hq_select"
  on public.clients for select to authenticated
  using (public.is_hq_admin());

create policy "client_portal_sessions_hq_select"
  on public.client_portal_sessions for select to authenticated
  using (public.is_hq_admin());

create policy "venues_hq_select"
  on public.venues for select to authenticated
  using (public.is_hq_admin());


-- ── 4a. compute_venue_activation_score() — ownership guard + history write ──

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
  v_score_7d_ago integer;

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
  if p_venue_id is distinct from public.current_user_venue_id() and not public.is_hq_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

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

  -- ── Trend snapshot (Beta Command Center) ──────────────────────────────────
  -- One row per venue per day; upserting on every recompute keeps only the
  -- latest score for "today" without piling up duplicate rows.

  insert into public.venue_activation_score_history (venue_id, score, recorded_on, computed_at)
  values (p_venue_id, v_score, current_date, now())
  on conflict (venue_id, recorded_on) do update set
    score = excluded.score, computed_at = excluded.computed_at;

  select score into v_score_7d_ago
  from public.venue_activation_score_history
  where venue_id = p_venue_id and recorded_on <= current_date - 7
  order by recorded_on desc
  limit 1;

  -- ── Upsert score ─────────────────────────────────────────────────────────

  insert into public.venue_activation_scores
    (venue_id, score, previous_score, phase, phase_label, dimension_scores, gaps, score_7d_ago, computed_at, updated_at)
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
    v_score_7d_ago,
    now(), now()
  )
  on conflict (venue_id) do update set
    previous_score   = venue_activation_scores.score,
    score            = excluded.score,
    phase            = excluded.phase,
    phase_label      = excluded.phase_label,
    dimension_scores = excluded.dimension_scores,
    gaps             = excluded.gaps,
    score_7d_ago     = excluded.score_7d_ago,
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
    'score',       v_score,
    'previousScore', v_prev_score,
    'phase',       v_phase,
    'phaseLabel',  v_phase_label,
    'dimensions', jsonb_build_object(
      'setup',             v_dim1,
      'coupleEngagement',  v_dim2,
      'workflow',          v_dim3,
      'team',              v_dim4,
      'habit',             v_dim5
    ),
    'gaps',        v_gaps,
    'score7dAgo',  v_score_7d_ago,
    'computedAt',  now()
  );
end;
$$;


-- ── 4b. record_engagement_event() — ownership guard ──────────────────────────

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
  if p_venue_id is distinct from public.current_user_venue_id() and not public.is_hq_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

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


-- ── 4c. check_relationship_milestones() — ownership guard ────────────────────

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
  if p_venue_id is distinct from public.current_user_venue_id() and not public.is_hq_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

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


-- ── 5. get_beta_adoption_overview() — expanded + internally guarded ─────────

create or replace function public.get_beta_adoption_overview()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows jsonb;
begin
  if not public.is_hq_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select jsonb_agg(row_to_json(r))
  into v_rows
  from (
    select
      v.id                                          as venue_id,
      v.name                                        as venue_name,
      v.created_at                                  as venue_created_at,
      coalesce(s.score, 0)                          as score,
      s.previous_score                              as previous_score,
      s.score_7d_ago                                as score_7d_ago,
      coalesce(s.phase_label, 'Your Venue Setup')   as phase_label,
      s.gaps                                        as gaps,
      s.dimension_scores                            as dimension_scores,
      -- Legacy two-tier flag, kept for backwards compat; the Beta Command
      -- Center computes a three-tier Healthy/At Risk/Critical status in TS
      -- (lib/hq/beta-scoring.ts) from the raw fields below instead.
      (coalesce(s.score, 0) < 50 and not exists (
        select 1 from public.engagement_events ee
        where ee.venue_id = v.id
          and ee.occurred_at >= now() - interval '7 days'
      ))                                            as risk_flag,
      -- Team
      (select count(*) from public.venue_staff vs
       where vs.venue_id = v.id and vs.is_owner = false)         as team_invited,
      (select count(*) from public.venue_staff vs
       where vs.venue_id = v.id and vs.is_owner = false
         and vs.accepted_at is not null)                          as team_accepted,
      (select count(*) from public.venue_staff vs
       where vs.venue_id = v.id and vs.is_owner = false
         and vs.last_active_at >= now() - interval '14 days')    as team_active,
      -- "Declining team participation" leading indicator — event volume
      -- this two-week window vs the two-week window before it.
      (select count(*) from public.engagement_events ee
       where ee.venue_id = v.id and ee.actor_type = 'team_member'
         and ee.occurred_at >= now() - interval '14 days')        as team_events_recent_14d,
      (select count(*) from public.engagement_events ee
       where ee.venue_id = v.id and ee.actor_type = 'team_member'
         and ee.occurred_at >= now() - interval '28 days'
         and ee.occurred_at <  now() - interval '14 days')        as team_events_prior_14d,
      -- Vendor
      (select count(*) from public.vendor_invitations vi
       where vi.venue_id = v.id)                                  as vendors_invited,
      (select count(*) from public.vendor_invitations vi
       where vi.venue_id = v.id and vi.status = 'accepted')       as vendors_claimed,
      (select min(vi.created_at) from public.vendor_invitations vi
       where vi.venue_id = v.id)                                  as first_vendor_invited_at,
      -- Couple portal
      (select count(*) from public.client_portal_sessions cps
       where cps.venue_id = v.id)                                 as portals_created,
      (select max(cps.last_accessed_at) from public.client_portal_sessions cps
       where cps.venue_id = v.id)                                 as last_portal_access,
      ast.first_portal_invite_sent_at                             as first_portal_invite_sent_at,
      ast.first_portal_open_at                                    as first_portal_open_at,
      -- Import / records
      (select count(*) from public.clients c where c.venue_id = v.id) as total_clients,
      -- "Activation unchanged for 3+ days" leading indicator
      (exists (
        select 1 from public.venue_activation_score_history h
        where h.venue_id = v.id
          and h.recorded_on <= current_date - 3
          and h.score = coalesce(s.score, 0)
      ))                                                          as activation_stalled_3d,
      -- Last activity (any engagement event, any actor — couple, vendor, or team)
      (select max(ee.occurred_at) from public.engagement_events ee
       where ee.venue_id = v.id)                                  as last_engagement_at,
      -- Last login (venue owner/team only — distinct from "last activity",
      -- which includes couples and vendors touching their own portals)
      (select max(ee.occurred_at) from public.engagement_events ee
       where ee.venue_id = v.id
         and ee.actor_type in ('venue_user', 'team_member'))       as last_login_at,
      -- CS workflow
      crm.last_contacted_at                                       as last_contacted_at,
      crm.next_contact_at                                         as next_contact_at
    from public.venues v
    left join public.venue_activation_scores s on s.venue_id = v.id
    left join public.venue_activation_state  ast on ast.venue_id = v.id
    left join public.venue_hq_crm_state      crm on crm.venue_id = v.id
    order by coalesce(s.score, 0) desc
  ) r;

  return coalesce(v_rows, '[]'::jsonb);
end;
$$;

notify pgrst, 'reload schema';
