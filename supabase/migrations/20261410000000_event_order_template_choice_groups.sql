-- Event Order Templates as commercial build sheets: selectable groups + options.
-- Absorbs Choices Template authoring shape into event_order_template_*.
-- Runtime client_choices instances gain event_order_template_id provenance.
-- Mock Choices template rows are not migrated; authoring moves to EO Templates.
-- Additive. Production untouched by this Sandbox-targeted apply path.

-- ---- 1. Choice groups on Event Order Templates --------------------------------

create table public.event_order_template_groups (
  id               uuid primary key default gen_random_uuid(),
  template_id      uuid not null references public.event_order_templates (id) on delete cascade,
  venue_id         uuid not null references public.venues (id) on delete cascade,
  section_id       uuid references public.event_order_template_sections (id) on delete set null,

  name             text not null check (char_length(trim(name)) > 0),
  instructions     text,
  selection_mode   text not null default 'single'
                   check (selection_mode in ('single', 'multi')),
  min_select       smallint not null default 0 check (min_select >= 0),
  max_select       smallint check (max_select is null or max_select >= 0),
  allow_quantity   boolean not null default false,
  sort_order       smallint not null default 0,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint event_order_template_groups_max_gte_min
    check (max_select is null or max_select >= min_select)
);

create index event_order_template_groups_order
  on public.event_order_template_groups (template_id, sort_order);
create index event_order_template_groups_section
  on public.event_order_template_groups (section_id)
  where section_id is not null;
create index event_order_template_groups_venue
  on public.event_order_template_groups (venue_id);

create trigger event_order_template_groups_updated_at
  before update on public.event_order_template_groups
  for each row execute function public.set_updated_at();

comment on table public.event_order_template_groups is
  'Selectable commercial groups on an Event Order Template (e.g. Bar: choose one).';

-- ---- 2. Options within groups -------------------------------------------------

create table public.event_order_template_options (
  id             uuid primary key default gen_random_uuid(),
  template_id    uuid not null references public.event_order_templates (id) on delete cascade,
  venue_id       uuid not null references public.venues (id) on delete cascade,
  group_id       uuid not null references public.event_order_template_groups (id) on delete cascade,

  offering_id    uuid references public.offerings (id) on delete set null,
  label          text not null check (char_length(trim(label)) > 0),
  description    text,
  -- Included / default commercial treatment (e.g. included bread service).
  is_included    boolean not null default false,
  -- Snapshot price for paid options. Null when unpriced or included.
  unit_price     numeric(10,2) check (unit_price is null or unit_price >= 0),
  -- Pre-selected when Use/Send opens (optional add-ons can leave false).
  is_default     boolean not null default false,
  sort_order     smallint not null default 0,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index event_order_template_options_order
  on public.event_order_template_options (group_id, sort_order);
create index event_order_template_options_offering
  on public.event_order_template_options (offering_id)
  where offering_id is not null;
create index event_order_template_options_template
  on public.event_order_template_options (template_id);

create trigger event_order_template_options_updated_at
  before update on public.event_order_template_options
  for each row execute function public.set_updated_at();

comment on table public.event_order_template_options is
  'Options inside an EO Template choice group. Offering FK is provenance; label/price are snapshots.';
comment on column public.event_order_template_options.is_included is
  'True = treated as included (typically $0 commercial impact when selected).';
comment on column public.event_order_template_options.is_default is
  'True = pre-selected when opening Use/Send for this template.';

-- ---- 3. RLS -------------------------------------------------------------------

alter table public.event_order_template_groups  enable row level security;
alter table public.event_order_template_options enable row level security;

create policy event_order_template_groups_all on public.event_order_template_groups
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy event_order_template_options_all on public.event_order_template_options
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.event_order_template_groups  to authenticated;
grant select, insert, update, delete on public.event_order_template_options to authenticated;
grant select, insert, update, delete on public.event_order_template_groups  to service_role;
grant select, insert, update, delete on public.event_order_template_options to service_role;

-- ---- 4. Runtime provenance: client_choices ← Event Order Template -------------
-- Keep client_choices_templates FK for any residual rows; new flow uses EO.

alter table public.client_choices
  add column if not exists event_order_template_id
    uuid references public.event_order_templates (id) on delete set null;

create index if not exists client_choices_eo_template
  on public.client_choices (event_order_template_id)
  where event_order_template_id is not null;

comment on column public.client_choices.event_order_template_id is
  'Authoring source when this selection instance was created from an Event Order Template. Definition remains frozen JSON.';

notify pgrst, 'reload schema';
