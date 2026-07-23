-- ============================================================================
-- Wedding website builder — Travel & Hotels should suggest from what the
-- venue already entered (client portal feedback, 2026-07-22): the venue's
-- own hotel_blocks/transportation fields (venue_operational_info, Sprint
-- 75) were never read into get_website_suggestions() at all — Travel &
-- Hotels was the one guided section with zero sync source, unlike Event
-- (venue name/address) and Story (couple_profiles.our_story).
--
-- Redefines get_website_suggestions() adding a `travel` key, same
-- read-only/security-definer shape as the rest of the function — no new
-- write path, no change to any other key it already returns.
-- ============================================================================

create or replace function public.get_website_suggestions(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_session  public.client_portal_sessions%rowtype;
  v_client   public.clients%rowtype;
  v_profile  public.couple_profiles%rowtype;
  v_event    record;
  v_venue    public.venues%rowtype;
  v_photos   jsonb;
  v_opinfo   public.venue_operational_info%rowtype;
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

  -- Primary event for this session (stable — see PART A above)
  select e.id, e.name, e.event_date, e.event_type
  into v_event
  from public.events e
  where e.id = coalesce(v_session.event_id, public._current_event_for_client(v_session.client_id, v_session.venue_id));

  -- Venue
  select * into v_venue from public.venues where id = v_session.venue_id;

  -- Venue-entered operational info (hotel blocks, transportation) — Sprint 75
  select * into v_opinfo from public.venue_operational_info where venue_id = v_session.venue_id;

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
    'engagementPhotos', v_photos,

    -- Travel & Hotels — only present when the venue actually entered
    -- something, same "null means nothing to suggest" convention as story/event.
    'travel', case
      when v_opinfo.id is not null and (
        jsonb_array_length(coalesce(v_opinfo.hotel_blocks, '[]'::jsonb)) > 0
        or (v_opinfo.transportation is not null and trim(v_opinfo.transportation) != '')
      ) then jsonb_build_object(
        'hotels', coalesce(v_opinfo.hotel_blocks, '[]'::jsonb),
        'transportation', case
          when v_opinfo.transportation is not null and trim(v_opinfo.transportation) != ''
            then jsonb_build_object('notes', v_opinfo.transportation)
          else null
        end
      )
      else null
    end
  );
end;
$$;

notify pgrst, 'reload schema';
