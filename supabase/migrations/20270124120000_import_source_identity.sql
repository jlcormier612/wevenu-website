-- Persist venue-scoped import identity for Clients, Events, and Vendor
-- relationships. Source IDs are signals for safe retries — never globally
-- unique and never written onto claimed global vendor profiles.

alter table public.clients
  add column if not exists source_data jsonb;

alter table public.events
  add column if not exists source_data jsonb;

alter table public.venue_vendor_relationships
  add column if not exists source_data jsonb;

create index if not exists clients_source_client_id
  on public.clients ((source_data->>'source_client_id'))
  where source_data->>'source_client_id' is not null;

create index if not exists events_source_event_id
  on public.events ((source_data->>'source_event_id'))
  where source_data->>'source_event_id' is not null;

create index if not exists vvr_source_vendor_id
  on public.venue_vendor_relationships ((source_data->>'source_vendor_id'))
  where source_data->>'source_vendor_id' is not null;
