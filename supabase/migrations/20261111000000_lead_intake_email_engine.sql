-- ============================================================================
-- Lead Acquisition & Intake — Email Intake Engine (Work Stream D).
--
-- Each venue gets a lead_email_key, the same "not a secret, identifies the
-- venue, not the user" pattern as embed_key/tour_embed_key. A venue forwards
-- inquiry-notification emails (from The Knot, WeddingWire, or anywhere
-- else — the parser is generic, see lib/lead-intake/email-extract.ts) to
-- leads+{lead_email_key}@{inbound domain}. The subaddress is resolved here;
-- extraction and lead creation happen in the application layer
-- (app/api/leads/email-intake/route.ts), same Lead Intake pipeline as
-- every other source.
-- ============================================================================

alter table public.venues
  add column lead_email_key text unique;

update public.venues
  set lead_email_key = lower(replace(gen_random_uuid()::text, '-', ''))
  where lead_email_key is null;

alter table public.venues
  alter column lead_email_key set not null;

create unique index venues_lead_email_key on public.venues (lead_email_key);

create or replace function public.get_venue_by_lead_email_key(p_key text)
returns table (id uuid, name text)
language sql
security definer
set search_path = public
stable
as $$
  select id, name from public.venues where lead_email_key = p_key;
$$;

grant execute on function public.get_venue_by_lead_email_key(text) to anon, authenticated;

notify pgrst, 'reload schema';
