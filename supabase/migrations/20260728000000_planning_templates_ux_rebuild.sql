-- Planning Templates — UX Rebuild (2026-07-09).
-- Two schema additions needed to fulfill the rebuilt experience, both
-- explicitly confirmed with the user rather than assumed:
--
-- 1. Venue-level (unscoped) documents — a Planning Template isn't tied to
--    any single lead/client/event/vendor, so "attach an existing document
--    from the document library" to a template needs documents that can
--    belong to the venue itself, not one specific entity.
-- 2. playbook_task_attachments — real multi-attachment support at Definition
--    time (upload a file / attach an existing venue document / add a web
--    link), replacing the old single resource_url/resource_label field.
--    event_task_context_links (already built for Related Context) gains a
--    matching "link" source type so the same table serves both the
--    execution-time Related Context UI and the copy-at-apply-time target
--    for a template's attachments — one mechanism, not two.

-- ---- 1. Venue-level documents -------------------------------------------------

alter table public.documents drop constraint documents_one_entity;
alter table public.documents add constraint documents_one_entity check (
  (lead_id   is not null)::int +
  (client_id is not null)::int +
  (event_id  is not null)::int +
  (vendor_id is not null)::int <= 1
);
-- A row with all four null is now valid: a reusable, venue-owned document
-- (a blank Guest Count Policy PDF, a standard Vendor COI checklist, etc.)
-- that isn't about one specific lead/client/event/vendor.

create index documents_venue_level on public.documents (venue_id, created_at desc)
  where lead_id is null and client_id is null and event_id is null and vendor_id is null;

-- ---- 2. Template-level attachments --------------------------------------------

create table public.playbook_task_attachments (
  id               uuid primary key default gen_random_uuid(),
  venue_id         uuid not null references public.venues(id) on delete cascade,
  playbook_task_id uuid not null references public.playbook_tasks(id) on delete cascade,
  document_id      uuid references public.documents(id) on delete cascade,
  link_url         text,
  link_label       text,
  sort_order       smallint not null default 0,
  created_at       timestamptz not null default now(),
  constraint playbook_task_attachments_one_source check (
    (document_id is not null)::int + (link_url is not null)::int = 1
  )
);

create index playbook_task_attachments_task on public.playbook_task_attachments (playbook_task_id);

alter table public.playbook_task_attachments enable row level security;

create policy playbook_task_attachments_venue_isolation on public.playbook_task_attachments
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

-- event_task_context_links gains a fourth source type — a raw link, matching
-- what a template attachment copies forward at apply-time. Documents,
-- Timeline entries, and Conversation messages are all references into a
-- system that owns that content; a link has no other owner, so it's stored
-- directly here rather than invented a fourth table for one field pair.
alter table public.event_task_context_links add column link_url text;
alter table public.event_task_context_links add column link_label text;
alter table public.event_task_context_links drop constraint event_task_context_links_one_source;
alter table public.event_task_context_links add constraint event_task_context_links_one_source check (
  (conversation_message_id is not null)::int
  + (document_id is not null)::int
  + (timeline_entry_id is not null)::int
  + (link_url is not null)::int = 1
);

-- ---- 3. Retire the old single-link field ---------------------------------------
-- Requirement 6 explicitly rejects "Button Label + URL configuration" as the
-- shape for attaching a link to a task — that's exactly what resource_url/
-- resource_label was. Real attachments (above) replace it outright rather
-- than existing alongside it as a second, confusing way to add a link.
-- No production data exists in either column as of this migration.
alter table public.playbook_tasks drop column resource_url;
alter table public.playbook_tasks drop column resource_label;
alter table public.event_tasks drop column resource_url;
alter table public.event_tasks drop column resource_label;
