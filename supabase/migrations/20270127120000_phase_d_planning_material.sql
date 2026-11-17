-- Phase D — allow planning_material rows in Migration Center.
-- Vocabulary only. Does not change planning tables or release anything.

do $$
begin
  if to_regclass('public.migration_records') is null then
    return;
  end if;
  alter table public.migration_records
    drop constraint if exists migration_records_target_entity_type_check;
  alter table public.migration_records
    add constraint migration_records_target_entity_type_check
    check (target_entity_type in (
      'client', 'lead', 'vendor', 'event', 'payment', 'document',
      'calendar_block', 'date_hold', 'tour', 'package', 'key_date',
      'active_commitment',
      'guest_list',
      'event_vendor_assignment',
      'timeline_entry',
      'floor_plan',
      'planning_material'
    ));
end;
$$;

notify pgrst, 'reload schema';
