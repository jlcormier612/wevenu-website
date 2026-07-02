-- ============================================================================
-- Sprint 68.5: Wedding Website Pre-Population
--
-- "The website should feel half-finished before they ever touch it."
--
-- Adds get_website_suggestions(p_token) — a single function that collects
-- everything the platform already knows and surfaces it as a suggestions
-- object for the Website Studio to display on first open.
--
-- Sources:
--   clients           → couple names
--   couple_profiles   → our_story text, wedding_hashtag
--   events            → event date, event name
--   venues            → venue name, address, city, state, website
--   client_media      → engagement photos (first = suggested cover photo)
-- ============================================================================

create or replace function public.get_website_suggestions(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session  public.client_portal_sessions%rowtype;
  v_client   public.clients%rowtype;
  v_profile  public.couple_profiles%rowtype;
  v_event    record;
  v_venue    public.venues%rowtype;
  v_photos   jsonb;
begin
  select * into v_session
  from public.client_portal_sessions
  where access_token = p_token
    and (expires_at is null or expires_at > now());
  if not found then return null; end if;

  -- Couple names
  select * into v_client from public.clients where id = v_session.client_id;

  -- Personal profile (our_story, hashtag)
  select * into v_profile
  from public.couple_profiles
  where client_id = v_session.client_id;

  -- Primary upcoming/active event
  select e.id, e.name, e.event_date, e.event_type
  into v_event
  from public.events e
  where e.client_id = v_session.client_id
    and e.venue_id  = v_session.venue_id
    and e.status not in ('cancelled')
  order by e.event_date asc
  limit 1;

  -- Venue
  select * into v_venue from public.venues where id = v_session.venue_id;

  -- Engagement photos (up to 12, ordered oldest-first so the earliest = most
  -- likely intended hero; couple can pick any)
  select coalesce(jsonb_agg(
    jsonb_build_object('url', cm.file_url, 'id', cm.id)
    order by cm.created_at asc
  ), '[]'::jsonb)
  into v_photos
  from public.client_media cm
  where cm.client_id  = v_session.client_id
    and cm.media_type = 'image'
    and cm.category   = 'engagement';

  return jsonb_build_object(
    -- "Emily & James" — used as default website headline
    'coupleNames', case
      when v_client.first_name is not null and v_client.partner_first_name is not null
        then v_client.first_name || ' & ' || v_client.partner_first_name
      when v_client.first_name is not null
        then v_client.first_name
      else null
    end,

    -- Story text from couple profile
    'story', case
      when v_profile.our_story is not null and trim(v_profile.our_story) != ''
        then jsonb_build_object('text', v_profile.our_story)
      else null
    end,

    -- Hashtag
    'hashtag', v_profile.wedding_hashtag,

    -- Event details
    'event', case when v_event.event_date is not null then jsonb_build_object(
      'name',      v_event.name,
      'eventDate', v_event.event_date,
      'eventType', v_event.event_type
    ) else null end,

    -- Venue details
    'venue', jsonb_build_object(
      'name',    v_venue.name,
      'address', trim(concat_ws(', ',
                   v_venue.address_line1,
                   v_venue.address_line2
                 )),
      'city',    v_venue.city,
      'state',   v_venue.state_region,
      'website', v_venue.website
    ),

    -- Engagement photos — first entry is the suggested cover photo
    'engagementPhotos', v_photos
  );
end;
$$;

grant execute on function public.get_website_suggestions(text) to anon, authenticated;

notify pgrst, 'reload schema';
