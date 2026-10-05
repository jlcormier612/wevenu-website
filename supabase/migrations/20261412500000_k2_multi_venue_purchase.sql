-- K2: one checkout session → one enrollment → one token → one venue → one owner membership.
-- Venue creation lives only in provision_enrollment_venue. Activation calls it.
-- venues_owner_unique is dropped at the end of this migration, after the scalar
-- owner lookups below have been rewritten to current_user_venue_id().

alter table public.venue_enrollments
  add column if not exists purchase_hold boolean not null default false,
  add column if not exists welcome_email_sent_at timestamptz,
  add column if not exists welcome_email_claimed_at timestamptz;

comment on column public.venue_enrollments.purchase_hold is
  'Same-email, same-name, new checkout session. Session is stored. venue_id and activation_token stay null.';
comment on column public.venue_enrollments.welcome_email_sent_at is
  'Set only after the Launch Yourself / White Glove welcome transport reports sent. One successful send per checkout session.';

-- Shared venue creator. Locks the enrollment row. Does not search venues by
-- owner_user_id, email, or name. A second call reuses enrollment.venue_id.
create or replace function public.provision_enrollment_venue(
  p_enrollment_id uuid,
  p_owner_user_id uuid,
  p_is_owner boolean default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enrollment public.venue_enrollments%rowtype;
  v_venue_id uuid;
  v_staff_name text;
  v_billing_overrides jsonb;
begin
  select * into v_enrollment
    from public.venue_enrollments
    where id = p_enrollment_id
    for update;

  if not found then
    raise exception 'enrollment_not_found' using errcode = 'P0001';
  end if;

  if coalesce(v_enrollment.purchase_hold, false) then
    raise exception 'purchase_held' using errcode = 'P0001';
  end if;

  if v_enrollment.venue_id is not null then
    v_venue_id := v_enrollment.venue_id;
  else
    insert into public.venues (owner_user_id, name, email, setup_completed)
    values (p_owner_user_id, v_enrollment.venue_name, v_enrollment.owner_email, false)
    returning id into v_venue_id;

    update public.venue_enrollments
      set venue_id = v_venue_id,
          status = case when status = 'pending' then 'provisioned' else status end
      where id = v_enrollment.id;
  end if;

  if p_is_owner is null or p_owner_user_id is null then
    return v_venue_id;
  end if;

  if exists (
    select 1 from public.venue_staff
    where venue_id = v_venue_id
      and user_id = p_owner_user_id
  ) then
    return v_venue_id;
  end if;

  v_staff_name := coalesce(
    nullif(trim(both from concat_ws(' ', v_enrollment.owner_first_name, v_enrollment.owner_last_name)), ''),
    nullif(v_enrollment.venue_name, ''),
    'Owner'
  );
  v_billing_overrides := case
    when p_is_owner then '{}'::jsonb
    else jsonb_build_object('account.billing', true)
  end;

  begin
    insert into public.venue_staff (
      venue_id, user_id, full_name, email, role, is_owner, accepted_at, is_active,
      access_title, title_basis, capability_overrides, owner_invite_pending
    )
    values (
      v_venue_id,
      p_owner_user_id,
      v_staff_name,
      v_enrollment.owner_email,
      public.legacy_role_for_access('administrator', p_is_owner),
      p_is_owner,
      now(),
      true,
      'administrator',
      'administrator',
      v_billing_overrides,
      false
    );
  exception when unique_violation then
    null;
  end;

  return v_venue_id;
end;
$$;

revoke all on function public.provision_enrollment_venue(uuid, uuid, boolean) from public;
grant execute on function public.provision_enrollment_venue(uuid, uuid, boolean) to service_role;

-- Activation no longer inserts venues. It locks the enrollment, then calls
-- provision_enrollment_venue. Purchaser ownership stays explicit and fail-closed.
create or replace function public.activate_venue_enrollment(
  p_activation_token text,
  p_owner_user_id uuid,
  p_purchaser_is_owner boolean,
  p_invited_owner_name text default null,
  p_invited_owner_email text default null
)
returns table(venue_id uuid, already_activated boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enrollment public.venue_enrollments%rowtype;
  v_venue_id   uuid;
  v_purchaser_is_owner boolean;
begin
  if p_purchaser_is_owner is null then
    raise exception 'purchaser_ownership_choice_required: Purchaser ownership choice is required. Explicit p_purchaser_is_owner must be true or false.'
      using errcode = 'P0001';
  end if;
  v_purchaser_is_owner := p_purchaser_is_owner;

  select * into v_enrollment
    from public.venue_enrollments
    where activation_token = p_activation_token
    for update;

  if not found then
    raise exception 'invalid_or_expired_token' using errcode = '22023';
  end if;

  update public.venue_enrollments
  set purchaser_is_owner = v_purchaser_is_owner,
      invited_owner_name = case when v_purchaser_is_owner then null else coalesce(p_invited_owner_name, invited_owner_name) end,
      invited_owner_email = case when v_purchaser_is_owner then null else lower(trim(coalesce(p_invited_owner_email, invited_owner_email))) end
  where id = v_enrollment.id;

  if v_enrollment.status = 'activated' then
    v_venue_id := public.provision_enrollment_venue(
      v_enrollment.id,
      p_owner_user_id,
      v_purchaser_is_owner
    );
    return query select v_venue_id, true;
    return;
  end if;

  if v_enrollment.activation_token_created_at is null
     or v_enrollment.activation_token_created_at < now() - interval '30 days' then
    raise exception 'token_expired' using errcode = '22023';
  end if;

  v_venue_id := public.provision_enrollment_venue(
    v_enrollment.id,
    p_owner_user_id,
    v_purchaser_is_owner
  );

  if not v_purchaser_is_owner
     and nullif(trim(coalesce(p_invited_owner_email, v_enrollment.invited_owner_email, '')), '') is not null
  then
    insert into public.venue_staff (
      venue_id, user_id, full_name, email, role, is_owner, is_active,
      invited_at, access_title, title_basis, capability_overrides, owner_invite_pending
    )
    values (
      v_venue_id,
      null,
      coalesce(nullif(trim(coalesce(p_invited_owner_name, v_enrollment.invited_owner_name, '')), ''), 'Owner'),
      lower(trim(coalesce(p_invited_owner_email, v_enrollment.invited_owner_email))),
      public.legacy_role_for_access('administrator', false),
      false,
      true,
      now(),
      'administrator',
      'administrator',
      '{}'::jsonb,
      true
    );
  end if;

  update public.venue_enrollments
    set status = 'activated',
        venue_id = v_venue_id
    where id = v_enrollment.id;

  return query select v_venue_id, false;
end;
$$;

revoke all on function public.activate_venue_enrollment(text, uuid, boolean, text, text) from public;
grant execute on function public.activate_venue_enrollment(text, uuid, boolean, text, text) to service_role;

create or replace function public.activate_venue_enrollment(
  p_activation_token text,
  p_owner_user_id uuid
)
returns table(venue_id uuid, already_activated boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'purchaser_ownership_choice_required: Purchaser ownership choice is required. Call activate_venue_enrollment(text, uuid, boolean, text, text) with an explicit p_purchaser_is_owner.'
    using errcode = 'P0001';
end;
$$;

revoke all on function public.activate_venue_enrollment(text, uuid) from public;
grant execute on function public.activate_venue_enrollment(text, uuid) to service_role;

-- RLS review (K2):
-- venues INSERT/UPDATE/DELETE stay owner_user_id = auth.uid(). That authorizes
-- the contact user on each of their venue rows. It does not pick one venue.
-- Child lead/calendar/payment data stays on current_user_venue_id() and is unchanged.
-- venue_staff INSERT/UPDATE stay "contact owner of THIS venue row OR manager of
-- the active venue". A second Owner who is not the contact FK is unchanged from
-- today (service role provisions memberships). Not rewritten.
-- vendor_health_scores previously matched every venue with this contact FK, so
-- an active session could read another owned venue's vendor health. Scope it to
-- the active venue and fail closed when context is null.

drop policy if exists venues_see_vendor_health_scores on public.vendor_health_scores;
create policy venues_see_vendor_health_scores
  on public.vendor_health_scores for select
  using (
    exists (
      select 1 from public.venue_vendor_relationships vvr
      where vvr.vendor_id = vendor_health_scores.vendor_id
        and vvr.status <> 'inactive'
        and vvr.venue_id = public.current_user_venue_id()
    )
    or exists (
      select 1 from public.vendor_users vu
      where vu.vendor_id = vendor_health_scores.vendor_id
        and vu.user_id = auth.uid()
        and vu.is_active = true
    )
  );

-- Scalar owner_user_id lookups rewritten to current_user_venue_id(). Fail closed when context is null.

-- get_notification_preferences
create or replace function public.get_notification_preferences()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
  v_prefs    public.venue_notification_preferences%rowtype;
begin
  v_venue_id := public.current_user_venue_id();
  if v_venue_id is null then return jsonb_build_object('error', 'not_found'); end if;

  select * into v_prefs
  from public.venue_notification_preferences
  where venue_id = v_venue_id;

  if not found then
    return jsonb_build_object(
      'prefNewLead',                   true,
      'prefRsvpReceived',              true,
      'prefTaskCompleted',             true,
      'prefVendorCheckedIn',           true,
      'prefFeedbackReceived',          true,
      'prefReferralReceived',          true,
      'prefMessageReceived',           true,
      'prefClientSubmittedInfo',       false,
      'prefPaymentFailed',             true,
      'prefPaymentOverdue',            true,
      'prefPaymentReceived',           false,
      'prefContractRequiresAttention', true,
      'prefContractSigned',            false,
      'prefFinalGuestCountSubmitted',  false,
      'prefTourScheduled',             true,
      'prefTourConfirmed',             true,
      'prefProposalAccepted',          true,
      'channelEmail',                  false,
      'channelSms',                    false,
      'channelPush',                   false
    );
  end if;

  return jsonb_build_object(
    'prefNewLead',                   v_prefs.pref_new_lead,
    'prefRsvpReceived',              v_prefs.pref_rsvp_received,
    'prefTaskCompleted',             v_prefs.pref_task_completed,
    'prefVendorCheckedIn',           v_prefs.pref_vendor_checked_in,
    'prefFeedbackReceived',          v_prefs.pref_feedback_received,
    'prefReferralReceived',          v_prefs.pref_referral_received,
    'prefMessageReceived',           v_prefs.pref_message_received,
    'prefClientSubmittedInfo',       v_prefs.pref_client_submitted_info,
    'prefPaymentFailed',             v_prefs.pref_payment_failed,
    'prefPaymentOverdue',            v_prefs.pref_payment_overdue,
    'prefPaymentReceived',           v_prefs.pref_payment_received,
    'prefContractRequiresAttention', v_prefs.pref_contract_requires_attention,
    'prefContractSigned',            v_prefs.pref_contract_signed,
    'prefFinalGuestCountSubmitted',  v_prefs.pref_final_guest_count_submitted,
    'prefTourScheduled',             v_prefs.pref_tour_scheduled,
    'prefTourConfirmed',             v_prefs.pref_tour_confirmed,
    'prefProposalAccepted',          v_prefs.pref_proposal_accepted,
    'channelEmail',                  v_prefs.channel_email,
    'channelSms',                    v_prefs.channel_sms,
    'channelPush',                   v_prefs.channel_push
  );
end;
$$;

-- update_notification_preferences
create or replace function public.update_notification_preferences(
  p_pref_new_lead                    boolean default null,
  p_pref_rsvp_received                boolean default null,
  p_pref_task_completed               boolean default null,
  p_pref_vendor_checked_in            boolean default null,
  p_pref_feedback_received            boolean default null,
  p_pref_referral_received            boolean default null,
  p_pref_message_received             boolean default null,
  p_pref_client_submitted_info        boolean default null,
  p_pref_payment_failed               boolean default null,
  p_pref_payment_overdue              boolean default null,
  p_pref_payment_received             boolean default null,
  p_pref_contract_requires_attention  boolean default null,
  p_pref_contract_signed              boolean default null,
  p_pref_final_guest_count_submitted  boolean default null,
  p_pref_tour_scheduled               boolean default null,
  p_pref_tour_confirmed               boolean default null,
  p_pref_proposal_accepted            boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
begin
  v_venue_id := public.current_user_venue_id();
  if v_venue_id is null then return jsonb_build_object('ok', false); end if;

  insert into public.venue_notification_preferences (
    venue_id,
    pref_new_lead, pref_rsvp_received, pref_task_completed,
    pref_vendor_checked_in, pref_feedback_received,
    pref_referral_received, pref_message_received,
    pref_client_submitted_info, pref_payment_failed, pref_payment_overdue,
    pref_payment_received, pref_contract_requires_attention,
    pref_contract_signed, pref_final_guest_count_submitted,
    pref_tour_scheduled, pref_tour_confirmed, pref_proposal_accepted,
    updated_at
  ) values (
    v_venue_id,
    coalesce(p_pref_new_lead,                    true),
    coalesce(p_pref_rsvp_received,               true),
    coalesce(p_pref_task_completed,               true),
    coalesce(p_pref_vendor_checked_in,            true),
    coalesce(p_pref_feedback_received,            true),
    coalesce(p_pref_referral_received,            true),
    coalesce(p_pref_message_received,             true),
    coalesce(p_pref_client_submitted_info,        false),
    coalesce(p_pref_payment_failed,               true),
    coalesce(p_pref_payment_overdue,              true),
    coalesce(p_pref_payment_received,             false),
    coalesce(p_pref_contract_requires_attention,  true),
    coalesce(p_pref_contract_signed,              false),
    coalesce(p_pref_final_guest_count_submitted,  false),
    coalesce(p_pref_tour_scheduled,               true),
    coalesce(p_pref_tour_confirmed,               true),
    coalesce(p_pref_proposal_accepted,            true),
    now()
  )
  on conflict (venue_id) do update set
    pref_new_lead                    = coalesce(p_pref_new_lead,                    venue_notification_preferences.pref_new_lead),
    pref_rsvp_received               = coalesce(p_pref_rsvp_received,               venue_notification_preferences.pref_rsvp_received),
    pref_task_completed              = coalesce(p_pref_task_completed,              venue_notification_preferences.pref_task_completed),
    pref_vendor_checked_in           = coalesce(p_pref_vendor_checked_in,           venue_notification_preferences.pref_vendor_checked_in),
    pref_feedback_received           = coalesce(p_pref_feedback_received,           venue_notification_preferences.pref_feedback_received),
    pref_referral_received           = coalesce(p_pref_referral_received,           venue_notification_preferences.pref_referral_received),
    pref_message_received            = coalesce(p_pref_message_received,            venue_notification_preferences.pref_message_received),
    pref_client_submitted_info       = coalesce(p_pref_client_submitted_info,       venue_notification_preferences.pref_client_submitted_info),
    pref_payment_failed              = coalesce(p_pref_payment_failed,              venue_notification_preferences.pref_payment_failed),
    pref_payment_overdue             = coalesce(p_pref_payment_overdue,             venue_notification_preferences.pref_payment_overdue),
    pref_payment_received            = coalesce(p_pref_payment_received,            venue_notification_preferences.pref_payment_received),
    pref_contract_requires_attention = coalesce(p_pref_contract_requires_attention, venue_notification_preferences.pref_contract_requires_attention),
    pref_contract_signed             = coalesce(p_pref_contract_signed,             venue_notification_preferences.pref_contract_signed),
    pref_final_guest_count_submitted = coalesce(p_pref_final_guest_count_submitted, venue_notification_preferences.pref_final_guest_count_submitted),
    pref_tour_scheduled              = coalesce(p_pref_tour_scheduled,              venue_notification_preferences.pref_tour_scheduled),
    pref_tour_confirmed              = coalesce(p_pref_tour_confirmed,              venue_notification_preferences.pref_tour_confirmed),
    pref_proposal_accepted           = coalesce(p_pref_proposal_accepted,           venue_notification_preferences.pref_proposal_accepted),
    updated_at                       = now();

  return jsonb_build_object('ok', true);
end;
$$;

-- get_reminder_cadence
create or replace function public.get_reminder_cadence()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
  v_row      public.venue_reminder_cadence%rowtype;
begin
  v_venue_id := public.current_user_venue_id();
  if v_venue_id is null then return jsonb_build_object('error', 'not_found'); end if;

  select * into v_row from public.venue_reminder_cadence where venue_id = v_venue_id;
  if not found then
    return jsonb_build_object(
      'paymentBeforeDueOffsets',  to_jsonb(array[-21, -14, -7]),
      'paymentAfterDueCadence',   'daily',
      'contractBeforeDueOffsets', to_jsonb(array[-21, -14, -7]),
      'taskAfterDueCadence',      'every_3_days'
    );
  end if;

  return jsonb_build_object(
    'paymentBeforeDueOffsets',  to_jsonb(v_row.payment_before_due_offsets),
    'paymentAfterDueCadence',   v_row.payment_after_due_cadence,
    'contractBeforeDueOffsets', to_jsonb(v_row.contract_before_due_offsets),
    'taskAfterDueCadence',      v_row.task_after_due_cadence
  );
end;
$$;

-- update_reminder_cadence
create or replace function public.update_reminder_cadence(
  p_payment_before_due_offsets  int[] default null,
  p_payment_after_due_cadence   text  default null,
  p_contract_before_due_offsets int[] default null,
  p_task_after_due_cadence      text  default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
  v_payment_offsets  int[];
  v_contract_offsets int[];
begin
  v_venue_id := public.current_user_venue_id();
  if v_venue_id is null then return jsonb_build_object('ok', false); end if;

  -- Normalize: keep only allowed unique offsets, ascending. Empty input → [].
  -- Must use a scalar subquery so empty arrays become [] (not NULL from SELECT INTO).
  if p_payment_before_due_offsets is not null then
    select coalesce(
      (select array_agg(d order by d)
       from (select distinct unnest(p_payment_before_due_offsets) as d) s
       where d = any (array[-21, -14, -7, 0])),
      array[]::int[]
    ) into v_payment_offsets;
  end if;

  if p_contract_before_due_offsets is not null then
    select coalesce(
      (select array_agg(d order by d)
       from (select distinct unnest(p_contract_before_due_offsets) as d) s
       where d = any (array[-21, -14, -7, 0])),
      array[]::int[]
    ) into v_contract_offsets;
  end if;

  insert into public.venue_reminder_cadence (
    venue_id,
    payment_before_due_offsets,
    payment_after_due_cadence,
    contract_before_due_offsets,
    task_after_due_cadence,
    updated_at
  ) values (
    v_venue_id,
    coalesce(v_payment_offsets, array[-21, -14, -7]),
    coalesce(p_payment_after_due_cadence, 'daily'),
    coalesce(v_contract_offsets, array[-21, -14, -7]),
    coalesce(p_task_after_due_cadence, 'every_3_days'),
    now()
  )
  on conflict (venue_id) do update set
    payment_before_due_offsets  = coalesce(v_payment_offsets,  venue_reminder_cadence.payment_before_due_offsets),
    payment_after_due_cadence   = coalesce(p_payment_after_due_cadence,   venue_reminder_cadence.payment_after_due_cadence),
    contract_before_due_offsets = coalesce(v_contract_offsets, venue_reminder_cadence.contract_before_due_offsets),
    task_after_due_cadence      = coalesce(p_task_after_due_cadence,      venue_reminder_cadence.task_after_due_cadence),
    updated_at = now();

  return jsonb_build_object('ok', true);
end;
$$;

-- get_venue_analytics
create or replace function public.get_venue_analytics()
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_venue_id uuid;
begin
  v_venue_id := public.current_user_venue_id();
  if v_venue_id is null then return jsonb_build_object('error', 'not_found'); end if;

  return jsonb_build_object(

    'leadFunnel', (
      with l as (
        select l2.sales_stage, l2.acquisition_source as source, l2.created_at,
               (ta.lead_id is not null) as has_tour
        from public.leads l2
        left join lateral (
          select 1 as lead_id from public.tour_appointments t where t.lead_id = l2.id limit 1
        ) ta on true
        where l2.venue_id = v_venue_id
                )
      select jsonb_build_object(
        'total',        count(*),
        'contacted',    count(*) filter (where sales_stage in ('outreach_sent','enrolled_in_sequence','tour_scheduled','proposal_sent','booked')),
        'toured',       count(*) filter (where sales_stage in ('tour_scheduled','proposal_sent','booked') or has_tour),
        'proposal',     count(*) filter (where sales_stage in ('proposal_sent','booked')),
        'booked',       count(*) filter (where sales_stage = 'booked'),
        'lost',         count(*) filter (where sales_stage = 'lost'),
        'conversionRate', case
                          when count(*) filter (where sales_stage is distinct from 'lost') > 0
                          then round(100.0 * count(*) filter (where sales_stage = 'booked')
                               / nullif(count(*) filter (where sales_stage is distinct from 'lost'), 0))
                          else 0 end,
        'bookingConversionRate', (public.canonical_conversion_funnel(null, null) ->> 'bookingConversionRate')::int,
        'bySource', (
          select coalesce(jsonb_agg(
            jsonb_build_object(
              'source',  coalesce(source, 'Unknown'),
              'total',   src_total,
              'booked',  src_booked,
              'rate',    case when src_total > 0 then round(100.0 * src_booked / src_total) else 0 end
            ) order by src_total desc
          ), '[]')
          from (
            select
              coalesce(source, 'unknown') as source,
              count(*) as src_total,
              count(*) filter (where sales_stage = 'booked') as src_booked
            from l
            group by source
          ) s
        )
      )
      from l
    ),

    'events', (
      with e as (
        select id, event_date, guest_count, event_type
        from public.events
        where venue_id = v_venue_id
      )
      select jsonb_build_object(
        'total',          count(*),
        'upcoming',       count(*) filter (where event_date >= current_date),
        'thisMonth',      count(*) filter (where event_date >= date_trunc('month', current_date)
                            and event_date < date_trunc('month', current_date) + interval '1 month'),
        'nextMonth',      count(*) filter (where event_date >= date_trunc('month', current_date) + interval '1 month'
                            and event_date < date_trunc('month', current_date) + interval '2 months'),
        'avgGuestCount',  coalesce(round(avg(guest_count) filter (where guest_count is not null and guest_count > 0)), 0),
        'byMonth', (
          select coalesce(jsonb_agg(
            jsonb_build_object(
              'month', to_char(mo, 'YYYY-MM'),
              'label', to_char(mo, 'Mon YYYY'),
              'count', cnt
            ) order by mo
          ), '[]')
          from (
            select date_trunc('month', event_date) as mo, count(*) as cnt
            from e
            where event_date >= date_trunc('month', current_date)
              and event_date < date_trunc('month', current_date) + interval '12 months'
            group by mo
          ) m
        )
      )
      from e
    ),

    'payments', (
      select jsonb_build_object(
        'totalOutstanding', coalesce(sum(i.balance_due) filter (where i.status not in ('paid','cancelled') and i.balance_due > 0), 0),
        'totalOverdue',     coalesce((
          select sum(pli.amount) from public.payment_line_items pli
          join public.payment_schedules ps on ps.id = pli.schedule_id and ps.venue_id = v_venue_id
          where pli.status = 'overdue'
        ), 0),
        'overdueCount',     coalesce((
          select count(distinct ps.event_id) from public.payment_line_items pli
          join public.payment_schedules ps on ps.id = pli.schedule_id and ps.venue_id = v_venue_id
          where pli.status = 'overdue'
        ), 0),
        'totalBilled',      coalesce(sum(i.total) filter (where i.status not in ('cancelled')), 0),
        'totalCollected',   coalesce(sum(i.total - i.balance_due) filter (where i.status not in ('cancelled')), 0),
        'totalCollectedCanonical', public.canonical_payments_collected(),
        'completionRate',   case
                            when sum(i.total) filter (where i.status not in ('cancelled')) > 0
                            then round(100.0
                                 * sum(i.total - i.balance_due) filter (where i.status not in ('cancelled'))
                                 / sum(i.total) filter (where i.status not in ('cancelled')))
                            else 0 end
      )
      from public.invoices i
      where i.venue_id = v_venue_id
    ),

    'featureAdoption', (
      with active_events as (
        select e.id as event_id, e.client_id
        from public.events e
        where e.venue_id = v_venue_id
          and e.event_date >= current_date
          and e.event_date <= current_date + interval '18 months'
      ),
      n as (select count(*) as total from active_events)
      select jsonb_build_object(
        'totalActiveEvents', n.total,
        'websitePublished',  (select count(distinct cw.client_id)  from public.couple_websites cw       join active_events ae on ae.client_id = cw.client_id       where cw.is_published = true),
        'websiteStarted',    (select count(distinct cw.client_id)  from public.couple_websites cw       join active_events ae on ae.client_id = cw.client_id),
        'budgetConfigured',  (select count(distinct cb.event_id)   from public.couple_budgets cb        join active_events ae on ae.event_id = cb.event_id          where cb.total_budget > 0),
        'seatingStarted',    (select count(distinct cg.client_id) from public.guest_seat_assignments gsa join public.couple_guests cg on cg.id = gsa.guest_id join active_events ae on ae.client_id = cg.client_id),
        'vendorsLinked',     (select count(distinct eva.event_id)  from public.event_vendor_assignments eva     join active_events ae on ae.event_id = eva.event_id  where eva.venue_id = v_venue_id),
        'documentsUploaded', (select count(distinct d.client_id)   from public.documents d              join active_events ae on ae.client_id = d.client_id         where d.venue_id = v_venue_id),
        'playbooksActive',   (select count(distinct et.event_id)   from public.event_tasks et           join active_events ae on ae.event_id = et.event_id          where et.venue_id = v_venue_id),
        'guestsAdded',       (select count(distinct cg.client_id)  from public.couple_guests cg        join active_events ae on ae.client_id = cg.client_id         where cg.venue_id = v_venue_id)
      )
      from n
    ),

    'coupleEngagement', (
      with active_events as (
        select e.id as event_id, e.client_id
        from public.events e
        where e.venue_id = v_venue_id
          and e.event_date >= current_date
          and e.event_date <= current_date + interval '18 months'
      ),
      n as (select count(*) as total from active_events)
      select jsonb_build_object(
        'totalActiveClients', n.total,
        'portalAdoption', (
          select case when n.total > 0
            then round(100.0 * count(distinct cps.client_id) / n.total)
            else 0 end
          from public.client_portal_sessions cps
          where cps.venue_id = v_venue_id
            and cps.client_id in (select client_id from active_events)
        ),
        'activeThisWeek', (
          select count(distinct cps.client_id)
          from public.client_portal_sessions cps
          where cps.venue_id = v_venue_id
            and cps.last_accessed_at >= now() - interval '7 days'
            and cps.client_id in (select client_id from active_events)
        ),
        'rsvpCompletionAvg', (
          select coalesce(round(avg(
            case when guest_total > 0 then responded::numeric / guest_total * 100 else 0 end
          )), 0)
          from (
            select
              ae.client_id,
              count(*) as guest_total,
              count(*) filter (where cg.rsvp_status <> 'pending') as responded
            from public.couple_guests cg
            join active_events ae on ae.client_id = cg.client_id
            where cg.venue_id = v_venue_id
            group by ae.client_id
            having count(*) > 0
          ) r
        )
      )
      from n
    )

  );
end;
$fn$;

-- get_client_health_scores
create or replace function public.get_client_health_scores()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
begin
  v_venue_id := public.current_user_venue_id();
  if v_venue_id is null then return jsonb_build_object('error', 'not_found'); end if;

  return jsonb_build_object(
    'clients', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'eventId',        e.id,
          'clientId',       c.id,
          'clientName',     c.first_name || coalesce(' & ' || c.partner_first_name, ''),
          'eventDate',      e.event_date,
          'daysUntilEvent', (e.event_date - current_date),
          'eventType',      e.event_type,
          'health',         h.health,
          'score',          h.score,
          'signals',        h.signals,
          'metrics',        h.metrics
        )
        order by e.event_date
      ), '[]')
      from public.events e
      join public.clients c on c.id = e.client_id
      cross join lateral (
        with
          -- ── Raw signal data ──────────────────────────────────────────────
          portal_data as (
            select
              count(*) > 0 as has_session,
              extract(days from now() - max(last_accessed_at))::int as days_since_login
            from public.client_portal_sessions
            where client_id = c.id and venue_id = v_venue_id
          ),
          guest_data as (
            select
              count(*) as guest_total,
              count(*) filter (where rsvp_status <> 'pending') as responded,
              count(*) filter (where rsvp_status = 'attending') as attending
            from public.couple_guests
            where client_id = c.id and venue_id = v_venue_id
          ),
          website_data as (
            select
              count(*) > 0 as started,
              coalesce(bool_or(is_published), false) as published
            from public.couple_websites
            where client_id = c.id and venue_id = v_venue_id
          ),
          budget_data as (
            select coalesce(bool_or(total_budget > 0), false) as configured
            from public.couple_budgets
            where event_id = e.id
          ),
          overdue_pay as (
            select count(*) as cnt
            from public.payment_line_items pli
            join public.payment_schedules ps on ps.id = pli.schedule_id
            where ps.event_id = e.id and ps.venue_id = v_venue_id
              and pli.status = 'overdue'
          ),
          overdue_tasks as (
            select count(*) as cnt
            from public.event_tasks et
            where et.event_id = e.id and et.venue_id = v_venue_id
              and (et.status = 'overdue' or (et.status = 'pending' and et.due_date < current_date))
          ),
          feedback_data as (
            select
              coalesce(max(overall_rating), 0) as rating,
              coalesce(bool_or(would_recommend), false) as recommends
            from public.couple_venue_feedback
            where event_id = e.id
          ),
          referral_data as (
            select count(*) > 0 as has_referral
            from public.couple_referrals
            where event_id = e.id and venue_id = v_venue_id
          ),
          doc_data as (
            select count(*) > 0 as has_docs
            from public.documents
            where client_id = c.id and venue_id = v_venue_id
          ),
          -- ── Score computation (computed once, referenced twice) ────────────
          score_data as (
            select greatest(0, least(100,
              60
              -- At Risk deductions
              + case when not p.has_session                                                                   then -25 else 0 end
              + case when p.has_session and coalesce(p.days_since_login,999) >= 14
                      and (e.event_date - current_date) <= 180                                               then -20 else 0 end
              + case when g.guest_total = 0 and (e.event_date - current_date) <= 180                        then -15 else 0 end
              + case when op.cnt > 0                                                                         then -20 * greatest(1, op.cnt::int) else 0 end
              + case when ot.cnt >= 3                                                                        then -10 else 0 end
              -- Healthy additions
              + case when p.has_session and coalesce(p.days_since_login, 999) < 7                           then  20 else 0 end
              + case when w.published                                                                        then  15 else 0 end
              + case when g.guest_total >= 5                                                                 then  10 else 0 end
              + case when g.guest_total > 0 and g.responded::numeric / g.guest_total > 0.25                 then  10 else 0 end
              + case when b.configured                                                                       then  10 else 0 end
              + case when d.has_docs                                                                         then   5 else 0 end
              -- Champion additions
              + case when f.rating >= 4                                                                      then  10 else 0 end
              + case when f.recommends                                                                       then  10 else 0 end
              + case when r.has_referral                                                                     then  15 else 0 end
            )) as score
            from portal_data p, guest_data g, website_data w, budget_data b,
                 overdue_pay op, overdue_tasks ot, feedback_data f, referral_data r, doc_data d
          )
        select
          sd.score,
          -- Health tier
          case
            when sd.score < 35 or op.cnt > 0 then 'at_risk'
            when sd.score < 60               then 'needs_attention'
            when sd.score < 80               then 'healthy'
            else                                  'champion'
          end as health,
          -- Signal objects (Luv reads these in Sprint 88)
          jsonb_build_object(
            'atRisk', (
              select coalesce(jsonb_agg(sig), '[]') from (
                select 'no_portal_setup'     as sig where not p.has_session
                union all select 'portal_inactive_14d' where p.has_session and coalesce(p.days_since_login,999) >= 14 and (e.event_date - current_date) <= 180
                union all select 'no_guests'           where g.guest_total = 0 and (e.event_date - current_date) <= 180
                union all select 'payment_overdue'     where op.cnt > 0
                union all select 'tasks_behind'        where ot.cnt >= 3
              ) t
            ),
            'healthy', (
              select coalesce(jsonb_agg(sig), '[]') from (
                select 'portal_active'      as sig where p.has_session and coalesce(p.days_since_login,999) < 7
                union all select 'website_published'  where w.published
                union all select 'website_started'    where w.started and not w.published
                union all select 'guests_adding'      where g.guest_total >= 5
                union all select 'rsvp_active'        where g.guest_total > 0 and g.responded::numeric / g.guest_total > 0.25
                union all select 'budget_set'         where b.configured
                union all select 'docs_shared'        where d.has_docs
              ) t
            ),
            'champion', (
              select coalesce(jsonb_agg(sig), '[]') from (
                select 'positive_feedback'  as sig where f.rating >= 4
                union all select 'recommends_venue'   where f.recommends
                union all select 'referral_sent'      where r.has_referral
              ) t
            )
          ) as signals,
          -- Raw metrics (for the table display and future Luv context)
          jsonb_build_object(
            'daysSinceLogin',   p.days_since_login,
            'hasPortal',        p.has_session,
            'guestCount',       g.guest_total,
            'rsvpResponded',    g.responded,
            'rsvpRate',         case when g.guest_total > 0 then round(100.0 * g.responded / g.guest_total) else 0 end,
            'websitePublished', w.published,
            'websiteStarted',   w.started,
            'budgetConfigured', b.configured,
            'paymentsOverdue',  op.cnt,
            'tasksOverdue',     ot.cnt
          ) as metrics
        from score_data sd, portal_data p, guest_data g, website_data w, budget_data b,
             overdue_pay op, overdue_tasks ot, feedback_data f, referral_data r, doc_data d
      ) h
      where e.venue_id = v_venue_id
        and e.event_date >= current_date
        and e.event_date <= current_date + interval '24 months'
    )
  );
end;
$$;

-- save_luv_rollup
create or replace function public.save_luv_rollup(
  p_metrics_snapshot jsonb,
  p_observations     jsonb,
  p_model_used       text default 'claude-sonnet-4-6'
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_venue_id uuid;
  v_id       uuid;
begin
  v_venue_id := public.current_user_venue_id();
  if v_venue_id is null then return jsonb_build_object('error', 'not_found'); end if;

  insert into public.luv_rollups (venue_id, metrics_snapshot, observations, model_used)
  values (v_venue_id, p_metrics_snapshot, p_observations, p_model_used)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- get_luv_rollups
create or replace function public.get_luv_rollups(p_limit int default 5)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_venue_id uuid;
begin
  v_venue_id := public.current_user_venue_id();
  if v_venue_id is null then return jsonb_build_object('rollups', '[]'::jsonb); end if;

  return jsonb_build_object(
    'rollups', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',           r.id,
          'generatedAt',  r.generated_at,
          'observations', r.observations,
          'modelUsed',    r.model_used
        ) order by r.generated_at desc
      )
      from public.luv_rollups r
      where r.venue_id = v_venue_id
      limit p_limit
    ), '[]'::jsonb)
  );
end;
$$;

-- search_global
create or replace function public.search_global(
  p_query text,
  p_limit int default 5
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
  v_term     text;
begin
  v_venue_id := public.current_user_venue_id();
  if v_venue_id is null then return jsonb_build_object('error', 'not_found'); end if;

  p_query := trim(p_query);
  if p_query = '' then return jsonb_build_object('results', '[]'::jsonb); end if;

  v_term := '%' || lower(p_query) || '%';

  return jsonb_build_object('results', (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id',       r.id,
        'kind',     r.kind,
        'title',    r.title,
        'subtitle', r.subtitle,
        'link',     r.link,
        'emoji',    r.emoji
      )
      order by r.sort_order, r.title
    ), '[]'::jsonb)
    from (

      -- ── Leads ──────────────────────────────────────────────────────────────
      (select
        'lead'                                                       as kind,
        id::text,
        first_name || ' ' || last_name                               as title,
        coalesce(email, event_type, 'Lead inquiry')                  as subtitle,
        '/leads'                                                     as link,
        '✨'                                                         as emoji,
        1                                                            as sort_order
      from public.leads
      where venue_id = v_venue_id
        and (
          lower(first_name || ' ' || last_name)                     like v_term
          or lower(coalesce(email, ''))                              like v_term
          or lower(coalesce(event_type, ''))                         like v_term
          or lower(coalesce(partner_first_name, '') || ' ' || coalesce(partner_last_name, '')) like v_term
        )
      limit p_limit)

      union all

      -- ── Events ─────────────────────────────────────────────────────────────
      (select
        'event'                                                      as kind,
        e.id::text,
        e.name                                                       as title,
        coalesce(
          c.first_name || ' & ' || c.last_name,
          e.event_type,
          to_char(e.event_date, 'Mon DD, YYYY')
        )                                                            as subtitle,
        '/events/' || e.id::text                                     as link,
        '📅'                                                         as emoji,
        2                                                            as sort_order
      from public.events e
      left join public.clients c on c.id = e.client_id
      where e.venue_id = v_venue_id
        and (
          lower(e.name)                                              like v_term
          or lower(coalesce(e.event_type, ''))                       like v_term
          or lower(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, ''))          like v_term
          or lower(coalesce(c.partner_first_name, '') || ' ' || coalesce(c.partner_last_name, '')) like v_term
        )
      limit p_limit)

      union all

      -- ── Vendors ────────────────────────────────────────────────────────────
      (select
        'vendor'                                                     as kind,
        v.id::text,
        v.business_name                                              as title,
        coalesce(v.category, v.contact_name, 'Vendor')                as subtitle,
        '/vendors/' || v.id::text                                    as link,
        '🤝'                                                         as emoji,
        3                                                            as sort_order
      from public.vendors v
      join public.venue_vendor_relationships vvr
        on vvr.vendor_id = v.id and vvr.venue_id = v_venue_id
      -- Fixed here (RC2, Milestone 4): the original Sprint 86 predicate
      -- referenced vvr.is_active, a column that has never existed on
      -- venue_vendor_relationships (only status: invited/active/inactive),
      -- which broke this ENTIRE function — a bad column reference in any
      -- UNION ALL arm fails the whole query at parse time, not just this
      -- branch. Found while testing this migration's own new branches.
      where vvr.status != 'inactive'
        and (
          lower(v.business_name)                                     like v_term
          or lower(coalesce(v.category, ''))                         like v_term
          or lower(coalesce(v.contact_name, ''))                     like v_term
          or lower(coalesce(v.email, ''))                            like v_term
        )
      limit p_limit)

      union all

      -- ── Guests ─────────────────────────────────────────────────────────────
      (select
        'guest'                                                      as kind,
        g.id::text,
        g.first_name || coalesce(' ' || g.last_name, '')             as title,
        coalesce(g.email, 'Guest')                                   as subtitle,
        coalesce(
          '/events/' || e.id::text || '?tab=final-details',
          '/events'
        )                                                            as link,
        '👥'                                                         as emoji,
        4                                                            as sort_order
      from public.couple_guests g
      left join lateral (
        select id from public.events
        where client_id = g.client_id and venue_id = g.venue_id
        order by event_date asc
        limit 1
      ) e on true
      where g.venue_id = v_venue_id
        and (
          lower(g.first_name || coalesce(' ' || g.last_name, ''))   like v_term
          or lower(coalesce(g.email, ''))                            like v_term
        )
      limit p_limit)

      union all

      -- ── Documents ──────────────────────────────────────────────────────────
      (select
        'document'                                                   as kind,
        d.id::text,
        d.name                                                       as title,
        coalesce(d.category, d.file_name)                            as subtitle,
        coalesce(
          case when d.event_id  is not null then '/events/'  || d.event_id::text  || '?tab=documents' end,
          case when d.lead_id   is not null then '/leads'                                              end,
          '/documents'
        )                                                            as link,
        '📄'                                                         as emoji,
        5                                                            as sort_order
      from public.documents d
      where d.venue_id = v_venue_id
        and (
          lower(d.name)                                              like v_term
          or lower(d.file_name)                                      like v_term
          or lower(coalesce(d.category, ''))                         like v_term
        )
      limit p_limit)

      union all

      -- ── Tasks ──────────────────────────────────────────────────────────────
      (select
        'task'                                                       as kind,
        t.id::text,
        t.title                                                      as title,
        coalesce(e.name, t.category, 'Task')                         as subtitle,
        '/events/' || t.event_id::text || '?tab=playbook'           as link,
        '✅'                                                         as emoji,
        6                                                            as sort_order
      from public.event_tasks t
      left join public.events e on e.id = t.event_id
      where t.venue_id = v_venue_id
        and (
          lower(t.title)                                             like v_term
          or lower(coalesce(t.description, ''))                      like v_term
        )
      limit p_limit)

      union all

      -- ── Conversations — RC2, Milestone 4 ──────────────────────────────────
      -- Matches message content, resolved up to one result per Conversation
      -- (most recent matching message), never a raw message row. A
      -- relationship-anchored Conversation deep-links into the Inbox; a
      -- vendor-anchored one deep-links to its Event's Vendors tab, matching
      -- where each type's thread actually lives.
      (select
        'conversation'                                               as kind,
        x.id,
        x.title,
        x.subtitle,
        x.link,
        '💬'                                                         as emoji,
        7                                                            as sort_order
      from (
        select distinct on (c.id)
          c.id::text                                                 as id,
          coalesce(rel.title, ven.title, 'Conversation')              as title,
          left(cm.body, 100)                                          as subtitle,
          coalesce(rel.link, ven.link, '/messaging')                  as link,
          cm.sent_at
        from public.conversation_messages cm
        join public.conversations c on c.id = cm.conversation_id
        -- Matched via clients.relationship_id directly (Phase 2B), not
        -- through a lead join — see 20261117000000's fix to
        -- get_conversation_inbox for why the lead-join form silently
        -- produces nothing for a client created without a Lead row.
        left join lateral (
          select
            coalesce(
              (select cl.first_name || coalesce(' ' || cl.last_name, '') || coalesce(' & ' || cl.partner_first_name, '')
                 from public.clients cl
                where cl.relationship_id = c.relationship_id
                order by cl.created_at desc limit 1),
              (select l.first_name || coalesce(' ' || l.last_name, '') || coalesce(' & ' || l.partner_first_name, '')
                 from public.leads l where l.relationship_id = c.relationship_id
                order by l.created_at desc limit 1)
            )                                                        as title,
            '/messaging?conversation=' || c.id::text                 as link
          where c.relationship_id is not null
        ) rel on true
        left join lateral (
          select
            v.business_name || ' — ' || e.name                       as title,
            '/events/' || e.id::text || '#vendors'                   as link
          from public.event_vendor_assignments eva
          join public.vendors v on v.id = eva.vendor_id
          join public.events e on e.id = eva.event_id
          where eva.id = c.event_vendor_assignment_id
        ) ven on true
        where c.venue_id = v_venue_id
          and lower(cm.body) like v_term
        order by c.id, cm.sent_at desc
      ) x
      limit p_limit)

      union all

      -- ── Requests — RC2, Milestone 4 ───────────────────────────────────────
      (select
        'request'                                                    as kind,
        r.id::text,
        r.title                                                      as title,
        coalesce(
          cl.first_name || coalesce(' & ' || cl.partner_first_name, ''),
          initcap(replace(r.status, '_', ' '))
        )                                                            as subtitle,
        '/requests/' || r.id::text                                   as link,
        '📋'                                                         as emoji,
        8                                                            as sort_order
      from public.requests r
      left join public.clients cl on cl.id = r.client_id
      where r.venue_id = v_venue_id
        and (
          lower(r.title)                                             like v_term
          or lower(coalesce(r.description, ''))                      like v_term
        )
      limit p_limit)

    ) r
  ));
end;
$$;

-- get_actor_context
create or replace function public.get_actor_context()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_venue_id  uuid;
  v_vendor_id uuid;
  v_role      text;
begin
  -- Venue owner takes priority
  v_venue_id := public.current_user_venue_id();

  if v_venue_id is not null then
    return jsonb_build_object(
      'actor_type', 'venue_owner',
      'entity_id',  v_venue_id,
      'role',       'owner'
    );
  end if;

  -- Vendor user (highest role wins when user belongs to multiple vendors)
  select vendor_id, role into v_vendor_id, v_role
  from public.vendor_users
  where user_id = auth.uid() and is_active = true
  order by case role when 'owner' then 1 when 'manager' then 2 when 'staff' then 3 else 4 end
  limit 1;

  if v_vendor_id is not null then
    return jsonb_build_object(
      'actor_type', 'vendor',
      'entity_id',  v_vendor_id,
      'role',       v_role
    );
  end if;

  return jsonb_build_object('actor_type', 'unknown');
end $$;

-- complete_venue_setup
create or replace function public.complete_venue_setup(payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid  uuid := auth.uid();
  v_id uuid;
  hour jsonb;
  v_completed boolean := coalesce((payload ->> 'setup_completed')::boolean, true);
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  v_id := public.current_user_venue_id();

  if v_id is null and (
    exists (
      select 1 from public.venue_staff
      where user_id = uid and is_active = true and accepted_at is not null
    )
    or exists (
      select 1 from public.venues where owner_user_id = uid
    )
  ) then
    raise exception 'active_venue_required'
      using errcode = 'P0001';
  end if;

  if v_id is null then
    v_id := gen_random_uuid();
    insert into public.venues (
      id, owner_user_id, name, business_name, email, phone, website,
      address_line1, address_line2, city, state_region, postal_code, country,
      venue_type, capacity, timezone,
      logo_url, primary_color, secondary_color, accent_color, neutral_color,
      currency, week_starts_on,
      stripe_onboarding_status,
      onboarding_persona, setup_last_step,
      setup_completed, setup_completed_at
    ) values (
      v_id,
      uid,
      payload ->> 'name',
      nullif(payload ->> 'business_name', ''),
      nullif(payload ->> 'email', ''),
      nullif(payload ->> 'phone', ''),
      nullif(payload ->> 'website', ''),
      nullif(payload ->> 'address_line1', ''),
      nullif(payload ->> 'address_line2', ''),
      nullif(payload ->> 'city', ''),
      nullif(payload ->> 'state_region', ''),
      nullif(payload ->> 'postal_code', ''),
      nullif(payload ->> 'country', ''),
      nullif(payload ->> 'venue_type', ''),
      nullif(payload ->> 'capacity', '')::integer,
      coalesce(nullif(payload ->> 'timezone', ''), 'America/New_York'),
      nullif(payload ->> 'logo_url', ''),
      coalesce(nullif(payload ->> 'primary_color', ''), '#5D6F5D'),
      coalesce(nullif(payload ->> 'secondary_color', ''), '#4F5F4F'),
      coalesce(nullif(payload ->> 'accent_color', ''), '#B8AEA1'),
      coalesce(nullif(payload ->> 'neutral_color', ''), '#F7F5F1'),
      coalesce(nullif(payload ->> 'currency', ''), 'USD'),
      coalesce((payload ->> 'week_starts_on')::smallint, 0),
      coalesce(
        nullif(payload ->> 'stripe_onboarding_status', '')::text,
        'not_started'
      ),
      nullif(payload ->> 'onboarding_persona', ''),
      nullif(payload ->> 'setup_last_step', ''),
      v_completed,
      case when v_completed then now() else null end
    );
  else
    update public.venues set
      name                     = payload ->> 'name',
      business_name            = nullif(payload ->> 'business_name', ''),
      email                    = nullif(payload ->> 'email', ''),
      phone                    = nullif(payload ->> 'phone', ''),
      website                  = nullif(payload ->> 'website', ''),
      address_line1            = nullif(payload ->> 'address_line1', ''),
      address_line2            = nullif(payload ->> 'address_line2', ''),
      city                     = nullif(payload ->> 'city', ''),
      state_region             = nullif(payload ->> 'state_region', ''),
      postal_code              = nullif(payload ->> 'postal_code', ''),
      country                  = nullif(payload ->> 'country', ''),
      venue_type               = nullif(payload ->> 'venue_type', ''),
      capacity                 = nullif(payload ->> 'capacity', '')::integer,
      timezone                 = coalesce(nullif(payload ->> 'timezone', ''), 'America/New_York'),
      logo_url                 = nullif(payload ->> 'logo_url', ''),
      primary_color            = coalesce(nullif(payload ->> 'primary_color', ''), '#5D6F5D'),
      secondary_color          = coalesce(nullif(payload ->> 'secondary_color', ''), '#4F5F4F'),
      accent_color             = coalesce(nullif(payload ->> 'accent_color', ''), '#B8AEA1'),
      neutral_color            = coalesce(nullif(payload ->> 'neutral_color', ''), '#F7F5F1'),
      currency                 = coalesce(nullif(payload ->> 'currency', ''), 'USD'),
      week_starts_on           = coalesce((payload ->> 'week_starts_on')::smallint, 0),
      stripe_onboarding_status = coalesce(
                                    nullif(payload ->> 'stripe_onboarding_status', '')::text,
                                    'not_started'
                                  ),
      onboarding_persona       = coalesce(nullif(payload ->> 'onboarding_persona', ''), public.venues.onboarding_persona),
      setup_last_step          = coalesce(nullif(payload ->> 'setup_last_step', ''), public.venues.setup_last_step),
      -- Sticky once true: a stale in-flight progress-save (setup_completed:
      -- false) racing behind the real final submit must never un-complete
      -- an already-finished venue.
      setup_completed          = public.venues.setup_completed or v_completed,
      setup_completed_at       = case
                                    when (public.venues.setup_completed or v_completed) and public.venues.setup_completed_at is null then now()
                                    else public.venues.setup_completed_at
                                  end,
      updated_at               = now()
    where id = v_id;
  end if;

  -- Upsert owner staff record
  update public.venue_staff
  set full_name = coalesce(nullif(payload -> 'owner' ->> 'full_name', ''), full_name),
      email = coalesce(nullif(payload -> 'owner' ->> 'email', ''), email),
      title = coalesce(nullif(payload -> 'owner' ->> 'title', ''), title)
  where venue_id = v_id
    and user_id = uid;

  if not found then
    insert into public.venue_staff (venue_id, user_id, full_name, email, title, role, is_owner)
    values (
      v_id, uid,
      coalesce(nullif(payload -> 'owner' ->> 'full_name', ''), 'Owner'),
      nullif(payload -> 'owner' ->> 'email', ''),
      nullif(payload -> 'owner' ->> 'title', ''),
      'owner', true
    );
  end if;

  -- Upsert business hours
  for hour in select * from jsonb_array_elements(payload -> 'business_hours')
  loop
    insert into public.venue_business_hours (venue_id, day_of_week, is_open, open_time, close_time)
    values (
      v_id,
      (hour ->> 'day_of_week')::smallint,
      (hour ->> 'is_open')::boolean,
      nullif(hour ->> 'open_time', '')::time,
      nullif(hour ->> 'close_time', '')::time
    )
    on conflict (venue_id, day_of_week) do update set
      is_open    = excluded.is_open,
      open_time  = excluded.open_time,
      close_time = excluded.close_time;
  end loop;

  notify pgrst, 'reload schema';
  return v_id;
end;
$$;



-- Dropped last. Replay safety is the enrollment row lock plus stripe_checkout_session_id,
-- not this index.

-- Additional scalar owner lookups found on re-scan.
-- send_anniversary_message
create or replace function public.send_anniversary_message(
  p_event_id   uuid,
  p_message    text,
  p_year       int default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
begin
  v_venue_id := public.current_user_venue_id();
  if v_venue_id is null or not exists (
    select 1 from public.events e
    where e.id = p_event_id and e.venue_id = v_venue_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  insert into public.venue_anniversary_messages (venue_id, event_id, message, year_number)
  values (v_venue_id, p_event_id, trim(p_message), p_year);

  return jsonb_build_object('ok', true);
end;
$$;

-- update_referral_status
create or replace function public.update_referral_status(
  p_referral_id uuid,
  p_status      text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
begin
  v_venue_id := public.current_user_venue_id();

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  update public.couple_referrals
  set status = case
    when p_status in ('new', 'contacted', 'booked') then p_status
    else status
  end
  where id = p_referral_id
    and venue_id = v_venue_id;

  return jsonb_build_object('ok', true);
end;
$$;

-- approve_couple_memory
create or replace function public.approve_couple_memory(p_memory_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
begin
  v_venue_id := public.current_user_venue_id();

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  update public.couple_memories
  set approved_at = now()
  where id = p_memory_id
    and venue_id = v_venue_id
    and visibility = 'testimonial';

  return jsonb_build_object('ok', true);
end;
$$;

-- get_venue_notifications
create or replace function public.get_venue_notifications(p_limit int default 40)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id     uuid;
  v_notifications jsonb;
  v_unread_count  int;
begin
  v_venue_id := public.current_user_venue_id();
  if v_venue_id is null then return jsonb_build_object('error', 'not_found'); end if;

  select count(*) into v_unread_count
  from public.venue_notifications
  where venue_id = v_venue_id
    and read_at  is null;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',        n.id,
      'type',      n.type,
      'title',     n.title,
      'body',      n.body,
      'link',      n.link,
      'emoji',     n.emoji,
      'eventId',   n.event_id,
      'readAt',    n.read_at,
      'createdAt', n.created_at
    ) order by n.created_at desc
  ), '[]'::jsonb)
  into v_notifications
  from (
    select * from public.venue_notifications
    where venue_id = v_venue_id
    order by created_at desc
    limit p_limit
  ) n;

  return jsonb_build_object(
    'notifications', v_notifications,
    'unreadCount',   v_unread_count
  );
end;
$$;

-- mark_notifications_read
create or replace function public.mark_notifications_read(p_notification_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
begin
  v_venue_id := public.current_user_venue_id();
  if v_venue_id is null then return jsonb_build_object('ok', false); end if;

  if array_length(p_notification_ids, 1) is null or array_length(p_notification_ids, 1) = 0 then
    -- Mark all unread notifications for this venue as read
    update public.venue_notifications
    set read_at = now()
    where venue_id = v_venue_id
      and read_at  is null;
  else
    update public.venue_notifications
    set read_at = now()
    where id      = any(p_notification_ids)
      and venue_id = v_venue_id
      and read_at  is null;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- venue_reminder_cadence policies were still contact-FK scoped. Child cadence
-- rows follow the active venue, matching the rewritten cadence RPCs.
drop policy if exists "venue owner reads own cadence" on public.venue_reminder_cadence;
create policy "venue owner reads own cadence"
  on public.venue_reminder_cadence for select
  using (venue_id = public.current_user_venue_id());

drop policy if exists "venue owner updates own cadence" on public.venue_reminder_cadence;
create policy "venue owner updates own cadence"
  on public.venue_reminder_cadence for update
  using (venue_id = public.current_user_venue_id());

drop index if exists public.venues_owner_unique;

notify pgrst, 'reload schema';
