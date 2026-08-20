-- ============================================================================
-- Migration Center — add the source_profiles row for Tripleseat.
--
-- The adapter itself (lib/migration/sources/tripleseat.ts, commit 14d4793)
-- has been built, tested, and registered in the TS-side ADAPTERS registry
-- since that slice. It has been dormant since then: getSourceProfiles()
-- reads only from this table, and with no row here Tripleseat could never
-- appear as a selectable option in the live UI, no matter how complete the
-- adapter was. This migration is the one remaining wiring step — purely
-- additive, follows the exact seed pattern from 20261300000000, no engine/
-- schema/adapter changes.
--
-- has_direct_connection stays false: Tripleseat has a real, documented
-- OAuth API (verified in the Tripleseat Source-Readiness Report), but this
-- phase is file-based only — that flag must not overclaim a live
-- connection that doesn't exist yet.
-- ============================================================================

insert into public.source_profiles
  (key, display_name, has_direct_connection, forward_only, export_assisted, white_glove_recommended, supported_file_types, has_known_parser, historical_limitations)
values
  ('tripleseat', 'Tripleseat', false, false, true, true, '{csv,xlsx,pdf,docx}', true,
    'Tripleseat has a real, documented OAuth API, but this migration path is file-based only for now — no live connection yet. Recognition and name-normalization are handled for Contacts (client/lead records); Bookings/Events are not migrated in this phase, and an Account is not assumed to be a vendor or a client without the venue confirming it.')
on conflict (key) do nothing;

notify pgrst, 'reload schema';
