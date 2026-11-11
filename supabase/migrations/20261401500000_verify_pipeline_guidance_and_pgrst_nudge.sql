-- Verify Pipeline Templates guidance content + nudge PostgREST.
-- Read-only content check; reload signals only for Data API recovery.

do $$
declare
  body text;
begin
  select why_it_matters into body
  from public.success_library_articles
  where slug = 'how-does-my-pipeline-work';

  if body is null then
    raise exception 'PIPELINE_GUIDANCE_MISSING';
  end if;

  if position('Where is this relationship in the sales process?' in body) = 0 then
    raise exception 'PIPELINE_GUIDANCE_ORIGINAL_MISSING';
  end if;

  if position('### Customize your sales process' in body) = 0 then
    raise exception 'PIPELINE_GUIDANCE_TEMPLATES_SECTION_MISSING';
  end if;

  if position('Your Relationships → Leads → Pipeline Templates' in body) = 0 then
    raise exception 'PIPELINE_GUIDANCE_TEMPLATES_PATH_MISSING';
  end if;

  if position('choose the reporting category that each stage belongs to' in body) = 0 then
    raise exception 'PIPELINE_GUIDANCE_TEMPLATES_BULLET_MISSING';
  end if;

  raise notice 'PIPELINE_GUIDANCE_OK chars=%', length(body);
end $$;

-- Best-effort PostgREST schema-cache recovery (no app data changes).
notify pgrst, 'reload config';
notify pgrst, 'reload schema';
