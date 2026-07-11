-- ============================================================================
-- SMS — inbound phone matching
--
-- Ahead of launch, texting was added as a real channel on the Conversation
-- system's "sms" option (previously present in the UI but never wired to an
-- actual provider — see lib/sms/, app/api/messaging/sms-inbound). Wevenu is
-- single-tenant per Twilio account but multi-venue: one shared inbound
-- number/webhook receives texts for every venue, exactly like inbound email
-- already works (matched by sender address, no venue scoping upfront — see
-- app/api/messaging/inbound/route.ts). This function is the SMS equivalent
-- of that email lookup: given a raw inbound "From" number, find which
-- lead/client (and therefore which venue) it belongs to.
--
-- Phone numbers are stored in whatever format a coordinator typed them in —
-- normalizing to digits-only for comparison here avoids requiring a new
-- normalized column + backfill; regexp_replace on read is cheap at today's
-- table sizes and avoids a migration that touches existing data.
-- ============================================================================

create or replace function public.find_relationship_by_phone(p_phone text)
returns table (venue_id uuid, relationship_id uuid, entity_type text, entity_id uuid, display_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_digits text := regexp_replace(p_phone, '\D', '', 'g');
begin
  -- Strip a leading US/Canada country code (1) so "+16155551234" and
  -- "6155551234" compare equal, matching how the number was likely typed in.
  if length(v_digits) = 11 and left(v_digits, 1) = '1' then
    v_digits := substring(v_digits from 2);
  end if;
  if v_digits = '' then
    return;
  end if;

  return query
    select l.venue_id, l.relationship_id, 'lead'::text, l.id,
      trim(coalesce(l.first_name, '') || ' ' || coalesce(l.last_name, ''))
    from public.leads l
    where l.relationship_id is not null
      and regexp_replace(coalesce(l.phone, ''), '\D', '', 'g') = v_digits
    limit 1;

  if found then
    return;
  end if;

  return query
    select c.venue_id, c.relationship_id, 'client'::text, c.id,
      trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, ''))
    from public.clients c
    where c.relationship_id is not null
      and regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') = v_digits
    limit 1;
end;
$$;

-- Called only from the SMS inbound webhook (no Supabase session — see
-- integrations/supabase/admin.ts), matching the same service-role-only
-- pattern already used for inbound email.
grant execute on function public.find_relationship_by_phone(text) to service_role;

notify pgrst, 'reload schema';
