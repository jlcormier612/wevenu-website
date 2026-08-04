-- ============================================================================
-- Event date ranges (start + optional end).
--
-- events.event_date remains the start day. event_end_date is nullable:
-- NULL or equal to event_date means a single-day event. Vendor Booked
-- availability (source=event) expands to every calendar day in the range;
-- the previous unique (vendor_id, source_id) only allowed one row per
-- assignment, so it becomes (vendor_id, source_id, date).
-- ============================================================================

alter table public.events
  add column if not exists event_end_date date;

alter table public.events
  drop constraint if exists events_event_end_date_ck;

alter table public.events
  add constraint events_event_end_date_ck
  check (event_end_date is null or event_end_date >= event_date);

comment on column public.events.event_end_date is
  'Last calendar day of a multi-day event. Null (or equal to event_date) = single-day.';

create index if not exists events_venue_end_date_idx
  on public.events (venue_id, event_end_date)
  where event_end_date is not null;

-- Multi-day Booked rows: one vendor_availability row per day per assignment.
drop index if exists public.vendor_availability_event_source_uidx;

create unique index vendor_availability_event_source_uidx
  on public.vendor_availability (vendor_id, source_id, date)
  where source = 'event' and source_id is not null;

-- ── Vendor event list ───────────────────────────────────────────────────────

create or replace function public.get_vendor_events()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor_id uuid;
  v_today date := current_date;
begin
  v_vendor_id := current_user_vendor_id();
  if v_vendor_id is null then
    return '{"error":"unauthorized"}'::jsonb;
  end if;

  return jsonb_build_object(
    'events', coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'assignment_id', eva.id, 'event_id', e.id, 'event_name', e.name,
          'event_date', e.event_date,
          'event_end_date', e.event_end_date,
          'venue_id', v.id, 'venue_name', v.name,
          'arrival_time', eva.arrival_time,
          'is_upcoming', (
            coalesce(e.event_end_date, e.event_date) is not null
            and coalesce(e.event_end_date, e.event_date) >= v_today
          )
        ) order by e.event_date desc nulls last)
        from public.event_vendor_assignments eva
        join public.events e on e.id = eva.event_id
        join public.venues v on v.id = e.venue_id
        where eva.vendor_id = v_vendor_id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.get_vendor_events() to authenticated;

-- ── Vendor event detail ─────────────────────────────────────────────────────

create or replace function public.get_vendor_event_detail(p_assignment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor_id uuid;
  v_event_id  uuid;
  v_client_id uuid;
begin
  v_vendor_id := current_user_vendor_id();
  if v_vendor_id is null then
    return null;
  end if;

  if not exists (
    select 1 from public.event_vendor_assignments
    where id = p_assignment_id and vendor_id = v_vendor_id
  ) then
    return null;
  end if;

  select e.id into v_event_id
  from public.event_vendor_assignments eva
  join public.events e on e.id = eva.event_id
  where eva.id = p_assignment_id;

  select client_id into v_client_id from public.events where id = v_event_id;

  return jsonb_build_object(
    'assignment', (
      select jsonb_build_object(
        'id', eva.id, 'event_id', eva.event_id,
        'arrival_time', eva.arrival_time, 'setup_location', eva.setup_location,
        'load_in_notes', eva.load_in_notes, 'internal_notes', eva.internal_notes,
        'notes', eva.notes, 'checked_in_at', eva.checked_in_at,
        'setup_complete_at', eva.setup_complete_at,
        'share_couple_email', eva.share_couple_email, 'share_couple_phone', eva.share_couple_phone,
        'agreed_fee', eva.agreed_fee, 'payment_status', eva.payment_status
      )
      from public.event_vendor_assignments eva where eva.id = p_assignment_id
    ),
    'event', (
      select jsonb_build_object(
        'id', e.id, 'name', e.name,
        'event_date', e.event_date, 'event_end_date', e.event_end_date,
        'event_type', e.event_type,
        'venue_id', e.venue_id, 'venue_name', v.name
      )
      from public.events e
      join public.venues v on v.id = e.venue_id
      where e.id = v_event_id
    ),
    'client', (
      select jsonb_build_object(
        'first_name', c.first_name, 'last_name', c.last_name,
        'partner_first_name', c.partner_first_name, 'partner_last_name', c.partner_last_name,
        'email', c.email, 'phone', c.phone
      )
      from public.clients c where c.id = v_client_id
    ),
    'timeline', coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'id', t.id, 'entry_time', t.entry_time, 'title', t.title,
          'description', t.description, 'audiences', t.audiences
        ) order by t.entry_time nulls last)
        from public.timeline_entries t
        where t.event_id = v_event_id and t.audiences @> array['vendors']
      ),
      '[]'::jsonb
    ),
    'event_tasks', coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'id', et.id, 'title', et.title, 'description', et.description,
          'category', et.category, 'visibility', et.visibility, 'due_date', et.due_date,
          'status', et.status, 'is_required', et.is_required, 'completed_at', et.completed_at
        ))
        from public.event_tasks et
        where et.event_id = v_event_id and et.visibility in ('vendor_visible', 'vendor_owned')
      ),
      '[]'::jsonb
    ),
    'documents', coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'id', d.id, 'name', d.name, 'category', d.category,
          'storage_url', d.storage_url, 'mime_type', d.mime_type, 'notes', d.notes,
          'created_at', d.created_at
        ) order by d.created_at desc)
        from public.documents d
        where d.event_id = v_event_id and d.shared_with_vendors = true
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.get_vendor_event_detail(uuid) to authenticated;

-- ── Cross-event Documents / Timeline ────────────────────────────────────────

create or replace function public.get_vendor_documents()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor_id uuid;
begin
  v_vendor_id := current_user_vendor_id();
  if v_vendor_id is null then
    return '{"error":"unauthorized"}'::jsonb;
  end if;

  return jsonb_build_object(
    'events', coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'assignmentId', ev.id, 'eventId', ev.event_id, 'eventName', e.name,
          'eventDate', e.event_date, 'eventEndDate', e.event_end_date,
          'venueName', v.name,
          'documents', coalesce(
            (
              select jsonb_agg(jsonb_build_object(
                'id', d.id, 'name', d.name, 'category', d.category,
                'storageUrl', d.storage_url, 'mimeType', d.mime_type, 'notes', d.notes
              ))
              from public.documents d
              where d.event_id = ev.event_id and d.shared_with_vendors = true
            ),
            '[]'::jsonb
          ),
          'floorPlans', coalesce(
            (
              select jsonb_agg(jsonb_build_object('id', fp.id, 'name', fp.name))
              from public.floor_plans fp
              where fp.event_id = ev.event_id and fp.shared_with_vendors = true
            ),
            '[]'::jsonb
          )
        ) order by e.event_date desc nulls last)
        from public.event_vendor_assignments ev
        join public.events e on e.id = ev.event_id
        join public.venues v on v.id = e.venue_id
        where ev.vendor_id = v_vendor_id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

create or replace function public.get_vendor_timeline()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor_id uuid;
begin
  v_vendor_id := current_user_vendor_id();
  if v_vendor_id is null then
    return '{"error":"unauthorized"}'::jsonb;
  end if;

  return jsonb_build_object(
    'events', coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'assignmentId', ev.id, 'eventId', ev.event_id, 'eventName', e.name,
          'eventDate', e.event_date, 'eventEndDate', e.event_end_date,
          'venueName', v.name,
          'entries', coalesce(
            (
              select jsonb_agg(jsonb_build_object(
                'id', t.id, 'time', t.entry_time, 'title', t.title, 'description', t.description
              ) order by t.entry_time nulls last)
              from public.timeline_entries t
              where t.event_id = ev.event_id and t.audiences @> array['vendors']
            ),
            '[]'::jsonb
          )
        ) order by e.event_date nulls last)
        from public.event_vendor_assignments ev
        join public.events e on e.id = ev.event_id
        join public.venues v on v.id = e.venue_id
        where ev.vendor_id = v_vendor_id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.get_vendor_documents() to authenticated;
grant execute on function public.get_vendor_timeline() to authenticated;

-- ── Couple portal context ───────────────────────────────────────────────────

create or replace function public.get_portal_context(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session   public.client_portal_sessions%rowtype;
  v_client    public.clients%rowtype;
  v_event     record;
  v_venue     public.venues%rowtype;
  v_contact   public.client_contacts%rowtype;
begin
  select * into v_session
  from public.client_portal_sessions
  where access_token = p_token
    and (expires_at is null or expires_at > now());
  if not found then
    return jsonb_build_object('error', 'invalid_token');
  end if;
  update public.client_portal_sessions set last_accessed_at = now() where id = v_session.id;
  select * into v_client from public.clients where id = v_session.client_id;
  select e.id, e.event_date, e.event_end_date, e.event_type, e.status, e.name as event_name, e.guest_count, e.setup_time
  into v_event
  from public.events e
  where e.id = coalesce(v_session.event_id, public._current_event_for_client(v_session.client_id, v_session.venue_id));
  select * into v_venue from public.venues where id = v_session.venue_id;
  if v_session.contact_id is not null then
    select * into v_contact from public.client_contacts where id = v_session.contact_id;
  end if;

  return jsonb_build_object(
    'sessionId',   v_session.id,
    'accessLevel', coalesce(v_contact.portal_role, v_session.access_level),
    'label',       coalesce(
      v_session.label,
      case when v_contact.id is not null
        then coalesce(v_contact.role_label, v_contact.first_name)
        else v_client.first_name || ' & ' || coalesce(v_client.partner_first_name, '')
      end
    ),
    'client', jsonb_build_object(
      'id', v_client.id, 'firstName', v_client.first_name, 'lastName', v_client.last_name,
      'partnerFirstName', v_client.partner_first_name, 'partnerLastName', v_client.partner_last_name,
      'eventType', v_client.event_type
    ),
    'contact', case when v_contact.id is not null then jsonb_build_object(
      'id', v_contact.id, 'firstName', v_contact.first_name, 'lastName', v_contact.last_name,
      'roleLabel', v_contact.role_label, 'portalRole', v_contact.portal_role
    ) else null end,
    'event', case when v_event.id is not null then jsonb_build_object(
      'id', v_event.id, 'eventDate', v_event.event_date, 'eventEndDate', v_event.event_end_date,
      'eventType', v_event.event_type,
      'name', v_event.event_name, 'guestCount', v_event.guest_count, 'setupTime', v_event.setup_time
    ) else null end,
    'venue', jsonb_build_object(
      'id', v_venue.id, 'name', v_venue.name, 'website', v_venue.website,
      'primaryColor', v_venue.primary_color, 'secondaryColor', v_venue.secondary_color,
      'accentColor', v_venue.accent_color, 'neutralColor', v_venue.neutral_color,
      'logoUrl', v_venue.logo_url,
      'heroImageUrl', v_venue.hero_image_url, 'story', v_venue.story,
      'phone', v_venue.phone, 'email', v_venue.email,
      'addressLine1', v_venue.address_line1, 'addressLine2', v_venue.address_line2,
      'city', v_venue.city, 'stateRegion', v_venue.state_region, 'postalCode', v_venue.postal_code
    )
  );
end;
$$;

grant execute on function public.get_portal_context(text) to authenticated;
grant execute on function public.get_portal_context(text) to anon;

-- ── Public wedding website (event end date for multi-day display) ───────────

create or replace function public.get_wedding_website(
  p_slug text, p_password text default null::text, p_session_id text default null::text,
  p_page text default 'home'::text, p_preview_token text default null::text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_site    public.couple_websites%rowtype;
  v_version public.experience_versions%rowtype;
  v_event   record;
  v_client  public.clients%rowtype;
  v_venue   public.venues%rowtype;
  v_guests  record;
  v_views   bigint;
  v_schedule jsonb;
  v_theme        text;
  v_theme_palette text;
  v_font_pairing text;
  v_accent_color text;
  v_schedule_sync boolean;
  v_sections_meta jsonb;
  v_content jsonb;
  v_is_preview boolean := false;
  v_layout_config jsonb;
  v_color_tokens jsonb;
  v_typography_tokens jsonb;
  v_photo_style_tokens jsonb;
begin
  select * into v_site from public.couple_websites where slug = p_slug;
  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  if p_preview_token is not null and v_site.preview_token::text = p_preview_token then
    v_is_preview := true;
  elsif v_site.status not in ('published', 'archived') then
    return jsonb_build_object('error', 'not_found');
  end if;

  if not v_is_preview and v_site.password is not null then
    if p_password is null or v_site.password != p_password then
      return jsonb_build_object('requires_password', true);
    end if;
  end if;

  if not v_is_preview then
    select * into v_version from public.experience_versions where id = v_site.current_version_id;
  end if;

  if v_is_preview or not found then
    select coalesce(c.key, v_site.theme), coalesce(cs.name, v_site.theme_palette), coalesce(ts.key, v_site.font_pairing),
           c.layout_config, cs.tokens, ts.tokens
    into v_theme, v_theme_palette, v_font_pairing, v_layout_config, v_color_tokens, v_typography_tokens
    from (select 1) dummy
    left join public.collections c on c.id = v_site.collection_id
    left join public.color_stories cs on cs.id = v_site.color_story_id
    left join public.typography_styles ts on ts.id = v_site.typography_style_id;
    v_accent_color := v_site.accent_color;
    v_schedule_sync := v_site.schedule_sync;

    select ps.tokens into v_photo_style_tokens from public.photo_styles ps where ps.id = v_site.photo_style_id;

    select coalesce(jsonb_agg(jsonb_build_object(
      'key', es.section_key, 'title', es.title, 'owner', es.owner, 'syncMode', es.sync_mode, 'sortOrder', es.sort_order
    ) order by es.sort_order), '[]'::jsonb),
    coalesce(jsonb_object_agg(es.section_key, es.content) filter (where es.content is not null), '{}'::jsonb)
    into v_sections_meta, v_content
    from public.experience_sections es
    where es.experience_id = v_site.id and es.visibility <> 'hidden';
  else
    v_theme         := v_version.snapshot ->> 'theme';
    v_theme_palette := v_version.snapshot ->> 'themePalette';
    v_font_pairing  := v_version.snapshot ->> 'fontPairing';
    v_accent_color  := v_version.snapshot ->> 'accentColor';
    v_schedule_sync := (v_version.snapshot ->> 'scheduleSync')::boolean;
    v_layout_config := (select c.layout_config from public.collections c where c.id = v_site.collection_id);
    v_color_tokens  := (select cs.tokens from public.color_stories cs where cs.id = v_site.color_story_id);
    v_typography_tokens := (select ts.tokens from public.typography_styles ts where ts.id = v_site.typography_style_id);
    v_photo_style_tokens := (select ps.tokens from public.photo_styles ps where ps.id = v_site.photo_style_id);

    select coalesce(jsonb_agg(jsonb_build_object(
      'key', s.key, 'title', s.title, 'owner', s.owner, 'syncMode', s."syncMode", 'sortOrder', s."sortOrder"
    ) order by s."sortOrder"), '[]'::jsonb),
    coalesce(jsonb_object_agg(s.key, s.content) filter (where s.content is not null), '{}'::jsonb)
    into v_sections_meta, v_content
    from jsonb_to_recordset(v_version.snapshot -> 'sections')
      as s(key text, title text, owner text, "syncMode" text, "sortOrder" int, content jsonb, visibility text)
    where s.visibility is distinct from 'hidden';
  end if;

  select coalesce(count(*) filter (where rsvp_status = 'attending'), 0) as attending,
         coalesce(count(*), 0) as total
  into v_guests
  from public.couple_guests where client_id = v_site.client_id;

  select e.id, e.event_date, e.event_end_date, e.event_type, e.name, e.guest_count into v_event
  from public.events e where e.client_id = v_site.client_id and e.venue_id = v_site.venue_id
  order by e.event_date limit 1;

  select c.* into v_client from public.clients c where c.id = v_site.client_id;

  select v.* into v_venue from public.venues v where v.id = v_site.venue_id;

  select count(*) into v_views from public.couple_website_views where website_id = v_site.id;

  return jsonb_build_object(
    'siteId', v_site.id, 'slug', v_site.slug, 'status', v_site.status, 'isPreview', v_is_preview,
    'requires_password', false,
    'theme', v_theme, 'themePalette', v_theme_palette, 'fontPairing', v_font_pairing,
    'accentColor', v_accent_color, 'scheduleSync', v_schedule_sync,
    'layoutConfig', coalesce(v_layout_config, '{}'::jsonb),
    'colorTokens', v_color_tokens,
    'typographyTokens', v_typography_tokens,
    'photoStyleTokens', v_photo_style_tokens,
    'colorPrimary', v_site.color_primary, 'colorSecondary', v_site.color_secondary,
    'colorAccent', v_site.color_accent, 'colorNeutral', v_site.color_neutral,
    'colorBackground', v_site.color_background, 'colorText', v_site.color_text,
    'sectionOrder', v_site.section_order,
    'sections', v_sections_meta,
    'content', v_content,
    'couple', jsonb_build_object(
      'firstName', v_client.first_name, 'lastName', v_client.last_name,
      'partnerFirstName', v_client.partner_first_name, 'partnerLastName', v_client.partner_last_name
    ),
    'venue', case when v_venue.id is not null then jsonb_build_object(
      'name', v_venue.name, 'heroImageUrl', v_venue.hero_image_url, 'story', v_venue.story
    ) else null end,
    'event', case when v_event.id is not null then jsonb_build_object(
      'id', v_event.id, 'eventDate', v_event.event_date, 'eventEndDate', v_event.event_end_date,
      'eventType', v_event.event_type,
      'name', v_event.name, 'guestCount', v_event.guest_count
    ) else null end,
    'rsvpStats', jsonb_build_object('attending', v_guests.attending, 'total', v_guests.total),
    'totalViews', coalesce(v_views, 0)
  );
end;
$function$;

notify pgrst, 'reload schema';
