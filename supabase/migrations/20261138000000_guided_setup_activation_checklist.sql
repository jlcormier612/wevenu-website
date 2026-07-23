-- ============================================================================
-- Hospitality Success Platform — Guided Setup §1.1: one source of truth for
-- "what's done, what's missing."
--
-- Today two systems separately compute this: the Getting Started checklist
-- (lib/dashboard/service.ts's computeOnboarding(), ad hoc TypeScript field/
-- count checks) and the Activation Engine (this function). They don't share
-- a data model, disagree on vocabulary, and duplicate queries against the
-- same tables. Per docs/hospitality-success-platform-implementation-plan.md
-- §1.1 (decided 2026-07-22): Getting Started retires its own computation
-- and becomes a presentation layer over the Activation Engine's own data.
--
-- This migration does NOT change what's scored or how (v_dim1..v_dim5,
-- v_score, v_phase — all byte-for-byte identical logic to
-- 20260709120000_sprint108_activation_engine.sql). It only ALSO exposes a
-- full checklist (every item, completed or not — 'gaps' only ever exposed
-- the top-3 *incomplete* ones, which can't power a "here's everything
-- you've done" progress card). 'gaps' itself is now simply derived by
-- filtering this same checklist, instead of being built as a separate
-- parallel array — one computation, two views of it.
-- ============================================================================

alter table public.venue_activation_scores
  add column checklist jsonb not null default '[]';

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

  v_checklist_items jsonb[] := '{}';
  v_checklist        jsonb;
  v_gaps              jsonb;
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

  if v_profile_pct >= 80 then v_dim1 := v_dim1 + 10; end if;
  v_checklist_items := array_append(v_checklist_items, jsonb_build_object(
    'key', 'profile_complete', 'action', 'Complete your venue profile',
    'pts', 10, 'href', '/settings', 'completed', v_profile_pct >= 80));

  select exists(
    select 1 from public.packages where venue_id = p_venue_id and is_active = true limit 1
  ) into v_has_package;
  if v_state.first_package_created_at is not null or v_has_package then v_dim1 := v_dim1 + 10; end if;
  v_checklist_items := array_append(v_checklist_items, jsonb_build_object(
    'key', 'first_package', 'action', 'Create your first package',
    'pts', 10, 'href', '/library/packages',
    'completed', v_state.first_package_created_at is not null or v_has_package));

  -- ── Dim 2: Couple Engagement (30 pts) ─────────────────────────────────────

  if v_state.first_portal_invite_sent_at is not null then v_dim2 := v_dim2 + 5; end if;
  v_checklist_items := array_append(v_checklist_items, jsonb_build_object(
    'key', 'first_portal_invite', 'action', 'Send your first couple a portal invite',
    'pts', 5, 'href', '/clients', 'completed', v_state.first_portal_invite_sent_at is not null));

  if v_state.first_portal_open_at is not null then v_dim2 := v_dim2 + 15; end if;
  v_checklist_items := array_append(v_checklist_items, jsonb_build_object(
    'key', 'first_portal_open', 'action', 'Get your first couple to open their portal',
    'pts', 15, 'href', '/clients', 'completed', v_state.first_portal_open_at is not null));

  if v_state.third_couple_portal_active_at is not null then v_dim2 := v_dim2 + 10; end if;
  v_checklist_items := array_append(v_checklist_items, jsonb_build_object(
    'key', 'three_couples_active', 'action', 'Have 3+ couples active in their portals',
    'pts', 10, 'href', '/clients', 'completed', v_state.third_couple_portal_active_at is not null));

  -- ── Dim 3: Workflow (25 pts) ──────────────────────────────────────────────

  if v_state.first_contract_signed_at is not null then v_dim3 := v_dim3 + 10; end if;
  v_checklist_items := array_append(v_checklist_items, jsonb_build_object(
    'key', 'first_contract_signed', 'action', 'Sign your first contract in Hello to Cheers',
    'pts', 10, 'href', '/clients', 'completed', v_state.first_contract_signed_at is not null));

  if v_state.first_invoice_paid_at is not null then v_dim3 := v_dim3 + 10; end if;
  v_checklist_items := array_append(v_checklist_items, jsonb_build_object(
    'key', 'first_payment_received', 'action', 'Receive your first payment in Hello to Cheers',
    'pts', 10, 'href', '/clients', 'completed', v_state.first_invoice_paid_at is not null));

  if v_state.first_vendor_assigned_at is not null then v_dim3 := v_dim3 + 5; end if;
  v_checklist_items := array_append(v_checklist_items, jsonb_build_object(
    'key', 'first_vendor_assigned', 'action', 'Assign a vendor to a timeline entry',
    'pts', 5, 'href', '/events', 'completed', v_state.first_vendor_assigned_at is not null));

  -- ── Dim 4: Team Adoption (15 pts) ─────────────────────────────────────────

  if v_state.first_team_invite_sent_at is not null then v_dim4 := v_dim4 + 3; end if;
  v_checklist_items := array_append(v_checklist_items, jsonb_build_object(
    'key', 'first_team_invite', 'action', 'Invite a team member',
    'pts', 3, 'href', '/settings/team', 'completed', v_state.first_team_invite_sent_at is not null));

  if v_state.first_team_member_login_at is not null then v_dim4 := v_dim4 + 7; end if;
  v_checklist_items := array_append(v_checklist_items, jsonb_build_object(
    'key', 'first_team_login', 'action', 'Have a team member log in for the first time',
    'pts', 7, 'href', '/settings/team', 'completed', v_state.first_team_member_login_at is not null));

  select exists(
    select 1 from public.venue_staff
    where venue_id = p_venue_id
      and is_owner = false
      and is_active = true
      and last_active_at >= now() - interval '14 days'
    limit 1
  ) into v_team_active;
  if v_team_active then v_dim4 := v_dim4 + 5; end if;
  v_checklist_items := array_append(v_checklist_items, jsonb_build_object(
    'key', 'team_active_recently', 'action', 'Keep a team member active in the last 2 weeks',
    'pts', 5, 'href', '/settings/team', 'completed', v_team_active));

  -- ── Dim 5: Habit Formation (10 pts) — informational only, never a gap ─────
  -- (unchanged: these never appeared as actionable gaps before this
  -- migration either — a venue can't directly "do" 7 active days or a Luv
  -- action the way it can click a settings link, so they stay score-only.)

  select count(distinct (occurred_at at time zone coalesce(v_venue.timezone, 'UTC'))::date)::integer
  into v_active_days
  from public.engagement_events
  where venue_id = p_venue_id
    and occurred_at >= now() - interval '30 days';

  if v_active_days >= 7 then v_dim5 := v_dim5 + 5; end if;
  if v_state.first_luv_action_at is not null then v_dim5 := v_dim5 + 5; end if;

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

  -- ── Full checklist (insertion order) + gaps (top-3 incomplete, by pts) ────

  select coalesce(jsonb_agg(c), '[]'::jsonb) into v_checklist from unnest(v_checklist_items) as c;

  v_gaps := (
    select coalesce(jsonb_agg(x), '[]'::jsonb)
    from (
      select x
      from jsonb_array_elements(v_checklist) as x
      where (x->>'completed')::boolean = false
      order by (x->>'pts')::integer desc
      limit 3
    ) sub
  );

  -- ── Upsert score ─────────────────────────────────────────────────────────

  insert into public.venue_activation_scores
    (venue_id, score, previous_score, phase, phase_label, dimension_scores, gaps, checklist, computed_at, updated_at)
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
    v_checklist,
    now(), now()
  )
  on conflict (venue_id) do update set
    previous_score   = venue_activation_scores.score,
    score            = excluded.score,
    phase            = excluded.phase,
    phase_label      = excluded.phase_label,
    dimension_scores = excluded.dimension_scores,
    gaps             = excluded.gaps,
    checklist        = excluded.checklist,
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
    'checklist',  v_checklist,
    'computedAt', now()
  );
end;
$$;

notify pgrst, 'reload schema';
