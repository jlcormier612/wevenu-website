-- ============================================================================
-- Financial adjustments (multi discount/credit/charge) + date-range holds
--
-- commercial_selections.financial_adjustments: named adjustments; legacy
-- discount_* columns remain the rollup of all reductions.
--
-- date_holds.end_date: inclusive end of an all-day / multi-day reservation
-- (single-day legacy: end_date = hold_date).
-- date_holds.preference_id: optional explicit link to a lead space preference
-- (e.g. Friday rehearsal dinner) — holds never invent contract components.
-- ============================================================================

-- commercial_selections: multi-adjustment snapshot --------------------------------
alter table public.commercial_selections
  add column if not exists financial_adjustments jsonb not null default '[]'::jsonb;

comment on column public.commercial_selections.financial_adjustments is
  'Named adjustments [{id,kind,description,mode,value,amount,taxTreatment}]. Reductions roll up into discount_amount; charges are additive. Deposits are never stored here.';

-- date_holds: inclusive date range + optional preference association -------------
alter table public.date_holds
  add column if not exists end_date date;

alter table public.date_holds
  add column if not exists preference_id uuid
    references public.lead_event_space_preferences (id) on delete set null;

update public.date_holds
set end_date = hold_date
where end_date is null;

alter table public.date_holds
  alter column end_date set not null;

alter table public.date_holds
  drop constraint if exists date_holds_end_date_gte_hold_date;

alter table public.date_holds
  add constraint date_holds_end_date_gte_hold_date
    check (end_date >= hold_date);

comment on column public.date_holds.hold_date is
  'Inclusive start date of the reservation (legacy single-day holds use hold_date = end_date).';
comment on column public.date_holds.end_date is
  'Inclusive end date of the reservation. All-day Fri–Sun uses hold_date=Fri, end_date=Sun.';
comment on column public.date_holds.preference_id is
  'Optional explicit association to a lead_event_space_preferences row (e.g. rehearsal dinner). Never inferred from hold presence alone.';

create index if not exists date_holds_venue_date_range
  on public.date_holds (venue_id, hold_date, end_date)
  where status = 'active';

create index if not exists date_holds_preference_id
  on public.date_holds (preference_id)
  where preference_id is not null;

-- Range-aware foreign hold conflict helper (used by availability checks) ---------
create or replace function public.date_ranges_overlap(
  a_start date, a_end date, b_start date, b_end date
)
returns boolean
language sql
immutable
as $$
  select a_start <= b_end and b_start <= a_end;
$$;

comment on function public.date_ranges_overlap(date, date, date, date) is
  'Inclusive date-range overlap. Fri–Sun overlaps Sat; does not invent an extra day.';

notify pgrst, 'reload schema';
