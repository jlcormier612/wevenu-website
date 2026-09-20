-- Couple / venue relationship photos.
--
-- Photos belong to venue_customer_relationships (the enduring Lead/Client
-- identity), not to a disposable Lead row. Venue photo and client-shared
-- photo are separate; venue_display_source records which one the venue
-- chose to show. Client media that is not shared stays invisible to the
-- venue (RLS), including after the Sprint 107 team-collaboration policy
-- that briefly opened every client_media row to the venue.

-- ── 1. Relationship photo columns ───────────────────────────────────────────

alter table public.venue_customer_relationships
  add column if not exists venue_photo_url text,
  add column if not exists venue_display_source text not null default 'none',
  add column if not exists client_photo_url text,
  add column if not exists client_photo_shared boolean not null default false,
  add column if not exists client_photo_share_notified_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'vcr_venue_display_source_check'
  ) then
    alter table public.venue_customer_relationships
      add constraint vcr_venue_display_source_check
      check (venue_display_source in ('none', 'venue', 'client'));
  end if;
end $$;

comment on column public.venue_customer_relationships.venue_photo_url is
  'Venue-controlled photo for this relationship. Public uploads URL.';
comment on column public.venue_customer_relationships.venue_display_source is
  'Which available photo the venue is currently displaying: none, venue, or client.';
comment on column public.venue_customer_relationships.client_photo_url is
  'Couple-uploaded profile photo. Venue may read only when client_photo_shared is true.';
comment on column public.venue_customer_relationships.client_photo_shared is
  'Couple explicitly shared their photo with the venue. Default false.';
comment on column public.venue_customer_relationships.client_photo_share_notified_at is
  'When the venue was last notified that sharing turned on. Used to avoid duplicate bells on repeated saves.';

-- ── 2. client_media: profile category + shared-only venue read ──────────────
-- Preserve existing inspiration categories (incl. photography) and add profile.

alter table public.client_media drop constraint if exists client_media_category_check;
alter table public.client_media
  add constraint client_media_category_check check (category in (
    'engagement', 'inspiration', 'memory', 'gallery', 'venue_visit',
    'dress', 'other',
    'florals', 'fashion', 'cake', 'decor', 'photography', 'colors', 'stationery',
    'profile'
  ));

drop policy if exists "venue owner sees shared media" on public.client_media;
create policy "venue owner sees shared media" on public.client_media
  for select
  using (
    venue_id = public.current_user_venue_id()
    and visibility in ('venue', 'website')
  );

-- Venue staff must not read the raw client_photo_url when sharing is off.
-- Use a column-hiding view for application reads that go through PostgREST.
create or replace view public.venue_relationship_photos
with (security_invoker = true)
as
select
  r.id as relationship_id,
  r.venue_id,
  r.venue_photo_url,
  r.venue_display_source,
  case when r.client_photo_shared then r.client_photo_url else null end as client_photo_url,
  r.client_photo_shared,
  case
    when r.venue_display_source = 'client'
      and r.client_photo_shared
      and r.client_photo_url is not null
      then r.client_photo_url
    when r.venue_display_source = 'venue'
      and r.venue_photo_url is not null
      then r.venue_photo_url
    when r.venue_display_source = 'client'
      and r.venue_photo_url is not null
      then r.venue_photo_url
    when r.venue_display_source = 'none'
      and r.venue_photo_url is not null
      then r.venue_photo_url
    else null
  end as displayed_photo_url,
  case
    when r.venue_display_source = 'client'
      and r.client_photo_shared
      and r.client_photo_url is not null
      then 'client'
    when r.venue_photo_url is not null
      and (
        r.venue_display_source = 'venue'
        or r.venue_display_source = 'none'
        or (
          r.venue_display_source = 'client'
          and (not r.client_photo_shared or r.client_photo_url is null)
        )
      )
      then 'venue'
    else 'none'
  end as effective_display_source
from public.venue_customer_relationships r;

grant select on public.venue_relationship_photos to authenticated;

-- ── 3. Portal: get / set couple relationship photo + sharing ────────────────

create or replace function public.get_portal_relationship_photo(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
  v_rel_id uuid;
  v_row public.venue_customer_relationships%rowtype;
begin
  select * into v_session from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  select relationship_id into v_rel_id
  from public.clients
  where id = v_session.client_id and venue_id = v_session.venue_id;
  if v_rel_id is null then
    return jsonb_build_object('ok', true, 'photoUrl', null, 'shared', false);
  end if;

  select * into v_row from public.venue_customer_relationships where id = v_rel_id;
  if not found then
    return jsonb_build_object('ok', true, 'photoUrl', null, 'shared', false);
  end if;

  return jsonb_build_object(
    'ok', true,
    'photoUrl', v_row.client_photo_url,
    'shared', v_row.client_photo_shared
  );
end;
$$;

create or replace function public.set_portal_relationship_photo(
  p_token     text,
  p_photo_url text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
  v_rel_id uuid;
  v_url text := nullif(trim(coalesce(p_photo_url, '')), '');
begin
  select * into v_session from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  select relationship_id into v_rel_id
  from public.clients
  where id = v_session.client_id and venue_id = v_session.venue_id;
  if v_rel_id is null then
    return jsonb_build_object('ok', false, 'error', 'no_relationship');
  end if;

  update public.venue_customer_relationships
  set
    client_photo_url = v_url,
    -- Replacing the photo keeps the current share preference. Removing it
    -- clears sharing so a deleted private photo cannot linger as "shared."
    client_photo_shared = case
      when v_url is null then false
      else client_photo_shared
    end,
    venue_display_source = case
      when v_url is null and venue_display_source = 'client' then
        case when venue_photo_url is not null then 'venue' else 'none' end
      when v_url is not null
        and client_photo_shared
        and venue_display_source = 'client' then 'client'
      else venue_display_source
    end,
    updated_at = now()
  where id = v_rel_id and venue_id = v_session.venue_id;

  return jsonb_build_object('ok', true, 'photoUrl', v_url);
end;
$$;

create or replace function public.set_portal_relationship_photo_sharing(
  p_token  text,
  p_shared boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
  v_rel_id uuid;
  v_row public.venue_customer_relationships%rowtype;
  v_was_shared boolean;
  v_notify boolean := false;
  v_name text;
  v_link text;
begin
  select * into v_session from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  select relationship_id into v_rel_id
  from public.clients
  where id = v_session.client_id and venue_id = v_session.venue_id;
  if v_rel_id is null then
    return jsonb_build_object('ok', false, 'error', 'no_relationship');
  end if;

  select * into v_row from public.venue_customer_relationships where id = v_rel_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'no_relationship');
  end if;

  v_was_shared := v_row.client_photo_shared;

  if p_shared and v_row.client_photo_url is null then
    return jsonb_build_object('ok', false, 'error', 'no_photo');
  end if;

  update public.venue_customer_relationships
  set
    client_photo_shared = p_shared,
    venue_display_source = case
      -- Newly shared, no venue photo yet → auto-display client photo.
      when p_shared
        and v_row.venue_photo_url is null
        and v_row.client_photo_url is not null
        then 'client'
      -- Revoking while venue was showing client photo → fall back.
      when not p_shared and v_row.venue_display_source = 'client' then
        case when v_row.venue_photo_url is not null then 'venue' else 'none' end
      else venue_display_source
    end,
    client_photo_share_notified_at = case
      when p_shared and not v_was_shared and v_row.client_photo_url is not null
        then now()
      when not p_shared then null
      else client_photo_share_notified_at
    end,
    updated_at = now()
  where id = v_rel_id;

  v_notify := p_shared and not v_was_shared and v_row.client_photo_url is not null;

  if v_notify then
    select trim(both ' ' from concat_ws(' ',
      nullif(trim(c.first_name), ''),
      nullif(trim(c.last_name), ''),
      case
        when nullif(trim(c.partner_first_name), '') is not null
          then concat('& ', trim(c.partner_first_name),
            case when nullif(trim(c.partner_last_name), '') is not null
              then concat(' ', trim(c.partner_last_name)) else '' end)
        else null
      end
    ))
    into v_name
    from public.clients c
    where c.id = v_session.client_id;

    if v_name is null or v_name = '' then
      v_name := 'A couple';
    end if;

    v_link := '/clients/' || v_session.client_id::text;

    perform public.create_venue_notification(
      v_session.venue_id,
      null,
      'client_photo_shared',
      v_name || ' shared a photo with you.',
      'You can use it on their client profile.',
      v_link,
      '📷'
    );
  end if;

  return jsonb_build_object('ok', true, 'shared', p_shared, 'notified', v_notify);
end;
$$;

revoke all on function public.get_portal_relationship_photo(text) from public;
revoke all on function public.set_portal_relationship_photo(text, text) from public;
revoke all on function public.set_portal_relationship_photo_sharing(text, boolean) from public;
grant execute on function public.get_portal_relationship_photo(text) to anon, authenticated;
grant execute on function public.set_portal_relationship_photo(text, text) to anon, authenticated;
grant execute on function public.set_portal_relationship_photo_sharing(text, boolean) to anon, authenticated;

-- ── 4. Guard: venue sessions cannot rewrite couple-owned photo columns ───────
-- Venue staff may update venue_photo_url / venue_display_source via RLS.
-- Client photo fields are owned by the couple (portal security-definer RPCs
-- and service_role). Prevents a venue client from forging a "shared" URL.

create or replace function public.guard_relationship_client_photo_columns()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  -- service_role and table/function owners (security definer RPCs) may write.
  if current_setting('role', true) = 'service_role'
     or current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  new.client_photo_url := old.client_photo_url;
  new.client_photo_shared := old.client_photo_shared;
  new.client_photo_share_notified_at := old.client_photo_share_notified_at;
  return new;
end;
$$;

drop trigger if exists trg_guard_relationship_client_photo on public.venue_customer_relationships;
create trigger trg_guard_relationship_client_photo
  before update on public.venue_customer_relationships
  for each row
  execute function public.guard_relationship_client_photo_columns();

notify pgrst, 'reload schema';
