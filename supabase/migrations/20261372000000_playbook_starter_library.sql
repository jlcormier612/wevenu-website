-- Planning Templates starter masters — persistent source_master_key.
-- Library template → copied event tasks/milestones architecture unchanged.

alter table public.playbook_templates
  add column if not exists source_master_key text;

comment on column public.playbook_templates.source_master_key is
  'Hello to Cheers starter master key when provisioned from a protected master. Null for venue-created templates.';

create unique index if not exists playbook_templates_venue_source_master_key_uidx
  on public.playbook_templates (venue_id, source_master_key)
  where source_master_key is not null;
