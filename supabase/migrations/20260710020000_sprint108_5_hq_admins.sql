-- Sprint 108.5: Wevenu HQ — internal admin access
--
-- Replaces the WEVENU_ADMIN_EMAILS env-var allowlist (app/api/admin/beta,
-- app/api/admin/feedback) with a real access-control table, per
-- docs/wevenu-hq-architecture.md §5.
--
-- No self-service signup: rows are inserted by a human via SQL (or a future
-- Settings > HQ Admin Roster UI). Bootstrap the first owner manually:
--
--   insert into public.hq_admins (user_id, role)
--   values ('<your auth.users.id>', 'owner');

create table public.hq_admins (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references auth.users(id) on delete cascade,
  role       text not null default 'team' check (role in ('owner', 'team')),
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.hq_admins enable row level security;

-- ── is_hq_admin() / current_hq_admin_role() ─────────────────────────────────
-- Defined before the table's own RLS policy below, which references
-- is_hq_admin() — security definer so these can also be called from RLS
-- policies on other HQ tables (venue_hq_notes, venue_hq_tasks, etc.) without
-- recursive RLS issues, and from the app layer (layout gate, middleware) via
-- a simple RPC call.

create or replace function public.is_hq_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.hq_admins
    where user_id = auth.uid() and is_active = true
  );
$$;

create or replace function public.current_hq_admin_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.hq_admins
  where user_id = auth.uid() and is_active = true
  limit 1;
$$;

grant execute on function public.is_hq_admin() to authenticated;
grant execute on function public.current_hq_admin_role() to authenticated;

-- An HQ admin can see the rest of the roster (e.g. a future "who else has
-- HQ access" settings view). No insert/update/delete policy — the roster is
-- managed via service role / SQL only for now.
create policy "hq_admins_select"
  on public.hq_admins for select to authenticated
  using (public.is_hq_admin());

notify pgrst, 'reload schema';
