-- Fix create_public_lead / ingest_lead 42P10.
--
-- Root cause: 20261365000000_vendor_network_inquiry_and_process.sql narrowed
-- conversations_relationship_uniq to:
--   UNIQUE (relationship_id) WHERE relationship_id IS NOT NULL
--     AND conversation_kind = 'venue_couple'
-- but provision_conversation_for_relationship() (from 202611810) still used:
--   ON CONFLICT (relationship_id) WHERE relationship_id IS NOT NULL
-- PostgreSQL requires the ON CONFLICT inference predicate to match the unique
-- index predicate exactly → SQLSTATE 42P10 when inserting a new relationship
-- (fired by the AFTER INSERT trigger on venue_customer_relationships).
--
-- Dedup semantics unchanged: still one venue_couple conversation per
-- relationship; still DO NOTHING on conflict.

create or replace function public.provision_conversation_for_relationship()
returns trigger
language plpgsql
as $$
begin
  insert into public.conversations (venue_id, relationship_id, conversation_kind)
  values (new.venue_id, new.id, 'venue_couple')
  on conflict (relationship_id)
    where relationship_id is not null
      and conversation_kind = 'venue_couple'
  do nothing;
  return new;
end;
$$;
