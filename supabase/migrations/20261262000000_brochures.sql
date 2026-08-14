-- Work Package D7B — Brochures.
--
-- Research finding (this phase): the Document Domain's real adoption is 2
-- producers in the whole app (Contracts, Event Orders), both of which have
-- a real negotiation/finalization lifecycle worth versioning. A Brochure
-- has none of that — it's a venue-authored, venue-wide reusable marketing
-- document, closer to a Contract *Template* (edit-in-place, no lock/amend
-- cycle) than to a signed Contract instance. Contract Templates themselves
-- are not Document Domain producers either — that's the correct precedent
-- to follow. Plain table + its own PDF generator, matching Packages/
-- Contract Templates' own shape.
--
-- Content model (brief §6/§8): reuse authoritative venue data LIVE at
-- render/PDF time wherever it already exists (Packages, FAQs, venue
-- story/branding) — never copy it into this table. Only genuinely
-- brochure-specific editorial text (a welcome override, a closing/next-
-- steps blurb) and which live sections to include are stored here.
--
-- Sharing (brief §11): a public share_token, generated at creation
-- (not "on first share" — simpler, matches contracts.sign_token's own
-- always-present convention), backing a public, unauthenticated
-- `/brochure/[token]` page + PDF route — the same "token + public route"
-- pattern already established for Contracts (get_contract_by_token /
-- /sign/[token]), not a second sharing mechanism.

create table public.brochures (
  id              uuid primary key default gen_random_uuid(),
  venue_id        uuid not null references public.venues (id) on delete cascade,

  name            text not null check (char_length(trim(name)) > 0),
  is_archived     boolean not null default false,

  welcome_text    text,      -- null = fall back to venue.story at render time
  include_packages boolean not null default true,
  include_faqs    boolean not null default false,
  closing_text    text,      -- optional "next steps" / call-to-action blurb

  share_token     uuid not null default gen_random_uuid(),

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (share_token)
);

create index brochures_venue on public.brochures (venue_id);

create trigger brochures_updated_at
  before update on public.brochures
  for each row execute function public.set_updated_at();

create table public.brochure_activities (
  id            uuid primary key default gen_random_uuid(),
  brochure_id   uuid not null references public.brochures (id) on delete cascade,
  venue_id      uuid not null references public.venues (id) on delete cascade,

  type          text not null,
  title         text not null,
  description   text,

  created_at    timestamptz not null default now()
);

create index brochure_activities_order on public.brochure_activities (brochure_id, created_at desc);

-- ---- RLS -----------------------------------------------------------------------
alter table public.brochures           enable row level security;
alter table public.brochure_activities enable row level security;

create policy brochures_all on public.brochures
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy brochure_activities_all on public.brochure_activities
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

-- Same lesson applied from day one as D7A's event_order_templates_delete_gate.
create policy brochures_delete_gate on public.brochures
  as restrictive
  for delete
  using (current_user_role() = any (array['owner', 'manager']));

grant select, insert, update, delete on public.brochures           to authenticated;
grant select, insert, update, delete on public.brochure_activities to authenticated;

-- ---- Public read (brief §11 — no auth required, token-validated) ----------------
-- Mirrors get_contract_by_token's exact discipline: a SECURITY DEFINER RPC
-- is the only path to any brochure content without a venue session, and it
-- resolves everything itself from the token — never trusts a client-
-- supplied id. Archived brochures are intentionally still viewable via a
-- link already sent out (archiving hides it from the venue's own Library
-- list, it does not revoke an already-shared link — matching how a sent
-- Contract or shared Event Order behaves).
create or replace function public.get_brochure_by_token(p_token uuid)
returns table (
  id               uuid,
  name             text,
  welcome_text     text,
  include_packages boolean,
  include_faqs     boolean,
  closing_text     text,
  venue_name       text,
  venue_business_name text,
  venue_logo_url   text,
  venue_story      text,
  venue_hero_image_url text,
  venue_primary_color text,
  venue_secondary_color text,
  venue_accent_color text,
  venue_email      text,
  venue_phone      text,
  venue_website    text,
  venue_id         uuid
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    b.id, b.name, b.welcome_text, b.include_packages, b.include_faqs, b.closing_text,
    v.name, v.business_name, v.logo_url, v.story, v.hero_image_url,
    v.primary_color, v.secondary_color, v.accent_color,
    v.email, v.phone, v.website, v.id
  from public.brochures b
  join public.venues v on v.id = b.venue_id
  where b.share_token = p_token;
end;
$$;

grant execute on function public.get_brochure_by_token(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
