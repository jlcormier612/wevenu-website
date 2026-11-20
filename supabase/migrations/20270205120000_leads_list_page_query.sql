-- Phase 1A — paged Leads read.
-- Asks Postgres for one page of matching leads plus list counts.
-- The live Leads page still uses the full index in application code.
-- Do not switch that page over until a Sandbox shadow compare passes
-- (same ids, order, and totals as the in-memory list).

-- Mirrors lib/event-types/canonical.ts normalizeEventType.
create or replace function public.normalize_lead_event_type(p_value text)
returns text
language sql
immutable
parallel safe
set search_path = public
as $$
  select case
    when p_value is null or btrim(p_value) = '' then null
    when lower(btrim(p_value)) = 'corporate_event' then 'corporate'
    when lower(btrim(p_value)) = 'birthday_milestone' then 'birthday'
    when lower(btrim(p_value)) in (
      'wedding',
      'elopement',
      'engagement_party',
      'rehearsal_dinner',
      'reception',
      'corporate',
      'social_event',
      'birthday',
      'anniversary',
      'shower',
      'gala',
      'retreat',
      'celebration_of_life',
      'quinceanera',
      'other'
    ) then lower(btrim(p_value))
    when lower(btrim(p_value)) = 'engagement party' then 'engagement_party'
    when lower(btrim(p_value)) = 'rehearsal dinner only' then 'rehearsal_dinner'
    when lower(btrim(p_value)) = 'rehearsal dinner' then 'rehearsal_dinner'
    when lower(btrim(p_value)) = 'reception only' then 'reception'
    when lower(btrim(p_value)) = 'corporate event' then 'corporate'
    when lower(btrim(p_value)) = 'social event' then 'social_event'
    when lower(btrim(p_value)) = 'birthday party' then 'birthday'
    when lower(btrim(p_value)) = 'anniversary celebration' then 'anniversary'
    when lower(btrim(p_value)) = 'bridal / baby shower' then 'shower'
    when lower(btrim(p_value)) = 'gala / fundraiser' then 'gala'
    when lower(btrim(p_value)) = 'celebration of life' then 'celebration_of_life'
    when lower(btrim(p_value)) = 'quinceañera' then 'quinceanera'
    else null
  end;
$$;

comment on function public.normalize_lead_event_type(text) is
  'Canonical event type for the Leads list. Same aliases and labels as normalizeEventType.';

revoke all on function public.normalize_lead_event_type(text) from public;
grant execute on function public.normalize_lead_event_type(text) to authenticated;

create or replace function public.query_leads_list_page(
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
  -- Show more passes already-seen ids and takes the next chunk from the top
  -- of what remains. Offset applies only when that list is empty.
  v_offset := case
    when cardinality(v_exclude) > 0 then 0
    else greatest(coalesce(p_offset, 0), 0)
  end;
  v_limit := least(greatest(coalesce(p_limit, 20), 1), 100);

  with base as (
    select
      l.id,
      l.venue_id,
      l.sales_stage,
      l.status,
      l.source,
      l.pipeline_stage_id,
      l.first_name,
      l.last_name,
      l.email,
      l.phone,
      l.preferred_communication_channels,
      l.partner_first_name,
      l.partner_last_name,
      l.partner_email,
      l.event_type,
      l.event_date,
      l.planned_event_space_id,
      l.end_date,
      l.guest_count,
      l.estimated_budget,
      l.inquiry_date,
      l.next_action_text,
      l.next_action_due,
      l.follow_up_date,
      l.last_contacted_at,
      l.commitment_score,
      l.responsiveness_score,
      l.interest_score,
      l.scores_updated_at,
      l.relationship_id,
      l.intake_confidence,
      l.exclude_from_business_reporting,
      l.lost_reason,
      l.lost_reason_detail,
      l.lost_at,
      l.first_booked_at,
      l.venue_seen_at,
      l.assigned_staff_id,
      l.merged_into_lead_id,
      l.merged_at,
      l.created_at,
      l.updated_at,
      case
        when l.sales_stage = 'cancelled' then 'cancelled'
        when l.sales_stage in (
          'new_inquiry',
          'outreach_sent',
          'enrolled_in_sequence',
          'tour_scheduled',
          'proposal_sent',
          'booked',
          'lost'
        ) then l.sales_stage
        when l.status = 'new' then 'new_inquiry'
        when l.status = 'contacted' then 'outreach_sent'
        when l.status = 'qualified' then 'outreach_sent'
        when l.status = 'proposal_sent' then 'proposal_sent'
        when l.status = 'won' then 'booked'
        when l.status in ('lost', 'cancelled') then 'lost'
        else 'new_inquiry'
      end as resolved_stage,
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
    from base
    where resolved_stage not in ('booked', 'lost', 'won', 'cancelled')
  ),
  filtered as (
    select *
    from base b
    where (
      case
        when v_status = 'lost' then b.resolved_stage = 'lost'
        else b.resolved_stage not in ('booked', 'lost', 'won', 'cancelled')
      end
    )
      and (v_status in ('all', 'lost') or b.resolved_stage = v_status)
      and (v_event = 'all' or b.norm_event = v_event)
      and (
        v_attention <> 'stale_contact'
        or coalesce(
          b.last_contacted_at,
          case
            when b.inquiry_date is not null
              then (b.inquiry_date::text || 'T00:00:00Z')::timestamptz
          end,
          b.created_at
        ) <= v_now - interval '7 days'
      )
      and (
        v_attention <> 'open'
        or b.resolved_stage not in ('booked', 'lost', 'won', 'cancelled')
      )
      and (
        v_attention <> 'unseen'
        or (
          b.venue_seen_at is null
          and b.resolved_stage not in ('booked', 'lost', 'won', 'cancelled')
        )
      )
      and (
        v_attention <> 'unattended_inquiry'
        or b.id = any (v_unattended)
      )
      and (
        v_q = ''
        or strpos(lower(coalesce(b.first_name, '')), v_q) > 0
        or strpos(lower(coalesce(b.last_name, '')), v_q) > 0
        or strpos(lower(coalesce(b.partner_first_name, '')), v_q) > 0
        or strpos(lower(coalesce(b.partner_last_name, '')), v_q) > 0
        or strpos(lower(coalesce(b.email, '')), v_q) > 0
        or strpos(lower(coalesce(b.phone, '')), v_q) > 0
        or strpos(lower(coalesce(b.event_type, '')), v_q) > 0
        or strpos(lower(coalesce(b.source, '')), v_q) > 0
      )
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
  ),
  numbered as (
    select
      row_number() over (
        -- Name order uses the database collation. Shadow compare must
        -- check A–Z / Z–A against today's localeCompare order before the
        -- live page is switched.
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
    'total_leads', (select count(*) from base),
    'total_matching', (select count(*) from filtered),
    'offset', v_offset,
    'page_size', v_limit,
    'has_more', coalesce((select max(rn) from numbered) > v_offset + v_limit, false),
    'status_counts', jsonb_build_object(
      'all', (select count(*) from active),
      'new_inquiry', (select count(*) from active where resolved_stage = 'new_inquiry'),
      'outreach_sent', (select count(*) from active where resolved_stage = 'outreach_sent'),
      'enrolled_in_sequence', (select count(*) from active where resolved_stage = 'enrolled_in_sequence'),
      'tour_scheduled', (select count(*) from active where resolved_stage = 'tour_scheduled'),
      'proposal_sent', (select count(*) from active where resolved_stage = 'proposal_sent'),
      'lost', (select count(*) from base where resolved_stage = 'lost')
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

comment on function public.query_leads_list_page(
  uuid, text, text, text, text, text, text, integer, integer, uuid[], uuid[], timestamptz
) is
  'Phase 1A paged Leads read. Not the live list until shadow compare passes. Counts ignore search and the page window. Booked chip count is supplied by the caller.';

revoke all on function public.query_leads_list_page(
  uuid, text, text, text, text, text, text, integer, integer, uuid[], uuid[], timestamptz
) from public;
grant execute on function public.query_leads_list_page(
  uuid, text, text, text, text, text, text, integer, integer, uuid[], uuid[], timestamptz
) to authenticated;
