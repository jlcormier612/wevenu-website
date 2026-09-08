-- Calendar 2A.2.3 — case-insensitive unique labels among active catalog rows.
-- Prevents custom names colliding with each other or with built-in labels.
-- Archived customs are excluded so names can be reused after archive.

create unique index if not exists venue_schedule_item_types_active_label_uidx
  on public.venue_schedule_item_types (venue_id, lower(label))
  where archived_at is null;
