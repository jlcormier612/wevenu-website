-- 089 listed dismissed observation ids with substring(type from 14).
-- 'observation:' is 12 characters; PostgreSQL substring is 1-based, so
-- from 14 dropped the first character of the stable observation id
-- (tour-no-followup-… became our-no-followup-…) and Dashboard refresh
-- could not hide a just-dismissed observation.

create or replace function public.list_dismissed_luv_observation_ids()
returns text[]
language sql
security definer
set search_path = public
as $$
  select coalesce(array_agg(substring(type from char_length('observation:') + 1)), '{}'::text[])
  from public.luv_recommendations
  where venue_id = public.current_user_venue_id()
    and type like 'observation:%'
    and dismissed_at is not null
    and dismissed_at > now() - interval '7 days';
$$;

grant execute on function public.list_dismissed_luv_observation_ids() to authenticated;

notify pgrst, 'reload schema';
