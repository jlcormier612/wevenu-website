-- Luv Intelligence V1 — minimal Ask signal persistence.
-- Venue-scoped question outcomes for future Guide gap intelligence.
-- Not a general AI event log. No UI exposure in this phase.

create table public.luv_ask_signals (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  created_at timestamptz not null default now(),
  client_id uuid references public.clients(id) on delete set null,
  relationship_id uuid references public.venue_customer_relationships(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  question text not null,
  outcome text not null
    check (outcome in (
      'answered_venue_guide',
      'answered_htc_help',
      'answered_portal_context',
      'information_gap',
      'unavailable'
    )),
  guide_section text null,
  knowledge_layer text null
    check (
      knowledge_layer is null
      or knowledge_layer in ('venue_guide', 'htc_product', 'portal_context')
    ),
  next_steps text[] not null default '{}'
);

create index luv_ask_signals_venue_created_idx
  on public.luv_ask_signals (venue_id, created_at desc);

create index luv_ask_signals_venue_outcome_idx
  on public.luv_ask_signals (venue_id, outcome, created_at desc);

comment on table public.luv_ask_signals is
  'Minimal Couple Ask Luv signals (Luv Intelligence V1). Venue-scoped; not client-visible.';

alter table public.luv_ask_signals enable row level security;

-- Venue staff may read their own venue's signals. Clients/anon have no access.
-- Inserts happen only via record_luv_ask_signal (security definer).
create policy luv_ask_signals_venue_select on public.luv_ask_signals
  for select to authenticated
  using (venue_id = public.current_user_venue_id());

grant select on public.luv_ask_signals to authenticated;

-- Token-validated insert — never trust a client-supplied venue_id.
create or replace function public.record_luv_ask_signal(
  p_token text,
  p_question text,
  p_outcome text,
  p_guide_section text default null,
  p_knowledge_layer text default null,
  p_next_steps text[] default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids record;
  v_relationship_id uuid;
  v_id uuid;
  v_question text;
begin
  if coalesce(nullif(trim(p_token), ''), '') = '' then
    raise exception 'missing_token';
  end if;

  v_question := left(trim(coalesce(p_question, '')), 500);
  if v_question = '' then
    raise exception 'missing_question';
  end if;

  if p_outcome is null or p_outcome not in (
    'answered_venue_guide',
    'answered_htc_help',
    'answered_portal_context',
    'information_gap',
    'unavailable'
  ) then
    raise exception 'invalid_outcome';
  end if;

  if p_knowledge_layer is not null and p_knowledge_layer not in (
    'venue_guide', 'htc_product', 'portal_context'
  ) then
    raise exception 'invalid_knowledge_layer';
  end if;

  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.venue_id is null then
    raise exception 'invalid_token';
  end if;

  select c.relationship_id into v_relationship_id
  from public.clients c
  where c.id = v_ids.client_id;

  insert into public.luv_ask_signals (
    venue_id,
    client_id,
    relationship_id,
    event_id,
    question,
    outcome,
    guide_section,
    knowledge_layer,
    next_steps
  ) values (
    v_ids.venue_id,
    v_ids.client_id,
    v_relationship_id,
    v_ids.event_id,
    v_question,
    p_outcome,
    nullif(trim(coalesce(p_guide_section, '')), ''),
    p_knowledge_layer,
    coalesce(p_next_steps, '{}'::text[])
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.record_luv_ask_signal(text, text, text, text, text, text[])
  to authenticated;
grant execute on function public.record_luv_ask_signal(text, text, text, text, text, text[])
  to anon;

notify pgrst, 'reload schema';
