-- Template Platform — Migration & Release Readiness: Archive parity.
--
-- Message Templates and Contract Templates were the only two of the eight
-- real template systems with hard-delete as their only removal path — no
-- "is_archived" column at all, unlike Planning/Timeline/Floor Plan
-- Templates' shared archive-first model, and unlike Packages/Pipeline
-- Templates, which already had an equivalent is_active column. Adding the
-- identical column those three already use, not a new concept.

alter table public.message_templates
  add column is_archived boolean not null default false;

alter table public.contract_templates
  add column is_archived boolean not null default false;

create index message_templates_archived on public.message_templates (venue_id, is_archived);
create index contract_templates_archived on public.contract_templates (venue_id, is_archived);
