-- ============================================================================
-- Client Planning vs. Venue Workflow — the two-workflow Planning Playbook model
--
-- Implements the approved product decisions in
-- docs/planning-playbooks-two-workflow-model.md and the follow-up product
-- decisions: two independent playbook kinds (client/venue, vendor-owned tasks
-- stay part of Venue Workflow), a relative-date rule type (extensible, V1
-- only implements relative_to_event), per-task due-date override tracking so
-- event-date recalculation can skip explicitly-overridden tasks, and the
-- duplicate-application guard moving from one-per-event to one-per-(event,kind).
--
-- Deliberately NOT auto-splitting existing playbooks' tasks by owner_type —
-- per explicit product decision, existing playbooks are superseded by new,
-- intentionally-built reference playbooks (Standard Client Planning / Standard
-- Venue Workflow), not migrated. The `kind` column still needs a value for
-- existing rows to satisfy NOT NULL, so it's backfilled from each template's
-- own majority task owner_type — a practical schema necessity, not a claim
-- that the old templates are now correctly categorized playbooks.
-- ============================================================================

-- ── STEP 1: playbook_templates.kind ──────────────────────────────────────────

alter table public.playbook_templates add column kind text;

with majority as (
  select x.template_id, (array_agg(x.owner_type order by x.cnt desc))[1] as top_owner
  from (
    select template_id, owner_type, count(*) as cnt
    from public.playbook_tasks
    group by template_id, owner_type
  ) x
  group by x.template_id
)
update public.playbook_templates t
set kind = case when m.top_owner = 'couple' then 'client' else 'venue' end
from majority m
where m.template_id = t.id;

-- Templates with zero tasks have no majority to compute from.
update public.playbook_templates set kind = 'venue' where kind is null;

alter table public.playbook_templates alter column kind set not null;
alter table public.playbook_templates add constraint playbook_templates_kind_check check (kind in ('client', 'venue'));
alter table public.playbook_templates alter column kind set default 'venue';

-- ── STEP 2: due_date_rule_kind — extensible scheduling rule type ────────────
-- V1 only implements relative_to_event (the existing days_offset math,
-- unchanged). Future kinds (relative_to_task, relative_to_trigger) are added
-- by extending this check constraint and adding their own reference
-- column(s) when they're actually built — not speculatively now.

alter table public.playbook_tasks
  add column due_date_rule_kind text not null default 'relative_to_event'
  check (due_date_rule_kind in ('relative_to_event'));

alter table public.event_tasks
  add column due_date_rule_kind text not null default 'relative_to_event'
  check (due_date_rule_kind in ('relative_to_event'));

-- ── STEP 3: per-task due-date override tracking ──────────────────────────────
-- Product rule: relative due dates stay synchronized with the event date
-- automatically, until a coordinator explicitly overrides one task's date —
-- after that, recalculation skips that task rather than silently overwriting
-- a deliberate manual change.

alter table public.event_tasks add column due_date_locked boolean not null default false;

-- ── STEP 4: event_playbook_applications — one per (event, kind), not one per event ─

alter table public.event_playbook_applications add column kind text;

update public.event_playbook_applications epa
set kind = pt.kind
from public.playbook_templates pt
where pt.id = epa.template_id;

update public.event_playbook_applications set kind = 'venue' where kind is null;

alter table public.event_playbook_applications drop constraint event_playbook_applications_pkey;
alter table public.event_playbook_applications alter column kind set not null;
alter table public.event_playbook_applications add constraint event_playbook_applications_kind_check check (kind in ('client', 'venue'));
alter table public.event_playbook_applications add primary key (event_id, kind);

notify pgrst, 'reload schema';
