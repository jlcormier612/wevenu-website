-- ============================================================================
-- Fix: Budget section uses client_id directly, not event_id.
--
-- Problem: couple_budgets.event_id was NOT NULL, so clients without a linked
-- event record (no event date on their client row) had _resolve_portal_event_id
-- return null → every budget RPC returned 'invalid_token' silently.
--
-- Fix:
--   1. Add client_id FK to couple_budgets (the natural owner of a wedding budget)
--   2. Make event_id optional (nullable)
--   3. Backfill client_id for existing rows
--   4. Rewrite all 5 budget RPCs to resolve via client_id from the session
-- ============================================================================

-- ── Schema changes ────────────────────────────────────────────────────────────

alter table public.couple_budgets alter column event_id drop not null;

alter table public.couple_budgets
  add column if not exists client_id uuid references public.clients(id) on delete cascade;

-- Backfill client_id for budgets that already exist (linked via event_id)
update public.couple_budgets cb
set    client_id = e.client_id
from   public.events e
where  e.id = cb.event_id
  and  cb.client_id is null;

-- One budget per client
create unique index if not exists couple_budgets_client_uniq
  on public.couple_budgets(client_id)
  where client_id is not null;

-- ── Updated RLS policies ──────────────────────────────────────────────────────
-- Venue coordinators can read budgets for their clients (via event_id OR client_id)

drop policy if exists "venue_read_couple_budgets"      on public.couple_budgets;
drop policy if exists "venue_read_budget_contributors"  on public.budget_contributors;
drop policy if exists "venue_read_budget_categories"    on public.budget_categories;

create policy "venue_read_couple_budgets" on public.couple_budgets
  for select using (
    ( event_id  is not null and event_id  in (
        select e.id from public.events  e
        join   public.venue_users vu on vu.venue_id = e.venue_id
        where  vu.user_id = auth.uid() and vu.is_active
    ))
    or
    ( client_id is not null and client_id in (
        select c.id from public.clients c
        join   public.venue_users vu on vu.venue_id = c.venue_id
        where  vu.user_id = auth.uid() and vu.is_active
    ))
  );

create policy "venue_read_budget_contributors" on public.budget_contributors
  for select using (
    budget_id in (
      select id from public.couple_budgets where
        ( event_id  is not null and event_id  in (
            select e.id from public.events e
            join public.venue_users vu on vu.venue_id = e.venue_id
            where vu.user_id = auth.uid() and vu.is_active
          ))
        or
        ( client_id is not null and client_id in (
            select c.id from public.clients c
            join public.venue_users vu on vu.venue_id = c.venue_id
            where vu.user_id = auth.uid() and vu.is_active
          ))
    )
  );

create policy "venue_read_budget_categories" on public.budget_categories
  for select using (
    budget_id in (
      select id from public.couple_budgets where
        ( event_id  is not null and event_id  in (
            select e.id from public.events e
            join public.venue_users vu on vu.venue_id = e.venue_id
            where vu.user_id = auth.uid() and vu.is_active
          ))
        or
        ( client_id is not null and client_id in (
            select c.id from public.clients c
            join public.venue_users vu on vu.venue_id = c.venue_id
            where vu.user_id = auth.uid() and vu.is_active
          ))
    )
  );

-- ── Shared inline helper (used by every RPC below) ───────────────────────────
-- Each RPC resolves client_id directly from the access_token — no event needed.

-- ── get_portal_budget ────────────────────────────────────────────────────────

create or replace function public.get_portal_budget(p_token text)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_client_id uuid;
  v_budget    public.couple_budgets%rowtype;
begin
  select cps.client_id into v_client_id
  from public.client_portal_sessions cps
  where cps.access_token = p_token
    and (cps.expires_at is null or cps.expires_at > now())
  limit 1;

  if v_client_id is null then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  -- Primary lookup: by client_id
  select * into v_budget from public.couple_budgets
  where client_id = v_client_id limit 1;

  -- Fallback: legacy budgets linked via event_id only (pre-migration rows not backfilled)
  if v_budget.id is null then
    select cb.* into v_budget
    from   public.couple_budgets cb
    join   public.events e on e.id = cb.event_id
    where  e.client_id = v_client_id
    limit 1;
  end if;

  if v_budget.id is null then
    return jsonb_build_object('budget', null);
  end if;

  return jsonb_build_object(
    'budget', jsonb_build_object(
      'id',           v_budget.id,
      'totalBudget',  v_budget.total_budget,
      'notes',        v_budget.notes,
      'contributors', coalesce((
        select jsonb_agg(
          jsonb_build_object('id', bc.id, 'name', bc.name, 'amount', bc.amount)
          order by bc.display_order, bc.created_at
        )
        from public.budget_contributors bc
        where bc.budget_id = v_budget.id
      ), '[]'::jsonb),
      'categories', coalesce((
        select jsonb_agg(
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
        )
        from public.budget_categories c
        where c.budget_id = v_budget.id
      ), '[]'::jsonb)
    )
  );
end;
$$;

-- ── upsert_portal_budget ─────────────────────────────────────────────────────

create or replace function public.upsert_portal_budget(
  p_token        text,
  p_total_budget numeric
) returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_client_id uuid;
  v_budget_id uuid;
begin
  select cps.client_id into v_client_id
  from public.client_portal_sessions cps
  where cps.access_token = p_token
    and (cps.expires_at is null or cps.expires_at > now())
  limit 1;

  if v_client_id is null then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  -- Upsert on client_id (the partial unique index handles the conflict)
  insert into public.couple_budgets (client_id, total_budget)
  values (v_client_id, p_total_budget)
  on conflict (client_id) where client_id is not null
  do update set
    total_budget = excluded.total_budget,
    updated_at   = now()
  returning id into v_budget_id;

  -- Fallback: legacy budget exists only via event_id — adopt it
  if v_budget_id is null then
    select cb.id into v_budget_id
    from   public.couple_budgets cb
    join   public.events e on e.id = cb.event_id
    where  e.client_id = v_client_id
    limit 1;

    if v_budget_id is not null then
      update public.couple_budgets
      set    total_budget = p_total_budget,
             client_id    = v_client_id,
             updated_at   = now()
      where  id = v_budget_id;
    end if;
  end if;

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
) returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_client_id uuid;
  v_budget_id uuid;
begin
  select cps.client_id into v_client_id
  from public.client_portal_sessions cps
  where cps.access_token = p_token
    and (cps.expires_at is null or cps.expires_at > now())
  limit 1;

  if v_client_id is null then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  select id into v_budget_id from public.couple_budgets where client_id = v_client_id limit 1;

  if v_budget_id is null then
    select cb.id into v_budget_id
    from   public.couple_budgets cb
    join   public.events e on e.id = cb.event_id
    where  e.client_id = v_client_id
    limit 1;
  end if;

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
) returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_client_id  uuid;
  v_budget_id  uuid;
  v_contrib_id uuid;
begin
  select cps.client_id into v_client_id
  from public.client_portal_sessions cps
  where cps.access_token = p_token
    and (cps.expires_at is null or cps.expires_at > now())
  limit 1;

  if v_client_id is null then return jsonb_build_object('error', 'invalid_token'); end if;

  select id into v_budget_id from public.couple_budgets where client_id = v_client_id limit 1;

  if v_budget_id is null then
    select cb.id into v_budget_id
    from   public.couple_budgets cb
    join   public.events e on e.id = cb.event_id
    where  e.client_id = v_client_id
    limit 1;
  end if;

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
) returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_client_id uuid;
  v_budget_id uuid;
begin
  select cps.client_id into v_client_id
  from public.client_portal_sessions cps
  where cps.access_token = p_token
    and (cps.expires_at is null or cps.expires_at > now())
  limit 1;

  if v_client_id is null then return jsonb_build_object('error', 'invalid_token'); end if;

  select id into v_budget_id from public.couple_budgets where client_id = v_client_id limit 1;

  if v_budget_id is null then
    select cb.id into v_budget_id
    from   public.couple_budgets cb
    join   public.events e on e.id = cb.event_id
    where  e.client_id = v_client_id
    limit 1;
  end if;

  delete from public.budget_contributors
  where id = p_id and budget_id = v_budget_id;

  return jsonb_build_object('ok', true);
end;
$$;

-- ── Grants (unchanged) ────────────────────────────────────────────────────────

grant execute on function public.get_portal_budget(text)                                         to anon, authenticated;
grant execute on function public.upsert_portal_budget(text, numeric)                             to anon, authenticated;
grant execute on function public.upsert_portal_budget_category(text, text, numeric, numeric, int) to anon, authenticated;
grant execute on function public.upsert_portal_contributor(text, uuid, text, numeric)            to anon, authenticated;
grant execute on function public.delete_portal_contributor(text, uuid)                           to anon, authenticated;

notify pgrst, 'reload schema';
