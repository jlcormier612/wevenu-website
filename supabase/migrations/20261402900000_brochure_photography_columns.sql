-- Repair: 20261392000000 is recorded in schema_migrations, but Sandbox
-- brochures has neither photo_urls nor photo_layout (verified 42703).
-- Re-apply the same idempotent DDL and public brochure function, then
-- reload the API schema. Removing a photo from a brochure still does not
-- delete the storage object; that is a separate application action.

alter table public.brochures
  add column if not exists photo_urls text[] not null default '{}',
  add column if not exists photo_layout text not null default 'classic';

alter table public.brochures
  drop constraint if exists brochures_photo_layout_check;

alter table public.brochures
  add constraint brochures_photo_layout_check
  check (photo_layout in ('classic', 'gallery', 'story', 'editorial'));

comment on column public.brochures.photo_urls is
  'Ordered brochure photos. Index 0 is the primary/hero. URLs of existing venue-authored media; not a separate asset library.';
comment on column public.brochures.photo_layout is
  'Curated presentation style: classic | gallery | story | editorial.';

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
