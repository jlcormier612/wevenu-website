-- Relationship-level Archive (ACTIVE → ARCHIVED).
-- Distinct from hard Delete. Preserves contracts/invoices/documents/history.
-- Active surfaces exclude archived relationships; historical access remains.

alter table public.venue_customer_relationships
  add column if not exists archived_at timestamptz null;

alter table public.venue_customer_relationships
  add column if not exists archived_by uuid null references auth.users (id) on delete set null;

comment on column public.venue_customer_relationships.archived_at is
  'When set, the relationship is ARCHIVED: removed from active pipeline/lists/dashboard attention while history remains.';

comment on column public.venue_customer_relationships.archived_by is
  'Staff user who archived the relationship (optional audit).';

create index if not exists venue_customer_relationships_active_idx
  on public.venue_customer_relationships (venue_id)
  where archived_at is null;

create index if not exists venue_customer_relationships_archived_idx
  on public.venue_customer_relationships (venue_id, archived_at)
  where archived_at is not null;
