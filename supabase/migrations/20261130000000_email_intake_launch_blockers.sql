-- ============================================================================
-- Email Intake Self-Service — Sprint 3, Item 2. Fix the two launch-blocking
-- defects found during assessment before building any self-service UX.
-- Both were confirmed live, not just by code inspection.
-- ============================================================================

-- ---- Bug A: venues.lead_email_key had no DB default -------------------------
--
-- Confirmed live: calling complete_venue_setup() for a brand-new venue
-- fails outright with "null value in column lead_email_key violates
-- not-null constraint" — every venue created since the Email Intake
-- Engine migration shipped would hit this. embed_key and tour_embed_key
-- both get a DB-level default for exactly this reason (so no insert path
-- can omit them); lead_email_key never got the same treatment when it was
-- added. Adding the default here means every future insert path — not
-- just complete_venue_setup — is protected, not just the one RPC we found
-- broken today.

alter table public.venues
  alter column lead_email_key set default lower(replace(gen_random_uuid()::text, '-', ''));

-- ---- Bug C: service_role has no GRANT on lead_intake_attempts ---------------
--
-- Found live while re-verifying Bug B's fix, not by inspection: fixing the
-- proxy allowlist made app/api/leads/email-intake/route.ts reachable for
-- the first time, which immediately exposed that its admin-client write to
-- lead_intake_attempts (logIntakeAttempt) was silently failing —
-- service_role had SELECT-adjacent grants missing entirely (no INSERT,
-- SELECT, or UPDATE). Every other Source Adapter (public inquiry form,
-- tour booking) either uses the session/anon-role client directly or goes
-- through a SECURITY DEFINER RPC, so this table's service_role grant gap
-- had never been exercised until this route became reachable — this is
-- the fifth table this engagement has found with this exact gap
-- (vendor_inquiries, vendor_tasks, clients/invoices/payment_line_items,
-- invoice_line_items, now lead_intake_attempts). RLS bypass via
-- rolbypassrls never implies table privileges — a service-role client
-- still needs an explicit GRANT, every time, on every new table it touches.

grant select, insert, update on public.lead_intake_attempts to service_role;

notify pgrst, 'reload schema';
