-- Luv V2 — Recurring incomplete tour follow-up pattern.
-- One durable luv_recommendations row per venue (type = tour_followup_pattern).
-- Venue resolution: current_user_venue_id() only.
-- Preserves dismissed_at on conflict (same contract as Guide-gap sync).

create or replace function public.sync_tour_followup_pattern_recommendation(
  p_rec jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
  v_type text := 'tour_followup_pattern';
  v_upserted int := 0;
  v_cleared int := 0;
  v_active boolean := false;
begin
  v_venue_id := public.current_user_venue_id();

  if v_venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'no venue');
  end if;

  if p_rec is not null
     and jsonb_typeof(p_rec) = 'object'
     and nullif(trim(coalesce(p_rec ->> 'type', '')), '') = v_type
  then
    v_active := true;
  end if;

  if v_active then
    if exists (
      select 1 from luv_recommendations
      where venue_id = v_venue_id
        and type = v_type
        and dismissed_at > now() - interval '7 days'
    ) then
      return jsonb_build_object(
        'ok', true,
        'upserted', 0,
        'cleared', 0,
        'skipped', 'recently_dismissed'
      );
    end if;

    insert into luv_recommendations
      (venue_id, type, title, body, priority, ctas, metadata, dismissed_at, completed_at, expires_at)
    values (
      v_venue_id,
      v_type,
      coalesce(nullif(trim(p_rec ->> 'title'), ''), 'Recent tours still need follow-up'),
      coalesce(
        nullif(trim(p_rec ->> 'body'), ''),
        'These are completed tours with no recorded follow-up.'
      ),
      least(100, greatest(0, coalesce((p_rec ->> 'priority')::int, 72))),
      coalesce(p_rec -> 'ctas', '[]'::jsonb),
      coalesce(p_rec -> 'metadata', '{}'::jsonb),
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

    v_upserted := 1;
  else
    with deleted as (
      delete from luv_recommendations
      where venue_id = v_venue_id
        and type = v_type
        and dismissed_at is null
        and completed_at is null
      returning 1
    )
    select count(*)::int into v_cleared from deleted;
  end if;

  return jsonb_build_object(
    'ok', true,
    'upserted', v_upserted,
    'cleared', v_cleared
  );
end;
$$;

revoke all on function public.sync_tour_followup_pattern_recommendation(jsonb) from public;
grant execute on function public.sync_tour_followup_pattern_recommendation(jsonb)
  to authenticated;

comment on function public.sync_tour_followup_pattern_recommendation(jsonb) is
  'Upsert or clear the venue-level tour_followup_pattern Luv recommendation for current_user_venue_id(). Preserves recent dismissals.';

notify pgrst, 'reload schema';
