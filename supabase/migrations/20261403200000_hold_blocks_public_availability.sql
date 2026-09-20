-- Date holds and public availability.
--
-- Venues choose whether an active date hold closes a date for prospects.
-- Default is on: an active, unexpired hold makes the date unavailable.
-- Tours and appointments are not consulted. Booked-event occupancy and
-- covering calendar blocks stay as they are.
--
-- _is_event_date_available remains the single date authority used by the
-- public availability calendar and the inquiry form.

alter table public.venues
  add column if not exists hold_blocks_availability boolean not null default true;

comment on column public.venues.hold_blocks_availability is
  'When true, an active unexpired date hold makes that date unavailable on the public availability calendar and inquiry form. Default true.';

update public.venues
set hold_blocks_availability = true
where hold_blocks_availability is distinct from true;

create or replace function public._is_event_date_available(
  p_venue_id uuid,
  p_date     date
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max integer;
  v_result jsonb;
  v_space record;
  v_hold_blocks boolean;
begin
  if p_date is null then
    return true;
  end if;

  select coalesce(v.hold_blocks_availability, true)
    into v_hold_blocks
  from public.venues v
  where v.id = p_venue_id;
  if v_hold_blocks is null then
    v_hold_blocks := true;
  end if;

  if v_hold_blocks and exists (
    select 1
    from public.date_holds h
    where h.venue_id = p_venue_id
      and h.hold_date = p_date
      and h.status = 'active'
      and (h.expires_at is null or h.expires_at > now())
  ) then
    return false;
  end if;

  if public.covering_calendar_block_title(
    p_venue_id, p_date, p_date, time '00:00', time '23:59', null
  ) is not null then
    return false;
  end if;

  select r.max_simultaneous_events into v_max
  from public.venue_capacity_rules r
  where r.venue_id = p_venue_id;
  if v_max is null or v_max < 1 then
    v_max := 1;
  end if;

  if v_max >= 2 then
    if not exists (
      select 1 from public.venue_spaces s
      where s.venue_id = p_venue_id and s.is_active = true
    ) then
      return false;
    end if;
    for v_space in
      select s.id from public.venue_spaces s
      where s.venue_id = p_venue_id and s.is_active = true
    loop
      v_result := public.evaluate_event_availability(
        p_venue_id, p_date, null, null, null, null, null, v_space.id, null
      );
      if coalesce(v_result->>'ok', '') = 'true' then
        return true;
      end if;
    end loop;
    return false;
  end if;

  v_result := public.evaluate_event_availability(
    p_venue_id, p_date, null, null, null, null, null, null, null
  );
  return coalesce(v_result->>'ok', '') = 'true';
end;
$$;

-- Brochure rendering needs the stable availability path, not a date list.
-- The key is the venue's existing inquiry embed key.
drop function if exists public.get_brochure_by_token(uuid);

create function public.get_brochure_by_token(p_token uuid)
returns table (
  id                    uuid,
  name                  text,
  welcome_text          text,
  include_packages      boolean,
  include_faqs          boolean,
  closing_text          text,
  photo_urls            text[],
  photo_layout          text,
  venue_id              uuid,
  venue_name            text,
  venue_business_name   text,
  venue_logo_url        text,
  venue_story           text,
  venue_hero_image_url  text,
  venue_primary_color   text,
  venue_secondary_color text,
  venue_accent_color    text,
  venue_email           text,
  venue_phone           text,
  venue_website         text,
  venue_embed_key       text,
  packages              jsonb,
  faqs                  jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_brochure_id uuid;
  v_venue_id    uuid;
begin
  select b.id, b.venue_id into v_brochure_id, v_venue_id
  from public.brochures b
  where b.share_token = p_token;

  if v_brochure_id is null then return; end if;

  return query
  select
    b.id, b.name, b.welcome_text, b.include_packages, b.include_faqs, b.closing_text,
    b.photo_urls, b.photo_layout,
    v.id, v.name, v.business_name, v.logo_url, v.story, v.hero_image_url,
    v.primary_color, v.secondary_color, v.accent_color, v.email, v.phone, v.website,
    v.embed_key,
    (
      select coalesce(jsonb_agg(jsonb_build_object(
               'name', p.name, 'description', p.description,
               'basePrice', p.base_price, 'category', p.category
             ) order by p.sort_order), '[]'::jsonb)
      from public.packages p
      where p.venue_id = v_venue_id and p.is_active
    ),
    (
      select public.filter_published_venue_faqs(coalesce(voi.faqs, '[]'::jsonb))
      from public.venue_operational_info voi
      where voi.venue_id = v_venue_id
    )
  from public.brochures b
  join public.venues v on v.id = b.venue_id
  where b.id = v_brochure_id;
end;
$$;

grant execute on function public.get_brochure_by_token(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
