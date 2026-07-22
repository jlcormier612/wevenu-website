-- ============================================================================
-- QR Lead Capture — Sprint 3, Item 4. Approved exactly as designed
-- (docs/qr-lead-capture-design.md).
--
-- qr_campaigns modeled on vendor_invitations (dedicated child table,
-- venue_id FK, DB-default unique token) rather than the one-token-per-
-- venue pattern (embed_key) — a venue needs many of these. qr_scans
-- modeled on couple_website_views (append-only, written as a side effect
-- inside the resolve RPC itself).
-- ============================================================================

create table public.qr_campaigns (
  id               uuid primary key default gen_random_uuid(),
  venue_id         uuid not null references public.venues(id) on delete cascade,
  name             text not null,
  code             text not null unique default encode(gen_random_bytes(8), 'hex'),
  destination_type text not null check (destination_type in ('inquiry_form', 'tour_booking', 'wedding_website', 'external_url')),
  destination_url  text,
  status           text not null default 'active' check (status in ('active', 'archived')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index qr_campaigns_venue on public.qr_campaigns (venue_id);
create index qr_campaigns_code on public.qr_campaigns (code);

create trigger qr_campaigns_updated_at
  before update on public.qr_campaigns
  for each row execute function public.set_updated_at();

alter table public.qr_campaigns enable row level security;

create policy qr_campaigns_all on public.qr_campaigns
  using (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.qr_campaigns to authenticated;

create table public.qr_scans (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues(id) on delete cascade,
  campaign_id uuid not null references public.qr_campaigns(id) on delete cascade,
  scanned_at  timestamptz not null default now(),
  user_agent  text,
  referrer    text
);

create index qr_scans_campaign on public.qr_scans (campaign_id, scanned_at desc);

alter table public.qr_scans enable row level security;

create policy qr_scans_select on public.qr_scans for select
  using (venue_id = public.current_user_venue_id());

grant select on public.qr_scans to authenticated;

-- ---- Resolve + record scan, one round trip ----------------------------------
--
-- Mirrors get_wedding_website's insert-then-return body: the scan insert
-- is wrapped in its own exception-swallowing block so a logging failure
-- can never break the redirect itself.

create or replace function public.resolve_qr_scan(
  p_code       text,
  p_user_agent text default null,
  p_referrer   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign public.qr_campaigns%rowtype;
begin
  select * into v_campaign from public.qr_campaigns where code = p_code and status = 'active';
  if not found then
    return jsonb_build_object('ok', false);
  end if;

  begin
    insert into public.qr_scans (venue_id, campaign_id, user_agent, referrer)
    values (v_campaign.venue_id, v_campaign.id, p_user_agent, p_referrer);
  exception when others then null;
  end;

  return jsonb_build_object(
    'ok', true,
    'campaignId', v_campaign.id,
    'venueId', v_campaign.venue_id,
    'destinationType', v_campaign.destination_type,
    'destinationUrl', v_campaign.destination_url
  );
end;
$$;

grant execute on function public.resolve_qr_scan(text, text, text) to anon, authenticated;

-- ---- Analytics: scans + conversions per campaign -----------------------------
--
-- "Conversion" = a Lead whose source_data->>'qr_campaign_id' matches this
-- campaign — no separate funnel stage, per the approved design.

create or replace function public.get_qr_campaign_analytics(p_venue_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) from (
    select
      c.id,
      c.name,
      c.destination_type,
      (select count(*) from public.qr_scans s where s.campaign_id = c.id) as scans,
      (select count(*) from public.leads l where l.venue_id = p_venue_id and l.source_data ->> 'qr_campaign_id' = c.id::text) as conversions
    from public.qr_campaigns c
    where c.venue_id = p_venue_id
    order by c.created_at desc
  ) t;
$$;

grant execute on function public.get_qr_campaign_analytics(uuid) to authenticated;

notify pgrst, 'reload schema';
