-- Planning Template Library: archive support + default-index fix.
--
-- playbook_templates_default previously covered only (venue_id, event_type),
-- so a Client Planning and a Venue Planning template for the same event type
-- could never both be marked default even though the app already reads
-- isDefault scoped by kind too. Rebuilding it to include kind is required
-- for "Set as Default" to work without spurious unique-constraint failures.

alter table public.playbook_templates
  add column is_archived boolean not null default false;

drop index if exists public.playbook_templates_default;

create unique index playbook_templates_default
  on public.playbook_templates (venue_id, event_type, kind)
  where is_default = true;
