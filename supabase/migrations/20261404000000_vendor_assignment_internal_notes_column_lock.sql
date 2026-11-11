-- Vendor-private assignment notes: event_vendor_assignments.internal_notes
-- belong to the vendor team only. Venue JWTs (authenticated + venue RLS)
-- must not read or write this column; vendors use security-definer RPCs
-- (get_vendor_event_detail / update_vendor_assignment_notes).

revoke select (internal_notes), update (internal_notes)
  on public.event_vendor_assignments
  from authenticated;

comment on column public.event_vendor_assignments.internal_notes is
  'Vendor-private notes. Not visible to venue or client. Read/write only via vendor security-definer RPCs.';
