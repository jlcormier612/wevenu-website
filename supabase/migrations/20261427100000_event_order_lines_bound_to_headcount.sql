-- Narrow B / B2 — mark Event Order lines that should follow Guaranteed ?? Estimated.
-- Recalc stays application-gated (headcountRecalcEnabled); this column only identifies
-- which lines are headcount-bound. Historical "Per person" notes are soft-backfilled.

alter table public.event_order_lines
  add column if not exists bound_to_headcount boolean not null default false;

comment on column public.event_order_lines.bound_to_headcount is
  'True when quantity should follow Guaranteed ?? Estimated on open unapproved orders (Narrow B).';

-- Soft backfill: template apply snapshots stamp notes = 'Per person' for per_person lines.
-- Only touch open Event Orders — finalized lines are immutable via trigger, and B2
-- never recalcs finalized orders anyway.
update public.event_order_lines eol
set bound_to_headcount = true
from public.event_orders eo
where eol.event_order_id = eo.id
  and eo.status = 'open'
  and eol.bound_to_headcount = false
  and eol.notes = 'Per person';
