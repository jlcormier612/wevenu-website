-- ============================================================================
-- Booking Journey — Commercial Selection (UI: "Selected Package")
--
-- Frozen snapshot of what this couple was sold. Library packages remain
-- reusable setup; edits to packages never mutate an existing selection.
-- ============================================================================

create table public.commercial_selections (
  id                 uuid primary key default gen_random_uuid(),
  venue_id           uuid not null references public.venues (id) on delete cascade,
  lead_id            uuid references public.leads (id) on delete set null,
  client_id          uuid references public.clients (id) on delete set null,
  event_id           uuid references public.events (id) on delete set null,
  source_package_id  uuid references public.packages (id) on delete set null,
  name               text not null,
  total_amount       numeric(10, 2) not null check (total_amount >= 0),
  deposit_amount     numeric(10, 2) not null check (deposit_amount >= 0),
  included_items     jsonb not null default '[]'::jsonb,
  status             text not null default 'draft'
                       check (status in ('draft', 'offered', 'accepted', 'superseded')),
  version            integer not null default 1 check (version >= 1),
  superseded_by_id   uuid references public.commercial_selections (id) on delete set null,
  offered_at         timestamptz,
  accepted_at        timestamptz,
  accept_token       text unique,
  offer_message      text,
  invoice_id         uuid references public.invoices (id) on delete set null,
  contract_id        uuid references public.contracts (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (char_length(trim(name)) > 0),
  check (deposit_amount <= total_amount),
  check (lead_id is not null or client_id is not null)
);

create index commercial_selections_venue on public.commercial_selections (venue_id, created_at desc);
create index commercial_selections_lead on public.commercial_selections (lead_id)
  where lead_id is not null;
create index commercial_selections_client on public.commercial_selections (client_id)
  where client_id is not null;
create index commercial_selections_event on public.commercial_selections (event_id)
  where event_id is not null;
create index commercial_selections_active on public.commercial_selections (venue_id, lead_id, client_id)
  where status <> 'superseded';

create trigger commercial_selections_updated_at
  before update on public.commercial_selections
  for each row execute function public.set_updated_at();

alter table public.commercial_selections enable row level security;

create policy commercial_selections_all on public.commercial_selections
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.commercial_selections to authenticated;
grant select, insert, update, delete on public.commercial_selections to service_role;

-- Couple portal: read an offered/accepted selection by accept token (no auth).
create or replace function public.get_commercial_selection_by_accept_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.commercial_selections%rowtype;
begin
  if p_token is null or length(trim(p_token)) = 0 then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  select * into v_row
  from public.commercial_selections
  where accept_token = p_token
    and status in ('offered', 'accepted')
  limit 1;

  if v_row.id is null then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'venueId', v_row.venue_id,
    'name', v_row.name,
    'totalAmount', v_row.total_amount,
    'depositAmount', v_row.deposit_amount,
    'remainingAmount', v_row.total_amount - v_row.deposit_amount,
    'includedItems', v_row.included_items,
    'status', v_row.status,
    'offeredAt', v_row.offered_at,
    'acceptedAt', v_row.accepted_at,
    'offerMessage', v_row.offer_message
  );
end;
$$;

revoke all on function public.get_commercial_selection_by_accept_token(text) from public;
grant execute on function public.get_commercial_selection_by_accept_token(text) to anon, authenticated;

-- Couple portal: accept an offered selection (idempotent if already accepted).
create or replace function public.accept_commercial_selection(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.commercial_selections%rowtype;
begin
  if p_token is null or length(trim(p_token)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  select * into v_row
  from public.commercial_selections
  where accept_token = p_token
  for update;

  if v_row.id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  if v_row.status = 'accepted' then
    return jsonb_build_object('ok', true, 'id', v_row.id, 'alreadyAccepted', true);
  end if;

  if v_row.status <> 'offered' then
    return jsonb_build_object('ok', false, 'error', 'not_offered');
  end if;

  update public.commercial_selections
  set status = 'accepted',
      accepted_at = now()
  where id = v_row.id;

  return jsonb_build_object('ok', true, 'id', v_row.id, 'alreadyAccepted', false);
end;
$$;

revoke all on function public.accept_commercial_selection(text) from public;
grant execute on function public.accept_commercial_selection(text) to anon, authenticated;

notify pgrst, 'reload schema';
