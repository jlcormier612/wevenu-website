-- ============================================================================
-- Active business continuity — guest list, event vendor assignments, timeline
-- Expand migration_records entity vocabulary + service_role DML for cutover.
-- ============================================================================

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
      'timeline_entry'
    ));
end;
$$;

grant select, insert, update on public.couple_guests to service_role;
grant select, insert, update on public.couple_households to service_role;
grant select, insert, update on public.event_vendor_assignments to service_role;
grant select, insert on public.timeline_entries to service_role;
grant select, insert, update on public.venue_vendor_relationships to service_role;
grant select, insert, update on public.vendors to service_role;
-- markAssignmentBooked replaces event-sourced availability rows for the new assignment only.
grant select, insert, delete on public.vendor_availability to service_role;
grant select, delete on public.vendor_notifications to service_role;
grant execute on function public.create_vendor_atomic(jsonb, uuid) to service_role;
