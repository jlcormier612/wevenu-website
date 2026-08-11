-- Work Package D7B follow-up — the public brochure RPC needs Packages and
-- FAQs too (both resolved LIVE from their own authoritative tables, never
-- copied onto brochures itself), so the public `/brochure/[token]` page
-- and its PDF route can render without a venue session. Changing a SQL
-- function's return column list requires an explicit DROP first — a
-- lesson learned repeatedly this engagement (CREATE OR REPLACE cannot
-- change a function's return shape; it either errors or silently leaves
-- the old signature as a second overload).

drop function if exists public.get_brochure_by_token(uuid);

create function public.get_brochure_by_token(p_token uuid)
returns table (
  id                    uuid,
  name                  text,
  welcome_text          text,
  include_packages      boolean,
  include_faqs          boolean,
  closing_text          text,
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
      select coalesce(voi.faqs, '[]'::jsonb)
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
