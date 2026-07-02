-- ============================================================================
-- Sprint 91: Public Booking Flow Polish
--
-- Two changes:
--
-- 1. get_venue_by_tour_key — return phone, email, and address fields so the
--    public confirmation page can show them and the booking route can email
--    the coordinator at the correct address.
--
-- 2. lead_signal_events — extend signal_type constraint to include tour
--    conversion signals (tour_booked, tour_attended, tour_cancelled,
--    tour_converted). These power future Luv Roll-Up trend analysis.
-- ============================================================================

-- ── 1. Extended venue info for public tour page ───────────────────────────────

create or replace function public.get_venue_by_tour_key(p_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_venue public.venues%rowtype;
begin
  select * into v_venue
  from public.venues
  where tour_embed_key = p_key
    and tour_scheduling_enabled = true;
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  return jsonb_build_object(
    'name',        v_venue.name,
    'headline',    coalesce(v_venue.tour_page_headline, 'Schedule a Tour'),
    'description', v_venue.tour_page_description,
    'duration',    v_venue.tour_duration_minutes,
    -- Contact & location (new Sprint 91)
    'email',       v_venue.email,
    'phone',       v_venue.phone,
    'addressLine1',v_venue.address_line1,
    'city',        v_venue.city,
    'stateRegion', v_venue.state_region
  );
end;
$$;

-- ── 2. Tour conversion analytics signal types ─────────────────────────────────

-- Drop + re-add the check constraint with the new signal types
alter table public.lead_signal_events
  drop constraint if exists lead_signal_events_signal_type_check;

alter table public.lead_signal_events
  add constraint lead_signal_events_signal_type_check
  check (signal_type in (
    -- Questionnaire signals
    'questionnaire_viewed', 'questionnaire_submitted',
    -- Email signals (from Resend webhooks)
    'email_opened', 'email_clicked',
    -- Form signals
    'form_viewed', 'form_revisited',
    -- Future payment/proposal signals
    'payment_link_clicked', 'proposal_viewed',
    -- Tour conversion signals (Sprint 91)
    'tour_booked',     -- prospect scheduled a tour
    'tour_attended',   -- tour marked completed
    'tour_cancelled',  -- tour cancelled or no-show
    'tour_converted'   -- lead with tour moved to won/booked
  ));

notify pgrst, 'reload schema';
