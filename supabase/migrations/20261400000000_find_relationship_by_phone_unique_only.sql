-- Additive replacement of find_relationship_by_phone_for_venue.
--
-- The 202613990 version used min(relationship_id) when counting matches.
-- Postgres in this environment cannot min(uuid), and min() would also be the
-- wrong identity rule even if it compiled: shared/duplicate phones must not
-- be guessed into one relationship.
--
-- Contract (unchanged product rule, safer implementation):
--   exactly one distinct relationship_id → return that relationship
--   zero matches → unmatched (empty result)
--   two or more → ambiguous (empty result; never pick one)
--
-- count_relationships_by_phone_for_venue reports the distinct count so inbound
-- can log none vs ambiguous without inventing a winner.
--
-- inbound_sms_unmatched persists unmatched/ambiguous Twilio inbound for ops
-- without creating a relationship or conversation.

create or replace function public.count_relationships_by_phone_for_venue(
  p_phone text,
  p_venue_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_digits text := public.normalize_phone_digits(p_phone);
  v_count int;
begin
  if p_venue_id is null or v_digits = '' then
    return 0;
  end if;

  select count(distinct x.relationship_id)
  into v_count
  from (
    select l.relationship_id
    from public.leads l
    where l.venue_id = p_venue_id
      and l.relationship_id is not null
      and public.normalize_phone_digits(l.phone) = v_digits
    union
    select c.relationship_id
    from public.clients c
    where c.venue_id = p_venue_id
      and c.relationship_id is not null
      and public.normalize_phone_digits(c.phone) = v_digits
  ) x;

  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.count_relationships_by_phone_for_venue(text, uuid) from public;
revoke all on function public.count_relationships_by_phone_for_venue(text, uuid) from anon;
revoke all on function public.count_relationships_by_phone_for_venue(text, uuid) from authenticated;
grant execute on function public.count_relationships_by_phone_for_venue(text, uuid) to service_role;

create or replace function public.find_relationship_by_phone_for_venue(
  p_phone text,
  p_venue_id uuid
)
returns table (
  venue_id uuid,
  relationship_id uuid,
  entity_type text,
  entity_id uuid,
  display_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_digits text := public.normalize_phone_digits(p_phone);
  v_rels uuid[];
  v_rel uuid;
begin
  if p_venue_id is null or v_digits = '' then
    return;
  end if;

  select array_agg(distinct x.relationship_id)
  into v_rels
  from (
    select l.relationship_id
    from public.leads l
    where l.venue_id = p_venue_id
      and l.relationship_id is not null
      and public.normalize_phone_digits(l.phone) = v_digits
    union
    select c.relationship_id
    from public.clients c
    where c.venue_id = p_venue_id
      and c.relationship_id is not null
      and public.normalize_phone_digits(c.phone) = v_digits
  ) x;

  if v_rels is null or cardinality(v_rels) is distinct from 1 then
    return;
  end if;

  v_rel := v_rels[1];

  return query
    select l.venue_id, l.relationship_id, 'lead'::text, l.id,
      trim(coalesce(l.first_name, '') || ' ' || coalesce(l.last_name, ''))
    from public.leads l
    where l.venue_id = p_venue_id
      and l.relationship_id = v_rel
      and public.normalize_phone_digits(l.phone) = v_digits
    order by l.created_at desc
    limit 1;

  if found then
    return;
  end if;

  return query
    select c.venue_id, c.relationship_id, 'client'::text, c.id,
      trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, ''))
    from public.clients c
    where c.venue_id = p_venue_id
      and c.relationship_id = v_rel
      and public.normalize_phone_digits(c.phone) = v_digits
    order by c.created_at desc
    limit 1;
end;
$$;

revoke all on function public.find_relationship_by_phone_for_venue(text, uuid) from public;
revoke all on function public.find_relationship_by_phone_for_venue(text, uuid) from anon;
revoke all on function public.find_relationship_by_phone_for_venue(text, uuid) from authenticated;
grant execute on function public.find_relationship_by_phone_for_venue(text, uuid) to service_role;

create table if not exists public.inbound_sms_unmatched (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  from_digits text not null,
  match_count integer not null default 0,
  reason text not null check (reason in ('none', 'ambiguous', 'invalid_phone', 'rpc_error')),
  message_sid text,
  created_at timestamptz not null default now()
);

create index if not exists inbound_sms_unmatched_venue_created
  on public.inbound_sms_unmatched (venue_id, created_at desc);

create unique index if not exists inbound_sms_unmatched_message_sid
  on public.inbound_sms_unmatched (message_sid)
  where message_sid is not null;

alter table public.inbound_sms_unmatched enable row level security;

grant select, insert on public.inbound_sms_unmatched to service_role;

notify pgrst, 'reload schema';
