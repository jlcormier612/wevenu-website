-- Program 4, Initiative C, Phases 8/10/16 (2026-07-23) — FAQs are named
-- explicitly across three phases as content a Partner Vendor maintains and
-- a claimed vendor's expanded profile shows, but no FAQ concept exists
-- anywhere in this schema yet (confirmed: zero tables matching '%faq%').
-- This is the one other genuinely new, small table this initiative needs.
-- Shape and RLS mirror vendor_packages exactly, the existing precedent for
-- "vendor-owned content the venue and couple can read."

create table if not exists public.vendor_faqs (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  question text not null,
  answer text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vendor_faqs_vendor on public.vendor_faqs (vendor_id, sort_order);

create trigger vendor_faqs_updated_at before update on public.vendor_faqs
  for each row execute function public.set_updated_at();

alter table public.vendor_faqs enable row level security;

create policy "vendor_users_manage_faqs" on public.vendor_faqs
  using (
    exists (
      select 1 from public.vendor_users vu
      where vu.vendor_id = vendor_faqs.vendor_id
        and vu.user_id = auth.uid()
        and vu.role in ('owner', 'manager')
        and vu.is_active = true
    )
  );

create policy "venues_see_vendor_faqs" on public.vendor_faqs
  for select using (
    exists (
      select 1 from public.venue_vendor_relationships vvr
      join public.venues v on v.id = vvr.venue_id
      where vvr.vendor_id = vendor_faqs.vendor_id
        and vvr.status <> 'inactive'
        and v.owner_user_id = auth.uid()
    )
    or exists (
      select 1 from public.vendor_users vu
      where vu.vendor_id = vendor_faqs.vendor_id and vu.user_id = auth.uid() and vu.is_active = true
    )
  );

grant select, insert, update, delete on public.vendor_faqs to authenticated;
