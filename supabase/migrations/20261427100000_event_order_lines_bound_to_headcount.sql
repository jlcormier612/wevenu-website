-- Narrow B / B2 — mark Event Order lines that should follow Guaranteed ?? Estimated.
-- Recalc stays application-gated (headcountRecalcEnabled); this column only identifies
-- which lines are headcount-bound. Historical "Per person" notes are soft-backfilled.

alter table public.event_order_lines
  add column if not exists bound_to_headcount boolean not null default false;

comment on column public.event_order_lines.bound_to_headcount is
  'True when quantity should follow Guaranteed ?? Estimated on open unapproved orders (Narrow B).';

-- Soft backfill: template apply snapshots stamp notes = 'Per person' for per_person lines.
update public.event_order_lines
set bound_to_headcount = true
where bound_to_headcount = false
  and notes = 'Per person';
