-- ============================================================================
-- Timeline Integration — connect Timeline items to Vendors, Floor Plans,
-- Conversations, and Invoices/Payments, mirroring the exact multi-source-
-- type "Related Context" shape Planning tasks already use
-- (event_task_context_links). Planning itself needs no new storage here —
-- that table already has a timeline_entry_id column, so a Timeline item
-- linking to a Planning task and a Planning task linking to a Timeline item
-- are the same row, read from either direction. Documents are already
-- covered by timeline_entry_attachments (Booking Timeline Experience task)
-- — reusing that model, not duplicating it here.
-- ============================================================================

create table public.timeline_entry_context_links (
  id                    uuid primary key default gen_random_uuid(),
  venue_id              uuid not null references public.venues (id) on delete cascade,
  timeline_entry_id     uuid not null references public.timeline_entries (id) on delete cascade,

  vendor_assignment_id  uuid references public.event_vendor_assignments (id) on delete cascade,
  floor_plan_id         uuid references public.floor_plans (id) on delete cascade,
  conversation_id       uuid references public.conversations (id) on delete cascade,
  invoice_id            uuid references public.invoices (id) on delete cascade,

  created_at            timestamptz not null default now(),

  constraint timeline_entry_context_links_one_source check (
    ((vendor_assignment_id is not null)::int + (floor_plan_id is not null)::int
     + (conversation_id is not null)::int + (invoice_id is not null)::int) = 1
  )
);

create index timeline_entry_context_links_entry on public.timeline_entry_context_links (timeline_entry_id);

create unique index timeline_entry_context_links_vendor on public.timeline_entry_context_links (timeline_entry_id, vendor_assignment_id) where vendor_assignment_id is not null;
create unique index timeline_entry_context_links_floor_plan on public.timeline_entry_context_links (timeline_entry_id, floor_plan_id) where floor_plan_id is not null;
create unique index timeline_entry_context_links_conversation on public.timeline_entry_context_links (timeline_entry_id, conversation_id) where conversation_id is not null;
create unique index timeline_entry_context_links_invoice on public.timeline_entry_context_links (timeline_entry_id, invoice_id) where invoice_id is not null;

alter table public.timeline_entry_context_links enable row level security;

create policy timeline_entry_context_links_all on public.timeline_entry_context_links
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.timeline_entry_context_links to authenticated;

notify pgrst, 'reload schema';
