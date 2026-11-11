-- Add first-class not_applicable preference kind.
-- Existing undecided / venue_space / external rows are unchanged (no backfill).

alter table public.lead_event_space_preferences
  drop constraint if exists lead_event_space_preferences_kind;

alter table public.lead_event_space_preferences
  add constraint lead_event_space_preferences_kind
    check (preference_kind in ('venue_space', 'external', 'undecided', 'not_applicable'));

alter table public.lead_event_space_preferences
  drop constraint if exists lead_event_space_preferences_shape;

alter table public.lead_event_space_preferences
  add constraint lead_event_space_preferences_shape
    check (
      (
        preference_kind = 'venue_space'
        and space_id is not null
        and (external_location is null or length(trim(external_location)) = 0)
      ) or (
        preference_kind = 'external'
        and space_id is null
        and external_location is not null
        and length(trim(external_location)) > 0
      ) or (
        preference_kind = 'undecided'
        and space_id is null
        and (external_location is null or length(trim(external_location)) = 0)
      ) or (
        preference_kind = 'not_applicable'
        and space_id is null
        and (external_location is null or length(trim(external_location)) = 0)
      )
    );

comment on table public.lead_event_space_preferences is
  'Historical lead space intent by use. Kinds: venue_space, external, undecided (applicable), not_applicable (component not part of event). Not an assignment. Booking may seed event authority from venue_space/external without rewriting these rows.';
