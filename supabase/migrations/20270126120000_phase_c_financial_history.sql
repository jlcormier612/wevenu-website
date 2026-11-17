-- Phase C — historical financial activity.
--
-- payment_line_items remain the schedule of what is owed and when.
-- financial_movements is the trace of each receipt, refund, reallocation,
-- credit, adjustment, and write-off. Import writes origin = 'import'.
-- Native card payments stay on payment_line_items and are not copied here.
--
-- Collected reporting counts a line's paid_amount, including partially_paid,
-- only when that invoice has no import movements. Import cash is summed from
-- the movements themselves so a line cache and a receipt are not both counted.
-- Outstanding is the unpaid balance_due on issued invoices, not invoiced-minus-collected.

alter table public.contracts
  add column if not exists agreement_value numeric(12, 2),
  add column if not exists import_source_id text,
  add column if not exists executed_file_path text;

alter table public.contracts
  drop constraint if exists contracts_agreement_value_check;

alter table public.contracts
  add constraint contracts_agreement_value_check
  check (agreement_value is null or agreement_value >= 0);

create unique index if not exists contracts_import_source
  on public.contracts (venue_id, import_source_id)
  where import_source_id is not null;

-- One externally executed root agreement per event. Amendments point at it
-- through amends_contract_id and are allowed alongside the root.
drop index if exists public.contracts_one_external_signed_per_event;

create unique index if not exists contracts_one_external_root_per_event
  on public.contracts (venue_id, event_id)
  where execution_origin = 'external'
    and status = 'signed'
    and event_id is not null
    and amends_contract_id is null;

alter table public.invoices
  add column if not exists import_source_id text;

create unique index if not exists invoices_import_source
  on public.invoices (venue_id, import_source_id)
  where import_source_id is not null;

alter table public.payment_line_items
  add column if not exists import_source_id text;

create unique index if not exists payment_line_items_import_source
  on public.payment_line_items (venue_id, import_source_id)
  where import_source_id is not null;

create table if not exists public.financial_movements (
  id                    uuid primary key default gen_random_uuid(),
  venue_id              uuid not null references public.venues (id) on delete cascade,
  client_id             uuid references public.clients (id) on delete set null,
  event_id              uuid references public.events (id) on delete set null,
  invoice_id            uuid references public.invoices (id) on delete cascade,
  schedule_id           uuid references public.payment_schedules (id) on delete set null,
  line_item_id          uuid references public.payment_line_items (id) on delete set null,
  related_movement_id   uuid references public.financial_movements (id) on delete set null,
  counter_invoice_id    uuid references public.invoices (id) on delete set null,
  kind                  text not null check (kind in (
                          'payment', 'refund', 'reallocation_out', 'reallocation_in',
                          'credit', 'adjustment', 'write_off'
                        )),
  amount                numeric(12, 2) not null check (amount >= 0),
  effect                text not null check (effect in ('reduces_balance', 'increases_balance')),
  occurred_on           date,
  method                text,
  reference_number      text,
  notes                 text,
  source_id             text,
  origin                text not null default 'import' check (origin in ('import', 'htc')),
  created_at            timestamptz not null default now(),
  constraint financial_movements_effect_kind check (
    (kind = 'payment' and effect = 'reduces_balance')
    or (kind = 'refund' and effect = 'increases_balance')
    or (kind = 'reallocation_out' and effect = 'increases_balance')
    or (kind = 'reallocation_in' and effect = 'reduces_balance')
    or (kind = 'credit' and effect = 'reduces_balance')
    or (kind = 'write_off' and effect = 'reduces_balance')
    or (kind = 'adjustment')
  )
);

create unique index if not exists financial_movements_venue_source
  on public.financial_movements (venue_id, source_id)
  where source_id is not null;

create index if not exists financial_movements_invoice
  on public.financial_movements (invoice_id, occurred_on);

alter table public.financial_movements enable row level security;

drop policy if exists financial_movements_select on public.financial_movements;
drop policy if exists financial_movements_insert on public.financial_movements;
drop policy if exists financial_movements_update on public.financial_movements;
drop policy if exists financial_movements_delete on public.financial_movements;

create policy financial_movements_select on public.financial_movements
  for select
  using (venue_id = public.current_user_venue_id() and coalesce(public.current_user_role(), '') <> 'staff');

create policy financial_movements_insert on public.financial_movements
  for insert
  with check (venue_id = public.current_user_venue_id());

create policy financial_movements_update on public.financial_movements
  for update
  using (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy financial_movements_delete on public.financial_movements
  for delete
  using (venue_id = public.current_user_venue_id() and public.current_user_role() in ('owner', 'manager'));

grant select, insert, update, delete on public.financial_movements to authenticated, service_role;

comment on table public.financial_movements is
  'One row per historical or recorded money movement. Schedules stay the obligations. Import rows use origin=import and are excluded from Stripe and QuickBooks.';

-- Net amount by which import movements reduce what is owed on an invoice.
create or replace function public._import_movement_reduction(p_invoice_id uuid)
returns numeric
language sql
stable
set search_path = public
as $$
  select coalesce(sum(
    case when effect = 'reduces_balance' then amount else -amount end
  ), 0)
  from public.financial_movements
  where invoice_id = p_invoice_id
    and origin = 'import';
$$;

create or replace function public._invoice_has_import_movements(p_invoice_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from public.financial_movements
    where invoice_id = p_invoice_id
      and origin = 'import'
  );
$$;

create or replace function public._compute_invoice_balance_due(p_invoice_id uuid, p_total numeric)
returns numeric
language sql
stable
set search_path = public
as $$
  select greatest(
    0,
    coalesce(p_total, 0)
      - public._compute_invoice_cancelled_plan_amount(p_invoice_id)
      - case
          when public._invoice_has_import_movements(p_invoice_id)
            then public._import_movement_reduction(p_invoice_id)
          else public._compute_invoice_total_paid(p_invoice_id)
        end
  );
$$;

create or replace function public._trg_invoices_sync_balance_due()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'void' then
    new.balance_due := 0;
  else
    new.balance_due := public._compute_invoice_balance_due(new.id, new.total);
  end if;
  return new;
end;
$$;

create or replace function public._trg_financial_movements_sync_balance()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_invoice uuid;
begin
  v_invoice := coalesce(new.invoice_id, old.invoice_id);
  if v_invoice is not null then
    update public.invoices i
    set balance_due = case
      when i.status = 'void' then 0
      else public._compute_invoice_balance_due(i.id, i.total)
    end
    where i.id = v_invoice;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists financial_movements_sync_balance on public.financial_movements;

create trigger financial_movements_sync_balance
  after insert or update or delete on public.financial_movements
  for each row
  execute function public._trg_financial_movements_sync_balance();

create or replace function public.canonical_payments_collected(
  p_from date default null,
  p_to date default null
) returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((
      select coalesce(sum(
        coalesce(pli.paid_amount, pli.amount) - coalesce(pli.refunded_amount, 0)
      ), 0)
      from public.payment_line_items pli
      left join public.payment_schedules ps on ps.id = pli.schedule_id
      left join public.clients c on c.id = ps.client_id
      where pli.venue_id = public.current_user_venue_id()
        and pli.status in ('paid', 'partially_paid', 'partially_refunded', 'refunded')
        and coalesce(c.exclude_from_business_reporting, false) = false
        and not public._invoice_has_import_movements(ps.invoice_id)
        and (
          (p_from is null and p_to is null)
          or (
            pli.paid_at is not null
            and (p_from is null or pli.paid_at::date >= p_from)
            and (p_to is null or pli.paid_at::date <= p_to)
          )
        )
    ), 0)
    + coalesce((
      select coalesce(sum(
        case
          when m.kind in ('payment', 'reallocation_in') then m.amount
          when m.kind in ('refund', 'reallocation_out') then -m.amount
          else 0
        end
      ), 0)
      from public.financial_movements m
      left join public.clients c on c.id = m.client_id
      where m.venue_id = public.current_user_venue_id()
        and m.origin = 'import'
        and m.kind in ('payment', 'refund', 'reallocation_in', 'reallocation_out')
        and coalesce(c.exclude_from_business_reporting, false) = false
        and (
          (p_from is null and p_to is null)
          or (
            m.occurred_on is not null
            and (p_from is null or m.occurred_on >= p_from)
            and (p_to is null or m.occurred_on <= p_to)
          )
        )
    ), 0);
$$;

create or replace function public.canonical_outstanding_balance(
  p_from date default null,
  p_to date default null
) returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(i.balance_due), 0)
  from public.invoices i
  join public.clients c on c.id = i.client_id
  where i.venue_id = public.current_user_venue_id()
    and i.status in ('sent', 'partially_paid', 'paid')
    and c.exclude_from_business_reporting = false
    and (
      (p_from is null and p_to is null)
      or (
        i.issued_at is not null
        and (p_from is null or i.issued_at::date >= p_from)
        and (p_to is null or i.issued_at::date <= p_to)
      )
    );
$$;

grant execute on function public.canonical_payments_collected(date, date) to authenticated;
grant execute on function public.canonical_outstanding_balance(date, date) to authenticated;

notify pgrst, 'reload schema';
