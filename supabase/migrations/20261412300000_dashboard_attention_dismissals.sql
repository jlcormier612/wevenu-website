-- Dashboard Today's Focus dismissals.
-- Presentation suppression only: does not complete work or mutate domain state.
-- Distinct from luv_recommendations observation dismiss (7-day restore).

create table if not exists public.dashboard_attention_dismissals (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  item_key text not null,
  dismissed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint dashboard_attention_dismissals_key_len
    check (char_length(item_key) between 8 and 500),
  constraint dashboard_attention_dismissals_venue_key unique (venue_id, item_key)
);

create index if not exists dashboard_attention_dismissals_venue_idx
  on public.dashboard_attention_dismissals (venue_id);

comment on table public.dashboard_attention_dismissals is
  'Venue-scoped Dashboard Focus suppression. Dismiss ≠ complete. Does not mutate payments, leads, tasks, contracts, or communications.';

alter table public.dashboard_attention_dismissals enable row level security;

grant select, insert on public.dashboard_attention_dismissals to authenticated;
grant select, insert, update, delete on public.dashboard_attention_dismissals to service_role;

create policy dashboard_attention_dismissals_select
  on public.dashboard_attention_dismissals
  for select
  to authenticated
  using (venue_id = public.current_user_venue_id());

create policy dashboard_attention_dismissals_insert
  on public.dashboard_attention_dismissals
  for insert
  to authenticated
  with check (venue_id = public.current_user_venue_id());

create or replace function public.dismiss_dashboard_attention_item(p_item_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
begin
  v_venue_id := public.current_user_venue_id();
  if v_venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'no venue');
  end if;

  if p_item_key is null
     or length(p_item_key) < 8
     or length(p_item_key) > 500
     or p_item_key !~ '^[A-Za-z0-9_.:|-]+$' then
    return jsonb_build_object('ok', false, 'error', 'invalid item');
  end if;

  insert into public.dashboard_attention_dismissals (venue_id, item_key, dismissed_at)
  values (v_venue_id, p_item_key, now())
  on conflict (venue_id, item_key) do update
    set dismissed_at = now();

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.list_dismissed_dashboard_attention_keys()
returns text[]
language sql
security definer
set search_path = public
as $$
  select coalesce(array_agg(item_key), '{}'::text[])
  from public.dashboard_attention_dismissals
  where venue_id = public.current_user_venue_id();
$$;

grant execute on function public.dismiss_dashboard_attention_item(text) to authenticated;
grant execute on function public.list_dismissed_dashboard_attention_keys() to authenticated;

notify pgrst, 'reload schema';
