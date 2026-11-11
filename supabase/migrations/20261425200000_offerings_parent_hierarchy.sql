-- ============================================================================
-- Offerings catalog — optional parent/child hierarchy (major choice → items)
--
-- Additive. Existing offerings keep parent_offering_id NULL (standalone / legacy).
-- Same offering row can be used as a major choice, a child item, an included line,
-- or an optional extra in Event Order templates — hierarchy does not duplicate rows.
-- Inventory links remain optional and never imply stock reservation.
-- ============================================================================

alter table public.offerings
  add column if not exists parent_offering_id uuid references public.offerings (id) on delete set null;

create index if not exists offerings_parent
  on public.offerings (parent_offering_id)
  where parent_offering_id is not null;

comment on column public.offerings.parent_offering_id is
  'Optional major-choice parent in the same venue catalog. NULL = top-level (major choice or standalone item). Child rows are associated menu/package items under that major offering. Not a second dependency model for Event Order templates.';

create or replace function public.validate_offering_parent()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_parent record;
begin
  if new.parent_offering_id is null then
    return new;
  end if;

  if new.parent_offering_id = new.id then
    raise exception 'offerings: parent_offering_id cannot reference itself';
  end if;

  select id, venue_id, category_id, parent_offering_id, is_archived
    into v_parent
  from public.offerings
  where id = new.parent_offering_id;

  if v_parent.id is null then
    raise exception 'offerings: parent offering not found';
  end if;
  if v_parent.venue_id <> new.venue_id then
    raise exception 'offerings: parent must belong to the same venue';
  end if;
  -- Keep hierarchy within one service category when both sides are categorized.
  if new.category_id is not null
     and v_parent.category_id is not null
     and new.category_id <> v_parent.category_id then
    raise exception 'offerings: parent must be in the same category';
  end if;
  -- One level only for v1: parent must itself be top-level.
  if v_parent.parent_offering_id is not null then
    raise exception 'offerings: parent must be a top-level major offering (one nesting level)';
  end if;

  return new;
end;
$$;

drop trigger if exists offerings_validate_parent on public.offerings;
create trigger offerings_validate_parent
  before insert or update of parent_offering_id, category_id, venue_id on public.offerings
  for each row execute function public.validate_offering_parent();
