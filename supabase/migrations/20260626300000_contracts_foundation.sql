-- ============================================================================
-- Sprint 15 — Contracts Foundation
-- "A venue owner should be able to move from a booked couple to a
--  professional, signed agreement with confidence and ease."
--
-- Three tables + one SECURITY DEFINER function:
--   contract_templates  — reusable templates with {{merge_field}} tokens
--   contracts           — generated contracts (tokens already resolved)
--   contract_activities — activity log
--   sign_contract()     — allows anonymous signers to sign via a secret token
-- ============================================================================

-- contract_templates ----------------------------------------------------------
create table public.contract_templates (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues (id) on delete cascade,

  name        text not null,
  description text,
  content     text not null, -- plain text with {{merge_field}} tokens
  is_default  boolean not null default false,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- At most one default template per venue
create unique index contract_templates_one_default
  on public.contract_templates (venue_id)
  where is_default;

create index contract_templates_venue on public.contract_templates (venue_id);

create trigger contract_templates_updated_at
  before update on public.contract_templates
  for each row execute function public.set_updated_at();

-- contracts -------------------------------------------------------------------
create table public.contracts (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues    (id) on delete cascade,
  client_id   uuid references public.clients (id) on delete set null,
  event_id    uuid references public.events  (id) on delete set null,
  template_id uuid references public.contract_templates (id) on delete set null,

  title       text not null,
  content     text not null, -- rendered snapshot (tokens already resolved)

  status      text not null default 'draft'
                check (status in ('draft','sent','signed','cancelled','expired')),

  -- Unique secret token used in the public signing URL (/sign/[token])
  sign_token  uuid not null default gen_random_uuid() unique,

  -- Captured at signing
  signer_name text,
  signed_at   timestamptz,

  sent_at     timestamptz,
  expires_at  date,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index contracts_venue        on public.contracts (venue_id);
create index contracts_client       on public.contracts (client_id) where client_id is not null;
create unique index contracts_token on public.contracts (sign_token);

create trigger contracts_updated_at
  before update on public.contracts
  for each row execute function public.set_updated_at();

-- contract_activities ---------------------------------------------------------
create table public.contract_activities (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues    (id) on delete cascade,
  contract_id uuid not null references public.contracts (id) on delete cascade,
  type        text not null,
  title       text not null,
  description text,
  created_at  timestamptz not null default now()
);

create index contract_activities_contract on public.contract_activities (contract_id, created_at desc);

-- RLS -------------------------------------------------------------------------
alter table public.contract_templates  enable row level security;
alter table public.contracts           enable row level security;
alter table public.contract_activities enable row level security;

create policy contract_templates_all on public.contract_templates
  for all
  using      (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()));

create policy contracts_all on public.contracts
  for all
  using      (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()));

create policy contract_activities_all on public.contract_activities
  for all
  using      (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()));

grant select, insert, update, delete on public.contract_templates  to authenticated;
grant select, insert, update, delete on public.contracts           to authenticated;
grant select, insert, update, delete on public.contract_activities to authenticated;

-- Public signing function -----------------------------------------------------
-- SECURITY DEFINER so anonymous users can sign without bypassing RLS manually.
-- The sign_token acts as the authorization — possession of the URL is consent.
create or replace function public.sign_contract(p_token uuid, p_signer text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id     uuid;
  v_venue  uuid;
begin
  select id, venue_id into v_id, v_venue
  from public.contracts
  where sign_token = p_token and status = 'sent';

  if v_id is null then return false; end if;

  update public.contracts set
    status      = 'signed',
    signer_name = trim(p_signer),
    signed_at   = now()
  where id = v_id;

  insert into public.contract_activities (venue_id, contract_id, type, title, description)
  values (v_venue, v_id, 'signed', 'Contract signed', 'Signed by ' || trim(p_signer));

  return true;
end;
$$;

-- Allow the anon role to call this function (public signing page has no JWT)
grant execute on function public.sign_contract(uuid, text) to anon, authenticated;

-- Also allow anonymous users to read a contract by token (for the signing page)
create policy contracts_read_by_token on public.contracts
  for select
  using (true); -- RLS already limits to own venue for authenticated; anon can read by token via the function

-- Restrict anonymous reads: only allow reading the sign-relevant columns via a view
-- (Simpler: just let the sign function handle everything; the page can't read contract via RLS without auth)

-- Drop overly permissive policy and use the function only
drop policy contracts_read_by_token on public.contracts;

-- Create a specific policy for the public signing page view
create policy contracts_sign_read on public.contracts
  for select
  using (
    -- Authenticated users can see their own venue's contracts
    (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()))
    -- Public signing page reads a contract by token (no auth)
    or (auth.uid() is null and status in ('sent', 'signed'))
  );

notify pgrst, 'reload schema';
