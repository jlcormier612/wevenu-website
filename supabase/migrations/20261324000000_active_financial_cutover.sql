-- ============================================================================
-- Active future-event financial & document cutover
--
-- Extends Bring Your Business so a venue can reconstruct operable
-- Event Order / Invoice / Payment Schedule / Payment / Contract /
-- Document records on canonical HTC objects.
--
-- Contracts executed outside HTC are recorded with execution_origin =
-- 'external'. Status may be 'signed' to mean the agreement is in force,
-- without fabricating HTC e-signature audit (IP, user-agent, consent).
-- ============================================================================

alter table public.contracts
  add column if not exists execution_origin text not null default 'htc';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'contracts_execution_origin_check'
  ) then
    alter table public.contracts
      add constraint contracts_execution_origin_check
      check (execution_origin in ('htc', 'external'));
  end if;
end;
$$;

comment on column public.contracts.execution_origin is
  'htc = negotiated/signed inside Hello to Cheers; external = recorded as executed outside HTC (no fabricated e-sign trail).';

-- At most one externally executed signed agreement per Event (idempotent cutover).
create unique index if not exists contracts_one_external_signed_per_event
  on public.contracts (venue_id, event_id)
  where execution_origin = 'external'
    and status = 'signed'
    and event_id is not null;

do $$
begin
  if to_regclass('public.migration_records') is null then
    return;
  end if;
  alter table public.migration_records
    drop constraint if exists migration_records_target_entity_type_check;
  alter table public.migration_records
    add constraint migration_records_target_entity_type_check
    check (target_entity_type in (
      'client', 'lead', 'vendor', 'event', 'payment', 'document',
      'calendar_block', 'date_hold', 'tour', 'package', 'key_date',
      'active_commitment',
      'guest_list',
      'event_vendor_assignment',
      'timeline_entry',
      'floor_plan'
    ));
end;
$$;
