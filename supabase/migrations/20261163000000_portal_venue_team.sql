-- Program 4, Initiative D, Phase 4 (2026-07-23) — "Your Venue Team" card:
-- primary coordinator + additional venue contacts. venue_staff already
-- exists and is already how the venue itself manages its team; this is
-- the first time it's read from the Couple Workspace.

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
          'role', s.role, 'isOwner', s.is_owner
        ) order by s.is_owner desc, case s.role when 'owner' then 0 when 'manager' then 1 when 'coordinator' then 2 else 3 end, s.full_name)
        from public.venue_staff s
        where s.venue_id = v_ids.venue_id and s.is_active = true
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.get_portal_venue_team(text) to anon, authenticated;
