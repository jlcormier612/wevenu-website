-- Sprint 97: Luv Memory
-- Persistent venue-level patterns Luv learns over time.
-- Unlike rollups (point-in-time AI observations), memories are derived facts
-- that persist and deepen — milestones, seasonality, conversion speed, etc.

create table luv_memories (
  id          uuid        primary key default gen_random_uuid(),
  venue_id    uuid        not null references venues(id) on delete cascade,
  category    text        not null check (category in ('milestone', 'business_pattern', 'seasonal', 'preference')),
  key         text        not null,
  value       jsonb       not null,
  computed_at timestamptz not null default now(),
  unique (venue_id, key)
);

create index luv_memories_venue_idx on luv_memories (venue_id);

alter table luv_memories enable row level security;

create policy "venues read own memories"
  on luv_memories for select to authenticated
  using (
    venue_id = (select venue_id from venue_users where user_id = auth.uid() limit 1)
  );

-- ── compute_venue_memories ──────────────────────────────────────────────────
-- Derives and upserts all memory keys for the current venue.
-- Skips recomputation if memories are < 24 hours old.

create or replace function compute_venue_memories()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
begin
  select venue_id into v_venue_id
  from venue_users where user_id = auth.uid() limit 1;

  if v_venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'no venue');
  end if;

  -- Skip if fresh (< 24 hours)
  if exists (
    select 1 from luv_memories
    where venue_id = v_venue_id
      and computed_at > now() - interval '24 hours'
  ) then
    return jsonb_build_object('ok', true, 'cached', true);
  end if;

  -- ── Milestones ────────────────────────────────────────────────────────────

  -- total_bookings
  insert into luv_memories (venue_id, category, key, value)
  select v_venue_id, 'milestone', 'total_bookings',
    jsonb_build_object('count', count(*))
  from clients where venue_id = v_venue_id
  on conflict (venue_id, key) do update
    set value = excluded.value, computed_at = now();

  -- first_booking_date
  insert into luv_memories (venue_id, category, key, value)
  select v_venue_id, 'milestone', 'first_booking_date',
    jsonb_build_object('date', min(created_at)::date)
  from clients where venue_id = v_venue_id
  having count(*) > 0
  on conflict (venue_id, key) do update
    set value = excluded.value, computed_at = now();

  -- ── Business patterns ─────────────────────────────────────────────────────

  -- avg_lead_to_booking_days
  insert into luv_memories (venue_id, category, key, value)
  select v_venue_id, 'business_pattern', 'avg_lead_to_booking_days',
    jsonb_build_object('days',
      round(avg(extract(epoch from (c.created_at - l.created_at)) / 86400))::int
    )
  from clients c
  join leads l on l.id = c.lead_id
  where c.venue_id = v_venue_id
    and c.lead_id is not null
  having count(*) >= 3
  on conflict (venue_id, key) do update
    set value = excluded.value, computed_at = now();

  -- busiest_event_month (which calendar month has the most booked events)
  insert into luv_memories (venue_id, category, key, value)
  select v_venue_id, 'business_pattern', 'busiest_event_month',
    jsonb_build_object('month', month_num, 'count', event_count)
  from (
    select extract(month from event_date)::int as month_num,
           count(*) as event_count
    from clients
    where venue_id = v_venue_id
      and event_date is not null
    group by extract(month from event_date)::int
    order by event_count desc
    limit 1
  ) t
  on conflict (venue_id, key) do update
    set value = excluded.value, computed_at = now();

  -- ── Seasonal ──────────────────────────────────────────────────────────────

  -- monthly_inquiry_averages: avg inquiries per calendar month across all years
  insert into luv_memories (venue_id, category, key, value)
  select v_venue_id, 'seasonal', 'monthly_inquiry_averages',
    coalesce(
      jsonb_agg(
        jsonb_build_object('month', month_num, 'avg', avg_count)
        order by month_num
      ),
      '[]'::jsonb
    )
  from (
    select
      extract(month from created_at)::int as month_num,
      round(
        count(*) * 1.0 /
        nullif(count(distinct extract(year from created_at)), 0), 1
      ) as avg_count
    from leads
    where venue_id = v_venue_id
    group by extract(month from created_at)::int
  ) monthly
  on conflict (venue_id, key) do update
    set value = excluded.value, computed_at = now();

  return jsonb_build_object('ok', true, 'cached', false);
end;
$$;

-- ── get_venue_memories ───────────────────────────────────────────────────────

create or replace function get_venue_memories()
returns table (category text, key text, value jsonb, computed_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select category, key, value, computed_at
  from luv_memories
  where venue_id = (
    select venue_id from venue_users where user_id = auth.uid() limit 1
  )
  order by category, key;
$$;
