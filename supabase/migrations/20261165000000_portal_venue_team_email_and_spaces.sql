-- Venue Team polish + Property Overview (2026-07-23) — "Meet Your Venue
-- Team" needs each member's email for a real per-member Email action;
-- Property Overview reuses venue_spaces, already authored by the venue,
-- never before read from the Couple Workspace.

create or replace function public.get_portal_venue_team(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids record;
begin
  select * into v_ids from _resolve_portal_ids(p_token);
  if v_ids.venue_id is null then
    return '{"error":"unauthorized"}'::jsonb;
  end if;

  return jsonb_build_object(
    'team', coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'id', s.id, 'fullName', s.full_name, 'title', s.title,
          'role', s.role, 'isOwner', s.is_owner, 'email', s.email
        ) order by s.is_owner desc, case s.role when 'owner' then 0 when 'manager' then 1 when 'coordinator' then 2 else 3 end, s.full_name)
        from public.venue_staff s
        where s.venue_id = v_ids.venue_id and s.is_active = true
      ),
      '[]'::jsonb
    )
  );
end;
$$;

create or replace function public.get_portal_venue_spaces(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids record;
begin
  select * into v_ids from _resolve_portal_ids(p_token);
  if v_ids.venue_id is null then
    return '{"error":"unauthorized"}'::jsonb;
  end if;

  return jsonb_build_object(
    'spaces', coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'id', sp.id, 'name', sp.name, 'description', sp.description, 'capacity', sp.capacity
        ) order by sp.sort_order, sp.name)
        from public.venue_spaces sp
        where sp.venue_id = v_ids.venue_id and sp.is_active = true
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.get_portal_venue_spaces(text) to anon, authenticated;
