-- ============================================================================
-- TR-G4 — Client portal access-level restrictions are cosmetic
-- Resolves docs/trust-risk-register.md TR-G4. A coordinator can assign a
-- contact a restrictive portal_role ('financial', 'view_only', etc.), but
-- get_portal_payments/get_portal_budget/get_seating_data/get_portal_export
-- never checked client_portal_sessions.access_level at all — every session
-- got full data regardless of the intended restriction. Same shape as
-- TR-G1 ("permissions are cosmetic"), on the couple-portal side.
-- ============================================================================

-- ---- _resolve_portal_ids: also return access_level so callers can gate on it.
-- Return shape is changing (new trailing column), which Postgres doesn't
-- allow via CREATE OR REPLACE — drop first. Safe: every caller uses an
-- untyped `record` variable, none reference columns by position.
drop function if exists public._resolve_portal_ids(text);

create or replace function public._resolve_portal_ids(p_token text)
returns table(event_id uuid, client_id uuid, venue_id uuid, access_level text)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  return query
  select e.id as event_id, cps.client_id, cps.venue_id, cps.access_level
  from public.client_portal_sessions cps
  join public.events e
    on e.client_id = cps.client_id
   and e.venue_id  = cps.venue_id
  where cps.access_token = p_token
    and (cps.expires_at is null or cps.expires_at > now())
  order by e.event_date asc nulls last
  limit 1;
end;
$$;

grant execute on function public._resolve_portal_ids(text) to anon, authenticated;

-- ---- get_portal_payments: 'planning' access is explicitly documented as
-- "no payments" (see client_portal_sessions.access_level comment) — block it.
create or replace function public.get_portal_payments(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
begin
  select * into v_session
  from public.client_portal_sessions
  where access_token = p_token
    and (expires_at is null or expires_at > now())
  limit 1;

  if v_session.id is null then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  if v_session.access_level = 'planning' then
    return jsonb_build_object('schedules', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'schedules', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id',          ps.id,
            'title',       ps.title,
            'totalAmount', ps.total_amount,
            'currency',    ps.currency,
            'notes',       ps.notes,
            'invoiceId',   ps.invoice_id,
            'createdAt',   ps.created_at,
            'lineItems', (
              select coalesce(
                jsonb_agg(
                  jsonb_build_object(
                    'id',            pli.id,
                    'label',         pli.label,
                    'amount',        pli.amount,
                    'dueDate',       pli.due_date,
                    'status',        pli.status,
                    'paidAt',        pli.paid_at,
                    'paidAmount',    pli.paid_amount,
                    'paymentMethod', pli.payment_method,
                    'notes',         pli.notes,
                    'sortOrder',     pli.sort_order
                  )
                  order by pli.sort_order, pli.due_date nulls last
                ),
                '[]'::jsonb
              )
              from public.payment_line_items pli
              where pli.schedule_id = ps.id
                and pli.venue_id    = v_session.venue_id
                and pli.status     != 'cancelled'
            )
          )
          order by ps.created_at desc
        ),
        '[]'::jsonb
      )
      from public.payment_schedules ps
      where ps.client_id = v_session.client_id
        and ps.venue_id  = v_session.venue_id
    )
  );
end;
$$;

-- ---- get_portal_budget: same restriction as payments — budget is financial.
create or replace function public.get_portal_budget(p_token text)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_client_id    uuid;
  v_access_level text;
  v_budget       public.couple_budgets%rowtype;
begin
  select cps.client_id, cps.access_level into v_client_id, v_access_level
  from public.client_portal_sessions cps
  where cps.access_token = p_token
    and (cps.expires_at is null or cps.expires_at > now())
  limit 1;

  if v_client_id is null then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  if v_access_level = 'planning' then
    return jsonb_build_object('budget', null);
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
            'id', bc.id, 'categoryKey', bc.category_key, 'customName', bc.custom_name,
            'budgetedAmount', bc.budgeted_amount, 'actualAmount', bc.actual_amount, 'notes', bc.notes
          )
          order by bc.display_order, bc.created_at
        )
        from public.budget_categories bc
        where bc.budget_id = v_budget.id
      ), '[]'::jsonb)
    )
  );
end;
$$;

-- ---- get_seating_data: 'financial' access is scoped to "invoices and
-- payments only" (see client_portal_sessions.access_level comment) — block it.
create or replace function public.get_seating_data(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_ids    record;
  v_arr_id uuid;
begin
  select * into v_ids from _resolve_portal_ids(p_token);
  if v_ids.event_id is null then return null; end if;
  if v_ids.access_level = 'financial' then return jsonb_build_object('arrangement', null, 'tables', '[]'::jsonb); end if;

  -- Auto-create arrangement on first access
  insert into couple_seating_arrangements(event_id)
  values (v_ids.event_id)
  on conflict (event_id) do nothing;

  select id into v_arr_id
  from couple_seating_arrangements where event_id = v_ids.event_id;

  return jsonb_build_object(
    'arrangement', (
      select jsonb_build_object(
        'id', id, 'name', name,
        'canvasWidth', canvas_width, 'canvasHeight', canvas_height
      )
      from couple_seating_arrangements where id = v_arr_id
    ),
    'tables', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',           st.id,
          'tableType',    st.table_type,
          'name',         st.name,
          'capacity',     st.capacity,
          'positionX',    st.position_x,
          'positionY',    st.position_y,
          'displayOrder', st.display_order,
          'guests', coalesce((
            select jsonb_agg(
              jsonb_build_object('id', gsa.guest_id, 'seatNumber', gsa.seat_number)
              order by gsa.seat_number nulls last
            )
            from guest_seat_assignments gsa
            where gsa.table_id = st.id
          ), '[]'::jsonb)
        )
        order by st.display_order
      )
      from seating_tables st
      where st.arrangement_id = v_arr_id
    ), '[]'::jsonb)
  );
end;
$$;

-- ---- get_portal_export: bundles guest list + budget + seating together —
-- only the full 'couple' access level gets the combined export; a partial
-- export per restricted role isn't built (this deliberately fails safe
-- rather than leak a restricted section).
create or replace function public.get_portal_export(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
begin
  select * into v_session
  from public.client_portal_sessions
  where access_token = p_token
    and (expires_at is null or expires_at > now());
  if not found then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  if v_session.access_level != 'couple' then
    return jsonb_build_object('error', 'insufficient_access');
  end if;

  return jsonb_build_object(
    'exportedAt', now(),
    'guests', coalesce((
      select jsonb_agg(to_jsonb(g) - 'venue_id' - 'client_id' order by g.sort_order)
      from public.couple_guests g where g.client_id = v_session.client_id
    ), '[]'::jsonb),
    'budget', (
      select jsonb_build_object(
        'totalBudget', b.total_budget,
        'notes', b.notes,
        'categories', coalesce((
          select jsonb_agg(to_jsonb(bc) - 'budget_id' order by bc.display_order)
          from public.budget_categories bc where bc.budget_id = b.id
        ), '[]'::jsonb),
        'contributors', coalesce((
          select jsonb_agg(to_jsonb(bcon) - 'budget_id' order by bcon.display_order)
          from public.budget_contributors bcon where bcon.budget_id = b.id
        ), '[]'::jsonb)
      )
      from public.couple_budgets b where b.client_id = v_session.client_id
    ),
    'seating', coalesce((
      select jsonb_agg(jsonb_build_object(
        'arrangementName', sa.name,
        'tables', coalesce((
          select jsonb_agg(jsonb_build_object(
            'name', st.name, 'tableType', st.table_type, 'capacity', st.capacity,
            'guests', coalesce((
              select jsonb_agg(g.first_name || coalesce(' ' || g.last_name, ''))
              from public.guest_seat_assignments gsa
              join public.couple_guests g on g.id = gsa.guest_id
              where gsa.table_id = st.id
            ), '[]'::jsonb)
          ) order by st.display_order)
          from public.seating_tables st where st.arrangement_id = sa.id
        ), '[]'::jsonb)
      ))
      from public.couple_seating_arrangements sa
      join public.events e on e.id = sa.event_id
      where e.client_id = v_session.client_id
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.get_portal_export(text) to anon, authenticated;
