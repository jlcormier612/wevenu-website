-- Work Package D5C — Event Order operational experience completion.
--
-- Three additions, all additive to the certified Event Order foundation
-- (20260923000000_event_order_foundation.sql) — nothing here redesigns it:
--
-- 1. shared_at — the one new column. Mirrors the exact "private until
--    intentionally shared" pattern already used elsewhere (invoices.
--    is_couple_visible, contracts.sent_at): null until the venue takes the
--    explicit "Share with Client" action; that's the one and only place
--    this ever gets set.
--
-- 2. Finalize immutability, enforced at the database level. Event Order's
--    existing "Finalized" status was, before this migration, enforced only
--    by the application layer (assertOpen() in lib/event-orders/service.ts)
--    — exactly the same class of gap D4 found and fixed for Contracts and
--    D5A found and fixed for Event Inventory. The label "Finalized" is
--    real, customer-facing product language (DISPLAY_STATUS_LABEL) — this
--    migration makes it actually true, using the identical trigger-based
--    pattern already certified twice.
--
-- 3. A private storage bucket + portal RPC for the Event Order PDF
--    representation, mirroring contract-representations exactly (D4) —
--    never a public bucket, every real read goes through a freshly-minted
--    signed URL.

alter table public.event_orders add column if not exists shared_at timestamptz;

-- ---- Finalize immutability (mirrors 20261248000000's event_inventory_items trigger) ----
create or replace function public.event_order_lines_enforce_finalized_immutability()
returns trigger
language plpgsql
as $$
declare
  v_status text;
begin
  select status into v_status from public.event_orders where id = coalesce(new.event_order_id, old.event_order_id);
  if v_status = 'finalized' then
    raise exception 'This Event Order is finalized — reopen it to make changes.'
      using errcode = '23001'; -- restrict_violation
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists event_order_lines_finalized_immutable on public.event_order_lines;
create trigger event_order_lines_finalized_immutable
  before insert or update or delete on public.event_order_lines
  for each row execute function public.event_order_lines_enforce_finalized_immutability();

create or replace function public.event_order_sections_enforce_finalized_immutability()
returns trigger
language plpgsql
as $$
declare
  v_status text;
begin
  select status into v_status from public.event_orders where id = coalesce(new.event_order_id, old.event_order_id);
  if v_status = 'finalized' then
    raise exception 'This Event Order is finalized — reopen it to make changes.'
      using errcode = '23001';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists event_order_sections_finalized_immutable on public.event_order_sections;
create trigger event_order_sections_finalized_immutable
  before insert or update or delete on public.event_order_sections
  for each row execute function public.event_order_sections_enforce_finalized_immutability();

-- ---- Private storage for the generated PDF (mirrors contract-representations, D4) ----
insert into storage.buckets (id, name, public)
values ('event-order-representations', 'event-order-representations', false)
on conflict (id) do nothing;

drop policy if exists "event_order_representations_select" on storage.objects;
create policy "event_order_representations_select" on storage.objects
  for select
  using (bucket_id = 'event-order-representations' and auth.role() = 'authenticated');
-- Writes are service-role only (no insert/update/delete policy for authenticated) —
-- identical posture to contract-representations.

-- ---- Client portal read access (mirrors get_event_inventory_for_portal, D5A) ----
create or replace function public.get_event_order_for_portal(p_token text)
returns table (
  id            uuid,
  status        text,
  revision      int,
  shared_at     timestamptz,
  section_id    uuid,
  section_name  text,
  line_id       uuid,
  line_description text,
  line_quantity numeric,
  line_amount   numeric,
  line_sort_order smallint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
begin
  select * into v_session
  from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return; end if;

  return query
  select
    eo.id, eo.status, eo.revision, eo.shared_at,
    eol.section_id, es.name,
    eol.id, eol.description, eol.quantity, eol.amount, eol.sort_order
  from public.event_orders eo
  join public.events e on e.id = eo.event_id
  left join public.event_order_lines eol on eol.event_order_id = eo.id
  left join public.event_order_sections es on es.id = eol.section_id
  where e.client_id = v_session.client_id
    and eo.venue_id = v_session.venue_id
    and eo.shared_at is not null
  order by eol.sort_order;
end;
$$;

grant execute on function public.get_event_order_for_portal(text) to anon, authenticated;

notify pgrst, 'reload schema';
