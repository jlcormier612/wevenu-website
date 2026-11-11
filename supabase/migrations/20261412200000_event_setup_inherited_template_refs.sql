-- Book-time snapshot of Setup Profile template_refs.
-- Sibling to inherited_decisions on the existing event_setup_states row.
-- Profile edits never rewrite this. Not a second source of truth.

alter table public.event_setup_states
  add column if not exists inherited_template_refs jsonb not null default '{}'::jsonb;

alter table public.event_setup_states
  drop constraint if exists event_setup_states_inherited_refs_object;

alter table public.event_setup_states
  add constraint event_setup_states_inherited_refs_object
  check (jsonb_typeof(inherited_template_refs) = 'object');

comment on column public.event_setup_states.inherited_template_refs is
  'Immutable book-time snapshot of the Setup Profile template_refs. Profile edits do not update this. References only — not applied artifacts.';

notify pgrst, 'reload schema';
