-- Budget: soft-remove starter categories (budgeted returns to unallocated) +
-- custom categories with display names. No destructive wipe of actual spend.

alter table public.budget_categories
  add column if not exists is_removed boolean not null default false;

-- ── get_portal_budget — include isRemoved ────────────────────────────────────

create or replace function public.get_portal_budget(p_token text)
returns jsonb language plpgsql security definer set search_path to 'public'
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

  select * into v_budget from public.couple_budgets
  where client_id = v_client_id limit 1;

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
            'displayOrder',   c.display_order,
            'isRemoved',      c.is_removed
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

-- ── upsert_portal_budget_category — optional custom_name, clears is_removed ──

create or replace function public.upsert_portal_budget_category(
  p_token         text,
  p_category_key  text,
  p_budgeted      numeric,
  p_actual        numeric,
  p_display_order int default 0,
  p_custom_name   text default null
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

  insert into public.budget_categories (
    budget_id, category_key, budgeted_amount, actual_amount, display_order, custom_name, is_removed
  )
  values (
    v_budget_id, p_category_key, p_budgeted, p_actual, p_display_order,
    nullif(trim(p_custom_name), ''), false
  )
  on conflict (budget_id, category_key) do update
    set budgeted_amount = excluded.budgeted_amount,
        actual_amount   = excluded.actual_amount,
        display_order   = excluded.display_order,
        custom_name     = coalesce(excluded.custom_name, public.budget_categories.custom_name),
        is_removed      = false,
        updated_at      = now();

  return jsonb_build_object('ok', true);
end;
$$;

-- Soft-remove: zero budgeted (returns dollars to unallocated). Keep actual history.
create or replace function public.remove_portal_budget_category(
  p_token        text,
  p_category_key text
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

  update public.budget_categories
  set budgeted_amount = 0,
      is_removed = true,
      updated_at = now()
  where budget_id = v_budget_id
    and category_key = p_category_key;

  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.upsert_portal_budget_category(text, text, numeric, numeric, int, text) to anon, authenticated;
grant execute on function public.remove_portal_budget_category(text, text) to anon, authenticated;
