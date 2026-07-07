-- Sprint 104: Luv Performance Intelligence
-- Aggregates historical action outcomes so Luv can surface what's working
-- for this specific venue over time.
-- Minimum threshold: 3 outcome rows before surfacing any observation.
-- Seasonal comparison surfaces only when data spans ≥2 distinct months.

create or replace function get_luv_performance_summary()
returns table (
  action_type      text,
  metric_name      text,
  total_actions    int,
  total_outcome    numeric,
  avg_outcome      numeric,
  best_month_name  text,
  best_month_avg   numeric,
  worst_month_name text,
  worst_month_avg  numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
begin
  select venue_id into v_venue_id
  from venue_users where user_id = auth.uid() limit 1;

  if v_venue_id is null then return; end if;

  return query
  with outcomes as (
    select
      a.action_type,
      o.metric_name,
      o.after_value,
      trim(to_char(a.started_at at time zone 'UTC', 'Month')) as month_name
    from luv_actions a
    join luv_action_outcomes o on o.action_id = a.id
    where a.venue_id = v_venue_id
      and o.after_value is not null
      and a.started_at > now() - interval '12 months'
  ),
  summary as (
    select
      action_type,
      metric_name,
      count(*)::int                  as total_actions,
      sum(after_value)               as total_outcome,
      avg(after_value)               as avg_outcome,
      count(distinct month_name)::int as distinct_months
    from outcomes
    group by action_type, metric_name
    having count(*) >= 3
  ),
  monthly as (
    select
      action_type,
      metric_name,
      month_name,
      avg(after_value) as month_avg
    from outcomes
    group by action_type, metric_name, month_name
  ),
  best_months as (
    select distinct on (action_type, metric_name)
      action_type, metric_name,
      month_name as best_month_name,
      month_avg  as best_month_avg
    from monthly
    order by action_type, metric_name, month_avg desc
  ),
  worst_months as (
    select distinct on (action_type, metric_name)
      action_type, metric_name,
      month_name as worst_month_name,
      month_avg  as worst_month_avg
    from monthly
    order by action_type, metric_name, month_avg asc
  )
  select
    s.action_type,
    s.metric_name,
    s.total_actions,
    s.total_outcome,
    s.avg_outcome,
    case when s.distinct_months >= 2 then bm.best_month_name  end as best_month_name,
    case when s.distinct_months >= 2 then bm.best_month_avg   end as best_month_avg,
    case when s.distinct_months >= 2 then wm.worst_month_name end as worst_month_name,
    case when s.distinct_months >= 2 then wm.worst_month_avg  end as worst_month_avg
  from summary s
  left join best_months  bm on bm.action_type = s.action_type
                            and bm.metric_name = s.metric_name
  left join worst_months wm on wm.action_type = s.action_type
                            and wm.metric_name = s.metric_name;
end;
$$;
