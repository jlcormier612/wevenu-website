-- ============================================================================
-- Sprint 55: Website Analytics & Photo Storage Foundation
--
-- 1. couple_website_views — every guest visit to the public wedding website.
--    Even simple analytics feel exciting:
--    "✨ Your website has been visited 52 times."
--    "💌 14 guests have viewed your schedule."
--
-- 2. Update get_wedding_website() to log views and return view count.
--
-- 3. Create couple-media storage bucket for photo uploads.
--    Cover photos and couple photos stored under:
--    couple-media/{venue_id}/{client_id}/{filename}
-- ============================================================================

-- ── 1. Website view events ────────────────────────────────────────────────────

create table public.couple_website_views (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues(id) on delete cascade,
  client_id   uuid not null references public.clients(id) on delete cascade,
  website_id  uuid not null references public.couple_websites(id) on delete cascade,

  viewed_at   timestamptz not null default now(),
  page        text not null default 'home',  -- home | rsvp | schedule | travel | etc.
  referrer    text,                           -- referring URL if available
  session_id  text,                           -- client-generated UUID per browser session
  guest_token text                            -- rsvp_token if guest is identified
);

alter table public.couple_website_views enable row level security;

create policy "venue owner reads website views"
  on public.couple_website_views for select
  using (exists (
    select 1 from public.venues
    where id = couple_website_views.venue_id
      and owner_user_id = auth.uid()
  ));

grant select on public.couple_website_views to authenticated;

-- Index for analytics queries
create index website_views_website on public.couple_website_views (website_id, viewed_at desc);
create index website_views_recent  on public.couple_website_views (venue_id, viewed_at desc);

-- ── 2. Update get_wedding_website to log views and return count ───────────────

create or replace function public.get_wedding_website(p_slug text, p_password text default null, p_session_id text default null, p_page text default 'home')
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

  -- Log the view (non-critical)
  begin
    insert into public.couple_website_views (venue_id, client_id, website_id, page, session_id)
    values (v_site.venue_id, v_site.client_id, v_site.id, p_page, p_session_id);
  exception when others then null;
  end;

  -- Total unique sessions (approximate unique visitors)
  select count(distinct coalesce(session_id, id::text)) into v_views
  from public.couple_website_views
  where website_id = v_site.id;

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

  return jsonb_build_object(
    'siteId',         v_site.id,
    'slug',           v_site.slug,
    'theme',          v_site.theme,
    'accentColor',    v_site.accent_color,
    'sectionsEnabled', v_site.sections_enabled,
    'content',        v_site.content,
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

-- Also add a function to get view stats for the couple's portal
create or replace function public.get_website_analytics(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
  v_site    public.couple_websites%rowtype;
  v_total   bigint;
  v_today   bigint;
  v_week    bigint;
begin
  select * into v_session from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('error', 'invalid_token'); end if;

  select * into v_site
  from public.couple_websites
  where client_id = v_session.client_id and venue_id = v_session.venue_id;
  if not found then return jsonb_build_object('totalViews', 0, 'todayViews', 0, 'weekViews', 0); end if;

  select count(distinct coalesce(session_id, id::text)) into v_total
  from public.couple_website_views where website_id = v_site.id;

  select count(distinct coalesce(session_id, id::text)) into v_today
  from public.couple_website_views
  where website_id = v_site.id and viewed_at >= current_date;

  select count(distinct coalesce(session_id, id::text)) into v_week
  from public.couple_website_views
  where website_id = v_site.id and viewed_at >= current_date - 7;

  return jsonb_build_object('totalViews', v_total, 'todayViews', v_today, 'weekViews', v_week);
end;
$$;

grant execute on function public.get_wedding_website(text, text, text, text) to anon, authenticated;
grant execute on function public.get_website_analytics(text) to anon, authenticated;

-- ── 3. Supabase Storage: couple-media bucket ──────────────────────────────────
-- Run via Supabase Dashboard or CLI after migration.
-- bucket name: couple-media
-- public: true (photos are on a public website)
-- file size limit: 10MB
-- allowed MIME types: image/jpeg, image/png, image/webp, image/gif

-- Note: Storage bucket creation happens via Supabase Dashboard → Storage → New bucket
-- or via: supabase storage create couple-media --public
-- This migration documents the intent; the bucket is created separately.

notify pgrst, 'reload schema';
