-- Narrow B / B0 — optional Guaranteed headcount beside Estimated (events.guest_count).
-- No commercial recalc in this slice; EO apply continues to use guest_count only.

alter table public.events
  add column if not exists guaranteed_guest_count integer;

comment on column public.events.guest_count is
  'Estimated guest count (Narrow B). Legacy column name retained.';
comment on column public.events.guaranteed_guest_count is
  'Optional Guaranteed guest count (Narrow B). Null until the venue sets it.';

alter table public.events
  drop constraint if exists events_guaranteed_guest_count_nonneg;
alter table public.events
  add constraint events_guaranteed_guest_count_nonneg
  check (guaranteed_guest_count is null or guaranteed_guest_count >= 0);
