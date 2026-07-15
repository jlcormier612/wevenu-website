-- ============================================================================
-- Automation Framework — Phase 1
--
-- Per docs/platform-orchestration-architecture.md and
-- docs/platform-event-adoption-plan.md: Automation is a consumer of
-- Platform Events, exactly like the Notification consumer already is.
-- Automation never owns business logic or feature state — every action it
-- executes calls the owning feature's existing service/repository layer;
-- this migration adds no business logic of its own, only the rule
-- definitions and an execution log.
--
-- Changes:
--   1. automation_rules   — trigger event type, simple conditions, one
--      action + its params, enabled/disabled. Venue-scoped, coordinator-
--      manageable (no UI built yet, per scope — grants are in place for
--      when one exists).
--   2. automation_executions — one row per (rule, platform_event)
--      evaluation, whether or not the action actually ran. The unique
--      constraint on (rule_id, platform_event_id) is the framework's
--      entire idempotency guarantee: a rule can never execute twice for
--      the same event, even under concurrent or repeated sweep runs.
-- ============================================================================

create table public.automation_rules (
  id                  uuid primary key default gen_random_uuid(),
  venue_id            uuid not null references public.venues(id) on delete cascade,

  name                text not null,
  trigger_event_type  text not null,          -- e.g. "Booking.Confirmed" — see docs/platform-event-adoption-plan.md §3

  -- Array of { field, operator, value }, ANDed together. No nested logic,
  -- no scripting — deliberately small per this phase's scope.
  conditions          jsonb not null default '[]'::jsonb,

  action_type         text not null,          -- a key in the Action Registry, e.g. "apply_planning_template"
  action_params       jsonb not null default '{}'::jsonb,

  enabled             boolean not null default true,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.automation_rules enable row level security;

create policy "venue manages own automation rules"
  on public.automation_rules for all
  using (venue_id = current_user_venue_id())
  with check (venue_id = current_user_venue_id());

grant select, insert, update, delete on public.automation_rules to authenticated;

create index automation_rules_trigger on public.automation_rules (trigger_event_type, venue_id) where enabled;

create trigger automation_rules_updated_at before update on public.automation_rules
  for each row execute function public.set_updated_at();


create table public.automation_executions (
  id                  uuid primary key default gen_random_uuid(),
  rule_id             uuid not null references public.automation_rules(id) on delete cascade,
  platform_event_id   uuid not null references public.platform_events(id) on delete cascade,

  status              text not null,          -- 'success' | 'failed' | 'conditions_not_met'
  error               text,

  executed_at         timestamptz not null default now(),

  unique (rule_id, platform_event_id)
);

alter table public.automation_executions enable row level security;

create policy "venue reads own automation executions"
  on public.automation_executions for select
  using (exists (
    select 1 from public.automation_rules r
    where r.id = automation_executions.rule_id and r.venue_id = current_user_venue_id()
  ));

-- Writes only from the engine (service role) — same posture as
-- platform_events and venue_notifications: no insert grant for authenticated.
grant select on public.automation_executions to authenticated;

create index automation_executions_rule on public.automation_executions (rule_id, executed_at desc);


-- ── Service-role grants for the engine ────────────────────────────────────────
-- The engine (lib/automation/engine.ts) runs as a system process — no staff
-- session — so it uses a service-role client. rolbypassrls does not imply
-- table-level privileges (the same gap found and fixed for the Request-
-- lifecycle wrap in Platform Event Framework Phase 1): each table the
-- engine or its actions touch needs an explicit grant here.

grant select on public.platform_events to service_role;
grant select on public.automation_rules to service_role;
grant select, insert on public.automation_executions to service_role;

-- apply_planning_template's own lookups/writes — the exact tables
-- lib/playbooks/repository.ts's applyPlaybookToEvent() (and the functions
-- it calls: getTemplate, getTemplateTasks, getMilestones) already touch.
grant select on public.events to service_role;
grant select on public.playbook_templates to service_role;
grant select on public.playbook_milestones to service_role;
grant select on public.playbook_tasks to service_role;
grant select, insert on public.event_playbook_applications to service_role;
grant select, insert on public.event_tasks to service_role;

notify pgrst, 'reload schema';
