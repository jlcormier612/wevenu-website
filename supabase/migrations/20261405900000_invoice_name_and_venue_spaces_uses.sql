-- Human-facing invoice name vs immutable system invoice_number.
-- display_name is presentation only; never replaces invoice_number for
-- accounting, Stripe/QBO DocNumber, audit, or integrations.

alter table public.invoices
  add column if not exists display_name text;

comment on column public.invoices.display_name is
  'Human-facing editable invoice name (e.g. Wedding Deposit). invoice_number remains the immutable system identifier.';

-- Deterministic defaults where null — application sets richer names on create.
update public.invoices
set display_name = 'Invoice'
where display_name is null or trim(display_name) = '';

-- Venue spaces: permitted uses (venue-configured; not hard-coded wedding concepts).
alter table public.venue_spaces
  add column if not exists permitted_uses text[] not null default '{}';

comment on column public.venue_spaces.permitted_uses is
  'Venue-configured uses this physical space may serve (e.g. ceremony, reception, meeting). Empty = unrestricted for assignment UI simplicity on single-use venues.';

-- Venue operating mode for space UI exposure.
alter table public.venues
  add column if not exists space_operating_mode text not null default 'single'
    check (space_operating_mode in ('single', 'multi'));

comment on column public.venues.space_operating_mode is
  'single = one primary event space UX; multi = expose multi-space assignment, calendar filter, and use-based controls. Default single so existing one-space venues stay simple.';

-- Promote venues that already have 2+ active spaces to multi (deterministic, non-destructive).
update public.venues v
set space_operating_mode = 'multi'
where space_operating_mode = 'single'
  and (
    select count(*) from public.venue_spaces s
    where s.venue_id = v.id and s.is_active = true
  ) >= 2;

-- Event space assignments: use → physical space (same space may serve multiple uses).
create table if not exists public.event_space_assignments (
  id         uuid primary key default gen_random_uuid(),
  venue_id   uuid not null references public.venues (id) on delete cascade,
  event_id   uuid not null references public.events (id) on delete cascade,
  use_key    text not null,
  use_label  text not null,
  space_id   uuid not null references public.venue_spaces (id) on delete restrict,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, use_key)
);

create index if not exists event_space_assignments_event
  on public.event_space_assignments (event_id, sort_order);
create index if not exists event_space_assignments_venue
  on public.event_space_assignments (venue_id);
create index if not exists event_space_assignments_space
  on public.event_space_assignments (space_id);

drop trigger if exists event_space_assignments_updated_at on public.event_space_assignments;
create trigger event_space_assignments_updated_at
  before update on public.event_space_assignments
  for each row execute function public.set_updated_at();

alter table public.event_space_assignments enable row level security;

drop policy if exists "venue staff manage event_space_assignments" on public.event_space_assignments;
create policy "venue staff manage event_space_assignments"
  on public.event_space_assignments
  for all
  using (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.event_space_assignments to authenticated;

-- Backfill: when an event has a single space_id and no assignments, create one "Event space" row.
insert into public.event_space_assignments (venue_id, event_id, use_key, use_label, space_id, sort_order)
select e.venue_id, e.id, 'event_space', 'Event space', e.space_id, 0
from public.events e
where e.space_id is not null
  and not exists (
    select 1 from public.event_space_assignments a where a.event_id = e.id
  )
on conflict (event_id, use_key) do nothing;

-- Portal payments: surface human invoice name + system number + obligation_kind.
-- Same schedules SoT; invoices array is presentation enrichment only.
create or replace function public.get_portal_payments(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
begin
  select * into v_session
  from public.client_portal_sessions
  where access_token = p_token
    and (expires_at is null or expires_at > now())
  limit 1;

  if v_session.id is null then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  if v_session.access_level = 'planning' then
    return jsonb_build_object('schedules', '[]'::jsonb, 'invoices', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'schedules', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id',          ps.id,
            'title',       ps.title,
            'totalAmount', ps.total_amount,
            'currency',    ps.currency,
            'notes',       ps.notes,
            'invoiceId',   ps.invoice_id,
            'createdAt',   ps.created_at,
            'lineItems', (
              select coalesce(
                jsonb_agg(
                  jsonb_build_object(
                    'id',             pli.id,
                    'label',          pli.label,
                    'amount',         pli.amount,
                    'dueDate',        pli.due_date,
                    'status',         pli.status,
                    'paidAt',         pli.paid_at,
                    'paidAmount',     pli.paid_amount,
                    'refundedAmount', coalesce(pli.refunded_amount, 0),
                    'paymentMethod',  pli.payment_method,
                    'obligationKind', pli.obligation_kind,
                    'sortOrder',      pli.sort_order
                  )
                  order by pli.sort_order, pli.due_date nulls last
                ),
                '[]'::jsonb
              )
              from public.payment_line_items pli
              where pli.schedule_id = ps.id
                and pli.venue_id    = v_session.venue_id
                and pli.status     != 'cancelled'
            )
          )
          order by ps.created_at desc
        ),
        '[]'::jsonb
      )
      from (
        select distinct on (coalesce(ps0.invoice_id, ps0.id))
          ps0.*
        from public.payment_schedules ps0
        left join public.invoices inv on inv.id = ps0.invoice_id
        where ps0.client_id = v_session.client_id
          and ps0.venue_id  = v_session.venue_id
          and (ps0.invoice_id is null or inv.status != 'draft')
        order by coalesce(ps0.invoice_id, ps0.id), ps0.created_at desc, ps0.id desc
      ) ps
    ),
    'invoices', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id',            inv.id,
            'invoiceNumber', inv.invoice_number,
            'displayName',   inv.display_name,
            'total',         inv.total,
            'balanceDue',    inv.balance_due,
            'status',        inv.status
          )
          order by inv.created_at desc
        ),
        '[]'::jsonb
      )
      from public.invoices inv
      where inv.client_id = v_session.client_id
        and inv.venue_id  = v_session.venue_id
        and inv.status   != 'draft'
    )
  );
end;
$$;

grant execute on function public.get_portal_payments(text) to anon, authenticated;

comment on function public.get_portal_payments(text) is
  'Portal payment schedules + invoice display_name/invoice_number. Omits payment_line_items.notes. financial and couple access share the same invoice SoT.';

notify pgrst, 'reload schema';
