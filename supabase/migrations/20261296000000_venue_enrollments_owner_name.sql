-- Separate subscriber first/last name on venue_enrollments.
--
-- Release requirement: the welcome email and any future personalization
-- must be able to resolve "Hi {{first_name}}," independently of the
-- venue's own business name, and neither may depend on splitting a
-- combined string (Stripe's billing "Name" field, which this table never
-- stored anyway — see venue_name's own comment history). No backfill is
-- meaningful for existing rows: nothing in this table or the local CRM
-- store has ever captured a genuinely separate first/last name for a
-- cold Stripe-checkout signup, so existing rows simply get null here,
-- same as they have no name today.
alter table public.venue_enrollments
  add column if not exists owner_first_name text,
  add column if not exists owner_last_name  text;

comment on column public.venue_enrollments.owner_first_name is
  'Subscriber first name, collected at checkout — never derived by splitting a combined name.';
comment on column public.venue_enrollments.owner_last_name is
  'Subscriber last name, collected at checkout — never derived by splitting a combined name.';
