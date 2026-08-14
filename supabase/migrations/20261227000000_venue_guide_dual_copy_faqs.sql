-- Extend Venue Guide dual-copy: ceremony/things vendor prose + vendor FAQ lists.
-- Storage remains section_overrides jsonb (no new columns).
-- Backfill vendor FAQ list from legacy per-item answer_for_vendors / vendors-only rows.

comment on column public.venue_operational_info.section_overrides is
  'Optional dual copy: {"parking"|"policies"|"ceremony"|"things":{"vendors":"..."},"faqs":{"vendors":[{"question":"...","answer":"..."}]}}.';

update public.venue_operational_info voi
set section_overrides = coalesce(voi.section_overrides, '{}'::jsonb) || jsonb_build_object(
  'faqs', jsonb_build_object(
    'vendors', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'question', trim(elem->>'question'),
            'answer', case
              when nullif(trim(elem->>'answer_for_vendors'), '') is not null
                then trim(elem->>'answer_for_vendors')
              else coalesce(elem->>'answer', '')
            end
          )
          order by ord
        ),
        '[]'::jsonb
      )
      from jsonb_array_elements(coalesce(voi.faqs, '[]'::jsonb)) with ordinality as t(elem, ord)
      where nullif(trim(elem->>'question'), '') is not null
        and (
          nullif(trim(elem->>'answer_for_vendors'), '') is not null
          or coalesce(elem->>'audience', 'both') = 'vendors'
        )
    )
  )
)
where jsonb_typeof(coalesce(voi.faqs, '[]'::jsonb)) = 'array'
  and (
    voi.section_overrides->'faqs'->'vendors' is null
    or jsonb_typeof(voi.section_overrides->'faqs'->'vendors') <> 'array'
    or jsonb_array_length(coalesce(voi.section_overrides->'faqs'->'vendors', '[]'::jsonb)) = 0
  )
  and exists (
    select 1
    from jsonb_array_elements(coalesce(voi.faqs, '[]'::jsonb)) elem
    where nullif(trim(elem->>'question'), '') is not null
      and (
        nullif(trim(elem->>'answer_for_vendors'), '') is not null
        or coalesce(elem->>'audience', 'both') = 'vendors'
      )
  );
