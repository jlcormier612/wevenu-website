-- Appointment config correction:
-- 1) Stamp one-time intake → catalog carry-through.
-- 2) New-venue seed: ordinary + personal appointments non-blocking by default;
--    Blocked Time remains blocking. Does NOT rewrite existing venue rows.

alter table public.venue_onboarding_intake
  add column if not exists appointment_catalog_applied_at timestamptz;

comment on column public.venue_onboarding_intake.appointment_catalog_applied_at is
  'Set when onboarding appointment preferences were applied once to venue_schedule_item_types. Null means not yet applied; never clear to re-apply automatically.';

create or replace function public.seed_venue_schedule_item_types(p_venue_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.venue_schedule_item_types (
    venue_id, source, builtin_key, label, enabled, blocks_availability, group_key, sort_order
  )
  values
    (p_venue_id, 'builtin', 'consultation',         'Consultation',          true,  false, 'meetings',     10),
    (p_venue_id, 'builtin', 'client_meeting',        'Client Meeting',        true,  false, 'meetings',     20),
    (p_venue_id, 'builtin', 'walkthrough',           'Walkthrough',           true,  false, 'meetings',     30),
    (p_venue_id, 'builtin', 'vendor_meeting',        'Vendor Meeting',        true,  false, 'meetings',     40),
    (p_venue_id, 'builtin', 'tasting',               'Tasting',               false, false, 'meetings',     50),
    (p_venue_id, 'builtin', 'personal_appointment',  'Personal Appointment',  true,  false, 'availability', 60),
    (p_venue_id, 'builtin', 'blocked_time',          'Blocked Time',          true,  true,  'availability', 70),
    (p_venue_id, 'builtin', 'other',                 'Other',                 true,  false, 'other',        80)
  on conflict (venue_id, builtin_key) where (builtin_key is not null)
  do nothing;
end;
$$;

revoke all on function public.seed_venue_schedule_item_types(uuid) from public;
grant execute on function public.seed_venue_schedule_item_types(uuid)
  to authenticated, service_role;
