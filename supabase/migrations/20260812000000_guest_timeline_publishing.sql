-- ============================================================================
-- Guest Timeline Publishing — connect the existing Booking Timeline to the
-- public wedding website. No second Timeline: both functions below read
-- timeline_entries directly and live, filtered to 'guest' audiences —
-- exactly the visibility already designed for this in Sprint 57
-- (20260629180000_timeline_visibility.sql).
--
-- Both functions were broken: they referenced te.time (the column has been
-- entry_time since introduction — this appears to have never actually
-- matched the real schema) and te.notes for "description". notes is the
-- internal-only field added in the Booking Timeline Experience task
-- ("not shown to guests or clients") — using it here would have leaked
-- internal notes to the public website the moment either bug got fixed
-- without this correction. Confirmed broken by calling get_guest_timeline
-- directly against the local DB before this fix: "column te.time does not
-- exist".
--
-- Also fixes ordering: both previously sorted by time only. The Booking
-- Timeline's real display order is section order, then each item's
-- position within its section (Booking Timeline Experience task) — entries
-- with no section sort last, matching the coordinator's own "Unsectioned"
-- bucket.
-- ============================================================================

create or replace function public.get_wedding_website(
  p_slug text,
  p_password text default null,
  p_session_id text default null,
  p_page text default 'home'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_site    public.couple_websites%rowtype;
  v_event   record;
  v_client  public.clients%rowtype;
  v_guests  record;
  v_views   bigint;
  v_schedule jsonb;
begin
  select * into v_site
  from public.couple_websites
  where slug = p_slug and is_published = true;

  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  if v_site.password is not null then
    if p_password is null or v_site.password != p_password then
      return jsonb_build_object('requires_password', true);
    end if;
  end if;

  -- Log view (non-critical)
  begin
    insert into public.couple_website_views (venue_id, client_id, website_id, page, session_id)
    values (v_site.venue_id, v_site.client_id, v_site.id, p_page, p_session_id);
  exception when others then null;
  end;

  -- Approximate unique visitors
  select count(distinct coalesce(session_id, id::text)) into v_views
  from public.couple_website_views where website_id = v_site.id;

  select * into v_client from public.clients where id = v_site.client_id;
  select e.id, e.name, e.event_date, e.event_type, e.guest_count, e.setup_time
  into v_event
  from public.events e
  where e.client_id = v_site.client_id and e.venue_id = v_site.venue_id
    and e.status not in ('cancelled')
  order by e.event_date asc limit 1;

  select count(*) as total,
         count(*) filter (where rsvp_status = 'attending') as attending,
         count(*) filter (where rsvp_status = 'pending') as pending
  into v_guests
  from public.couple_guests
  where client_id = v_site.client_id and venue_id = v_site.venue_id;

  -- Schedule: sync from the Booking Timeline if enabled and event exists —
  -- same table the coordinator and couple already read and write, filtered
  -- to items marked Guest Visible, in the same order the Booking Timeline
  -- displays them.
  if v_site.schedule_sync and v_event.id is not null then
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'time',        te.entry_time::text,
        'title',       te.title,
        'description', te.description
      )
      order by (te.section_id is null)::int, coalesce(ts.sort_order, 0), te.sort_order, te.created_at
    ), '[]'::jsonb)
    into v_schedule
    from public.timeline_entries te
    left join public.timeline_sections ts on ts.id = te.section_id
    where te.event_id = v_event.id
      and 'guest' = any(te.audiences)
      and te.entry_time is not null;
  else
    -- Use custom content
    v_schedule := coalesce(v_site.content->'schedule', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'siteId',         v_site.id,
    'slug',           v_site.slug,
    'theme',          v_site.theme,
    'accentColor',    v_site.accent_color,
    'sectionsEnabled', v_site.sections_enabled,
    'scheduleSync',   v_site.schedule_sync,
    'content',        jsonb_set(
                        coalesce(v_site.content, '{}'::jsonb),
                        '{schedule}',
                        v_schedule
                      ),
    'totalViews',     v_views,
    'couple', jsonb_build_object(
      'firstName',        v_client.first_name,
      'lastName',         v_client.last_name,
      'partnerFirstName', v_client.partner_first_name,
      'partnerLastName',  v_client.partner_last_name
    ),
    'event', case when v_event.id is not null then jsonb_build_object(
      'id', v_event.id, 'name', v_event.name, 'eventDate', v_event.event_date,
      'eventType', v_event.event_type, 'guestCount', v_event.guest_count,
      'setupTime', v_event.setup_time
    ) else null end,
    'rsvpStats', jsonb_build_object(
      'total', v_guests.total, 'attending', v_guests.attending, 'pending', v_guests.pending
    )
  );
end;
$$;

-- Helper: get guest-facing timeline entries for the website editor preview
create or replace function public.get_guest_timeline(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
  v_event   record;
  v_entries jsonb;
begin
  select * into v_session from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('error', 'invalid_token'); end if;

  select id into v_event from public.events
  where client_id = v_session.client_id and venue_id = v_session.venue_id
    and status not in ('cancelled')
  order by event_date asc limit 1;

  if not found then return jsonb_build_object('entries', '[]'::jsonb, 'count', 0); end if;

  select coalesce(jsonb_agg(
    jsonb_build_object('time', te.entry_time::text, 'title', te.title, 'description', te.description)
    order by (te.section_id is null)::int, coalesce(ts.sort_order, 0), te.sort_order, te.created_at
  ), '[]'::jsonb)
  into v_entries
  from public.timeline_entries te
  left join public.timeline_sections ts on ts.id = te.section_id
  where te.event_id = v_event.id
    and 'guest' = any(te.audiences)
    and te.entry_time is not null;

  return jsonb_build_object(
    'entries', v_entries,
    'count', jsonb_array_length(v_entries)
  );
end;
$$;

grant execute on function public.get_guest_timeline(text) to anon, authenticated;

notify pgrst, 'reload schema';
