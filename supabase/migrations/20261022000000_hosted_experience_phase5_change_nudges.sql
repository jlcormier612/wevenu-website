-- ============================================================================
-- Hosted Experience Platform — Phase 5: Change-Notification Nudges
--
-- docs/hosted-experience-platform-architecture-spec.md §9 — "A
-- coordinator/couple-facing (never guest-facing) nudge when a live-synced
-- source changes after publish: 'Your ceremony time changed on the
-- Timeline — want to notify guests who've already RSVP'd?'"
--
-- Scoped deliberately to the one live-synced section with real content
-- today (Schedule, when schedule_sync is on — see Phase 2's honest finding
-- that venue_managed/other live-synced sections have no real occupants
-- yet). Generalizing to other live-synced sources is future work for
-- whenever a second one exists with real content to watch.
--
-- Detection is on-demand (called when the couple's portal/Studio loads),
-- following the same request-time-generation pattern as
-- generate_venue_recommendations — no new cron. website_change_nudges is
-- the couple-portal-scoped analog of luv_recommendations (which is
-- venue-coordinator-scoped and structurally can't represent a per-couple
-- nudge): upsert-by-(website_id, section_key), re-surfaces (clears
-- dismissed_at) only when the underlying source changed again since the
-- last dismissal, and self-clears once the trigger condition no longer
-- holds (e.g. after a republish resets the baseline).
-- ============================================================================

create table public.website_change_nudges (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references public.clients(id) on delete cascade,
  venue_id           uuid not null references public.venues(id) on delete cascade,
  website_id         uuid not null references public.couple_websites(id) on delete cascade,
  section_key        text not null,
  change_summary     text not null,
  source_updated_at  timestamptz not null,
  detected_at        timestamptz not null default now(),
  dismissed_at       timestamptz,
  notified_at        timestamptz,
  created_at         timestamptz not null default now(),
  unique (website_id, section_key)
);

create index website_change_nudges_client on public.website_change_nudges (client_id) where dismissed_at is null;

alter table public.website_change_nudges enable row level security;

create policy website_change_nudges_venue_select
  on public.website_change_nudges for select
  using (
    exists (select 1 from public.venue_users vu where vu.venue_id = website_change_nudges.venue_id and vu.user_id = auth.uid() and vu.is_active)
  );

grant select on public.website_change_nudges to authenticated;

-- get_website_change_nudges: detect (upsert/self-clear) then return active nudges ---
create or replace function public.get_website_change_nudges(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session  public.client_portal_sessions%rowtype;
  v_site     public.couple_websites%rowtype;
  v_version  public.experience_versions%rowtype;
  v_latest   record;
  v_has_rsvps boolean;
begin
  select * into v_session
  from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return '[]'::jsonb; end if;

  select * into v_site
  from public.couple_websites
  where client_id = v_session.client_id and venue_id = v_session.venue_id;

  if found and v_site.status = 'published' and v_site.schedule_sync and v_site.current_version_id is not null then
    select * into v_version from public.experience_versions where id = v_site.current_version_id;

    select te.title, te.entry_time, te.updated_at
    into v_latest
    from public.timeline_entries te
    join public.events e on e.id = te.event_id
    where e.client_id = v_session.client_id and e.venue_id = v_session.venue_id
      and te.updated_at > v_version.published_at
    order by te.updated_at desc
    limit 1;

    select exists (
      select 1 from public.couple_guests g
      where g.client_id = v_session.client_id and g.venue_id = v_session.venue_id and g.rsvp_status <> 'pending'
    ) into v_has_rsvps;

    if v_latest.updated_at is not null and v_has_rsvps then
      insert into public.website_change_nudges (client_id, venue_id, website_id, section_key, change_summary, source_updated_at)
      values (
        v_session.client_id, v_session.venue_id, v_site.id, 'schedule',
        'Your Day-of Schedule was updated after your website was published — "' || v_latest.title || '"' ||
          case when v_latest.entry_time is not null then ' now shows ' || to_char(v_latest.entry_time, 'FMHH12:MI AM') else '' end ||
          '. Guests who already RSVP''d are seeing the new schedule on your live site, but haven''t been told about the change.',
        v_latest.updated_at
      )
      on conflict (website_id, section_key) do update
      set change_summary    = excluded.change_summary,
          source_updated_at = excluded.source_updated_at,
          detected_at       = now(),
          dismissed_at       = case when website_change_nudges.source_updated_at < excluded.source_updated_at then null else website_change_nudges.dismissed_at end,
          notified_at        = case when website_change_nudges.source_updated_at < excluded.source_updated_at then null else website_change_nudges.notified_at end
      where website_change_nudges.dismissed_at is null or website_change_nudges.source_updated_at < excluded.source_updated_at;
    else
      -- Trigger condition no longer holds (republished, sync turned off, or no post-publish change) — self-clear.
      delete from public.website_change_nudges
      where website_id = v_site.id and section_key = 'schedule' and dismissed_at is null;
    end if;
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', n.id, 'sectionKey', n.section_key, 'changeSummary', n.change_summary,
      'detectedAt', n.detected_at, 'notifiedAt', n.notified_at
    ) order by n.detected_at desc)
    from public.website_change_nudges n
    where n.client_id = v_session.client_id and n.venue_id = v_session.venue_id and n.dismissed_at is null
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.get_website_change_nudges(text) to anon, authenticated;

-- dismiss_website_change_nudge: couple dismisses, optionally after notifying guests ---
create or replace function public.dismiss_website_change_nudge(p_token text, p_nudge_id uuid, p_notified boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
begin
  select * into v_session
  from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then raise exception 'invalid_token'; end if;

  update public.website_change_nudges
  set dismissed_at = now(), notified_at = case when p_notified then now() else notified_at end
  where id = p_nudge_id and client_id = v_session.client_id and venue_id = v_session.venue_id;
end;
$$;

grant execute on function public.dismiss_website_change_nudge(text, uuid, boolean) to anon, authenticated;
