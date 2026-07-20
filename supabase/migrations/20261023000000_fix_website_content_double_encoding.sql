-- ============================================================================
-- Fix: double-encoded wedding website section content
--
-- app/api/portal/website/route.ts called JSON.stringify(contentValue) before
-- passing it as p_content_value to update_my_website, a jsonb-typed RPC
-- parameter. supabase-js already serializes RPC params for the request, so
-- this double-encoded every section saved through the Studio: instead of a
-- nested object/array, couple_websites.content and experience_sections.content
-- stored a JSON *string* under each key. Guest-visible impact was silent —
-- e.g. components/wedding-website/wedding-website.tsx's dress_code case reads
-- content.dress_code?.formality, which is undefined on a string value, so the
-- section renders as empty/fallback with no error anywhere.
--
-- Unrelated to the Hosted Experience Platform Phase 5 work in progress —
-- discovered while live-testing Phase 5's guest concierge (which reads this
-- same content) and fixed as a standalone correction per user direction,
-- not folded into the Phase 5 migration set. The route itself is fixed in
-- the same commit as this migration; this repairs already-corrupted rows.
--
-- Repair is narrowly scoped: only touches a value when it is a jsonb string
-- whose text content looks like a JSON object/array (starts with { or [) —
-- every real WebsiteContent field is itself an object or array by the
-- TypeScript type, so a scalar string value would never legitimately occur
-- here. Confirmed the bug always produces exactly one level of extra
-- encoding per save (jsonb_set overwrites the key, it doesn't compound), so
-- a single unwrap pass is sufficient.
-- ============================================================================

update public.couple_websites
set content = (
  select jsonb_object_agg(
    e.key,
    case
      when jsonb_typeof(e.value) = 'string' and (e.value #>> '{}') ~ '^\s*[\[{]'
        then (e.value #>> '{}')::jsonb
      else e.value
    end
  )
  from jsonb_each(content) e
)
where content is not null and content != '{}'::jsonb
  and exists (
    select 1 from jsonb_each(content) e
    where jsonb_typeof(e.value) = 'string' and (e.value #>> '{}') ~ '^\s*[\[{]'
  );

update public.experience_sections
set content = (content #>> '{}')::jsonb
where content is not null
  and jsonb_typeof(content) = 'string'
  and (content #>> '{}') ~ '^\s*[\[{]';

-- experience_versions.snapshot: each published version's frozen sections
-- array carries the same corrupted content wherever it was captured from an
-- already-broken experience_sections row at publish time.
update public.experience_versions
set snapshot = jsonb_set(
  snapshot, '{sections}',
  (
    select coalesce(jsonb_agg(
      case
        when jsonb_typeof(s.value -> 'content') = 'string'
          and (s.value -> 'content' #>> '{}') ~ '^\s*[\[{]'
          then jsonb_set(s.value, '{content}', (s.value -> 'content' #>> '{}')::jsonb)
        else s.value
      end
    ), '[]'::jsonb)
    from jsonb_array_elements(snapshot -> 'sections') s
  )
)
where snapshot -> 'sections' is not null
  and exists (
    select 1 from jsonb_array_elements(snapshot -> 'sections') s
    where jsonb_typeof(s.value -> 'content') = 'string'
      and (s.value -> 'content' #>> '{}') ~ '^\s*[\[{]'
  );
