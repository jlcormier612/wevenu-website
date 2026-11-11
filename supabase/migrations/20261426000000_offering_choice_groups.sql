-- ============================================================================
-- Offering catalog choice groups (Option A)
--
-- Named reusable groups under a parent/major Offering (e.g. Plated Dinner →
-- Entrées, Desserts). Membership links existing child Offerings via
-- offering_major_links eligibility. Template groups may optionally reference
-- a catalog group ID; legacy template groups keep null (no name-based remapping).
-- ============================================================================

-- ---- 1. Catalog groups --------------------------------------------------------

create table if not exists public.offering_choice_groups (
  id                  uuid primary key default gen_random_uuid(),
  venue_id            uuid not null references public.venues (id) on delete cascade,
  parent_offering_id  uuid not null references public.offerings (id) on delete cascade,
  name                text not null check (char_length(trim(name)) > 0),
  sort_order          smallint not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint offering_choice_groups_name_unique
    unique (venue_id, parent_offering_id, name)
);

create index if not exists offering_choice_groups_venue
  on public.offering_choice_groups (venue_id);

create index if not exists offering_choice_groups_parent
  on public.offering_choice_groups (parent_offering_id, sort_order);

create trigger offering_choice_groups_updated_at
  before update on public.offering_choice_groups
  for each row execute function public.set_updated_at();

comment on table public.offering_choice_groups is
  'Reusable named choice groups under a parent/major Offering (catalog). Template selection rules stay on event_order_template_groups.';

-- ---- 2. Membership ------------------------------------------------------------

create table if not exists public.offering_choice_group_members (
  id           uuid primary key default gen_random_uuid(),
  venue_id     uuid not null references public.venues (id) on delete cascade,
  group_id     uuid not null references public.offering_choice_groups (id) on delete cascade,
  offering_id  uuid not null references public.offerings (id) on delete cascade,
  sort_order   smallint not null default 0,
  created_at   timestamptz not null default now(),
  unique (group_id, offering_id)
);

create index if not exists offering_choice_group_members_venue
  on public.offering_choice_group_members (venue_id);

create index if not exists offering_choice_group_members_offering
  on public.offering_choice_group_members (offering_id);

create index if not exists offering_choice_group_members_group_order
  on public.offering_choice_group_members (group_id, sort_order);

comment on table public.offering_choice_group_members is
  'Child Offering membership in a catalog choice group. Same child may appear in multiple groups under the same parent.';

-- ---- 3. Validation ------------------------------------------------------------

create or replace function public.validate_offering_choice_group()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_parent record;
begin
  new.name := trim(new.name);
  if new.name = '' then
    raise exception 'offering_choice_groups: name is required';
  end if;

  select id, venue_id, parent_offering_id, is_archived
    into v_parent
  from public.offerings
  where id = new.parent_offering_id;

  if v_parent.id is null then
    raise exception 'offering_choice_groups: parent offering not found';
  end if;
  if v_parent.venue_id <> new.venue_id then
    raise exception 'offering_choice_groups: venue_id must match parent venue';
  end if;
  if v_parent.parent_offering_id is not null then
    raise exception 'offering_choice_groups: parent must be a top-level major offering';
  end if;
  if exists (
    select 1 from public.offering_major_links
    where offering_id = new.parent_offering_id
  ) then
    raise exception 'offering_choice_groups: parent must be a top-level major offering';
  end if;

  return new;
end;
$$;

drop trigger if exists offering_choice_groups_validate on public.offering_choice_groups;
create trigger offering_choice_groups_validate
  before insert or update on public.offering_choice_groups
  for each row execute function public.validate_offering_choice_group();

create or replace function public.validate_offering_choice_group_member()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_group record;
  v_child record;
begin
  select id, venue_id, parent_offering_id
    into v_group
  from public.offering_choice_groups
  where id = new.group_id;

  if v_group.id is null then
    raise exception 'offering_choice_group_members: group not found';
  end if;
  if v_group.venue_id <> new.venue_id then
    raise exception 'offering_choice_group_members: venue_id must match group venue';
  end if;

  select id, venue_id, is_archived
    into v_child
  from public.offerings
  where id = new.offering_id;

  if v_child.id is null then
    raise exception 'offering_choice_group_members: offering not found';
  end if;
  if v_child.venue_id <> new.venue_id then
    raise exception 'offering_choice_group_members: venue_id must match offering venue';
  end if;
  if new.offering_id = v_group.parent_offering_id then
    raise exception 'offering_choice_group_members: parent cannot be a member of its own group';
  end if;

  -- Child must be linked under this parent in the catalog hierarchy.
  if not exists (
    select 1 from public.offering_major_links
    where venue_id = new.venue_id
      and offering_id = new.offering_id
      and parent_offering_id = v_group.parent_offering_id
  ) and not exists (
    select 1 from public.offerings
    where id = new.offering_id
      and venue_id = new.venue_id
      and parent_offering_id = v_group.parent_offering_id
  ) then
    raise exception 'offering_choice_group_members: offering must belong under the group parent';
  end if;

  return new;
end;
$$;

drop trigger if exists offering_choice_group_members_validate on public.offering_choice_group_members;
create trigger offering_choice_group_members_validate
  before insert or update on public.offering_choice_group_members
  for each row execute function public.validate_offering_choice_group_member();

-- ---- 4. Template optional catalog reference (additive / non-destructive) ------

alter table public.event_order_template_groups
  add column if not exists offering_choice_group_id uuid
    references public.offering_choice_groups (id) on delete set null;

create index if not exists event_order_template_groups_catalog_group
  on public.event_order_template_groups (offering_choice_group_id)
  where offering_choice_group_id is not null;

comment on column public.event_order_template_groups.offering_choice_group_id is
  'Optional catalog choice-group provenance. Null = legacy manually named template group. Does not auto-sync options after snapshot.';

-- ---- 5. RLS -------------------------------------------------------------------

alter table public.offering_choice_groups enable row level security;
alter table public.offering_choice_group_members enable row level security;

drop policy if exists offering_choice_groups_all on public.offering_choice_groups;
create policy offering_choice_groups_all on public.offering_choice_groups
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

drop policy if exists offering_choice_group_members_all on public.offering_choice_group_members;
create policy offering_choice_group_members_all on public.offering_choice_group_members
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.offering_choice_groups to authenticated;
grant select, insert, update, delete on public.offering_choice_group_members to authenticated;
grant select, insert, update, delete on public.offering_choice_groups to service_role;
grant select, insert, update, delete on public.offering_choice_group_members to service_role;

notify pgrst, 'reload schema';
