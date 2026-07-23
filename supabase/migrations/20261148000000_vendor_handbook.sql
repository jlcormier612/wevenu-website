-- Vendor Workspace Realignment (Program 4, Initiative B, 2026-07-22), Phase 9:
-- the Vendor Handbook. Reuses venue_operational_info — the exact table that
-- already backs the couple portal's Venue Guide — rather than authoring new
-- vendor-facing content. venue_operational_info's own RLS
-- ("venue_rw_operational_info") only recognizes venue_users sessions, the
-- same gap the Sprint 2 Vendor Certification Pass already found and fixed
-- for event_vendor_assignments/timeline_entries/etc — so vendor reads go
-- through a SECURITY DEFINER RPC validated against current_user_vendor_id(),
-- following the same pattern as every other vendor-portal read.

-- Handbook for one event's venue — used inside the per-event workspace's
-- "Venue Information" tab. Access gated by an actual assignment to that
-- event (Stage 3, booked), not just venue browsing.
create or replace function public.get_vendor_handbook(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor_id uuid;
  v_venue_id uuid;
begin
  v_vendor_id := current_user_vendor_id();
  if v_vendor_id is null then
    return '{"error":"unauthorized"}'::jsonb;
  end if;

  if not exists (
    select 1 from public.event_vendor_assignments eva
    where eva.event_id = p_event_id and eva.vendor_id = v_vendor_id
  ) then
    return '{"error":"not_assigned"}'::jsonb;
  end if;

  select venue_id into v_venue_id from public.events where id = p_event_id;

  return jsonb_build_object(
    'venue', (
      select jsonb_build_object(
        'id', v.id, 'name', v.name, 'phone', v.phone, 'website', v.website,
        'addressLine1', v.address_line1, 'addressLine2', v.address_line2,
        'city', v.city, 'stateRegion', v.state_region, 'postalCode', v.postal_code,
        'logoUrl', v.logo_url
      )
      from public.venues v where v.id = v_venue_id
    ),
    'operationalInfo', (
      select jsonb_build_object(
        'parkingInfo', oi.parking_info,
        'transportation', oi.transportation,
        'nearbyAccommodations', oi.nearby_accommodations,
        'hotelBlocks', oi.hotel_blocks,
        'rainPlan', oi.rain_plan,
        'policies', oi.policies,
        'ceremonyInstructions', oi.ceremony_instructions,
        'thingsToDo', oi.things_to_do,
        'faqs', oi.faqs,
        'importantContacts', oi.important_contacts
      )
      from public.venue_operational_info oi where oi.venue_id = v_venue_id
    )
  );
end;
$$;

grant execute on function public.get_vendor_handbook(uuid) to authenticated;

-- All venues this vendor currently has a booked (Stage 3) relationship
-- with — used by the top-level "Venue Information" nav destination, which
-- isn't scoped to one event. A vendor working with only one venue skips
-- straight to that venue's handbook; a multi-venue vendor picks.
create or replace function public.get_vendor_handbooks()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor_id uuid;
begin
  v_vendor_id := current_user_vendor_id();
  if v_vendor_id is null then
    return '{"error":"unauthorized"}'::jsonb;
  end if;

  return jsonb_build_object(
    'venues', coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'venue', jsonb_build_object(
            'id', v.id, 'name', v.name, 'phone', v.phone, 'website', v.website,
            'addressLine1', v.address_line1, 'addressLine2', v.address_line2,
            'city', v.city, 'stateRegion', v.state_region, 'postalCode', v.postal_code,
            'logoUrl', v.logo_url
          ),
          'operationalInfo', (
            select jsonb_build_object(
              'parkingInfo', oi.parking_info,
              'transportation', oi.transportation,
              'nearbyAccommodations', oi.nearby_accommodations,
              'hotelBlocks', oi.hotel_blocks,
              'rainPlan', oi.rain_plan,
              'policies', oi.policies,
              'ceremonyInstructions', oi.ceremony_instructions,
              'thingsToDo', oi.things_to_do,
              'faqs', oi.faqs,
              'importantContacts', oi.important_contacts
            )
            from public.venue_operational_info oi where oi.venue_id = v.id
          )
        ) order by v.name)
        from (
          select distinct e.venue_id
          from public.event_vendor_assignments eva
          join public.events e on e.id = eva.event_id
          where eva.vendor_id = v_vendor_id
        ) booked
        join public.venues v on v.id = booked.venue_id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.get_vendor_handbooks() to authenticated;
