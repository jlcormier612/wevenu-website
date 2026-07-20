-- ============================================================================
-- Hosted Experience Platform — Phase 2: Section backfill
--
-- Populates experience_sections for every existing couple_websites row,
-- one row per the 13 sections the product actually has today (12 from
-- ALL_SECTIONS in components/portal/website-editor.tsx, plus "rsvp" which
-- exists in the renderer's DEFAULT_ORDER but has no editable Studio form
-- since its data lives in couple_guests, not content). "home" is a fixed,
-- always-first hero section — never reorderable in the current renderer —
-- given sort_order 0; the rest follow the renderer's real DEFAULT_ORDER.
--
-- Ownership grounded in what's ACTUALLY true today, not the vision
-- document's aspirational category for each section — see the Phase 2
-- report for the honest finding this produces: owner = 'venue_managed' is
-- assigned to zero sections, because no venue-facing editing surface
-- exists anywhere in the product yet. Every section today is edited
-- exclusively through the couple's own Studio, including ones a venue
-- would eventually own (Welcome Message, FAQ, Directions) once that
-- surface is built.
-- ============================================================================

insert into public.experience_sections
  (experience_id, section_key, title, owner, sync_mode, data_source, sort_order, content)
select
  w.id,
  s.section_key,
  s.title,
  s.owner,
  case
    when s.section_key = 'schedule' then (case when w.schedule_sync then 'live' else 'manual' end)
    else s.default_sync_mode
  end,
  case
    when s.section_key = 'schedule' and w.schedule_sync then 'timeline_entries'
    when s.section_key = 'rsvp' then 'couple_guests'
    else null
  end,
  s.sort_order,
  case when s.section_key = 'rsvp' then null else w.content -> s.section_key end
from public.couple_websites w
cross join (values
  ('home',         'Home & Welcome',   'guided',           'one_time_copy', 0),
  ('story',        'Your Story',       'guided',           'one_time_copy', 1),
  ('event',        'Event Details',    'couple_authored',  'manual',        2),
  ('gallery',      'Photo Gallery',    'couple_authored',  'manual',        3),
  ('schedule',     'Day-of Schedule',  'live_synced',       'live',          4),
  ('travel',       'Travel & Hotels',  'couple_authored',  'manual',        5),
  ('dress_code',   'Dress Code',       'couple_authored',  'manual',        6),
  ('bridal_party', 'Wedding Party',    'couple_authored',  'manual',        7),
  ('things_to_do', 'Things To Do',     'couple_authored',  'manual',        8),
  ('music',        'Music',            'couple_authored',  'manual',        9),
  ('registry',     'Registry',         'couple_authored',  'manual',       10),
  ('faq',          'FAQ',              'couple_authored',  'manual',       11),
  ('rsvp',         'RSVP',             'live_synced',       'live',         12)
) as s(section_key, title, owner, default_sync_mode, sort_order)
on conflict (experience_id, section_key) do nothing;
