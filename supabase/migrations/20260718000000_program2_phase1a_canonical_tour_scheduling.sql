-- ============================================================================
-- Program 2, Phase 1a — Canonical Lead tour scheduling
--
-- tour_appointments becomes the single source of truth for "does this lead
-- have a tour," regardless of whether it was booked through the public
-- widget or scheduled manually by a coordinator on the lead's relationship
-- card. leads.tour_date/tour_time/tour_completed/tour_notes were a second,
-- parallel representation of the same fact — every reader and writer in the
-- application has been moved onto tour_appointments (lib/leads/repository.ts's
-- getCurrentTourForLead/getCurrentToursForLeads/upsertLeadTour), so this
-- migration backfills any lead whose only tour record was the legacy fields,
-- then drops them. Replace, don't layer.
-- ============================================================================

-- Backfill: any lead with a legacy tour_date set, and no existing
-- non-cancelled tour_appointments row, gets one created from the legacy data.
insert into public.tour_appointments (venue_id, lead_id, scheduled_at, status, notes, completed_at)
select
  l.venue_id,
  l.id,
  (l.tour_date::text || 'T' || coalesce(l.tour_time::text, '12:00:00'))::timestamptz,
  case when l.tour_completed then 'completed' else 'scheduled' end,
  l.tour_notes,
  case when l.tour_completed then now() else null end
from public.leads l
where l.tour_date is not null
  and not exists (
    select 1 from public.tour_appointments ta
    where ta.lead_id = l.id and ta.status <> 'cancelled'
  );

-- Now that every legacy tour record has a canonical tour_appointments row,
-- drop the parallel representation.
alter table public.leads
  drop column tour_date,
  drop column tour_time,
  drop column tour_completed,
  drop column tour_notes;
