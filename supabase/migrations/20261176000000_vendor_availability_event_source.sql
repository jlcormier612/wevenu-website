-- ============================================================================
-- Vendor Events → Profile Availability write-through.
--
-- Secured assignments (event_vendor_assignments + events.event_date) mark a
-- vendor day as Booked in vendor_availability. Manual blocks stay editable
-- separately. Source tagging lets venue conflict checks distinguish a vendor
-- choosing to block a day from an actual secured booking.
--
-- Existing rows are treated as manual.
-- ============================================================================

alter table public.vendor_availability
  add column if not exists source text not null default 'manual'
    check (source in ('manual', 'event')),
  add column if not exists source_id uuid;

-- Prior unique (vendor_id, date) cannot hold both a manual block and an
-- event-sourced Booked row on the same day. Replace with partial uniques.
alter table public.vendor_availability
  drop constraint if exists vendor_availability_vendor_id_date_key;

create unique index if not exists vendor_availability_manual_date_uidx
  on public.vendor_availability (vendor_id, date)
  where source = 'manual';

create unique index if not exists vendor_availability_event_source_uidx
  on public.vendor_availability (vendor_id, source_id)
  where source = 'event' and source_id is not null;

create index if not exists vendor_availability_source_id_idx
  on public.vendor_availability (source_id)
  where source = 'event' and source_id is not null;

comment on column public.vendor_availability.source is
  'manual = vendor toggled block; event = secured assignment write-through';
comment on column public.vendor_availability.source_id is
  'For source=event: event_vendor_assignments.id. Null for manual.';

-- Sync helpers use the service-role client; table grants are separate from RLS.
grant select, insert, update, delete on public.vendor_availability to service_role;
grant select on public.event_vendor_assignments to service_role;

notify pgrst, 'reload schema';
