-- ============================================================================
-- Sprint 62: Client Media — Architecture Reservation
--
-- Couples upload photos throughout their planning journey:
--   engagement photos, inspiration images, venue visit moments,
--   dress shopping, color palette screenshots, memories.
--
-- Three visibility scopes (couple controls):
--   private  — visible only to the couple and invited participants
--   venue    — visible to couple + their venue coordinator
--   website  — visible on their public wedding website
--
-- This reservation unlocks future:
--   wedding website galleries, memory timelines, anniversary recaps,
--   AI-generated memory books, venue recognition, Luv visual context.
-- ============================================================================

create table public.client_media (
  id                      uuid primary key default gen_random_uuid(),
  venue_id                uuid not null references public.venues(id) on delete cascade,
  client_id               uuid not null references public.clients(id) on delete cascade,

  -- Who uploaded it (null = primary couple portal session)
  uploaded_by_contact_id  uuid references public.client_contacts(id) on delete set null,

  -- Storage
  file_url                text not null,
  file_name               text,
  file_size_bytes         bigint,
  mime_type               text,
  media_type              text not null default 'image' check (media_type in ('image', 'video', 'document')),

  -- Visibility — the couple controls this
  visibility              text not null default 'private' check (visibility in (
    'private',   -- couple + invited participants only
    'venue',     -- couple + venue coordinator
    'website'    -- public on their wedding website
  )),

  -- Category for organizing and surfacing contextually
  category                text check (category in (
    'engagement',   -- engagement photos
    'inspiration',  -- mood boards, color palettes, dress screenshots
    'memory',       -- planning journey moments
    'gallery',      -- formal wedding website gallery
    'venue_visit',  -- venue tour photos
    'dress',        -- dress/suit shopping moments
    'other'
  )),

  caption                 text,
  sort_order              integer not null default 0,
  created_at              timestamptz not null default now()
);

-- Couple owns their media — venue can only see what couple explicitly shares
alter table public.client_media enable row level security;

-- Venue can see media the couple has set to 'venue' or 'website' visibility
create policy "venue owner sees shared media"
  on public.client_media for select
  using (
    visibility in ('venue', 'website')
    and exists (
      select 1 from public.venues
      where id = client_media.venue_id
        and owner_user_id = auth.uid()
    )
  );

grant select on public.client_media to authenticated;

create index cm_client          on public.client_media (client_id, created_at desc);
create index cm_client_category on public.client_media (client_id, category);
create index cm_website_gallery on public.client_media (client_id) where visibility = 'website';

-- get_couple_media: returns media for this portal session, filtered by visibility
create or replace function public.get_couple_media(p_token text, p_category text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
begin
  select * into v_session from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('error', 'invalid_token'); end if;

  return jsonb_build_object(
    'media', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',         m.id,
          'fileUrl',    m.file_url,
          'fileName',   m.file_name,
          'mediaType',  m.media_type,
          'visibility', m.visibility,
          'category',   m.category,
          'caption',    m.caption,
          'createdAt',  m.created_at
        ) order by m.sort_order, m.created_at desc
      )
      from public.client_media m
      where m.client_id = v_session.client_id
        and m.venue_id  = v_session.venue_id
        and (p_category is null or m.category = p_category)
    ), '[]'::jsonb)
  );
end;
$$;

-- add_couple_media: couple uploads a photo
create or replace function public.add_couple_media(
  p_token      text,
  p_file_url   text,
  p_file_name  text,
  p_mime_type  text,
  p_media_type text,
  p_visibility text,
  p_category   text,
  p_caption    text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
  v_id      uuid;
begin
  select * into v_session from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;

  insert into public.client_media
    (venue_id, client_id, file_url, file_name, mime_type, media_type, visibility, category, caption)
  values
    (v_session.venue_id, v_session.client_id,
     p_file_url, nullif(trim(coalesce(p_file_name,'')), ''),
     nullif(p_mime_type,''), coalesce(nullif(p_media_type,''),'image'),
     coalesce(nullif(p_visibility,''),'private'), nullif(p_category,''),
     nullif(trim(coalesce(p_caption,'')),''))
  returning id into v_id;

  return jsonb_build_object('ok', true, 'mediaId', v_id);
end;
$$;

-- update_couple_media_visibility: couple changes who can see a photo
create or replace function public.update_couple_media_visibility(
  p_token      text,
  p_media_id   uuid,
  p_visibility text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_session public.client_portal_sessions%rowtype;
begin
  select * into v_session from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;

  update public.client_media
  set visibility = p_visibility
  where id = p_media_id
    and client_id = v_session.client_id
    and venue_id  = v_session.venue_id;

  return jsonb_build_object('ok', true);
end;
$$;

-- delete_couple_media
create or replace function public.delete_couple_media(p_token text, p_media_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_session public.client_portal_sessions%rowtype;
begin
  select * into v_session from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;

  delete from public.client_media
  where id = p_media_id
    and client_id = v_session.client_id
    and venue_id  = v_session.venue_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.get_couple_media(text, text)                       to anon, authenticated;
grant execute on function public.add_couple_media(text,text,text,text,text,text,text,text) to anon, authenticated;
grant execute on function public.update_couple_media_visibility(text, uuid, text)   to anon, authenticated;
grant execute on function public.delete_couple_media(text, uuid)                    to anon, authenticated;

notify pgrst, 'reload schema';
