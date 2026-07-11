-- ============================================================================
-- Message Template Library — Communication Platform Phase 1 (2026-07-14)
--
-- docs/communication-platform-next-phase.md §2. A named, reusable message
-- with a category and merge-field tokens, belonging to Email, SMS, or both.
-- Merge-field *vocabulary* is shared across channels (§2.3); content is
-- never shared (§2.5, decided 2026-07-13) — email_subject/email_body and
-- sms_body are independent, both nullable, with a check that at least one
-- channel is actually filled in.
--
-- Scoped strictly to the Library itself — no Sequence/Series, no Scheduled
-- Send, no send action of any kind. Those are later phases per the approved
-- design; this migration only stores templates for them to consume later.
-- ============================================================================

create table public.message_templates (
  id           uuid primary key default gen_random_uuid(),
  venue_id     uuid not null references public.venues (id) on delete cascade,

  name         text not null,
  category     text not null default 'general'
                 check (category in (
                   'inquiry_follow_up', 'tour', 'booking_confirmation',
                   'planning_reminder', 'payment_reminder',
                   'vendor_coordination', 'post_event', 'general'
                 )),

  -- Email variant — subject + body. Both null if this template has no email version.
  email_subject text,
  email_body    text,

  -- SMS variant — body only, no subject. Null if this template has no SMS version.
  sms_body      text,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- A template must actually say something in at least one channel.
  constraint message_templates_has_content
    check (email_body is not null or sms_body is not null)
);

create index message_templates_venue on public.message_templates (venue_id);
create index message_templates_venue_category on public.message_templates (venue_id, category);

create trigger message_templates_updated_at
  before update on public.message_templates
  for each row execute function public.set_updated_at();

alter table public.message_templates enable row level security;

create policy message_templates_all on public.message_templates
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.message_templates to authenticated;

notify pgrst, 'reload schema';
