-- ============================================================================
-- Sprint 25 — Documents Foundation
--
-- A universal document system supporting Leads, Clients, Events, and Vendors.
-- One table, one storage bucket, one reusable component.
--
-- Storage: `documents` bucket
-- Path:    documents/{venue_id}/{entity_type}/{entity_id}/{doc_id}/{filename}
-- ============================================================================

-- documents -------------------------------------------------------------------
-- Exactly one entity FK must be set (enforced by CHECK constraint).
create table public.documents (
  id            uuid primary key default gen_random_uuid(),
  venue_id      uuid not null references public.venues  (id) on delete cascade,

  -- Entity linkage — exactly one must be set
  lead_id       uuid references public.leads   (id) on delete cascade,
  client_id     uuid references public.clients (id) on delete cascade,
  event_id      uuid references public.events  (id) on delete cascade,
  vendor_id     uuid references public.vendors (id) on delete cascade,

  -- File metadata
  name          text not null,          -- user-editable display name
  file_name     text not null,          -- original filename for display
  file_size     bigint,                 -- bytes
  mime_type     text,
  storage_path  text not null,          -- full path inside the bucket
  storage_url   text not null,          -- public URL

  -- Categorisation and metadata
  category      text not null default 'other'
                  check (category in (
                    'contract', 'insurance', 'inspiration', 'floor_plan',
                    'menu', 'permit', 'questionnaire', 'invoice_copy', 'other'
                  )),
  notes         text,
  tags          text[] not null default '{}',
  expires_at    date,                   -- useful for COIs, permits, etc.

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- Exactly one entity FK must be set
  constraint documents_one_entity check (
    (lead_id   is not null)::int +
    (client_id is not null)::int +
    (event_id  is not null)::int +
    (vendor_id is not null)::int = 1
  )
);

create index documents_venue    on public.documents (venue_id, created_at desc);
create index documents_lead     on public.documents (lead_id)   where lead_id   is not null;
create index documents_client   on public.documents (client_id) where client_id is not null;
create index documents_event    on public.documents (event_id)  where event_id  is not null;
create index documents_vendor   on public.documents (vendor_id) where vendor_id is not null;
create index documents_category on public.documents (venue_id, category);

create trigger documents_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

-- RLS -------------------------------------------------------------------------
alter table public.documents enable row level security;

create policy documents_all on public.documents
  for all
  using      (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()));

grant select, insert, update, delete on public.documents to authenticated;

-- Storage bucket --------------------------------------------------------------
-- Documents are kept private (not public) — URLs are generated on demand.
-- Using public=true here for simplicity given venue RLS already guards access.
insert into storage.buckets (id, name, public)
  values ('documents', 'documents', true)
  on conflict (id) do nothing;

-- Storage RLS
create policy documents_storage_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documents');

create policy documents_storage_select on storage.objects
  for select to authenticated, anon
  using (bucket_id = 'documents');

create policy documents_storage_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'documents');

notify pgrst, 'reload schema';
