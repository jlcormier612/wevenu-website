-- ============================================================================
-- TR-G1 — Permissions enforcement
-- Resolves docs/trust-risk-register.md TR-G1: venue_staff.role existed only
-- as a label, with nothing server-side or at the RLS layer enforcing it.
-- Model agreed in docs/permissions-model-proposal.md: Owner, Manager,
-- Coordinator, Staff. Refunds are Owner-only (no refund flow exists yet, so
-- nothing to gate there today). Read-only and custom permissions deferred.
-- ============================================================================

-- Widen role constraint to add 'coordinator'. Backfill existing 'staff' rows
-- to 'coordinator' — the closest match to how "staff" is actually used today
-- (full day-to-day operational access), since nobody has been operating under
-- the new, narrower Staff definition. A venue owner can manually downgrade
-- specific people to the new 'staff' afterward if that's genuinely what they want.
alter table public.venue_staff drop constraint venue_staff_role_check;

update public.venue_staff set role = 'coordinator' where role = 'staff';

alter table public.venue_staff add constraint venue_staff_role_check
  check (role = any (array['owner', 'manager', 'coordinator', 'staff']));

-- current_user_role() — same SECURITY DEFINER pattern as current_user_venue_id(),
-- so RLS policies (including on venue_staff itself) can gate by role without
-- recursion: the function runs as its owner and its internal query bypasses
-- the caller's RLS, exactly like current_user_venue_id() already does.
create or replace function public.current_user_role()
returns text
language sql
stable security definer
set search_path = public
as $$
  select coalesce(
    (select 'owner' from public.venues where owner_user_id = auth.uid() limit 1),
    (select role from public.venue_staff
     where user_id = auth.uid() and accepted_at is not null and is_active = true
     limit 1)
  )
$$;

grant execute on function public.current_user_role() to authenticated, anon;

-- ---- contracts: split the single ALL policy so DELETE can be gated separately
-- (edit/delete-when-signed is already blocked for everyone at the app layer
-- per TR-L1/TR-L2; this adds "delete a draft/cancelled contract" behind
-- owner/manager, matching the agreed capability matrix).
drop policy contracts_all on public.contracts;

create policy contracts_select on public.contracts for select
  using (venue_id = current_user_venue_id());

create policy contracts_insert on public.contracts for insert
  with check (venue_id = current_user_venue_id());

create policy contracts_update on public.contracts for update
  using (venue_id = current_user_venue_id())
  with check (venue_id = current_user_venue_id());

create policy contracts_delete on public.contracts for delete
  using (venue_id = current_user_venue_id() and current_user_role() in ('owner', 'manager'));

-- ---- payment_schedules: gate DELETE behind owner/manager (TR-M5's app-layer
-- guard is the primary defense; this is the RLS backstop), and hide financial
-- visibility from Staff per the agreed matrix (Coordinator+ keep full visibility).
drop policy payment_schedules_all on public.payment_schedules;

create policy payment_schedules_select on public.payment_schedules for select
  using (venue_id = current_user_venue_id() and coalesce(current_user_role(), '') <> 'staff');

create policy payment_schedules_insert on public.payment_schedules for insert
  with check (venue_id = current_user_venue_id());

create policy payment_schedules_update on public.payment_schedules for update
  using (venue_id = current_user_venue_id())
  with check (venue_id = current_user_venue_id());

create policy payment_schedules_delete on public.payment_schedules for delete
  using (venue_id = current_user_venue_id() and current_user_role() in ('owner', 'manager'));

-- ---- payment_line_items: same pattern as payment_schedules
drop policy payment_line_items_all on public.payment_line_items;

create policy payment_line_items_select on public.payment_line_items for select
  using (venue_id = current_user_venue_id() and coalesce(current_user_role(), '') <> 'staff');

create policy payment_line_items_insert on public.payment_line_items for insert
  with check (venue_id = current_user_venue_id());

create policy payment_line_items_update on public.payment_line_items for update
  using (venue_id = current_user_venue_id())
  with check (venue_id = current_user_venue_id());

create policy payment_line_items_delete on public.payment_line_items for delete
  using (venue_id = current_user_venue_id() and current_user_role() in ('owner', 'manager'));

-- ---- invoices: same visibility rule (Staff has no financial visibility)
drop policy invoices_all on public.invoices;

create policy invoices_select on public.invoices for select
  using (venue_id = current_user_venue_id() and coalesce(current_user_role(), '') <> 'staff');

create policy invoices_insert on public.invoices for insert
  with check (venue_id = current_user_venue_id());

create policy invoices_update on public.invoices for update
  using (venue_id = current_user_venue_id())
  with check (venue_id = current_user_venue_id());

create policy invoices_delete on public.invoices for delete
  using (venue_id = current_user_venue_id() and current_user_role() in ('owner', 'manager'));

-- ---- venue_staff: widen invite/role-management from Owner-only to also allow
-- Manager, but only for staff/coordinator-level rows — a Manager can never
-- create or touch an owner or another manager's row (that stays Owner-only).
drop policy venue_staff_insert on public.venue_staff;

create policy venue_staff_insert on public.venue_staff for insert
  with check (
    exists (
      select 1 from public.venues
      where venues.id = venue_staff.venue_id and venues.owner_user_id = auth.uid()
    )
    or (current_user_role() = 'manager' and role in ('staff', 'coordinator'))
  );

drop policy venue_staff_update on public.venue_staff;

create policy venue_staff_update on public.venue_staff for update
  using (
    exists (
      select 1 from public.venues
      where venues.id = venue_staff.venue_id and venues.owner_user_id = auth.uid()
    )
    or (current_user_role() = 'manager' and is_owner = false and role in ('staff', 'coordinator'))
  )
  with check (
    exists (
      select 1 from public.venues
      where venues.id = venue_staff.venue_id and venues.owner_user_id = auth.uid()
    )
    or (current_user_role() = 'manager' and is_owner = false and role in ('staff', 'coordinator'))
  );
