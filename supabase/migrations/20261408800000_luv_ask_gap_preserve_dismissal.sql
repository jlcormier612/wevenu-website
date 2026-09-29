-- Guide-gap sync must not resurrect a dismissed recommendation on the
-- next dashboard load (generate → sync → get). The cooldown EXISTS check
-- already skips a recent dismiss, but ON CONFLICT was still setting
-- dismissed_at = null whenever that check did not short-circuit.
--
-- 7-day restore is owned by get_venue_recommendations
-- (dismissed_at <= now() - 7 days), not by clearing dismissed_at.
--
-- Continues to use current_user_venue_id() — do not revert to
-- venue_users … LIMIT 1.

create or replace function public.sync_client_ask_gap_recommendations(
  p_gaps jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
  v_gap jsonb;
  v_type text;
  v_active_types text[] := '{}';
  v_upserted int := 0;
  v_cleared int := 0;
begin
  v_venue_id := public.current_user_venue_id();

  if v_venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'no venue');
  end if;

  if p_gaps is null or jsonb_typeof(p_gaps) <> 'array' then
    p_gaps := '[]'::jsonb;
  end if;

  for v_gap in select * from jsonb_array_elements(p_gaps)
  loop
    v_type := nullif(trim(coalesce(v_gap ->> 'type', '')), '');
    if v_type is null or v_type not like 'client_ask_gap_%' then
      continue;
    end if;

    v_active_types := array_append(v_active_types, v_type);

    if exists (
      select 1 from luv_recommendations
      where venue_id = v_venue_id
        and type = v_type
        and dismissed_at > now() - interval '7 days'
    ) then
      continue;
    end if;

    insert into luv_recommendations
      (venue_id, type, title, body, priority, ctas, metadata, dismissed_at, completed_at, expires_at)
    values (
      v_venue_id,
      v_type,
      coalesce(nullif(trim(v_gap ->> 'title'), ''), 'Clients asked about a Guide topic'),
      coalesce(
        nullif(trim(v_gap ->> 'body'), ''),
        'Your published Venue Guide doesn''t currently answer this clearly.'
      ),
      least(100, greatest(0, coalesce((v_gap ->> 'priority')::int, 75))),
      coalesce(v_gap -> 'ctas', '[]'::jsonb),
      coalesce(v_gap -> 'metadata', '{}'::jsonb),
      null,
      null,
      null
    )
    on conflict (venue_id, type) do update
      set title    = excluded.title,
          body     = excluded.body,
          priority = excluded.priority,
          ctas     = excluded.ctas,
          metadata = excluded.metadata;

    v_upserted := v_upserted + 1;
  end loop;

  with deleted as (
    delete from luv_recommendations
    where venue_id = v_venue_id
      and type like 'client_ask_gap_%'
      and dismissed_at is null
      and completed_at is null
      and (
        cardinality(v_active_types) = 0
        or type <> all (v_active_types)
      )
    returning 1
  )
  select count(*)::int into v_cleared from deleted;

  return jsonb_build_object(
    'ok', true,
    'upserted', v_upserted,
    'cleared', v_cleared
  );
end;
$$;

notify pgrst, 'reload schema';
