-- ============================================================================
-- Engineering Cleanup — Change-Notification Nudge: filter by guests
-- visibility, not "any timeline_entries row changed"
--
-- docs/release-readiness-status.md §3 item 3b. Bug found while closing this
-- item: get_website_change_nudges (20261022000000) detects a Schedule
-- change by checking whether ANY timeline_entries row for the client/venue
-- has updated_at > the published version's timestamp — no filter on
-- audience or owner at all. Under the pre-Timeline-rebuild model this was
-- already loose; under the shipped Owner/Lock-State/Visibility model
-- (docs/timeline-implementation-report.md) it's a real false-positive
-- generator: a coordinator editing an internal-only note (audiences=
-- ['venue']), or a couple privately drafting an item never tagged for
-- guests, now silently fires "your Day-of Schedule was updated... guests
-- who already RSVP'd... haven't been told" — untrue on both counts, since
-- nothing guest-visible changed.
--
-- Not gating this on Timeline Submission, deliberately: per the Commitment
-- Lifecycle Architecture §6 (and confirmed correct on Timeline's own
-- implementation, see the architecture spec's 2026-07-17 update), audience
-- publication is independent of venue submission — a couple can publish an
-- item to guests without ever submitting anything to their venue. Gating
-- the nudge on Submission would be a new, incorrect coupling, not a fix.
-- The correct filter is the one the Schedule section itself already reads
-- by: 'guests' = any(audiences) (docs/timeline-implementation-report.md,
-- 20261029030000_timeline_audience_reads.sql's get_guest_timeline).
--
-- Implementation-quality fix only — no behavior change to what the nudge
-- says or does once it correctly fires, no new architecture.
-- ============================================================================

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
      and 'guests' = any(te.audiences)
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
      -- Trigger condition no longer holds (republished, sync turned off, no post-publish guest-visible change) — self-clear.
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
