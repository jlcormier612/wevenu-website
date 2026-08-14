-- Append-only audit history of legal document acceptances.
-- Each accept = INSERT a new row. No UPDATE/DELETE policies — deny by default.
-- Writes are service-role only until an acceptance API exists;
-- authenticated users may SELECT their own rows (user_id = auth.uid()).

create table public.legal_acceptances (
  id                 uuid primary key default gen_random_uuid(),
  -- App-wired acceptance context (e.g. venue_customer_relationships /
  -- venue_vendor_relationships). No FK: legal docs span couple, vendor,
  -- and platform surfaces with no single relationship target.
  relationship_id    uuid,
  user_id            uuid not null references auth.users (id),
  legal_document_id  uuid not null references public.legal_documents (id),
  -- Denormalized from legal_documents.version at accept time so history
  -- survives later document edits / new versions.
  accepted_version   text not null,
  accepted_at        timestamptz not null default now(),
  ip_address         text,
  user_agent         text,
  created_at         timestamptz not null default now()
);

comment on table public.legal_acceptances is
  'Append-only legal acceptance audit trail. Never overwrite; each accept inserts a new row.';

comment on column public.legal_acceptances.relationship_id is
  'Optional acceptance context id. App-wired — no FK because acceptances span venue_customer_relationships, venue_vendor_relationships, and relationship-less platform accepts.';

comment on column public.legal_acceptances.accepted_version is
  'Copy of legal_documents.version at accept time; pairs with legal_document_id for exact-version evidence.';

create index legal_acceptances_user_accepted
  on public.legal_acceptances (user_id, accepted_at desc);

create index legal_acceptances_document
  on public.legal_acceptances (legal_document_id, accepted_at desc);

create index legal_acceptances_relationship
  on public.legal_acceptances (relationship_id)
  where relationship_id is not null;

alter table public.legal_acceptances enable row level security;

create policy legal_acceptances_select_own on public.legal_acceptances
  for select to authenticated
  using (user_id = auth.uid());

-- No insert/update/delete policies for authenticated — service role writes only.
grant select on public.legal_acceptances to authenticated;

notify pgrst, 'reload schema';
