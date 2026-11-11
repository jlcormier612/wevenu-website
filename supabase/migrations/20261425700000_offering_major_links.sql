-- ============================================================================
-- Offerings catalog — many-to-many major-choice associations
--
-- One canonical offering (e.g. Cheesecake) may belong under multiple top-level
-- majors (Plated Dinner + Buffet Dinner) without duplicating the catalog row.
--
-- Source of truth for associations: offering_major_links.
-- offerings.parent_offering_id is retained as a denormalized "primary" parent
-- (first parent by parent name) for one-level validation and legacy readers.
-- Event Order template options / client choices are unchanged — pricing and
-- inclusion remain on template options, not on these links.
-- ============================================================================

create table if not exists public.offering_major_links (
  id                 uuid primary key default gen_random_uuid(),
  venue_id           uuid not null references public.venues (id) on delete cascade,
  offering_id        uuid not null references public.offerings (id) on delete cascade,
  parent_offering_id uuid not null references public.offerings (id) on delete cascade,
  created_at         timestamptz not null default now(),
  unique (offering_id, parent_offering_id),
  check (offering_id <> parent_offering_id)
);

create index if not exists offering_major_links_venue
  on public.offering_major_links (venue_id);

create index if not exists offering_major_links_parent
  on public.offering_major_links (parent_offering_id);

create index if not exists offering_major_links_offering
  on public.offering_major_links (offering_id);

comment on table public.offering_major_links is
  'Catalog associations: offering belongs under one or more top-level major choices in the same venue. Does not create Event Order lines or carry price/inclusion.';

-- ---- validation ----------------------------------------------------------------

create or replace function public.validate_offering_major_link()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_child record;
  v_parent record;
begin
  select id, venue_id, category_id, parent_offering_id, is_archived
    into v_child
  from public.offerings
  where id = new.offering_id;

  if v_child.id is null then
    raise exception 'offering_major_links: offering not found';
  end if;
  if v_child.venue_id <> new.venue_id then
    raise exception 'offering_major_links: venue_id must match offering venue';
  end if;

  select id, venue_id, category_id, parent_offering_id, is_archived
    into v_parent
  from public.offerings
  where id = new.parent_offering_id;

  if v_parent.id is null then
    raise exception 'offering_major_links: parent offering not found';
  end if;
  if v_parent.venue_id <> new.venue_id then
    raise exception 'offering_major_links: parent must belong to the same venue';
  end if;

  if v_child.category_id is not null
     and v_parent.category_id is not null
     and v_child.category_id <> v_parent.category_id then
    raise exception 'offering_major_links: parent must be in the same category';
  end if;

  -- Parent must be top-level (legacy FK and links).
  if v_parent.parent_offering_id is not null then
    raise exception 'offering_major_links: parent must be a top-level major offering (one nesting level)';
  end if;
  if exists (
    select 1 from public.offering_major_links
    where offering_id = new.parent_offering_id
  ) then
    raise exception 'offering_major_links: parent must be a top-level major offering (one nesting level)';
  end if;

  -- Child must not itself be used as a parent of others (one nesting level).
  if exists (
    select 1 from public.offerings
    where parent_offering_id = new.offering_id
  ) then
    raise exception 'offering_major_links: offering is already a major for other items';
  end if;
  if exists (
    select 1 from public.offering_major_links
    where parent_offering_id = new.offering_id
  ) then
    raise exception 'offering_major_links: offering is already a major for other items';
  end if;

  return new;
end;
$$;

drop trigger if exists offering_major_links_validate on public.offering_major_links;
create trigger offering_major_links_validate
  before insert or update on public.offering_major_links
  for each row execute function public.validate_offering_major_link();

-- ---- backfill existing single-parent associations ------------------------------

insert into public.offering_major_links (venue_id, offering_id, parent_offering_id)
select o.venue_id, o.id, o.parent_offering_id
from public.offerings o
where o.parent_offering_id is not null
on conflict (offering_id, parent_offering_id) do nothing;

-- ---- RLS -----------------------------------------------------------------------

alter table public.offering_major_links enable row level security;

drop policy if exists offering_major_links_all on public.offering_major_links;
create policy offering_major_links_all on public.offering_major_links
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.offering_major_links to authenticated;
grant select, insert, update, delete on public.offering_major_links to service_role;

-- Keep parent_offering_id comment accurate for dual-write era.
comment on column public.offerings.parent_offering_id is
  'Denormalized primary major-choice parent (first associated major). Full associations live in offering_major_links. NULL = top-level (major choice or standalone).';
