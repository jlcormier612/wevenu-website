-- ============================================================================
-- Hello to Cheers Starter Message Library — provisioning markers +
-- optional send-time merge context for Scheduled Sends.
--
-- Masters live in application code (lib/message-templates/starters.ts), not
-- as editable DB rows. Each venue receives independent copies tagged with
-- source_master_key. Venue edits never write back to the master.
-- ============================================================================

alter table public.message_templates
  add column if not exists source_master_key text;

comment on column public.message_templates.source_master_key is
  'Hello to Cheers starter master key (e.g. MSG-01). Null for venue-authored templates. Masters themselves are code fixtures, never rows.';

-- Non-unique: "Add starter again" may create additional copies of the same
-- master without overwriting a customized earlier copy.
create index if not exists message_templates_venue_master_key
  on public.message_templates (venue_id, source_master_key)
  where source_master_key is not null;

-- Optional merge context pins for Scheduled Sends — resolved fresh at send
-- time from authoritative tour_appointments / payment_line_items. When null,
-- the processor auto-selects the soonest relevant live row for the relationship.
alter table public.scheduled_messages
  add column if not exists merge_tour_appointment_id uuid
    references public.tour_appointments (id) on delete set null;

alter table public.scheduled_messages
  add column if not exists merge_payment_line_item_id uuid
    references public.payment_line_items (id) on delete set null;

alter table public.scheduled_messages
  add column if not exists merge_task_name text;

-- Venue-create seed uses the admin/service_role client (same pattern as
-- inventory starter seed). Authenticated venue sessions continue to use RLS.
grant select, insert, update on public.message_templates to service_role;

notify pgrst, 'reload schema';
