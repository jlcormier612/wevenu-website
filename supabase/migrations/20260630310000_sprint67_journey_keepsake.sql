-- ============================================================================
-- Sprint 67: Your Journey & Keepsake Foundation
--
-- 1. Expand milestone check constraint — post-wedding moments
-- 2. get_journey_timeline — all journal entries, oldest-first, for the timeline
-- ============================================================================

-- ── 1. Expand milestone constraint ───────────────────────────────────────────
-- Drop and recreate to include post-wedding life milestones.

alter table public.couple_journal_entries
  drop constraint if exists couple_journal_entries_milestone_check;

alter table public.couple_journal_entries
  add constraint couple_journal_entries_milestone_check check (milestone in (
    -- Pre-wedding planning
    'venue_tour', 'engagement_party', 'dress_shopping', 'venue_signed',
    'save_the_dates', 'vendor_booked', 'bridal_shower', 'bachelorette',
    'rehearsal', 'wedding_day',
    -- Post-wedding life
    'honeymoon', 'first_anniversary', 'first_home', 'reflection',
    -- Generic
    'other'
  ));

-- ── 2. get_journey_timeline ──────────────────────────────────────────────────
-- Returns all journal entries for a portal session, ordered oldest-first.
-- Separate from get_journal_entries (which is desc, used by Our Story tab)
-- so the journey view reads chronologically like a story.

create or replace function public.get_journey_timeline(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
begin
  select * into v_session from public.client_portal_sessions
  where access_token = p_token
    and (expires_at is null or expires_at > now());
  if not found then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  return jsonb_build_object(
    'entries', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',        j.id,
          'entryDate', j.entry_date,
          'title',     j.title,
          'body',      j.body,
          'milestone', j.milestone,
          'source',    j.source,
          'mediaId',   j.media_id,
          'mediaUrl',  (select file_url from public.client_media where id = j.media_id limit 1),
          'createdAt', j.created_at
        ) order by j.entry_date asc, j.created_at asc
      )
      from public.couple_journal_entries j
      where j.client_id = v_session.client_id
    ), '[]'::jsonb)
  );
end;
$$;

notify pgrst, 'reload schema';
