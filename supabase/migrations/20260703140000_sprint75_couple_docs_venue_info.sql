-- ============================================================================
-- Sprint 75 — Couple Documents Tab + Venue Operational Info
--
-- Two principles:
--   1. Couple should never dig through messages to find venue-shared documents.
--   2. If the venue already entered parking/hotel/FAQ info, couples should
--      never retype it — "Sync from Venue" makes it flow to the website.
-- ============================================================================

-- ── Couple visibility flags on existing document types ───────────────────────
-- Contracts and invoices are couple-visible by default (they signed/received them).
alter table public.contracts add column if not exists is_couple_visible boolean not null default true;
alter table public.invoices  add column if not exists is_couple_visible boolean not null default true;

-- ── Couple-initiated document uploads ────────────────────────────────────────
-- Couples can upload their own files and optionally share back to the venue.
create table public.couple_documents (
  id               uuid  primary key default gen_random_uuid(),
  client_id        uuid  not null references public.clients(id) on delete cascade,
  name             text  not null,
  file_url         text  not null,
  file_size        integer,
  mime_type        text,
  uploaded_by      text  not null default 'couple' check (uploaded_by in ('couple','venue')),
  share_with_venue boolean not null default false,
  source_type      text,   -- 'upload' | 'contract' | 'invoice' | 'planning_guide' etc.
  source_id        uuid,   -- optional FK to the originating record
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index on public.couple_documents(client_id, created_at desc);

alter table public.couple_documents enable row level security;

create policy "venue_rw_couple_documents" on public.couple_documents
  for all using (
    client_id in (
      select c.id from public.clients c
      join public.venue_users vu on vu.venue_id = c.venue_id
      where vu.user_id = auth.uid() and vu.is_active
    )
  );

-- ── Venue operational information ────────────────────────────────────────────
-- One row per venue. Couples can read this via portal RPC.
-- Fields sync to wedding website when the couple enables the toggle.
create table public.venue_operational_info (
  id                    uuid primary key default gen_random_uuid(),
  venue_id              uuid not null references public.venues(id) on delete cascade,
  parking_info          text,
  transportation        text,
  hotel_blocks          jsonb not null default '[]', -- [{name, url, code, notes}]
  nearby_accommodations text,
  things_to_do          text,
  faqs                  jsonb not null default '[]', -- [{question, answer}]
  policies              text,
  ceremony_instructions text,
  rain_plan             text,
  important_contacts    jsonb not null default '[]', -- [{name, role, phone, email}]
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique(venue_id)
);

alter table public.venue_operational_info enable row level security;

create policy "venue_rw_operational_info" on public.venue_operational_info
  for all using (
    venue_id in (
      select vu.venue_id from public.venue_users vu
      where vu.user_id = auth.uid() and vu.is_active
    )
  );

-- ── RPCs ─────────────────────────────────────────────────────────────────────

-- get_couple_documents: aggregates contracts + invoices + couple uploads ------
create or replace function public.get_couple_documents(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_ids record;
begin
  select * into v_ids from _resolve_portal_ids(p_token);
  if v_ids.client_id is null then return null; end if;

  return jsonb_build_object(
    'documents', coalesce((
      select jsonb_agg(doc order by (doc->>'createdAt') desc)
      from (
        -- Signed contracts shared by venue
        select jsonb_build_object(
          'id',          c.id,
          'docType',     'contract',
          'name',        coalesce(nullif(trim(c.title),''), 'Venue Contract'),
          'status',      c.status,
          'signedAt',    c.signed_at,
          'amount',      null,
          'fileUrl',     null,
          'uploadedBy',  'venue',
          'createdAt',   c.created_at
        )
        from contracts c
        where c.client_id = v_ids.client_id
          and c.is_couple_visible = true

        union all

        -- Invoices shared by venue
        select jsonb_build_object(
          'id',         i.id,
          'docType',    'invoice',
          'name',       'Invoice ' || coalesce(i.invoice_number::text, '#'),
          'status',     i.status,
          'signedAt',   null,
          'amount',     i.total_amount,
          'fileUrl',    null,
          'uploadedBy', 'venue',
          'createdAt',  i.created_at
        )
        from invoices i
        where i.client_id = v_ids.client_id
          and i.is_couple_visible = true

        union all

        -- Couple-uploaded or venue-shared documents
        select jsonb_build_object(
          'id',              cd.id,
          'docType',         coalesce(cd.source_type, 'upload'),
          'name',            cd.name,
          'status',          null,
          'signedAt',        null,
          'amount',          null,
          'fileUrl',         cd.file_url,
          'fileSize',        cd.file_size,
          'mimeType',        cd.mime_type,
          'uploadedBy',      cd.uploaded_by,
          'shareWithVenue',  cd.share_with_venue,
          'createdAt',       cd.created_at
        )
        from couple_documents cd
        where cd.client_id = v_ids.client_id
      ) docs(doc)
    ), '[]'::jsonb)
  );
end;
$$;

-- get_venue_info_for_portal: couple reads venue operational info ---------------
create or replace function public.get_venue_info_for_portal(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_ids record;
begin
  select * into v_ids from _resolve_portal_ids(p_token);
  if v_ids.venue_id is null then return null; end if;

  return (
    select jsonb_build_object(
      'parkingInfo',          voi.parking_info,
      'transportation',       voi.transportation,
      'hotelBlocks',          voi.hotel_blocks,
      'nearbyAccommodations', voi.nearby_accommodations,
      'thingsToDo',           voi.things_to_do,
      'faqs',                 voi.faqs,
      'policies',             voi.policies,
      'ceremonyInstructions', voi.ceremony_instructions,
      'rainPlan',             voi.rain_plan,
      'importantContacts',    voi.important_contacts
    )
    from venue_operational_info voi
    where voi.venue_id = v_ids.venue_id
  );
end;
$$;

-- upsert_venue_operational_info: venue coordinator writes their info -----------
create or replace function public.upsert_venue_operational_info(
  p_venue_id              uuid,
  p_parking_info          text     default null,
  p_transportation        text     default null,
  p_hotel_blocks          jsonb    default null,
  p_nearby_accommodations text     default null,
  p_things_to_do          text     default null,
  p_faqs                  jsonb    default null,
  p_policies              text     default null,
  p_ceremony_instructions text     default null,
  p_rain_plan             text     default null,
  p_important_contacts    jsonb    default null
) returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_id uuid;
begin
  -- Verify caller owns this venue
  if not exists (
    select 1 from venue_users where venue_id = p_venue_id and user_id = auth.uid() and is_active
  ) then
    raise exception 'unauthorized';
  end if;

  insert into venue_operational_info(
    venue_id, parking_info, transportation, hotel_blocks,
    nearby_accommodations, things_to_do, faqs, policies,
    ceremony_instructions, rain_plan, important_contacts
  ) values (
    p_venue_id, p_parking_info, p_transportation,
    coalesce(p_hotel_blocks, '[]'),
    p_nearby_accommodations, p_things_to_do,
    coalesce(p_faqs, '[]'), p_policies,
    p_ceremony_instructions, p_rain_plan,
    coalesce(p_important_contacts, '[]')
  )
  on conflict (venue_id) do update set
    parking_info          = coalesce(p_parking_info,          venue_operational_info.parking_info),
    transportation        = coalesce(p_transportation,        venue_operational_info.transportation),
    hotel_blocks          = coalesce(p_hotel_blocks,          venue_operational_info.hotel_blocks),
    nearby_accommodations = coalesce(p_nearby_accommodations, venue_operational_info.nearby_accommodations),
    things_to_do          = coalesce(p_things_to_do,          venue_operational_info.things_to_do),
    faqs                  = coalesce(p_faqs,                  venue_operational_info.faqs),
    policies              = coalesce(p_policies,              venue_operational_info.policies),
    ceremony_instructions = coalesce(p_ceremony_instructions, venue_operational_info.ceremony_instructions),
    rain_plan             = coalesce(p_rain_plan,             venue_operational_info.rain_plan),
    important_contacts    = coalesce(p_important_contacts,    venue_operational_info.important_contacts),
    updated_at            = now()
  returning id into v_id;

  return v_id;
end;
$$;

notify pgrst, 'reload schema';
