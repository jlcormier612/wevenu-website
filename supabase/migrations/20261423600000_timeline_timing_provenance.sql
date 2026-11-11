-- Timeline P1a: timing provenance.
-- Existing rows are NOT classified as relative or fixed.
-- Null timing_day_intent / timing_clock_intent means unknown legacy intent.
-- timing_attention = unknown_intent marks those rows for a venue decision.

alter table public.timeline_entries
  add column if not exists timing_day_intent text,
  add column if not exists timing_day_anchor text,
  add column if not exists timing_relative_day_offset integer,
  add column if not exists timing_day_offset_overridden boolean not null default false,
  add column if not exists timing_template_day_offset integer,
  add column if not exists timing_template_day_anchor text,
  add column if not exists timing_fixed_date date,
  add column if not exists timing_clock_intent text,
  add column if not exists timing_relative_minutes integer,
  add column if not exists timing_clock_overridden boolean not null default false,
  add column if not exists timing_attention text;

alter table public.timeline_entries
  drop constraint if exists timeline_entries_timing_day_intent_check;
alter table public.timeline_entries
  add constraint timeline_entries_timing_day_intent_check
  check (timing_day_intent is null or timing_day_intent in ('relative', 'fixed', 'unknown'));

alter table public.timeline_entries
  drop constraint if exists timeline_entries_timing_day_anchor_check;
alter table public.timeline_entries
  add constraint timeline_entries_timing_day_anchor_check
  check (timing_day_anchor is null or timing_day_anchor in ('event_start', 'event_end'));

alter table public.timeline_entries
  drop constraint if exists timeline_entries_timing_template_day_anchor_check;
alter table public.timeline_entries
  add constraint timeline_entries_timing_template_day_anchor_check
  check (timing_template_day_anchor is null or timing_template_day_anchor in ('event_start', 'event_end'));

alter table public.timeline_entries
  drop constraint if exists timeline_entries_timing_clock_intent_check;
alter table public.timeline_entries
  add constraint timeline_entries_timing_clock_intent_check
  check (timing_clock_intent is null or timing_clock_intent in ('relative', 'explicit', 'untimed', 'unknown'));

alter table public.timeline_entries
  drop constraint if exists timeline_entries_timing_attention_check;
alter table public.timeline_entries
  add constraint timeline_entries_timing_attention_check
  check (
    timing_attention is null
    or timing_attention in ('missing_event_end', 'invalid_event_end', 'unknown_intent')
  );

comment on column public.timeline_entries.timing_day_intent is
  'relative, fixed, or unknown. NULL means legacy intent was not recorded and must not be inferred.';
comment on column public.timeline_entries.timing_fixed_date is
  'Calendar date when timing_day_intent = fixed. Does not slide with events.event_date.';
comment on column public.timeline_entries.timing_relative_day_offset is
  'Authored day offset from timing_day_anchor. Venue adjustments set timing_day_offset_overridden.';
comment on column public.timeline_entries.timing_clock_intent is
  'relative minutes from Day-of start, explicit clock, untimed, or unknown. NULL is unknown legacy.';
comment on column public.timeline_entries.timing_attention is
  'missing_event_end, invalid_event_end, or unknown_intent. Blocks silent recalculation.';

-- Mark legacy rows for review. Does not assign relative or fixed.
update public.timeline_entries
set timing_attention = 'unknown_intent'
where timing_day_intent is null
  and timing_attention is null;

-- Venue merged read includes provenance. Client snapshot rows are not given an invented intent.
create or replace function public.get_event_timeline_merged(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_venue_id      uuid;
  v_snapshot      jsonb;
  v_submitted_at  timestamptz;
begin
  select venue_id into v_venue_id from public.events where id = p_event_id;
  if v_venue_id is null or v_venue_id is distinct from public.current_user_venue_id() then
    return jsonb_build_object('error', 'not_found');
  end if;

  select snapshot, created_at into v_snapshot, v_submitted_at
  from public.timeline_submissions
  where event_id = p_event_id and venue_id = v_venue_id
  order by created_at desc limit 1;

  return jsonb_build_object(
    'lastSubmittedAt', v_submitted_at,
    'entries',
      (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'id', te.id, 'title', te.title, 'description', te.description, 'notes', te.notes,
            'entryTime', te.entry_time, 'dayOffset', te.day_offset,
            'sectionId', te.section_id, 'sortOrder', te.sort_order,
            'owner', te.owner, 'lockState', te.lock_state, 'audiences', te.audiences,
            'status', te.status, 'assignedToStaffId', te.assigned_to_staff_id, 'assignedToName', vs.full_name,
            'createdAt', te.created_at, 'updatedAt', te.updated_at,
            'timingDayIntent', te.timing_day_intent,
            'timingDayAnchor', te.timing_day_anchor,
            'timingRelativeDayOffset', te.timing_relative_day_offset,
            'timingDayOffsetOverridden', te.timing_day_offset_overridden,
            'timingTemplateDayOffset', te.timing_template_day_offset,
            'timingTemplateDayAnchor', te.timing_template_day_anchor,
            'timingFixedDate', te.timing_fixed_date,
            'timingClockIntent', te.timing_clock_intent,
            'timingRelativeMinutes', te.timing_relative_minutes,
            'timingClockOverridden', te.timing_clock_overridden,
            'timingAttention', te.timing_attention
          ) order by te.day_offset, te.entry_time asc nulls last, te.sort_order, te.created_at
        ), '[]'::jsonb)
        from public.timeline_entries te
        left join public.venue_staff vs on vs.id = te.assigned_to_staff_id
        where te.event_id = p_event_id and te.venue_id = v_venue_id and te.owner = 'venue'
      )
      ||
      (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'id', (item->>'id')::uuid, 'title', item->>'title', 'description', item->>'description', 'notes', null,
            'entryTime', item->>'entryTime',
            'dayOffset', coalesce((item->>'dayOffset')::int, 0),
            'sectionId', nullif(item->>'sectionId', ''), 'sortOrder', (item->>'sortOrder')::int,
            'owner', 'client', 'lockState', 'editable',
            'audiences', coalesce(item->'audiences', '[]'::jsonb),
            'status', coalesce(te.status, 'not_started'),
            'assignedToStaffId', te.assigned_to_staff_id, 'assignedToName', vs.full_name,
            'createdAt', te.created_at, 'updatedAt', te.updated_at
          ) order by coalesce((item->>'dayOffset')::int, 0), (item->>'entryTime') asc nulls last, (item->>'sortOrder')::int
        ), '[]'::jsonb)
        from jsonb_array_elements(coalesce(v_snapshot, '[]'::jsonb)) item
        left join public.timeline_entries te on te.id = (item->>'id')::uuid
        left join public.venue_staff vs on vs.id = te.assigned_to_staff_id
      )
  );
end;
$$;

notify pgrst, 'reload schema';
