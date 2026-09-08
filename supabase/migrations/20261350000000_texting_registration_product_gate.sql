-- Track A Product Gate remediation:
-- 1. Add information_saved phase (HTC saved details; provider registration NOT underway)
-- 2. Drop invented regions default; allow NULL until venue supplies it
-- 3. Block authenticated clients from writing provider-authoritative phases
-- 4. Revoke authenticated SELECT/INSERT/UPDATE on registration_number_ciphertext

alter table public.venue_texting_registrations
  drop constraint if exists venue_texting_registrations_phase_check;

alter table public.venue_texting_registrations
  add constraint venue_texting_registrations_phase_check
  check (phase in (
    'not_started',
    'details_needed',
    'information_saved',
    'under_review',
    'needs_attention',
    'setting_up_number',
    'ready',
    'paused',
    'failed'
  ));

alter table public.venue_texting_registrations
  alter column regions_of_operation drop not null;

alter table public.venue_texting_registrations
  alter column regions_of_operation drop default;

revoke select (registration_number_ciphertext) on public.venue_texting_registrations from authenticated;
revoke update (registration_number_ciphertext) on public.venue_texting_registrations from authenticated;
revoke insert (registration_number_ciphertext) on public.venue_texting_registrations from authenticated;

create or replace function public.enforce_venue_texting_registration_phase_authority()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := coalesce(auth.role(), '');
  v_provider_phases text[] := array[
    'needs_attention',
    'setting_up_number',
    'ready',
    'paused',
    'failed'
  ];
  v_venue_writable text[] := array[
    'not_started',
    'details_needed',
    'information_saved',
    'under_review'
  ];
begin
  if v_role = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.phase is null or not (new.phase = any (v_venue_writable)) then
      raise exception 'Venues cannot set texting phase "%" — that state is managed by Hello to Cheers.',
        coalesce(new.phase, '(null)');
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' and new.phase is distinct from old.phase then
    if not (new.phase = any (v_venue_writable)) then
      raise exception 'Venues cannot set texting phase "%" — that state is managed by Hello to Cheers.',
        new.phase;
    end if;

    if old.phase = any (v_provider_phases) then
      -- Venue may leave attention/failed to continue editing or resubmit.
      if old.phase in ('needs_attention', 'failed')
         and new.phase in ('details_needed', 'information_saved', 'under_review') then
        return new;
      end if;
      raise exception 'Venues cannot change texting phase from "%" — that state is managed by Hello to Cheers.',
        old.phase;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists venue_texting_registrations_phase_authority
  on public.venue_texting_registrations;

create trigger venue_texting_registrations_phase_authority
  before insert or update of phase on public.venue_texting_registrations
  for each row
  execute function public.enforce_venue_texting_registration_phase_authority();

revoke all on function public.enforce_venue_texting_registration_phase_authority() from public;
revoke all on function public.enforce_venue_texting_registration_phase_authority() from anon;
revoke all on function public.enforce_venue_texting_registration_phase_authority() from authenticated;

notify pgrst, 'reload schema';
