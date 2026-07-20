-- ============================================================================
-- Wedding Website Stabilization — Defect 2: public site ignores the
-- couple's saved palette and section order
--
-- docs/wedding-website-stabilization-plan.md. Sprint 70 added themePalette/
-- fontPairing/sectionOrder to get_wedding_website's return object and they
-- worked. 20260812000000_guest_timeline_publishing.sql, whose stated
-- purpose was unrelated (live Timeline-sync for Schedule), redefined this
-- function from an older base and silently dropped all three fields — a
-- regression, not a gap. Confirmed live: a row with explicit theme_palette/
-- font_pairing/section_order values returns none of them through the
-- current public RPC.
--
-- This redefinition is the Timeline-sync body from 20260812000000
-- unchanged, plus the three restored fields. themePalette and sectionOrder
-- have an immediate, complete visual effect on restoration — the
-- consuming component (components/wedding-website/wedding-website.tsx)
-- already calls resolveTheme(site.theme, site.themePalette) and already
-- falls back to site.sectionOrder when present; only the data was missing.
-- fontPairing is restored here too for data parity with get_my_website and
-- the PublicWebsite type, but resolveTheme() has no logic to consume it —
-- making it visually apply is a deferred enhancement, not part of this fix.
--
-- Also drops the now-superseded 2-parameter overload
-- (get_wedding_website(text, text)) that has coexisted with the current
-- 4-parameter version since CREATE OR REPLACE only replaces exact
-- signature matches — every added parameter created a new overload
-- instead of replacing the old one. The real app always calls the
-- 4-parameter form, but the dead 2-parameter overload is a live landmine
-- for any future caller passing a partial argument set (confirmed live:
-- it produces an unresolvable "ambiguous function" PGRST203 error).
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
    'themePalette',   v_site.theme_palette,
    'fontPairing',    v_site.font_pairing,
    'sectionOrder',   v_site.section_order,
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

grant execute on function public.get_wedding_website(text, text, text, text) to anon, authenticated;

drop function if exists public.get_wedding_website(text, text);

notify pgrst, 'reload schema';
