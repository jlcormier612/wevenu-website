-- Automation P0: distinct terminal exit reasons for Lost vs Cancelled.
-- Existing active enrollments stop with exited_lost / exited_cancelled;
-- a purpose-built Lost/Cancelled Automation may then enroll without being
-- immediately exited (exit-before-enroll ordering is application-level).

alter table public.sequence_enrollments
  drop constraint if exists sequence_enrollments_status_check;

alter table public.sequence_enrollments
  add constraint sequence_enrollments_status_check
  check (status in (
    'active',
    'completed',
    'exited_reply',
    'exited_booking',
    'exited_lost',
    'exited_cancelled',
    'cancelled'
  ));

-- Idempotent starter Automation tagging (mirrors message_templates.source_master_key).
alter table public.message_sequences
  add column if not exists source_master_key text;

create unique index if not exists message_sequences_venue_source_master_key
  on public.message_sequences (venue_id, source_master_key)
  where source_master_key is not null;
