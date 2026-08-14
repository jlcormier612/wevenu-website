-- ============================================================================
-- Timeline template items — multi-day day_offset
--
-- Venue timeline templates aren't tied to a calendar range, but multi-day
-- events need items stamped to Day 1 / Day 2 / Day 3 when applied. Mirror
-- timeline_entries.day_offset (0-based) on the template layer.
-- ============================================================================

alter table public.timeline_template_items
  add column if not exists day_offset integer not null default 0;

alter table public.timeline_template_items
  drop constraint if exists timeline_template_items_day_offset_nonneg;

alter table public.timeline_template_items
  add constraint timeline_template_items_day_offset_nonneg check (day_offset >= 0);

update public.timeline_template_items set day_offset = 0 where day_offset is null;

comment on column public.timeline_template_items.day_offset is
  '0-based day relative to event start when this template item is applied (Day 1 = 0).';

create index if not exists timeline_template_items_template_day
  on public.timeline_template_items (template_id, day_offset, sort_order);
