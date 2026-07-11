-- Planning Experience — Related Context, embedded tool link, Internal Notes.
-- Product Decisions, Planning Experience Review / Design Approval, 2026-07-08.
--
-- Two additive pieces:
-- 1. resource_url/resource_label — the single embedded tool link a task can
--    point to ("Open the Guest List Tool"), authored at Definition time on
--    playbook_tasks, copied to event_tasks at apply-time (same pattern as
--    every other Definition->Execution field already in this table).
-- 2. event_task_context_links — a task's Related Context: pointers into
--    Conversation, Documents, and the Day-of Timeline. Deliberately a
--    reference table, never a copy of the underlying content (One Fact, One
--    Owner) — exactly one of the three source columns is set per row.
--    Execution-time only; a template has no Related Context of its own.
--
-- Internal Notes needs no migration: event_tasks.notes already exists,
-- already mapped in application code, and has simply never had a real
-- read/write path — this is a UI/service change, not a schema change.

alter table public.playbook_tasks add column resource_url text;
alter table public.playbook_tasks add column resource_label text;
alter table public.event_tasks add column resource_url text;
alter table public.event_tasks add column resource_label text;

create table public.event_task_context_links (
  id                       uuid primary key default gen_random_uuid(),
  venue_id                 uuid not null references public.venues(id) on delete cascade,
  event_task_id            uuid not null references public.event_tasks(id) on delete cascade,
  conversation_message_id  uuid references public.conversation_messages(id) on delete cascade,
  document_id              uuid references public.documents(id) on delete cascade,
  timeline_entry_id        uuid references public.timeline_entries(id) on delete cascade,
  created_at               timestamptz not null default now(),
  constraint event_task_context_links_one_source check (
    (conversation_message_id is not null)::int
    + (document_id is not null)::int
    + (timeline_entry_id is not null)::int = 1
  ),
  unique (event_task_id, conversation_message_id),
  unique (event_task_id, document_id),
  unique (event_task_id, timeline_entry_id)
);

create index event_task_context_links_task on public.event_task_context_links (event_task_id);
create index event_task_context_links_venue on public.event_task_context_links (venue_id);

alter table public.event_task_context_links enable row level security;

create policy event_task_context_links_venue_isolation on public.event_task_context_links
  for all
  using (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());
