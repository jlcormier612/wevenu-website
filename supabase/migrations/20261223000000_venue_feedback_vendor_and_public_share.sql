-- Product feedback: vendor submissions + outward-share consent for NPS.

-- 1. Optional vendor actor (venue_id becomes nullable when vendor_id is set)
alter table public.venue_feedback
  add column if not exists vendor_id uuid references public.vendors(id) on delete cascade;

alter table public.venue_feedback
  alter column venue_id drop not null;

alter table public.venue_feedback
  drop constraint if exists venue_feedback_actor_chk;

alter table public.venue_feedback
  add constraint venue_feedback_actor_chk check (
    (venue_id is not null and vendor_id is null)
    or (venue_id is null and vendor_id is not null)
  );

create index if not exists venue_feedback_vendor_id_idx
  on public.venue_feedback (vendor_id)
  where vendor_id is not null;

-- 2. Explicit consent for outward marketing use (default off)
alter table public.venue_feedback
  add column if not exists allow_public_share boolean not null default false;

-- 3. Vendor RLS (mirrors venue insert/select policies)
drop policy if exists "vendors can submit feedback" on public.venue_feedback;
create policy "vendors can submit feedback" on public.venue_feedback
  for insert to authenticated
  with check (
    vendor_id is not null
    and vendor_id = (
      select vu.vendor_id
      from public.vendor_users vu
      where vu.user_id = auth.uid()
        and vu.is_active = true
      limit 1
    )
  );

drop policy if exists "vendors can read own feedback" on public.venue_feedback;
create policy "vendors can read own feedback" on public.venue_feedback
  for select to authenticated
  using (
    vendor_id is not null
    and vendor_id = (
      select vu.vendor_id
      from public.vendor_users vu
      where vu.user_id = auth.uid()
        and vu.is_active = true
      limit 1
    )
  );
