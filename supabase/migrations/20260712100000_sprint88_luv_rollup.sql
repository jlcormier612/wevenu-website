-- Sprint 88 — Luv Roll-Up
--
-- Persists Luv's synthesized weekly observations so venues can compare
-- "this week" vs "last week" and track trends over time.
--
-- Tables:  luv_rollups
-- RPCs:    save_luv_rollup()   — called by the Next.js API after Claude generates
--          get_luv_rollups()   — returns recent roll-ups for this venue

-- ── Table ─────────────────────────────────────────────────────────────────────

create table if not exists public.luv_rollups (
  id               uuid        primary key default gen_random_uuid(),
  venue_id         uuid        not null references public.venues(id) on delete cascade,
  generated_at     timestamptz not null default now(),
  -- the raw analytics + health snapshot used to generate; enables change-over-time
  metrics_snapshot jsonb       not null,
  -- the four quadrant observations
  observations     jsonb       not null,
  model_used       text        not null default 'claude-sonnet-4-6',
  created_at       timestamptz not null default now()
);

create index if not exists luv_rollups_venue_time_idx
  on public.luv_rollups(venue_id, generated_at desc);

-- ── save_luv_rollup ───────────────────────────────────────────────────────────

create or replace function public.save_luv_rollup(
  p_metrics_snapshot jsonb,
  p_observations     jsonb,
  p_model_used       text default 'claude-sonnet-4-6'
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_venue_id uuid;
  v_id       uuid;
begin
  select id into v_venue_id from public.venues where owner_user_id = auth.uid();
  if not found then return jsonb_build_object('error', 'not_found'); end if;

  insert into public.luv_rollups (venue_id, metrics_snapshot, observations, model_used)
  values (v_venue_id, p_metrics_snapshot, p_observations, p_model_used)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- ── get_luv_rollups ───────────────────────────────────────────────────────────

create or replace function public.get_luv_rollups(p_limit int default 5)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_venue_id uuid;
begin
  select id into v_venue_id from public.venues where owner_user_id = auth.uid();
  if not found then return jsonb_build_object('rollups', '[]'::jsonb); end if;

  return jsonb_build_object(
    'rollups', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',           r.id,
          'generatedAt',  r.generated_at,
          'observations', r.observations,
          'modelUsed',    r.model_used
        ) order by r.generated_at desc
      )
      from public.luv_rollups r
      where r.venue_id = v_venue_id
      limit p_limit
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.save_luv_rollup(jsonb, jsonb, text) to authenticated;
grant execute on function public.get_luv_rollups(int)                 to authenticated;
