-- ============================================================================
-- Commercial Proposals (L1 offer menu) + package offer roles / eligibility
--
-- L0 packages remain mutable. Sent proposals freeze option prices into
-- commercial_proposal_options. Client select + approve creates L2
-- commercial_selections (existing SoT for Contract + Payments).
-- ============================================================================

-- L0: catalog role + optional eligibility (null = unrestricted) -------------
alter table public.packages
  add column if not exists offer_role text not null default 'primary'
    check (offer_role in ('primary', 'addon'));

alter table public.packages
  add column if not exists eligible_event_types text[] default null;

alter table public.packages
  add column if not exists min_guest_count integer default null
    check (min_guest_count is null or min_guest_count >= 0);

alter table public.packages
  add column if not exists max_guest_count integer default null
    check (max_guest_count is null or max_guest_count >= 0);

alter table public.packages
  add column if not exists eligible_space_ids uuid[] default null;

comment on column public.packages.offer_role is
  'primary = choose-one package; addon = optional addition on a proposal.';
comment on column public.packages.eligible_event_types is
  'Null = all event types. Otherwise package is eligible only when lead/client event_type is in this list.';
comment on column public.packages.min_guest_count is
  'Null = no minimum. Compared to lead/client guest_count when present.';
comment on column public.packages.max_guest_count is
  'Null = no maximum. Compared to lead/client guest_count when present.';
comment on column public.packages.eligible_space_ids is
  'Null = all spaces. Otherwise requires planned/booked space id in this list.';

-- L2 link back to proposal that produced it ---------------------------------
alter table public.commercial_selections
  add column if not exists proposal_id uuid;

alter table public.commercial_selections
  add column if not exists selected_at timestamptz;

alter table public.commercial_selections
  add column if not exists approved_at timestamptz;

-- L1: proposal container ----------------------------------------------------
create table if not exists public.commercial_proposals (
  id                 uuid primary key default gen_random_uuid(),
  venue_id           uuid not null references public.venues (id) on delete cascade,
  lead_id            uuid references public.leads (id) on delete set null,
  client_id          uuid references public.clients (id) on delete set null,
  event_id           uuid references public.events (id) on delete set null,
  status             text not null default 'draft'
                       check (status in (
                         'draft', 'sent', 'selected', 'approved', 'superseded', 'withdrawn'
                       )),
  version            integer not null default 1 check (version >= 1),
  accept_token       text unique,
  offer_message      text,
  deposit_amount     numeric(10, 2) not null default 0 check (deposit_amount >= 0),
  offered_at         timestamptz,
  selected_at        timestamptz,
  approved_at        timestamptz,
  selection_id       uuid references public.commercial_selections (id) on delete set null,
  eligibility_context jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (lead_id is not null or client_id is not null)
);

create index if not exists commercial_proposals_venue
  on public.commercial_proposals (venue_id, created_at desc);
create index if not exists commercial_proposals_lead
  on public.commercial_proposals (lead_id) where lead_id is not null;
create index if not exists commercial_proposals_client
  on public.commercial_proposals (client_id) where client_id is not null;
create index if not exists commercial_proposals_active
  on public.commercial_proposals (venue_id, lead_id, client_id)
  where status not in ('superseded', 'withdrawn');

create trigger commercial_proposals_updated_at
  before update on public.commercial_proposals
  for each row execute function public.set_updated_at();

-- FK from selections → proposals (deferred until proposals exist)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'commercial_selections_proposal_id_fkey'
  ) then
    alter table public.commercial_selections
      add constraint commercial_selections_proposal_id_fkey
      foreign key (proposal_id) references public.commercial_proposals (id) on delete set null;
  end if;
end $$;

-- L1: frozen offered options ------------------------------------------------
create table if not exists public.commercial_proposal_options (
  id                 uuid primary key default gen_random_uuid(),
  proposal_id        uuid not null references public.commercial_proposals (id) on delete cascade,
  venue_id           uuid not null references public.venues (id) on delete cascade,
  source_package_id  uuid references public.packages (id) on delete set null,
  offer_role         text not null check (offer_role in ('primary', 'addon')),
  name               text not null,
  description        text,
  unit_price         numeric(10, 2) not null check (unit_price >= 0),
  included_items     jsonb not null default '[]'::jsonb,
  sort_order         smallint not null default 0,
  frozen_at          timestamptz,
  created_at         timestamptz not null default now(),
  check (char_length(trim(name)) > 0)
);

create index if not exists commercial_proposal_options_proposal
  on public.commercial_proposal_options (proposal_id, sort_order);

-- Client choices (persisted on select; locked on approve) -------------------
create table if not exists public.commercial_proposal_choices (
  id                 uuid primary key default gen_random_uuid(),
  proposal_id        uuid not null references public.commercial_proposals (id) on delete cascade,
  venue_id           uuid not null references public.venues (id) on delete cascade,
  option_id          uuid not null references public.commercial_proposal_options (id) on delete cascade,
  quantity           numeric(8, 2) not null default 1 check (quantity > 0),
  unit_price         numeric(10, 2) not null check (unit_price >= 0),
  line_total         numeric(10, 2) not null check (line_total >= 0),
  name               text not null,
  offer_role         text not null check (offer_role in ('primary', 'addon')),
  created_at         timestamptz not null default now(),
  unique (proposal_id, option_id)
);

create index if not exists commercial_proposal_choices_proposal
  on public.commercial_proposal_choices (proposal_id);

-- RLS -----------------------------------------------------------------------
alter table public.commercial_proposals enable row level security;
alter table public.commercial_proposal_options enable row level security;
alter table public.commercial_proposal_choices enable row level security;

drop policy if exists commercial_proposals_all on public.commercial_proposals;
create policy commercial_proposals_all on public.commercial_proposals
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

drop policy if exists commercial_proposal_options_all on public.commercial_proposal_options;
create policy commercial_proposal_options_all on public.commercial_proposal_options
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

drop policy if exists commercial_proposal_choices_all on public.commercial_proposal_choices;
create policy commercial_proposal_choices_all on public.commercial_proposal_choices
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.commercial_proposals to authenticated, service_role;
grant select, insert, update, delete on public.commercial_proposal_options to authenticated, service_role;
grant select, insert, update, delete on public.commercial_proposal_choices to authenticated, service_role;

-- Public: get multi-option proposal by token --------------------------------
create or replace function public.get_commercial_proposal_by_accept_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.commercial_proposals%rowtype;
  v_venue_name text;
  v_options jsonb;
  v_choices jsonb;
begin
  if p_token is null or length(trim(p_token)) = 0 then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  select * into v_row
  from public.commercial_proposals
  where accept_token = p_token
    and status in ('sent', 'selected', 'approved')
  limit 1;

  if v_row.id is null then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  select v.name into v_venue_name
  from public.venues v
  where v.id = v_row.venue_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', o.id,
      'offerRole', o.offer_role,
      'name', o.name,
      'description', o.description,
      'unitPrice', o.unit_price,
      'includedItems', o.included_items,
      'sortOrder', o.sort_order
    ) order by o.sort_order, o.name
  ), '[]'::jsonb)
  into v_options
  from public.commercial_proposal_options o
  where o.proposal_id = v_row.id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'optionId', c.option_id,
      'quantity', c.quantity,
      'unitPrice', c.unit_price,
      'lineTotal', c.line_total,
      'name', c.name,
      'offerRole', c.offer_role
    )
  ), '[]'::jsonb)
  into v_choices
  from public.commercial_proposal_choices c
  where c.proposal_id = v_row.id;

  return jsonb_build_object(
    'id', v_row.id,
    'venueId', v_row.venue_id,
    'venueName', v_venue_name,
    'status', v_row.status,
    'offerMessage', v_row.offer_message,
    'depositAmount', v_row.deposit_amount,
    'offeredAt', v_row.offered_at,
    'selectedAt', v_row.selected_at,
    'approvedAt', v_row.approved_at,
    'selectionId', v_row.selection_id,
    'options', v_options,
    'choices', v_choices,
    'kind', 'proposal'
  );
end;
$$;

revoke all on function public.get_commercial_proposal_by_accept_token(text) from public;
grant execute on function public.get_commercial_proposal_by_accept_token(text) to anon, authenticated, service_role;

-- Helper: venue notice when client selects (before approve)
create or replace function public._notify_proposal_selected(p_proposal_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.commercial_proposals%rowtype;
  v_who text := 'A couple';
  v_link text;
begin
  select * into v_row from public.commercial_proposals where id = p_proposal_id;
  if v_row.id is null then return; end if;

  if v_row.lead_id is not null then
    select coalesce(nullif(trim(concat_ws(' ', nullif(trim(l.first_name), ''), nullif(trim(l.last_name), ''))), ''), 'A couple')
    into v_who from public.leads l where l.id = v_row.lead_id and l.venue_id = v_row.venue_id;
    insert into public.lead_activities (venue_id, lead_id, type, title, description)
    values (v_row.venue_id, v_row.lead_id, 'proposal_selected', v_who || ' selected options on their proposal.', null);
    v_link := '/leads/' || v_row.lead_id::text;
  elsif v_row.client_id is not null then
    select coalesce(nullif(trim(concat_ws(' ', nullif(trim(c.first_name), ''), nullif(trim(c.last_name), ''))), ''), 'A couple')
    into v_who from public.clients c where c.id = v_row.client_id and c.venue_id = v_row.venue_id;
    insert into public.client_activities (venue_id, client_id, type, title, description)
    values (v_row.venue_id, v_row.client_id, 'proposal_selected', v_who || ' selected options on their proposal.', null);
    v_link := '/clients/' || v_row.client_id::text;
  end if;

  perform public.create_venue_notification(
    v_row.venue_id, v_row.event_id, 'proposal_selected',
    v_who || ' selected options on their proposal.', null, v_link, null
  );
end;
$$;

revoke all on function public._notify_proposal_selected(uuid) from public;
grant execute on function public._notify_proposal_selected(uuid) to service_role;

-- Public: save client selection (does not approve / does not book) ----------
create or replace function public.select_commercial_proposal(
  p_token text,
  p_choices jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.commercial_proposals%rowtype;
  v_choice jsonb;
  v_option public.commercial_proposal_options%rowtype;
  v_primary_count int := 0;
  v_qty numeric;
  v_line numeric;
  v_option_id uuid;
begin
  if p_token is null or length(trim(p_token)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;
  if p_choices is null or jsonb_typeof(p_choices) <> 'array' or jsonb_array_length(p_choices) = 0 then
    return jsonb_build_object('ok', false, 'error', 'empty_selection');
  end if;

  select * into v_row
  from public.commercial_proposals
  where accept_token = p_token
  for update;

  if v_row.id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  if v_row.status = 'approved' then
    return jsonb_build_object('ok', false, 'error', 'already_approved');
  end if;

  if v_row.status not in ('sent', 'selected') then
    return jsonb_build_object('ok', false, 'error', 'not_open');
  end if;

  -- Validate every choice against frozen options; require exactly one primary.
  for v_choice in select * from jsonb_array_elements(p_choices)
  loop
    begin
      v_option_id := (v_choice->>'optionId')::uuid;
    exception when others then
      return jsonb_build_object('ok', false, 'error', 'invalid_option');
    end;
    v_qty := coalesce((v_choice->>'quantity')::numeric, 1);
    if v_qty is null or v_qty <= 0 then
      return jsonb_build_object('ok', false, 'error', 'invalid_quantity');
    end if;

    select * into v_option
    from public.commercial_proposal_options
    where id = v_option_id
      and proposal_id = v_row.id;

    if v_option.id is null then
      return jsonb_build_object('ok', false, 'error', 'invalid_option');
    end if;

    if v_option.offer_role = 'primary' then
      v_primary_count := v_primary_count + 1;
      if v_qty <> 1 then
        return jsonb_build_object('ok', false, 'error', 'primary_qty');
      end if;
    end if;
  end loop;

  if v_primary_count <> 1 then
    return jsonb_build_object('ok', false, 'error', 'need_one_primary');
  end if;

  delete from public.commercial_proposal_choices where proposal_id = v_row.id;

  for v_choice in select * from jsonb_array_elements(p_choices)
  loop
    v_option_id := (v_choice->>'optionId')::uuid;
    v_qty := coalesce((v_choice->>'quantity')::numeric, 1);
    select * into v_option
    from public.commercial_proposal_options
    where id = v_option_id and proposal_id = v_row.id;

    v_line := round((v_option.unit_price * v_qty)::numeric, 2);

    insert into public.commercial_proposal_choices (
      proposal_id, venue_id, option_id, quantity, unit_price, line_total, name, offer_role
    ) values (
      v_row.id, v_row.venue_id, v_option.id, v_qty, v_option.unit_price, v_line, v_option.name, v_option.offer_role
    );
  end loop;

  update public.commercial_proposals
  set status = 'selected',
      selected_at = coalesce(selected_at, now())
  where id = v_row.id;

  perform public._notify_proposal_selected(v_row.id);

  return jsonb_build_object('ok', true, 'id', v_row.id, 'status', 'selected');
end;
$$;

revoke all on function public.select_commercial_proposal(text, jsonb) from public;
grant execute on function public.select_commercial_proposal(text, jsonb) to anon, authenticated, service_role;

-- Public: approve selection → freeze L2 commercial_selection ----------------
create or replace function public.approve_commercial_proposal(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.commercial_proposals%rowtype;
  v_total numeric(10, 2);
  v_primary_name text;
  v_primary_pkg uuid;
  v_items jsonb;
  v_selection_id uuid;
  v_who text;
  v_title text;
  v_amount text;
  v_link text;
  v_prev public.commercial_selections%rowtype;
begin
  if p_token is null or length(trim(p_token)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  select * into v_row
  from public.commercial_proposals
  where accept_token = p_token
  for update;

  if v_row.id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  if v_row.status = 'approved' and v_row.selection_id is not null then
    return jsonb_build_object('ok', true, 'id', v_row.id, 'selectionId', v_row.selection_id, 'alreadyApproved', true);
  end if;

  if v_row.status not in ('sent', 'selected') then
    return jsonb_build_object('ok', false, 'error', 'not_open');
  end if;

  if not exists (select 1 from public.commercial_proposal_choices where proposal_id = v_row.id) then
    return jsonb_build_object('ok', false, 'error', 'no_selection');
  end if;

  if (select count(*) from public.commercial_proposal_choices
      where proposal_id = v_row.id and offer_role = 'primary') <> 1 then
    return jsonb_build_object('ok', false, 'error', 'need_one_primary');
  end if;

  select round(sum(line_total)::numeric, 2) into v_total
  from public.commercial_proposal_choices where proposal_id = v_row.id;

  select c.name, o.source_package_id
  into v_primary_name, v_primary_pkg
  from public.commercial_proposal_choices c
  join public.commercial_proposal_options o on o.id = c.option_id
  where c.proposal_id = v_row.id and c.offer_role = 'primary'
  limit 1;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'description', c.name,
      'quantity', c.quantity,
      'unit', case when c.offer_role = 'addon' then 'add-on' else 'package' end,
      'unitPrice', c.unit_price,
      'lineTotal', c.line_total,
      'offerRole', c.offer_role,
      'sourcePackageId', o.source_package_id
    ) order by case when c.offer_role = 'primary' then 0 else 1 end, c.name
  ), '[]'::jsonb)
  into v_items
  from public.commercial_proposal_choices c
  join public.commercial_proposal_options o on o.id = c.option_id
  where c.proposal_id = v_row.id;

  -- Supersede any active L2 for this lead/client
  if v_row.client_id is not null then
    select * into v_prev from public.commercial_selections
    where venue_id = v_row.venue_id and client_id = v_row.client_id and status <> 'superseded'
    order by created_at desc limit 1 for update;
  elsif v_row.lead_id is not null then
    select * into v_prev from public.commercial_selections
    where venue_id = v_row.venue_id and lead_id = v_row.lead_id and status <> 'superseded'
    order by created_at desc limit 1 for update;
  end if;

  insert into public.commercial_selections (
    venue_id, lead_id, client_id, event_id, source_package_id,
    name, total_amount, deposit_amount, included_items,
    status, version, offered_at, accepted_at, selected_at, approved_at,
    proposal_id, offer_message
  ) values (
    v_row.venue_id, v_row.lead_id, v_row.client_id, v_row.event_id, v_primary_pkg,
    v_primary_name, v_total,
    least(coalesce(v_row.deposit_amount, 0), v_total),
    v_items,
    'accepted',
    coalesce(v_prev.version, 0) + 1,
    v_row.offered_at,
    now(),
    coalesce(v_row.selected_at, now()),
    now(),
    v_row.id,
    v_row.offer_message
  )
  returning id into v_selection_id;

  if v_prev.id is not null then
    update public.commercial_selections
    set status = 'superseded', superseded_by_id = v_selection_id
    where id = v_prev.id;
  end if;

  update public.commercial_proposals
  set status = 'approved',
      selected_at = coalesce(selected_at, now()),
      approved_at = now(),
      selection_id = v_selection_id
  where id = v_row.id;

  v_who := 'A couple';
  if v_row.lead_id is not null then
    select coalesce(nullif(trim(concat_ws(' ', nullif(trim(l.first_name), ''), nullif(trim(l.last_name), ''))), ''), 'A couple')
    into v_who from public.leads l where l.id = v_row.lead_id and l.venue_id = v_row.venue_id;
  elsif v_row.client_id is not null then
    select coalesce(nullif(trim(concat_ws(' ', nullif(trim(c.first_name), ''), nullif(trim(c.last_name), ''))), ''), 'A couple')
    into v_who from public.clients c where c.id = v_row.client_id and c.venue_id = v_row.venue_id;
  end if;

  v_amount := trim(to_char(v_total, 'FM$999,999,990.00'));
  v_title := v_who || ' approved the ' || v_primary_name || ' proposal.';

  if v_row.lead_id is not null then
    insert into public.lead_activities (venue_id, lead_id, type, title, description)
    values (v_row.venue_id, v_row.lead_id, 'proposal_accepted', v_title, v_amount);
    v_link := '/leads/' || v_row.lead_id::text;
  elsif v_row.client_id is not null then
    insert into public.client_activities (venue_id, client_id, type, title, description)
    values (v_row.venue_id, v_row.client_id, 'proposal_accepted', v_title, v_amount);
    v_link := '/clients/' || v_row.client_id::text;
  end if;

  perform public.create_venue_notification(
    v_row.venue_id, v_row.event_id, 'proposal_accepted', v_title, v_amount, v_link, null
  );

  -- Does NOT book. Does NOT create invoice/contract.
  return jsonb_build_object(
    'ok', true,
    'id', v_row.id,
    'selectionId', v_selection_id,
    'totalAmount', v_total,
    'alreadyApproved', false
  );
end;
$$;

revoke all on function public.approve_commercial_proposal(text) from public;
grant execute on function public.approve_commercial_proposal(text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
