-- Phase 1 recovery hot path (candidate only — not wired to live Leads UI).
-- Split the combined query_leads_list_page into:
--   1) query_leads_list_rows  — next page of matching rows + total_matching
--   2) query_leads_list_counts — chip / event-type aggregates only
-- Live getLeadsListPage stays on Wave 1 index until speed + correctness gates pass.

create or replace function public.lead_list_resolved_stage(
  p_sales_stage text,
  p_status text
) returns text
language sql
immutable
parallel safe
set search_path = public
as $$
  select case
    when p_sales_stage = 'cancelled' then 'cancelled'
    when p_sales_stage in (
      'new_inquiry',
      'outreach_sent',
      'enrolled_in_sequence',
      'tour_scheduled',
      'proposal_sent',
      'booked',
      'lost'
    ) then p_sales_stage
    when p_status = 'new' then 'new_inquiry'
    when p_status = 'contacted' then 'outreach_sent'
    when p_status = 'qualified' then 'outreach_sent'
    when p_status = 'proposal_sent' then 'proposal_sent'
    when p_status = 'won' then 'booked'
    when p_status in ('lost', 'cancelled') then 'lost'
    else 'new_inquiry'
  end;
$$;

revoke all on function public.lead_list_resolved_stage(text, text) from public;
grant execute on function public.lead_list_resolved_stage(text, text) to authenticated;

create or replace function public.query_leads_list_rows(
  p_venue_id uuid,
  p_outcome text default 'active',
  p_status text default null,
  p_event_type text default 'all',
  p_attention text default 'all',
  p_q text default '',
  p_sort text default 'newest',
  p_offset integer default 0,
  p_limit integer default 20,
  p_exclude_ids uuid[] default '{}',
  p_unattended_ids uuid[] default '{}',
  p_now timestamptz default now()
) returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_status text;
  v_event text;
  v_attention text;
  v_q text;
  v_sort text;
  v_now timestamptz;
  v_limit integer;
  v_offset integer;
  v_exclude uuid[];
  v_unattended uuid[];
  v_payload jsonb;
begin
  v_status := coalesce(
    nullif(btrim(coalesce(p_status, '')), ''),
    case when p_outcome = 'lost' then 'lost' else 'all' end
  );
  v_event := coalesce(nullif(btrim(coalesce(p_event_type, '')), ''), 'all');
  v_attention := case
    when p_attention in ('stale_contact', 'open', 'unseen', 'unattended_inquiry') then p_attention
    else 'all'
  end;
  v_q := lower(btrim(coalesce(p_q, '')));
  v_sort := case
    when p_sort in (
      'newest', 'oldest', 'az', 'za', 'event_asc', 'event_desc',
      'budget_high', 'budget_low', 'last_contacted', 'commitment_high'
    ) then p_sort
    else 'newest'
  end;
  v_now := coalesce(p_now, now());
  v_exclude := coalesce(p_exclude_ids, '{}'::uuid[]);
  v_unattended := coalesce(p_unattended_ids, '{}'::uuid[]);
  v_offset := case
    when cardinality(v_exclude) > 0 then 0
    else greatest(coalesce(p_offset, 0), 0)
  end;
  v_limit := least(greatest(coalesce(p_limit, 20), 1), 100);

  with eligible as (
    select
      l.*,
      public.lead_list_resolved_stage(l.sales_stage, l.status) as resolved_stage,
      public.normalize_lead_event_type(l.event_type) as norm_event
    from public.leads l
    where l.venue_id = p_venue_id
      and l.merged_into_lead_id is null
      and not exists (
        select 1
        from public.venue_customer_relationships r
        where r.id = l.relationship_id
          and r.venue_id = p_venue_id
          and r.archived_at is not null
      )
  ),
  filtered as (
    select *
    from eligible e
    where (
      case
        when v_status = 'lost' then e.resolved_stage = 'lost'
        else e.resolved_stage not in ('booked', 'lost', 'won', 'cancelled')
      end
    )
      and (v_status in ('all', 'lost') or e.resolved_stage = v_status)
      and (v_event = 'all' or e.norm_event = v_event)
      and (
        v_attention <> 'stale_contact'
        or coalesce(
          e.last_contacted_at,
          case
            when e.inquiry_date is not null
              then (e.inquiry_date::text || 'T00:00:00Z')::timestamptz
          end,
          e.created_at
        ) <= v_now - interval '7 days'
      )
      and (
        v_attention <> 'open'
        or e.resolved_stage not in ('booked', 'lost', 'won', 'cancelled')
      )
      and (
        v_attention <> 'unseen'
        or (
          e.venue_seen_at is null
          and e.resolved_stage not in ('booked', 'lost', 'won', 'cancelled')
        )
      )
      and (
        v_attention <> 'unattended_inquiry'
        or e.id = any (v_unattended)
      )
      and (
        v_q = ''
        or strpos(lower(coalesce(e.first_name, '')), v_q) > 0
        or strpos(lower(coalesce(e.last_name, '')), v_q) > 0
        or strpos(lower(coalesce(e.partner_first_name, '')), v_q) > 0
        or strpos(lower(coalesce(e.partner_last_name, '')), v_q) > 0
        or strpos(lower(coalesce(e.email, '')), v_q) > 0
        or strpos(lower(coalesce(e.phone, '')), v_q) > 0
        or strpos(lower(coalesce(e.event_type, '')), v_q) > 0
        or strpos(lower(coalesce(e.source, '')), v_q) > 0
      )
  ),
  numbered as (
    select
      row_number() over (
        order by
          case when v_sort = 'oldest' then f.inquiry_date end asc nulls first,
          case when v_sort = 'newest' then f.inquiry_date end desc nulls last,
          case when v_sort = 'az' then f.first_name end asc nulls first,
          case when v_sort = 'za' then f.first_name end desc nulls last,
          case when v_sort = 'event_asc' then f.event_date end asc nulls last,
          case when v_sort = 'event_desc' then f.event_date end desc nulls last,
          case when v_sort = 'budget_low' then coalesce(f.estimated_budget, 0) end asc,
          case when v_sort = 'budget_high' then coalesce(f.estimated_budget, 0) end desc,
          case when v_sort = 'last_contacted' then f.last_contacted_at end desc nulls last,
          case when v_sort = 'commitment_high' then coalesce(f.commitment_score, 0) end desc,
          case when v_sort not in ('newest', 'oldest') then f.inquiry_date end desc nulls last,
          f.created_at desc,
          f.id desc
      ) as rn,
      f.id,
      f.venue_id,
      f.sales_stage,
      f.status,
      f.source,
      f.pipeline_stage_id,
      f.first_name,
      f.last_name,
      f.email,
      f.phone,
      f.preferred_communication_channels,
      f.partner_first_name,
      f.partner_last_name,
      f.partner_email,
      f.event_type,
      f.event_date,
      f.planned_event_space_id,
      f.end_date,
      f.guest_count,
      f.estimated_budget,
      f.inquiry_date,
      f.next_action_text,
      f.next_action_due,
      f.follow_up_date,
      f.last_contacted_at,
      f.commitment_score,
      f.responsiveness_score,
      f.interest_score,
      f.scores_updated_at,
      f.relationship_id,
      f.intake_confidence,
      f.exclude_from_business_reporting,
      f.lost_reason,
      f.lost_reason_detail,
      f.lost_at,
      f.first_booked_at,
      f.venue_seen_at,
      f.assigned_staff_id,
      f.merged_into_lead_id,
      f.merged_at,
      f.created_at,
      f.updated_at
    from filtered f
    where cardinality(v_exclude) = 0
      or f.id <> all (v_exclude)
  )
  select jsonb_build_object(
    'leads', coalesce((
      select jsonb_agg(to_jsonb(page) - 'rn' order by page.rn)
      from (
        select n.*
        from numbered n
        where n.rn > v_offset
          and n.rn <= v_offset + v_limit
      ) page
    ), '[]'::jsonb),
    'total_matching', (select count(*) from filtered),
    'offset', v_offset,
    'page_size', v_limit,
    'has_more', coalesce((select max(rn) from numbered) > v_offset + v_limit, false)
  )
  into v_payload;

  return v_payload;
end;
$$;

comment on function public.query_leads_list_rows(
  uuid, text, text, text, text, text, text, integer, integer, uuid[], uuid[], timestamptz
) is
  'Candidate hot-path page of matching leads. Not wired to live UI until dual gates pass.';

revoke all on function public.query_leads_list_rows(
  uuid, text, text, text, text, text, text, integer, integer, uuid[], uuid[], timestamptz
) from public;
grant execute on function public.query_leads_list_rows(
  uuid, text, text, text, text, text, text, integer, integer, uuid[], uuid[], timestamptz
) to authenticated;

create or replace function public.query_leads_list_counts(
  p_venue_id uuid
) returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_payload jsonb;
begin
  with eligible as (
    select
      l.id,
      l.inquiry_date,
      l.created_at,
      public.lead_list_resolved_stage(l.sales_stage, l.status) as resolved_stage,
      public.normalize_lead_event_type(l.event_type) as norm_event
    from public.leads l
    where l.venue_id = p_venue_id
      and l.merged_into_lead_id is null
      and not exists (
        select 1
        from public.venue_customer_relationships r
        where r.id = l.relationship_id
          and r.venue_id = p_venue_id
          and r.archived_at is not null
      )
  ),
  active as (
    select *
    from eligible
    where resolved_stage not in ('booked', 'lost', 'won', 'cancelled')
  ),
  reps as (
    select distinct on (norm_event)
      norm_event,
      inquiry_date as rep_inquiry,
      created_at as rep_created,
      id as rep_id
    from active
    where norm_event is not null
    order by norm_event, inquiry_date desc nulls last, created_at desc, id desc
  ),
  event_counts as (
    select a.norm_event, count(*)::int as n
    from active a
    where a.norm_event is not null
    group by a.norm_event
  )
  select jsonb_build_object(
    'total_leads', (select count(*) from eligible),
    'status_counts', jsonb_build_object(
      'all', (select count(*) from active),
      'new_inquiry', (select count(*) from active where resolved_stage = 'new_inquiry'),
      'outreach_sent', (select count(*) from active where resolved_stage = 'outreach_sent'),
      'enrolled_in_sequence', (select count(*) from active where resolved_stage = 'enrolled_in_sequence'),
      'tour_scheduled', (select count(*) from active where resolved_stage = 'tour_scheduled'),
      'proposal_sent', (select count(*) from active where resolved_stage = 'proposal_sent'),
      'lost', (select count(*) from eligible where resolved_stage = 'lost')
    ),
    'event_type_counts', coalesce((
      select jsonb_agg(
        jsonb_build_array(c.norm_event, c.n)
        order by c.n desc, r.rep_inquiry desc nulls last, r.rep_created desc, r.rep_id desc
      )
      from event_counts c
      join reps r on r.norm_event = c.norm_event
    ), '[]'::jsonb)
  )
  into v_payload;

  return v_payload;
end;
$$;

comment on function public.query_leads_list_counts(uuid) is
  'Candidate Leads chip/event counts. Separate from page rows. Not wired to live UI until dual gates pass.';

revoke all on function public.query_leads_list_counts(uuid) from public;
grant execute on function public.query_leads_list_counts(uuid) to authenticated;
