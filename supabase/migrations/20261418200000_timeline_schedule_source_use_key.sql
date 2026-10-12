-- Link schedule-derived timeline entries to booked component use keys.
-- event_space_assignments rows are fully replaced on save (new ids), so use_key
-- is the stable identity for idempotent schedule → timeline sync.

alter table public.timeline_entries
  add column if not exists source_space_use_key text;

comment on column public.timeline_entries.source_space_use_key is
  'When set, this venue-owned entry was generated from the booked component schedule (event_space_assignments.use_key). Null = manual / template entry.';

create unique index if not exists timeline_entries_event_schedule_use_key
  on public.timeline_entries (event_id, source_space_use_key)
  where source_space_use_key is not null
    and event_id is not null;

notify pgrst, 'reload schema';
