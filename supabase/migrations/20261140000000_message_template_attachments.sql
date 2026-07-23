-- ============================================================================
-- Message Templates — attachments (bug-report follow-up, 2026-07-22).
--
-- "they'll also need to be able to attach things in these templates, like
-- brochures, etc." Mirrors playbook_task_attachments' exact shape
-- (supabase/migrations/20260728000000_planning_templates_ux_rebuild.sql) —
-- an uploaded file, an existing venue-level document, or a web link — rather
-- than inventing a new attachment mechanism. Reuses the same venue-level
-- `documents` rows (lead_id/client_id/event_id/vendor_id all null) a
-- Planning Template attachment already reads from.
-- ============================================================================

create table public.message_template_attachments (
  id           uuid primary key default gen_random_uuid(),
  venue_id     uuid not null references public.venues(id) on delete cascade,
  template_id  uuid not null references public.message_templates(id) on delete cascade,
  document_id  uuid references public.documents(id) on delete cascade,
  link_url     text,
  link_label   text,
  sort_order   smallint not null default 0,
  created_at   timestamptz not null default now(),
  constraint message_template_attachments_one_source check (
    (document_id is not null)::int + (link_url is not null)::int = 1
  )
);

create index message_template_attachments_template on public.message_template_attachments (template_id);

alter table public.message_template_attachments enable row level security;

create policy message_template_attachments_venue_isolation on public.message_template_attachments
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.message_template_attachments to authenticated;

notify pgrst, 'reload schema';
