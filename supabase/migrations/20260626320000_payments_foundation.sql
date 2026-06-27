-- ============================================================================
-- Sprint 16 — Payments Foundation
-- "What has been paid, what is still due, and what needs attention?"
--
-- payment_schedules    — the overall payment arrangement for a client/event
-- payment_line_items   — individual payments (deposit, installments, final)
-- payment_activities   — activity log for each schedule
--
-- Overdue detection: mark_overdue_payments() updates pending items whose
-- due_date has passed. Called by the service layer on schedule fetch.
-- ============================================================================

-- payment_schedules -----------------------------------------------------------
create table public.payment_schedules (
  id           uuid primary key default gen_random_uuid(),
  venue_id     uuid not null references public.venues  (id) on delete cascade,
  client_id    uuid references public.clients (id) on delete set null,
  event_id     uuid references public.events  (id) on delete set null,

  title        text not null,
  total_amount numeric(12, 2) not null default 0
                 check (total_amount >= 0),
  currency     text not null default 'USD',
  notes        text,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index payment_schedules_venue   on public.payment_schedules (venue_id);
create index payment_schedules_client  on public.payment_schedules (client_id) where client_id is not null;

create trigger payment_schedules_updated_at
  before update on public.payment_schedules
  for each row execute function public.set_updated_at();

-- payment_line_items ----------------------------------------------------------
create table public.payment_line_items (
  id               uuid primary key default gen_random_uuid(),
  venue_id         uuid not null references public.venues           (id) on delete cascade,
  schedule_id      uuid not null references public.payment_schedules (id) on delete cascade,

  label            text not null,
  amount           numeric(12, 2) not null check (amount >= 0),
  due_date         date,

  -- pending → overdue (auto-detected) or paid or cancelled
  status           text not null default 'pending'
                     check (status in ('pending', 'overdue', 'paid', 'cancelled')),

  -- Captured when marking as paid
  paid_at          timestamptz,
  paid_amount      numeric(12, 2) check (paid_amount >= 0),
  payment_method   text,    -- 'cash','check','bank_transfer','credit_card','venmo','stripe','other'
  reference_number text,
  notes            text,

  sort_order       smallint not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index payment_line_items_schedule on public.payment_line_items (schedule_id, sort_order, due_date);
create index payment_line_items_venue    on public.payment_line_items (venue_id);

create trigger payment_line_items_updated_at
  before update on public.payment_line_items
  for each row execute function public.set_updated_at();

-- payment_activities ----------------------------------------------------------
create table public.payment_activities (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues           (id) on delete cascade,
  schedule_id uuid not null references public.payment_schedules (id) on delete cascade,
  type        text not null,
  title       text not null,
  description text,
  created_at  timestamptz not null default now()
);

create index payment_activities_schedule on public.payment_activities (schedule_id, created_at desc);

-- RLS -------------------------------------------------------------------------
alter table public.payment_schedules  enable row level security;
alter table public.payment_line_items enable row level security;
alter table public.payment_activities enable row level security;

create policy payment_schedules_all on public.payment_schedules
  for all
  using      (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()));

create policy payment_line_items_all on public.payment_line_items
  for all
  using      (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()));

create policy payment_activities_all on public.payment_activities
  for all
  using      (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()));

grant select, insert, update, delete on public.payment_schedules  to authenticated;
grant select, insert, update, delete on public.payment_line_items to authenticated;
grant select, insert, update, delete on public.payment_activities to authenticated;

-- Auto-overdue function -------------------------------------------------------
-- Called by the service layer when loading a schedule. Marks pending items
-- whose due_date has passed as overdue — no manual step required.
create or replace function public.mark_overdue_payments(p_venue_id uuid)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.payment_line_items
  set status = 'overdue', updated_at = now()
  where venue_id = p_venue_id
    and status = 'pending'
    and due_date < current_date;
$$;

grant execute on function public.mark_overdue_payments(uuid) to authenticated;

notify pgrst, 'reload schema';
