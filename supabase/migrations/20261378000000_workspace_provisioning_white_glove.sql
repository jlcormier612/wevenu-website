-- ============================================================================
-- Workspace provisioning + White Glove state (Setup & White Glove architecture)
--
-- - venue_enrollments gains provisioned status, intake token, white_glove_status
-- - activate_venue_enrollment links an already-provisioned venue (no duplicate)
-- - venue_onboarding_intake stores Self-Setup / White Glove intake answers
-- - venue_onboarding_materials stores optional customer uploads
-- ============================================================================

-- Enrollment status: pending → provisioned (venue exists, customer may not
-- have access yet) → activated (owner credentials established).
alter table public.venue_enrollments
  drop constraint if exists venue_enrollments_status_check;

alter table public.venue_enrollments
  add constraint venue_enrollments_status_check
  check (status in ('pending', 'provisioned', 'activated'));

alter table public.venue_enrollments
  add column if not exists intake_token text unique;

alter table public.venue_enrollments
  add column if not exists white_glove_status text
    check (
      white_glove_status is null
      or white_glove_status in (
        'awaiting_provision',
        'awaiting_intake',
        'waiting',
        'in_progress',
        'setup_complete_access_pending',
        'complete'
      )
    );

alter table public.venue_enrollments
  add column if not exists white_glove_handoff_at timestamptz;

alter table public.venue_enrollments
  add column if not exists white_glove_handoff_by uuid references auth.users(id) on delete set null;

alter table public.venue_enrollments
  add column if not exists access_email_sent_at timestamptz;

create index if not exists venue_enrollments_intake_token
  on public.venue_enrollments (intake_token)
  where intake_token is not null;

create index if not exists venue_enrollments_white_glove_status
  on public.venue_enrollments (white_glove_status)
  where white_glove_status is not null;

-- ---------------------------------------------------------------------------
-- Onboarding intake (Self-Setup + White Glove) — one row per venue
-- ---------------------------------------------------------------------------
create table if not exists public.venue_onboarding_intake (
  id                          uuid primary key default gen_random_uuid(),
  venue_id                    uuid not null unique references public.venues(id) on delete cascade,
  enrollment_id               uuid references public.venue_enrollments(id) on delete set null,
  path                        text not null check (path in ('self_setup', 'white_glove')),
  -- Venue basics
  venue_name                  text,
  address_line1               text,
  address_line2               text,
  city                        text,
  state_region                text,
  postal_code                 text,
  country                     text,
  primary_contact_name        text,
  contact_email               text,
  contact_phone               text,
  website                     text,
  -- Operating model
  space_mode                  text check (space_mode is null or space_mode in ('one', 'multiple')),
  spaces                      jsonb not null default '[]'::jsonb,
  offers_tours                boolean,
  tasting_appointment_choice  text check (
    tasting_appointment_choice is null
    or tasting_appointment_choice in ('tastings', 'other_appointments', 'both', 'neither')
  ),
  inquiry_sources             text[] not null default '{}',
  inquiry_sources_other       text,
  -- Bring business
  bring_business_choice       text check (
    bring_business_choice is null
    or bring_business_choice in ('honeybook', 'tripleseat', 'another_system', 'starting_fresh')
  ),
  starters_accepted_at        timestamptz,
  submitted_at                timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create trigger venue_onboarding_intake_updated_at
  before update on public.venue_onboarding_intake
  for each row execute function public.set_updated_at();

alter table public.venue_onboarding_intake enable row level security;

-- Venue staff can read/update their own intake after activation.
create policy venue_onboarding_intake_select on public.venue_onboarding_intake
  for select to authenticated
  using (venue_id = public.current_user_venue_id());

create policy venue_onboarding_intake_update on public.venue_onboarding_intake
  for update to authenticated
  using (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy venue_onboarding_intake_insert on public.venue_onboarding_intake
  for insert to authenticated
  with check (venue_id = public.current_user_venue_id());

-- HQ admins can read all intakes (operator review).
create policy venue_onboarding_intake_hq_select on public.venue_onboarding_intake
  for select to authenticated
  using (public.is_hq_admin());

revoke all on table public.venue_onboarding_intake from anon;
grant select, insert, update on public.venue_onboarding_intake to authenticated;
grant select, insert, update, delete on public.venue_onboarding_intake to service_role;

-- ---------------------------------------------------------------------------
-- Optional White Glove materials (not required for intake submit)
-- ---------------------------------------------------------------------------
create table if not exists public.venue_onboarding_materials (
  id              uuid primary key default gen_random_uuid(),
  venue_id        uuid not null references public.venues(id) on delete cascade,
  enrollment_id   uuid references public.venue_enrollments(id) on delete set null,
  file_name       text not null,
  content_type    text,
  byte_size       bigint,
  storage_path    text not null,
  public_url      text,
  uploaded_at     timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create index venue_onboarding_materials_venue
  on public.venue_onboarding_materials (venue_id, uploaded_at desc);

alter table public.venue_onboarding_materials enable row level security;

create policy venue_onboarding_materials_select on public.venue_onboarding_materials
  for select to authenticated
  using (
    venue_id = public.current_user_venue_id()
    or public.is_hq_admin()
  );

revoke all on table public.venue_onboarding_materials from anon;
grant select on public.venue_onboarding_materials to authenticated;
grant select, insert, update, delete on public.venue_onboarding_materials to service_role;

-- ---------------------------------------------------------------------------
-- activate_venue_enrollment: reuse already-provisioned venue (White Glove)
-- ---------------------------------------------------------------------------
create or replace function public.activate_venue_enrollment(
  p_activation_token text,
  p_owner_user_id uuid
)
returns table(venue_id uuid, already_activated boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enrollment public.venue_enrollments%rowtype;
  v_venue_id   uuid;
begin
  select * into v_enrollment
    from public.venue_enrollments
    where activation_token = p_activation_token
    for update;

  if not found then
    raise exception 'invalid_or_expired_token' using errcode = '22023';
  end if;

  if v_enrollment.status = 'activated' then
    if v_enrollment.venue_id is not null then
      insert into public.venue_staff (
        venue_id, user_id, full_name, email, role, is_owner, accepted_at, is_active
      )
      values (
        v_enrollment.venue_id,
        p_owner_user_id,
        coalesce(nullif(v_enrollment.venue_name, ''), 'Owner'),
        v_enrollment.owner_email,
        'owner',
        true,
        now(),
        true
      )
      on conflict (venue_id) where is_owner do update set
        user_id = excluded.user_id,
        email = excluded.email,
        accepted_at = coalesce(public.venue_staff.accepted_at, excluded.accepted_at),
        is_active = true
      where public.venue_staff.venue_id = v_enrollment.venue_id;
    end if;
    return query select v_enrollment.venue_id, true;
    return;
  end if;

  if v_enrollment.activation_token_created_at is null
     or v_enrollment.activation_token_created_at < now() - interval '30 days' then
    raise exception 'token_expired' using errcode = '22023';
  end if;

  -- Already provisioned (White Glove): link owner, do not create a second venue.
  if v_enrollment.venue_id is not null then
    v_venue_id := v_enrollment.venue_id;

    update public.venues
      set owner_user_id = p_owner_user_id,
          email = coalesce(nullif(email, ''), v_enrollment.owner_email),
          updated_at = now()
      where id = v_venue_id
        and owner_user_id is distinct from p_owner_user_id;

    insert into public.venue_staff (
      venue_id, user_id, full_name, email, role, is_owner, accepted_at, is_active
    )
    values (
      v_venue_id,
      p_owner_user_id,
      coalesce(
        nullif(trim(coalesce(v_enrollment.owner_first_name, '') || ' ' || coalesce(v_enrollment.owner_last_name, '')), ''),
        nullif(v_enrollment.venue_name, ''),
        'Owner'
      ),
      v_enrollment.owner_email,
      'owner',
      true,
      now(),
      true
    )
    on conflict (venue_id) where is_owner do update set
      user_id = excluded.user_id,
      email = excluded.email,
      full_name = excluded.full_name,
      accepted_at = coalesce(public.venue_staff.accepted_at, excluded.accepted_at),
      is_active = true
    where public.venue_staff.venue_id = v_venue_id;

    update public.venue_enrollments
      set status = 'activated',
          white_glove_status = case
            when onboarding_type = 'white_glove' then 'complete'
            else white_glove_status
          end
      where id = v_enrollment.id;

    return query select v_venue_id, false;
    return;
  end if;

  -- Self-Setup (or legacy): create venue now.
  insert into public.venues (owner_user_id, name, email)
    values (p_owner_user_id, v_enrollment.venue_name, v_enrollment.owner_email)
    returning id into v_venue_id;

  insert into public.venue_staff (
    venue_id, user_id, full_name, email, role, is_owner, accepted_at, is_active
  )
  values (
    v_venue_id,
    p_owner_user_id,
    coalesce(
      nullif(trim(coalesce(v_enrollment.owner_first_name, '') || ' ' || coalesce(v_enrollment.owner_last_name, '')), ''),
      nullif(v_enrollment.venue_name, ''),
      'Owner'
    ),
    v_enrollment.owner_email,
    'owner',
    true,
    now(),
    true
  )
  on conflict (venue_id) where is_owner do update set
    user_id = excluded.user_id,
    email = excluded.email,
    accepted_at = coalesce(public.venue_staff.accepted_at, excluded.accepted_at),
    is_active = true
  where public.venue_staff.venue_id = v_venue_id;

  update public.venue_enrollments
    set status = 'activated',
        venue_id = v_venue_id
    where id = v_enrollment.id;

  return query select v_venue_id, false;
end;
$$;

revoke all on function public.activate_venue_enrollment(text, uuid) from public;
grant execute on function public.activate_venue_enrollment(text, uuid) to service_role;
