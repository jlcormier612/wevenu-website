-- Fix: Sprint 108.5's ownership-guard fix to record_engagement_event() and
-- check_relationship_milestones() broke every couple/vendor-triggered
-- engagement event.
--
-- Root cause: those two functions gate on
--   current_user_venue_id() = p_venue_id  OR  is_hq_admin()
-- but current_user_venue_id() is only meaningful for venue owners/team
-- members. Couples (portal token flows: /p/{token}, /sign/{token}) and
-- vendors (claim/invitation flows) call recordEngagementEvent() with no
-- venue-staff session at all — for them current_user_venue_id() is always
-- null, so the guard raised "forbidden" on every one of their events
-- (couple.portal_opened, contract.signed, vendor.invitation_accepted, etc).
-- Caught in beta-readiness testing: simulating an anonymous/couple caller
-- against record_engagement_event() and check_relationship_milestones()
-- both raised 'forbidden' where they should have succeeded.
--
-- Fix:
--   - record_engagement_event(): only enforce the ownership check when
--     p_actor_type is 'venue_user', 'team_member', or 'hq_admin' — the
--     actor types that actually have a checkable session identity. Couple
--     and vendor calls are implicitly trusted the same way they always
--     were pre-Sprint-108.5: by the time this function runs, the caller
--     already validated a portal/sign/claim token via a separate
--     SECURITY DEFINER function earlier in the request.
--   - check_relationship_milestones(): drop the guard entirely. It never
--     accepts untrusted data — it only re-derives celebrations from
--     venue_activation_state that's already true, and inserts are
--     idempotent (ON CONFLICT DO NOTHING). Worst case without a guard is
--     re-firing an already-earned milestone for someone else's venue
--     slightly early, not fabricating false state.

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
  if p_actor_type in ('venue_user', 'team_member', 'hq_admin')
     and p_venue_id is distinct from public.current_user_venue_id()
     and not public.is_hq_admin() then
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
