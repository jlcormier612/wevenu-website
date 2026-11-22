-- R1A: HTC internal Workspace CRM staff ACL (Supabase Auth + explicit membership).
-- Authentication (auth.users) and authorization (this table) remain separate.
-- Venue/client/vendor accounts do NOT imply Workspace access.
-- CRM business tables (htc_crm_*) stay service_role-only; this migration does not
-- grant customer roles access to CRM data.
--
-- NOT APPLIED in R1A. Apply only under R1B founder authorization.

begin;

create table if not exists public.htc_internal_staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  team_member_id text not null unique,
  email text not null,
  display_name text not null,
  role text not null
    check (role in (
      'owner',
      'administrator',
      'sales',
      'customer_success',
      'implementation',
      'support',
      'finance',
      'marketing',
      'viewer'
    )),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deactivated_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  constraint htc_internal_staff_email_lower check (email = lower(email))
);

create unique index if not exists htc_internal_staff_email_uidx
  on public.htc_internal_staff (email);

create index if not exists htc_internal_staff_active_idx
  on public.htc_internal_staff (active)
  where active = true;

create table if not exists public.htc_internal_staff_invites (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  email text not null,
  display_name text not null,
  role text not null
    check (role in (
      'owner',
      'administrator',
      'sales',
      'customer_success',
      'implementation',
      'support',
      'finance',
      'marketing',
      'viewer'
    )),
  team_member_id text,
  invited_by uuid references auth.users (id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_user_id uuid references auth.users (id) on delete set null,
  constraint htc_internal_staff_invites_email_lower check (email = lower(email))
);

create index if not exists htc_internal_staff_invites_pending_email_idx
  on public.htc_internal_staff_invites (email)
  where status = 'pending';

create table if not exists public.htc_internal_staff_audit (
  id bigserial primary key,
  occurred_at timestamptz not null default now(),
  actor_user_id uuid references auth.users (id) on delete set null,
  action text not null,
  target_user_id uuid references auth.users (id) on delete set null,
  target_email text,
  detail jsonb not null default '{}'::jsonb
);

create index if not exists htc_internal_staff_audit_occurred_idx
  on public.htc_internal_staff_audit (occurred_at desc);

alter table public.htc_internal_staff enable row level security;
alter table public.htc_internal_staff_invites enable row level security;
alter table public.htc_internal_staff_audit enable row level security;

revoke all on table public.htc_internal_staff from public, anon, authenticated;
revoke all on table public.htc_internal_staff_invites from public, anon, authenticated;
revoke all on table public.htc_internal_staff_audit from public, anon, authenticated;

grant select, insert, update, delete on table public.htc_internal_staff to service_role;
grant select, insert, update, delete on table public.htc_internal_staff_invites to service_role;
grant select, insert on table public.htc_internal_staff_audit to service_role;
grant usage, select on sequence public.htc_internal_staff_audit_id_seq to service_role;

-- Authenticated staff may read only their own active membership row (no role elevation).
drop policy if exists htc_internal_staff_self_select on public.htc_internal_staff;
create policy htc_internal_staff_self_select
  on public.htc_internal_staff
  for select
  to authenticated
  using (user_id = auth.uid() and active = true);

grant select on table public.htc_internal_staff to authenticated;

-- Helper: is the current JWT an active internal staff member?
create or replace function public.is_htc_internal_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.htc_internal_staff s
    where s.user_id = auth.uid()
      and s.active = true
  );
$$;

revoke all on function public.is_htc_internal_staff() from public, anon, authenticated;
grant execute on function public.is_htc_internal_staff() to authenticated, service_role;

comment on table public.htc_internal_staff is
  'Explicit HTC Workspace CRM staff ACL. Supabase Auth alone is never sufficient.';
comment on table public.htc_internal_staff_invites is
  'Staff invites; acceptance must bind auth.users id to the invited email.';
comment on table public.htc_internal_staff_audit is
  'Auditable staff create/role/deactivate events for Workspace ACL.';

commit;
