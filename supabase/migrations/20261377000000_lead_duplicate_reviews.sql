-- ============================================================================
-- Possible duplicate inquiry reviews (venue attention only).
--
-- Detection + human guidance. Does NOT merge Relationships, re-parent Leads,
-- change Booking history, or alter Reporting semantics.
-- ============================================================================

create table public.lead_duplicate_reviews (
  id                      uuid primary key default gen_random_uuid(),
  venue_id                uuid not null references public.venues (id) on delete cascade,
  lead_id                 uuid not null references public.leads (id) on delete cascade,
  matched_lead_id         uuid references public.leads (id) on delete set null,
  matched_client_id       uuid references public.clients (id) on delete set null,
  matched_relationship_id uuid references public.venue_customer_relationships (id) on delete set null,
  matched_display_name    text not null,
  matched_email           text,
  matched_phone           text,
  matched_sales_stage     text,
  signals                 text[] not null default '{}',
  status                  text not null default 'needs_review'
                            check (status in ('needs_review', 'kept_separate')),
  notification_id         uuid references public.venue_notifications (id) on delete set null,
  created_at              timestamptz not null default now(),
  resolved_at             timestamptz,
  constraint lead_duplicate_reviews_lead_uniq unique (lead_id)
);

create index lead_duplicate_reviews_venue_status
  on public.lead_duplicate_reviews (venue_id, status)
  where status = 'needs_review';

create index lead_duplicate_reviews_matched_lead
  on public.lead_duplicate_reviews (matched_lead_id)
  where matched_lead_id is not null;

alter table public.lead_duplicate_reviews enable row level security;

create policy lead_duplicate_reviews_venue_all
  on public.lead_duplicate_reviews for all
  using (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.lead_duplicate_reviews to authenticated;
grant select, insert, update, delete on public.lead_duplicate_reviews to service_role;

comment on table public.lead_duplicate_reviews is
  'Venue-only possible-duplicate inquiry attention. Keep Separate dismisses; confirmed duplicates are consolidated manually then the erroneous Lead is deleted. No Relationship merge.';

notify pgrst, 'reload schema';
