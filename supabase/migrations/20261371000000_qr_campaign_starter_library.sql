-- QR Campaign starter masters — persistent source_master_key.
-- Starters remain available even when the venue already has active campaigns.

alter table public.qr_campaigns
  add column if not exists source_master_key text;

comment on column public.qr_campaigns.source_master_key is
  'Hello to Cheers starter master key when provisioned from a protected master. Null for venue-created campaigns.';

create unique index if not exists qr_campaigns_venue_source_master_key_uidx
  on public.qr_campaigns (venue_id, source_master_key)
  where source_master_key is not null;
