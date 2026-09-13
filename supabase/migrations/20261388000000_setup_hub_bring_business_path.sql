-- Setup Hub: persist Bring Your Business path choices truthfully.
-- unaddressed | imported (derived from import_batches) | individual | skipped
-- individual / skipped are explicit owner decisions; imported is evidence-based.

alter table public.venue_setup_hub_state
  add column if not exists bring_your_business_path text
  check (
    bring_your_business_path is null
    or bring_your_business_path in ('individual', 'skipped')
  );

comment on column public.venue_setup_hub_state.bring_your_business_path is
  'Explicit BYB choice when not imported: individual (add myself) or skipped (not now). Imported is derived from import_batches.';

-- Backfill: prior "starting fresh" acknowledgments were stored only as
-- bring_your_business_manual_confirmed_at — treat those as skipped.
update public.venue_setup_hub_state
set bring_your_business_path = 'skipped'
where bring_your_business_manual_confirmed_at is not null
  and bring_your_business_path is null;
