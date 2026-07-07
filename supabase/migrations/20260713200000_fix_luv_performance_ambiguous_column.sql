-- Fix: get_luv_performance_summary() — "column reference action_type is ambiguous"
--
-- RETURNS TABLE (action_type text, ...) makes `action_type` an OUT
-- parameter in scope for the whole plpgsql function body. Every bare,
-- unqualified `action_type` inside the CTEs below then collides with that
-- OUT parameter (Postgres can't tell if you mean the column or the
-- variable). The `outcomes`/summary CTEs qualified some references but not
-- all — this fully qualifies every CTE-column reference to action_type.

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
      outcomes.action_type,
      outcomes.metric_name,
      count(*)::int                  as total_actions,
      sum(outcomes.after_value)               as total_outcome,
      avg(outcomes.after_value)               as avg_outcome,
      count(distinct outcomes.month_name)::int as distinct_months
    from outcomes
    group by outcomes.action_type, outcomes.metric_name
    having count(*) >= 3
  ),
  monthly as (
    select
      outcomes.action_type,
      outcomes.metric_name,
      outcomes.month_name,
      avg(outcomes.after_value) as month_avg
    from outcomes
    group by outcomes.action_type, outcomes.metric_name, outcomes.month_name
  ),
  best_months as (
    select distinct on (monthly.action_type, monthly.metric_name)
      monthly.action_type, monthly.metric_name,
      monthly.month_name as best_month_name,
      monthly.month_avg  as best_month_avg
    from monthly
    order by monthly.action_type, monthly.metric_name, monthly.month_avg desc
  ),
  worst_months as (
    select distinct on (monthly.action_type, monthly.metric_name)
      monthly.action_type, monthly.metric_name,
      monthly.month_name as worst_month_name,
      monthly.month_avg  as worst_month_avg
    from monthly
    order by monthly.action_type, monthly.metric_name, monthly.month_avg asc
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
