-- ============================================================================
-- Venue enrollments — Postgres-backed bridge from Stripe SaaS signup to a
-- real, loggable-into venue + owner account.
--
-- Spec: docs/postgres-auth-architecture-findings.md §6.
--
-- Replaces the local JSON-file enrollment/activation-token store (used only
-- for THIS specific journey) with a real table this database's own RLS
-- already governs. Does not touch auth.uid(), any existing RLS policy, the
-- login path, or the broader CRM "Relationship" store (which keeps tracking
-- enrollments for its own sales/CS purposes, unchanged).
--
-- Internal-only: no authenticated end user ever reads or writes this table.
-- RLS is enabled with zero policies for `authenticated`/`anon` (default
-- deny); `service_role` bypasses RLS entirely (confirmed: rolbypassrls=t),
-- so the internal API routes (service-role client) work without any policy.
-- No password or password hash is stored here or anywhere in this schema —
-- Supabase's own auth.users remains the single place a credential lives,
-- exactly as it already does for client and vendor accounts.
-- ============================================================================

create table public.venue_enrollments (
  id                          uuid primary key default gen_random_uuid(),
  stripe_checkout_session_id text unique,
  stripe_customer_id         text,
  stripe_subscription_id     text,
  venue_name                 text not null,
  owner_email                text not null,
  plan                       text,
  onboarding_type            text not null default 'self_setup'
                                check (onboarding_type in ('self_setup', 'white_glove')),
  status                     text not null default 'pending'
                                check (status in ('pending', 'activated')),
  activation_token           text unique,
  activation_token_created_at timestamptz,
  venue_id                   uuid references public.venues(id) on delete set null,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

create index venue_enrollments_stripe_subscription
  on public.venue_enrollments (stripe_subscription_id)
  where stripe_subscription_id is not null;

create index venue_enrollments_owner_email
  on public.venue_enrollments (lower(owner_email));

create trigger venue_enrollments_updated_at
  before update on public.venue_enrollments
  for each row execute function public.set_updated_at();

alter table public.venue_enrollments enable row level security;

revoke all on table public.venue_enrollments from authenticated, anon;
grant select, insert, update on public.venue_enrollments to service_role;

-- ----------------------------------------------------------------------------
-- Atomic, retry-safe activation: looks up the enrollment by token, creates
-- the real venues row, and marks the enrollment activated — all in one
-- transaction with a row lock, so two concurrent/retried activation calls
-- for the same token can't double-create a venue. Auth-user creation and
-- password setting happen in the calling route (Admin API, not raw SQL —
-- matching how every other account type in this codebase is created),
-- immediately before this function is called with the resulting user id.
-- ----------------------------------------------------------------------------
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
    return query select v_enrollment.venue_id, true;
    return;
  end if;

  if v_enrollment.activation_token_created_at is null
     or v_enrollment.activation_token_created_at < now() - interval '30 days' then
    raise exception 'token_expired' using errcode = '22023';
  end if;

  insert into public.venues (owner_user_id, name, email)
    values (p_owner_user_id, v_enrollment.venue_name, v_enrollment.owner_email)
    returning id into v_venue_id;

  -- Deliberately does NOT null out activation_token: a genuine retry of
  -- the same request (e.g. the caller never saw this response) must still
  -- be able to look the row up by token and hit the already_activated
  -- branch above, not "invalid_or_expired_token". `status = 'activated'`
  -- is what actually prevents any further effect — a repeated call with
  -- this token is always a safe no-op from here on, never a re-creation.
  update public.venue_enrollments
    set status = 'activated',
        venue_id = v_venue_id
    where id = v_enrollment.id;

  return query select v_venue_id, false;
end;
$$;

-- SECURITY DEFINER so the function can write venues/venue_enrollments
-- regardless of caller RLS context; only service_role can call it (no
-- authenticated/anon EXECUTE grant), matching every other internal-only
-- RPC in this schema.
revoke all on function public.activate_venue_enrollment(text, uuid) from public;
grant execute on function public.activate_venue_enrollment(text, uuid) to service_role;
