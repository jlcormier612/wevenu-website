-- Timeline: signed day_offset (before / during / after) + template day_anchor.
-- Entries and template items store day_offset relative to event_date (start)
-- after apply resolution. Templates may declare day_anchor = event_end so the
-- offset is measured from the final event day at apply time.
-- Do not invent an end date when missing — apply falls back to event_start.

alter table public.timeline_entries
  drop constraint if exists timeline_entries_day_offset_nonneg;

alter table public.timeline_template_items
  drop constraint if exists timeline_template_items_day_offset_nonneg;

alter table public.timeline_template_items
  add column if not exists day_anchor text not null default 'event_start';

alter table public.timeline_template_items
  drop constraint if exists timeline_template_items_day_anchor_check;

alter table public.timeline_template_items
  add constraint timeline_template_items_day_anchor_check
  check (day_anchor in ('event_start', 'event_end'));

comment on column public.timeline_template_items.day_offset is
  'Signed day offset relative to day_anchor (event_start or event_end). Negative = before the anchor day.';

comment on column public.timeline_template_items.day_anchor is
  'Anchor for day_offset: event_start (default) or event_end. Resolved to event_date-relative offset on apply.';

comment on column public.timeline_entries.day_offset is
  'Signed days from events.event_date (0 = first event day). Negative = before the event starts.';

-- Soft-clamp: allow a planning pad before the event and after the last day.
-- Pad mirrors app MAX_TIMELINE_DAY_PAD (14). Does not invent event_end_date.
create or replace function public.timeline_clamp_day_offset(p_event_id uuid, p_day_offset integer)
returns integer
language sql
stable
security definer
set search_path to 'public'
as $$
  select greatest(
    -14,
    least(
      coalesce(p_day_offset, 0),
      coalesce(
        (
          select (e.event_end_date - e.event_date)
          from public.events e
          where e.id = p_event_id
            and e.event_end_date is not null
            and e.event_end_date > e.event_date
        ),
        0
      ) + 14
    )
  );
$$;

grant execute on function public.timeline_clamp_day_offset(uuid, integer) to authenticated, anon;

notify pgrst, 'reload schema';
