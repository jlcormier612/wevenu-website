-- Program 4, Initiative C, Phase 3 (2026-07-23) — Key Dates are
-- venue-authored (client_key_dates, already real, already shown on the
-- venue's own Dashboard) but were never reachable from the Couple
-- Workspace at all. Same _resolve_portal_ids(p_token) + SECURITY DEFINER
-- pattern every other portal RPC already uses.
create or replace function public.get_portal_key_dates(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids record;
begin
  select * into v_ids from _resolve_portal_ids(p_token);
  if v_ids.client_id is null then
    return '{"error":"unauthorized"}'::jsonb;
  end if;

  return jsonb_build_object(
    'keyDates', coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'id', k.id, 'label', k.label, 'date', k.date, 'note', k.note
        ) order by k.date)
        from public.client_key_dates k
        where k.client_id = v_ids.client_id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.get_portal_key_dates(text) to anon, authenticated;
