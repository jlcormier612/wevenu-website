-- ============================================================================
-- Sprint 72 — Budget & Spending Planner
-- Couple-owned budget with per-category allocations and actual spending.
-- All writes go through security-definer RPCs (portal token required).
-- Venue coordinators have read access to budgets for their events.
-- ============================================================================

-- ── venue_users compatibility view ───────────────────────────────────────────
-- venue_staff was the original table name; venue_users is the canonical alias
-- used by portal RLS policies from Sprint 72 onward.
create or replace view public.venue_users as
  select
    id,
    venue_id,
    user_id,
    role,
    true as is_active
  from public.venue_staff
  where user_id is not null;

-- ── Tables ────────────────────────────────────────────────────────────────────

create table if not exists public.couple_budgets (
  id           uuid          primary key default gen_random_uuid(),
  event_id     uuid          not null references public.events(id) on delete cascade,
  total_budget numeric(12,2) not null default 0,
  notes        text,
  created_at   timestamptz   not null default now(),
  updated_at   timestamptz   not null default now(),
  unique(event_id)
);

create table if not exists public.budget_contributors (
  id            uuid          primary key default gen_random_uuid(),
  budget_id     uuid          not null references public.couple_budgets(id) on delete cascade,
  name          text          not null,
  amount        numeric(12,2) not null default 0,
  notes         text,
  display_order int           not null default 0,
  created_at    timestamptz   not null default now()
);

create table if not exists public.budget_categories (
  id               uuid          primary key default gen_random_uuid(),
  budget_id        uuid          not null references public.couple_budgets(id) on delete cascade,
  category_key     text          not null,
  custom_name      text,
  budgeted_amount  numeric(12,2) not null default 0,
  actual_amount    numeric(12,2) not null default 0,
  notes            text,
  display_order    int           not null default 0,
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default now(),
  unique(budget_id, category_key)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

create index if not exists budget_contributors_budget_id
  on public.budget_contributors(budget_id, display_order);

create index if not exists budget_categories_budget_id
  on public.budget_categories(budget_id, display_order);

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table public.couple_budgets      enable row level security;
alter table public.budget_contributors enable row level security;
alter table public.budget_categories   enable row level security;

-- Venue coordinators can read budgets for their events
create policy "venue_read_couple_budgets" on public.couple_budgets
  for select using (
    event_id in (
      select e.id from public.events e
      join public.venue_users vu on vu.venue_id = e.venue_id
      where vu.user_id = auth.uid()
    )
  );

create policy "venue_read_budget_contributors" on public.budget_contributors
  for select using (
    budget_id in (
      select cb.id from public.couple_budgets cb
      join public.events e on e.id = cb.event_id
      join public.venue_users vu on vu.venue_id = e.venue_id
      where vu.user_id = auth.uid()
    )
  );

create policy "venue_read_budget_categories" on public.budget_categories
  for select using (
    budget_id in (
      select cb.id from public.couple_budgets cb
      join public.events e on e.id = cb.event_id
      join public.venue_users vu on vu.venue_id = e.venue_id
      where vu.user_id = auth.uid()
    )
  );

-- ── Token resolution helper ───────────────────────────────────────────────────

create or replace function public._resolve_portal_event_id(p_token text)
returns uuid language plpgsql security definer as $$
declare v_event_id uuid;
begin
  select event_id into v_event_id
  from public.client_portal_sessions
  where token = p_token and expires_at > now()
  limit 1;
  return v_event_id;
end;
$$;

-- ── get_portal_budget ─────────────────────────────────────────────────────────

create or replace function public.get_portal_budget(p_token text)
returns jsonb language plpgsql security definer as $$
declare
  v_event_id uuid;
  v_budget   public.couple_budgets%rowtype;
begin
  v_event_id := public._resolve_portal_event_id(p_token);
  if v_event_id is null then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  select * into v_budget from public.couple_budgets where event_id = v_event_id limit 1;

  if v_budget.id is null then
    return jsonb_build_object('budget', null);
  end if;

  return jsonb_build_object(
    'budget', jsonb_build_object(
      'id',          v_budget.id,
      'totalBudget', v_budget.total_budget,
      'notes',       v_budget.notes,
      'contributors', (
        select coalesce(jsonb_agg(
          jsonb_build_object('id', bc.id, 'name', bc.name, 'amount', bc.amount)
          order by bc.display_order, bc.created_at
        ), '[]'::jsonb)
        from public.budget_contributors bc
        where bc.budget_id = v_budget.id
      ),
      'categories', (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'id',             c.id,
            'categoryKey',    c.category_key,
            'customName',     c.custom_name,
            'budgetedAmount', c.budgeted_amount,
            'actualAmount',   c.actual_amount,
            'notes',          c.notes,
            'displayOrder',   c.display_order
          )
          order by c.display_order, c.category_key
        ), '[]'::jsonb)
        from public.budget_categories c
        where c.budget_id = v_budget.id
      )
    )
  );
end;
$$;

-- ── upsert_portal_budget ──────────────────────────────────────────────────────

create or replace function public.upsert_portal_budget(
  p_token        text,
  p_total_budget numeric
) returns jsonb language plpgsql security definer as $$
declare
  v_event_id  uuid;
  v_budget_id uuid;
begin
  v_event_id := public._resolve_portal_event_id(p_token);
  if v_event_id is null then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  insert into public.couple_budgets (event_id, total_budget)
  values (v_event_id, p_total_budget)
  on conflict (event_id) do update
    set total_budget = excluded.total_budget,
        updated_at   = now()
  returning id into v_budget_id;

  return jsonb_build_object('budgetId', v_budget_id);
end;
$$;

-- ── upsert_portal_budget_category ────────────────────────────────────────────

create or replace function public.upsert_portal_budget_category(
  p_token         text,
  p_category_key  text,
  p_budgeted      numeric,
  p_actual        numeric,
  p_display_order int default 0
) returns jsonb language plpgsql security definer as $$
declare
  v_event_id  uuid;
  v_budget_id uuid;
begin
  v_event_id := public._resolve_portal_event_id(p_token);
  if v_event_id is null then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  select id into v_budget_id from public.couple_budgets where event_id = v_event_id;
  if v_budget_id is null then
    return jsonb_build_object('error', 'no_budget');
  end if;

  insert into public.budget_categories (budget_id, category_key, budgeted_amount, actual_amount, display_order)
  values (v_budget_id, p_category_key, p_budgeted, p_actual, p_display_order)
  on conflict (budget_id, category_key) do update
    set budgeted_amount = excluded.budgeted_amount,
        actual_amount   = excluded.actual_amount,
        updated_at      = now();

  return jsonb_build_object('ok', true);
end;
$$;

-- ── upsert_portal_contributor ─────────────────────────────────────────────────

create or replace function public.upsert_portal_contributor(
  p_token  text,
  p_id     uuid,
  p_name   text,
  p_amount numeric
) returns jsonb language plpgsql security definer as $$
declare
  v_event_id   uuid;
  v_budget_id  uuid;
  v_contrib_id uuid;
begin
  v_event_id := public._resolve_portal_event_id(p_token);
  if v_event_id is null then return jsonb_build_object('error', 'invalid_token'); end if;

  select id into v_budget_id from public.couple_budgets where event_id = v_event_id;
  if v_budget_id is null then return jsonb_build_object('error', 'no_budget'); end if;

  if p_id is null then
    insert into public.budget_contributors (budget_id, name, amount)
    values (v_budget_id, p_name, p_amount)
    returning id into v_contrib_id;
  else
    update public.budget_contributors
       set name = p_name, amount = p_amount
     where id = p_id and budget_id = v_budget_id
    returning id into v_contrib_id;
  end if;

  return jsonb_build_object('contributorId', v_contrib_id);
end;
$$;

-- ── delete_portal_contributor ─────────────────────────────────────────────────

create or replace function public.delete_portal_contributor(
  p_token text,
  p_id    uuid
) returns jsonb language plpgsql security definer as $$
declare
  v_event_id  uuid;
  v_budget_id uuid;
begin
  v_event_id := public._resolve_portal_event_id(p_token);
  if v_event_id is null then return jsonb_build_object('error', 'invalid_token'); end if;

  select id into v_budget_id from public.couple_budgets where event_id = v_event_id;

  delete from public.budget_contributors
   where id = p_id and budget_id = v_budget_id;

  return jsonb_build_object('ok', true);
end;
$$;

-- ── Grants ────────────────────────────────────────────────────────────────────

grant execute on function public._resolve_portal_event_id(text)                             to anon, authenticated;
grant execute on function public.get_portal_budget(text)                                    to anon, authenticated;
grant execute on function public.upsert_portal_budget(text, numeric)                        to anon, authenticated;
grant execute on function public.upsert_portal_budget_category(text, text, numeric, numeric, int) to anon, authenticated;
grant execute on function public.upsert_portal_contributor(text, uuid, text, numeric)       to anon, authenticated;
grant execute on function public.delete_portal_contributor(text, uuid)                      to anon, authenticated;

notify pgrst, 'reload schema';
