-- ============================================================================
-- Venue Brand Experience Phase 1 — extend get_venue_by_tour_key with the
-- venue's brand colors + logo, so the public tour-scheduling page (a
-- customer-facing surface — prospective couples, not staff) can present
-- the venue's own identity instead of Wevenu's hardcoded sage palette.
-- Return type is unchanged (jsonb), so this is a plain create-or-replace,
-- no drop needed.
-- ============================================================================

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
    -- Contact & location (Sprint 91)
    'email',       v_venue.email,
    'phone',       v_venue.phone,
    'addressLine1',v_venue.address_line1,
    'city',        v_venue.city,
    'stateRegion', v_venue.state_region,
    -- Venue Brand Experience Phase 1
    'primaryColor',   v_venue.primary_color,
    'secondaryColor', v_venue.secondary_color,
    'accentColor',    v_venue.accent_color,
    'neutralColor',   v_venue.neutral_color,
    'logoUrl',        v_venue.logo_url
  );
end;
$$;
