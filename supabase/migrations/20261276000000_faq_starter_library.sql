-- Hello to Cheers — Starter Venue Guide FAQ Library (FAQ-01 … FAQ-12)
-- FAQs live in venue_operational_info.faqs jsonb (existing Venue Guide engine).
-- Each starter entry carries:
--   source_master_key text  (FAQ-01 … FAQ-12)
--   published boolean       (starters seed false; legacy / venue-authored omit or true)
-- Masters remain code fixtures in lib/venue-guide/starters.ts.

comment on column public.venue_operational_info.faqs is
  'Venue Guide FAQ cards: [{question, answer, audience?, answer_for_vendors?, source_master_key?, published?}]. Hello to Cheers starters use source_master_key FAQ-01…FAQ-12 and seed published=false until the venue publishes.';

-- Outbound filter for public brochure (and reusable by other SQL callers).
-- Missing published → treated as live (legacy venue-authored FAQs).
-- published=false → excluded (unreviewed Hello to Cheers starters).
create or replace function public.filter_published_venue_faqs(p_faqs jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(
    (
      select jsonb_agg(elem order by ord)
      from jsonb_array_elements(coalesce(p_faqs, '[]'::jsonb)) with ordinality as t(elem, ord)
      where jsonb_typeof(elem) = 'object'
        and nullif(trim(elem->>'question'), '') is not null
        and coalesce((elem->>'published')::boolean, true) = true
    ),
    '[]'::jsonb
  );
$$;

comment on function public.filter_published_venue_faqs(jsonb) is
  'Returns only published Venue Guide FAQs. published=false excluded; missing published kept (legacy).';

grant execute on function public.filter_published_venue_faqs(jsonb) to anon, authenticated, service_role;

-- Public brochure: never leak unpublished starter FAQs.
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

-- Venue-create seed uses admin/service_role (same pattern as packages / timeline / floor plan).
grant select, insert, update on public.venue_operational_info to service_role;

notify pgrst, 'reload schema';
