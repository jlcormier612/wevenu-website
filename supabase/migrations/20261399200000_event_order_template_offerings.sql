-- Structured offerings on Event Order Templates.
-- Extends existing event_order_template_lines (no parallel catalog).
-- Library offerings remain the reusable catalog; template lines snapshot
-- name/price/unit at authoring time. Applying copies snapshots into the
-- event-specific Event Order. Later template edits never touch existing events.

alter table public.event_order_template_lines
  add column if not exists description_detail text,
  add column if not exists pricing_model text not null default 'none',
  add column if not exists unit text,
  add column if not exists included_by_default boolean not null default false,
  add column if not exists offering_id uuid references public.offerings (id) on delete set null;

alter table public.event_order_template_lines
  drop constraint if exists event_order_template_lines_pricing_model_check;

alter table public.event_order_template_lines
  add constraint event_order_template_lines_pricing_model_check
  check (pricing_model in ('none', 'flat', 'per_person', 'per_unit', 'custom'));

alter table public.event_order_template_lines
  alter column unit_price drop not null;

alter table public.event_order_template_lines
  drop constraint if exists event_order_template_lines_unit_price_check;

alter table public.event_order_template_lines
  add constraint event_order_template_lines_unit_price_check
  check (unit_price is null or unit_price >= 0);

-- Existing priced legacy lines become flat; zero-price rows stay unpriced.
update public.event_order_template_lines
set pricing_model = 'flat'
where unit_price is not null and unit_price > 0 and pricing_model = 'none';

update public.event_order_template_lines
set unit_price = null
where unit_price = 0 and pricing_model = 'none';

create index if not exists event_order_template_lines_offering
  on public.event_order_template_lines (offering_id)
  where offering_id is not null;

create index if not exists event_order_template_lines_section
  on public.event_order_template_lines (section_id, sort_order);

comment on column public.event_order_template_lines.description is
  'Offering name on this template. Snapshot — not a live catalog title.';
comment on column public.event_order_template_lines.description_detail is
  'Optional offering description / guidance on this template.';
comment on column public.event_order_template_lines.unit_price is
  'Optional snapshot price. Null means no price configured.';
comment on column public.event_order_template_lines.pricing_model is
  'none | flat | per_person | per_unit | custom (TBD).';
comment on column public.event_order_template_lines.offering_id is
  'Optional provenance to Library Offerings. Never a live price feed.';

notify pgrst, 'reload schema';
