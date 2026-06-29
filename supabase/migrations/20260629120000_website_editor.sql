-- ============================================================================
-- Sprint 54: Wedding Website Editor Foundation
--
-- Two additions:
--
-- 1. invitation_settings JSONB column on couple_websites
--    Reserves architecture for save-the-dates, invitations, and RSVP reminders.
--    The guest list + rsvp_token already exist. This column holds the
--    scheduling and delivery settings for the invitation workflow.
--
-- 2. website_slug index on clients (for coordinator Luv observations)
--    Allows fast lookup: "which clients have published websites?"
-- ============================================================================

alter table public.couple_websites
  add column invitation_settings jsonb not null default '{}'::jsonb;
  -- { save_the_date: { scheduled_at: ISO, sent_count: int },
  --   invitations:   { scheduled_at: ISO, sent_count: int },
  --   reminders:     { interval_days: int, max_count: int } }

-- Stats view: coordinator sees published website counts (not content)
-- Used by Luv to surface website milestones
create or replace view public.couple_website_stats as
  select
    w.venue_id,
    w.client_id,
    w.slug,
    w.is_published,
    w.updated_at,
    w.created_at,
    (w.content->>'home' is not null)::boolean as has_home_content,
    (w.content->>'story' is not null)::boolean as has_story,
    (w.content->>'event' is not null)::boolean as has_event_details,
    (w.content->>'travel' is not null)::boolean as has_travel,
    (w.content->'registry' is not null and jsonb_array_length(w.content->'registry') > 0)::boolean as has_registry
  from public.couple_websites w;

-- Grant read to authenticated coordinators (for Luv)
grant select on public.couple_website_stats to authenticated;

-- SECURITY DEFINER: get website for coordinator dashboard (minimal info)
create or replace function public.get_client_website_summary(p_venue_id uuid, p_client_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_site public.couple_websites%rowtype;
begin
  select * into v_site
  from public.couple_websites
  where venue_id = p_venue_id and client_id = p_client_id;
  if not found then return jsonb_build_object('exists', false); end if;
  return jsonb_build_object(
    'exists',       true,
    'slug',         v_site.slug,
    'isPublished',  v_site.is_published,
    'url',          '/w/' || v_site.slug
  );
end;
$$;

grant execute on function public.get_client_website_summary(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
