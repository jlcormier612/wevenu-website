-- ============================================================================
-- TR-G2 — No data export exists, venue or couple side
-- Resolves docs/trust-risk-register.md TR-G2. Two SECURITY DEFINER RPCs,
-- following the same pattern as get_portal_context()/get_portal_payments():
--   get_venue_export(p_venue_id)  — called from an authenticated venue-staff
--     session (RLS already scopes venue_id there; venue_id is passed and
--     re-checked against current_user_venue_id() inside the function).
--   get_portal_export(p_token)   — called anonymously via the couple's portal
--     token, same session-lookup pattern as the other get_portal_* RPCs.
-- ============================================================================

create or replace function public.get_venue_export(p_venue_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_venue_id <> current_user_venue_id() then
    return jsonb_build_object('error', 'not_authorized');
  end if;

  return jsonb_build_object(
    'exportedAt', now(),
    'venue', (
      select to_jsonb(v) - 'stripe_account_id' - 'embed_key' - 'tour_embed_key'
      from public.venues v where v.id = p_venue_id
    ),
    'clients', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.created_at)
      from public.clients c where c.venue_id = p_venue_id
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.event_date)
      from public.events e where e.venue_id = p_venue_id
    ), '[]'::jsonb),
    'contracts', coalesce((
      select jsonb_agg(to_jsonb(k) - 'sign_token' order by k.created_at)
      from public.contracts k where k.venue_id = p_venue_id
    ), '[]'::jsonb),
    'invoices', coalesce((
      select jsonb_agg(to_jsonb(i) order by i.created_at)
      from public.invoices i where i.venue_id = p_venue_id
    ), '[]'::jsonb),
    'paymentSchedules', coalesce((
      select jsonb_agg(to_jsonb(ps) order by ps.created_at)
      from public.payment_schedules ps where ps.venue_id = p_venue_id
    ), '[]'::jsonb),
    'paymentLineItems', coalesce((
      select jsonb_agg(to_jsonb(pli) order by pli.due_date)
      from public.payment_line_items pli where pli.venue_id = p_venue_id
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.get_venue_export(uuid) to authenticated;

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
