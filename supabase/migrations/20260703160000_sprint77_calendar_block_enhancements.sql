-- Sprint 77: Calendar Block Enhancements
-- Adds hour-based blocks and recurrence rules (daily / weekly / annual).

alter table public.calendar_blocks
  add column if not exists recurrence_rule text not null default 'none'
    check (recurrence_rule in ('none', 'daily', 'weekly', 'annual')),
  add column if not exists recurrence_ends_on date;

comment on column public.calendar_blocks.recurrence_rule is
  'none = one-time block; daily = repeats every day; weekly = repeats same DOW; annual = repeats same month+day each year';
comment on column public.calendar_blocks.recurrence_ends_on is
  'Optional upper bound for recurring blocks (inclusive). NULL = repeats indefinitely.';
