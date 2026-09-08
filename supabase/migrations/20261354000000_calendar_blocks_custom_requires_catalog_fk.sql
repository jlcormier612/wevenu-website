-- Calendar 2A.2.4 — custom calendar_blocks must reference a catalog row.
-- Non-custom types retain nullable schedule_item_type_id (placeholders, legacy
-- tour, and builtins that have not yet been linked).

alter table public.calendar_blocks
  drop constraint if exists calendar_blocks_custom_requires_catalog_fk;

alter table public.calendar_blocks
  add constraint calendar_blocks_custom_requires_catalog_fk
  check (
    type is distinct from 'custom'
    or schedule_item_type_id is not null
  );

comment on constraint calendar_blocks_custom_requires_catalog_fk on public.calendar_blocks is
  'type=custom requires schedule_item_type_id; other types may leave the FK null.';
