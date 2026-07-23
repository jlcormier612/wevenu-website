-- Luv Success Guide §3.1, Daily Briefing (2026-07-22) — "what got resolved
-- since I last looked" needs exactly one new piece of persistence: when
-- did this venue last actually view the briefing. Everything the briefing
-- itself reads (readiness inputs, events, requests, celebrations) already
-- exists; this table only tracks Luv's own prior observation moment, per
-- docs/luv-platform-intelligence-architecture.md §2/§9's framing — not a
-- copy of any feature's data.
--
-- Scoped narrower than the design doc's own luv_observed_state sketch
-- (which would track every individual observation's first/last-seen/
-- resolved state): this pass answers "what resolved since I last looked"
-- using the 5 milestone types luv_celebrations already tracks in real
-- code paths (contract signed, final payment, guest list submitted,
-- timeline submitted, website published) rather than the full 11-type
-- vocabulary from §2, which would require adding fire points to 6 more
-- flows first. One venue-scoped last-viewed timestamp is what that
-- narrower scope actually needs.
create table public.luv_briefing_views (
  venue_id       uuid primary key references public.venues(id) on delete cascade,
  last_viewed_at timestamptz not null default now()
);

alter table public.luv_briefing_views enable row level security;

create policy luv_briefing_views_all on public.luv_briefing_views
  for all to authenticated
  using (venue_id = current_user_venue_id())
  with check (venue_id = current_user_venue_id());

grant select, insert, update on public.luv_briefing_views to authenticated;

notify pgrst, 'reload schema';
