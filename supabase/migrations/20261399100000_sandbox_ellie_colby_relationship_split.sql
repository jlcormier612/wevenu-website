-- Idempotent repair for the known Sandbox Ellie/Colby collision.
-- No-ops when those rows are absent (other environments).

do $$
declare
  v_venue uuid := 'a415ac52-cd74-42a6-8df7-7a8f6e71d080';
  v_old_rel uuid;
  v_new_rel uuid;
  v_old_convo uuid;
  v_new_convo uuid;
  v_colby_client uuid;
begin
  select r.id into v_old_rel
  from public.venue_customer_relationships r
  where r.venue_id = v_venue
    and lower(r.email) = 'jyagnesak@yahoo.com'
    and lower(r.first_name) = 'ellie'
  order by r.created_at asc
  limit 1;

  if v_old_rel is null then
    raise notice 'Ellie relationship not found — nothing to repair.';
    return;
  end if;

  select c.id into v_colby_client
  from public.clients c
  where c.venue_id = v_venue
    and c.relationship_id = v_old_rel
    and lower(c.first_name) = 'colby'
    and c.last_name ilike '%spine%'
  order by c.created_at desc
  limit 1;

  if v_colby_client is null then
    raise notice 'Colby client on Ellie relationship not found — nothing to repair.';
    return;
  end if;

  if exists (
    select 1 from public.venue_customer_relationships
    where venue_id = v_venue
      and lower(first_name) = 'colby'
      and last_name ilike '%spine%'
      and id <> v_old_rel
  ) then
    raise notice 'Colby already has a separate relationship — nothing to repair.';
    return;
  end if;

  insert into public.venue_customer_relationships (venue_id, email, first_name, last_name)
  values (v_venue, 'jyagnesak@yahoo.com', 'Colby', 'SpineE2E3')
  returning id into v_new_rel;

  update public.clients
  set relationship_id = v_new_rel
  where venue_id = v_venue
    and id = v_colby_client;

  update public.leads
  set relationship_id = v_new_rel
  where venue_id = v_venue
    and relationship_id = v_old_rel
    and lower(first_name) = 'colby'
    and last_name ilike '%spine%';

  select id into v_old_convo
  from public.conversations
  where venue_id = v_venue
    and relationship_id = v_old_rel
    and conversation_kind = 'venue_couple'
  order by created_at asc
  limit 1;

  select id into v_new_convo
  from public.conversations
  where venue_id = v_venue
    and relationship_id = v_new_rel
    and conversation_kind = 'venue_couple'
  order by created_at asc
  limit 1;

  if v_old_convo is not null and v_new_convo is not null then
    update public.conversation_messages
    set conversation_id = v_new_convo
    where conversation_id = v_old_convo
      and (
        body ilike '%spinee2e%'
        or body ilike '%colby spine%'
        or body ilike '%spine e2e%'
      );
  end if;

  raise notice 'Repaired Colby client % onto relationship % (from %). New conversation %.',
    v_colby_client, v_new_rel, v_old_rel, v_new_convo;
end $$;
