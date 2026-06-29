-- ============================================================================
-- Sprint 52: Wedding Website Foundation
--
-- "The Wedding Website is not a separate product.
--  It is the public expression of the couple's private planning workspace."
--
-- One source of truth:
--   Couple Portal → Website Settings → Public Website → Guest Responses →
--   Updated Guest Data → Venue Intelligence → Luv Insights
--
-- Architecture: the website is another surface on existing data.
--   - RSVP uses couple_guests (already built)
--   - Event details use events table (already built)
--   - Custom content stored in couple_websites.content JSONB
--
-- Public URL: /w/{slug} (e.g., /w/emily-and-james-2027)
-- ============================================================================

create table public.couple_websites (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues(id) on delete cascade,
  client_id   uuid not null references public.clients(id) on delete cascade,

  -- Public URL slug (couple-chosen, globally unique)
  slug        text unique check (
    slug ~ '^[a-z0-9][a-z0-9-]{2,62}[a-z0-9]$'  -- lowercase alphanumeric + hyphens
  ),

  -- Visibility
  is_published  boolean not null default false,
  password      text,   -- null = no password; bcrypt or plain text (compare in function)

  -- Customization
  theme         text not null default 'classic'
    check (theme in ('classic', 'modern', 'garden', 'minimal')),
  accent_color  text not null default '#5D6F5D',  -- default: Heritage Sage

  -- Page content as JSONB (couples edit sections individually via portal)
  -- Structure:
  -- {
  --   home:     { title, subtitle, welcomeMessage, coverImageUrl },
  --   event:    { ceremony: { time, location, address }, reception: { time, location, address } },
  --   schedule: [{ time: "4:00 PM", title: "Ceremony", description }],
  --   travel:   { message, hotels: [{ name, url, code, notes }], transportation: { notes } },
  --   registry: [{ name, url, notes }],
  --   faq:      [{ question, answer }]
  -- }
  content     jsonb not null default '{}'::jsonb,

  -- Which sections are visible on the public website
  -- Default: all sections enabled once content is added
  sections_enabled  text[] not null default array['home','event','schedule','travel','registry','faq','rsvp'],

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- RLS: venue owner reads for dashboard context; couple writes via SECURITY DEFINER
alter table public.couple_websites enable row level security;

create policy "venue owner reads couple websites"
  on public.couple_websites for select
  using (exists (
    select 1 from public.venues
    where id = couple_websites.venue_id
      and owner_user_id = auth.uid()
  ));

grant select on public.couple_websites to authenticated;

create index couple_websites_client on public.couple_websites (client_id);
create unique index couple_websites_slug on public.couple_websites (slug);

-- ── SECURITY DEFINER: public website access ───────────────────────────────────

-- get_wedding_website: returns public content for a published website
-- Called by the public /w/{slug} route — no authentication required
create or replace function public.get_wedding_website(p_slug text, p_password text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_site   public.couple_websites%rowtype;
  v_event  record;
  v_client public.clients%rowtype;
  v_guests record;
begin
  select * into v_site
  from public.couple_websites
  where slug = p_slug and is_published = true;

  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  -- Password check (plain comparison for now — hash in future sprint)
  if v_site.password is not null then
    if p_password is null or v_site.password != p_password then
      return jsonb_build_object('requires_password', true);
    end if;
  end if;

  -- Fetch supporting data
  select * into v_client from public.clients where id = v_site.client_id;
  select e.id, e.name, e.event_date, e.event_type, e.guest_count,
         e.setup_time, e.teardown_time
  into v_event
  from public.events e
  where e.client_id = v_site.client_id and e.venue_id = v_site.venue_id
    and e.status not in ('cancelled')
  order by e.event_date asc limit 1;

  -- Guest RSVP stats (counts only — names stay private)
  select count(*) as total,
         count(*) filter (where rsvp_status = 'attending') as attending,
         count(*) filter (where rsvp_status = 'pending') as pending
  into v_guests
  from public.couple_guests
  where client_id = v_site.client_id and venue_id = v_site.venue_id;

  return jsonb_build_object(
    'siteId',         v_site.id,
    'slug',           v_site.slug,
    'theme',          v_site.theme,
    'accentColor',    v_site.accent_color,
    'sectionsEnabled', v_site.sections_enabled,
    'content',        v_site.content,
    'couple', jsonb_build_object(
      'firstName',        v_client.first_name,
      'lastName',         v_client.last_name,
      'partnerFirstName', v_client.partner_first_name,
      'partnerLastName',  v_client.partner_last_name
    ),
    'event', case when v_event.id is not null then jsonb_build_object(
      'id',        v_event.id,
      'name',      v_event.name,
      'eventDate', v_event.event_date,
      'eventType', v_event.event_type
    ) else null end,
    'rsvpStats', jsonb_build_object(
      'total',     v_guests.total,
      'attending', v_guests.attending,
      'pending',   v_guests.pending
    )
  );
end;
$$;

-- get_my_website: couple reads their own website via portal token
create or replace function public.get_my_website(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
  v_site    public.couple_websites%rowtype;
begin
  select * into v_session from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('error', 'invalid_token'); end if;

  select * into v_site
  from public.couple_websites
  where client_id = v_session.client_id and venue_id = v_session.venue_id;

  if not found then
    return jsonb_build_object('exists', false);
  end if;

  return jsonb_build_object(
    'exists',          true,
    'id',              v_site.id,
    'slug',            v_site.slug,
    'isPublished',     v_site.is_published,
    'hasPassword',     v_site.password is not null,
    'theme',           v_site.theme,
    'accentColor',     v_site.accent_color,
    'sectionsEnabled', v_site.sections_enabled,
    'content',         v_site.content
  );
end;
$$;

-- update_my_website: couple updates their website settings and content
create or replace function public.update_my_website(
  p_token           text,
  p_slug            text default null,
  p_is_published    boolean default null,
  p_password        text default null,
  p_clear_password  boolean default false,
  p_theme           text default null,
  p_accent_color    text default null,
  p_content_key     text default null,   -- which section to update ('home', 'event', etc.)
  p_content_value   jsonb default null,  -- content for that section
  p_sections_enabled text[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
  v_site_id uuid;
begin
  select * into v_session from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;

  -- Upsert the website record
  insert into public.couple_websites (venue_id, client_id, slug)
  values (v_session.venue_id, v_session.client_id,
          coalesce(p_slug, 'wedding-' || left(gen_random_uuid()::text, 8)))
  on conflict (client_id) do update
    set updated_at = now()
  returning id into v_site_id;

  -- Apply updates
  if p_slug is not null then
    -- eslint: slug already unique-constrained
    update public.couple_websites set slug = p_slug, updated_at = now()
    where id = v_site_id;
  end if;

  if p_is_published is not null then
    update public.couple_websites set is_published = p_is_published, updated_at = now()
    where id = v_site_id;
  end if;

  if p_clear_password then
    update public.couple_websites set password = null, updated_at = now()
    where id = v_site_id;
  elsif p_password is not null then
    update public.couple_websites set password = p_password, updated_at = now()
    where id = v_site_id;
  end if;

  if p_theme is not null then
    update public.couple_websites set theme = p_theme, updated_at = now()
    where id = v_site_id;
  end if;

  if p_accent_color is not null then
    update public.couple_websites set accent_color = p_accent_color, updated_at = now()
    where id = v_site_id;
  end if;

  if p_content_key is not null and p_content_value is not null then
    update public.couple_websites
    set content = jsonb_set(content, array[p_content_key], p_content_value),
        updated_at = now()
    where id = v_site_id;
  end if;

  if p_sections_enabled is not null then
    update public.couple_websites
    set sections_enabled = p_sections_enabled, updated_at = now()
    where id = v_site_id;
  end if;

  return jsonb_build_object('ok', true, 'siteId', v_site_id);
end;
$$;

grant execute on function public.get_wedding_website(text, text) to anon, authenticated;
grant execute on function public.get_my_website(text) to anon, authenticated;
grant execute on function public.update_my_website(text, text, boolean, text, boolean, text, text, text, jsonb, text[]) to anon, authenticated;

notify pgrst, 'reload schema';
