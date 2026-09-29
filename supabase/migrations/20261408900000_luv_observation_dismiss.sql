-- Dashboard Luv observation cards share the existing luv_recommendations
-- dismiss primitive (dismissed_at + 7-day restore). They are stored as
-- type 'observation:{stable observation id}' so generate_venue_recommendations
-- never treats them as lead_followup / Guide-gap rows, and so
-- get_venue_recommendations never surfaces them as recommendation cards.

create or replace function public.get_venue_recommendations()
returns table (
  id           uuid,
  insight_id   uuid,
  type         text,
  title        text,
  body         text,
  priority     int,
  ctas         jsonb,
  metadata     jsonb,
  dismissed_at timestamptz,
  completed_at timestamptz,
  expires_at   timestamptz,
  created_at   timestamptz
)
language sql
security definer
set search_path = public
as $$
  select id, insight_id, type, title, body, priority, ctas, metadata,
         dismissed_at, completed_at, expires_at, created_at
  from luv_recommendations
  where venue_id = public.current_user_venue_id()
    and type not like 'observation:%'
    and completed_at is null
    and (dismissed_at is null or dismissed_at <= now() - interval '7 days')
    and (expires_at is null or expires_at > now())
  order by priority desc
  limit 5;
$$;

create or replace function public.dismiss_luv_dashboard_observation(p_observation_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
  v_type text;
begin
  v_venue_id := public.current_user_venue_id();
  if v_venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'no venue');
  end if;

  if p_observation_id is null
     or length(p_observation_id) < 3
     or length(p_observation_id) > 200
     or p_observation_id !~ '^[A-Za-z0-9_.:-]+$' then
    return jsonb_build_object('ok', false, 'error', 'invalid observation');
  end if;

  v_type := 'observation:' || p_observation_id;

  insert into public.luv_recommendations (
    venue_id, type, title, body, priority, metadata, dismissed_at
  ) values (
    v_venue_id,
    v_type,
    'Dismissed Luv observation',
    '',
    0,
    jsonb_build_object('observation_id', p_observation_id),
    now()
  )
  on conflict (venue_id, type) do update
    set dismissed_at = now(),
        completed_at = null;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.list_dismissed_luv_observation_ids()
returns text[]
language sql
security definer
set search_path = public
as $$
  select coalesce(array_agg(substring(type from 14)), '{}'::text[])
  from public.luv_recommendations
  where venue_id = public.current_user_venue_id()
    and type like 'observation:%'
    and dismissed_at is not null
    and dismissed_at > now() - interval '7 days';
$$;

grant execute on function public.dismiss_luv_dashboard_observation(text) to authenticated;
grant execute on function public.list_dismissed_luv_observation_ids() to authenticated;

notify pgrst, 'reload schema';
