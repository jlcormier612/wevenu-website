-- ============================================================================
-- Sprint 40 — Event Playbooks Foundation
--
-- The operational backbone of the platform.
-- Three tables enabling template-driven event task management:
--
--   playbook_templates  — venue templates by event type
--   playbook_tasks      — task definitions with relative dates, dependencies
--   event_tasks         — instances generated when an event is created
--
-- Key design decisions:
--   days_offset: positive = AFTER event, negative = BEFORE event
--     (supports post-event workflows: +7 = thank-you, +30 = review request)
--   status includes 'blocked': tasks locked by incomplete dependencies
--   dependency chain: task.depends_on_event_task_id → unlocked when dep completes
--   required vs optional: only required tasks affect Event Readiness score
--   visibility: foundation for Client Portal and Vendor Portal
-- ============================================================================

-- playbook_templates ----------------------------------------------------------
create table public.playbook_templates (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues (id) on delete cascade,
  name        text not null,            -- "Standard Wedding", "Corporate Event"
  event_type  text,                     -- maps to events.event_type (null = applies to all)
  is_default  boolean not null default false,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (char_length(trim(name)) > 0)
);

create index playbook_templates_venue on public.playbook_templates (venue_id);
-- Only one default template per venue per event_type
create unique index playbook_templates_default on public.playbook_templates (venue_id, event_type)
  where is_default = true;

create trigger playbook_templates_updated_at
  before update on public.playbook_templates
  for each row execute function public.set_updated_at();

-- playbook_tasks --------------------------------------------------------------
-- Task definitions within a template. Each generates one event_task per event.
create table public.playbook_tasks (
  id                    uuid primary key default gen_random_uuid(),
  template_id           uuid not null references public.playbook_templates (id) on delete cascade,
  venue_id              uuid not null references public.venues (id) on delete cascade,

  title                 text not null,
  description           text,

  -- Who does this and who can see it
  owner_type            text not null default 'coordinator'
                          check (owner_type in ('coordinator', 'couple', 'vendor', 'team')),
  visibility            text not null default 'coordinator_only'
                          check (visibility in (
                            'coordinator_only',   -- only venue team sees this
                            'client_visible',     -- couple can see but not edit
                            'client_owned',       -- couple must complete
                            'vendor_visible',     -- vendor can see
                            'vendor_owned'        -- vendor must complete
                          )),

  -- When is this due (relative to event date)
  -- NEGATIVE = before event (e.g., -30 = 30 days before)
  -- POSITIVE = after event  (e.g., +7  = 7 days after — for thank-you workflows)
  days_offset           integer not null,

  -- Task classification
  category              text not null default 'custom'
                          check (category in (
                            'communication',  -- emails, messages, calls
                            'financial',      -- payments, deposits, invoices
                            'planning',       -- timeline, floor plan, questionnaire
                            'document',       -- uploads needed (COI, permits, contracts)
                            'meeting',        -- walkthroughs, tours, final meetings
                            'internal',       -- coordinator-only prep
                            'custom'          -- anything else
                          )),

  -- Auto-completion: if set, this task auto-completes when the trigger fires
  auto_complete_trigger text,   -- 'contract_signed' | 'payment_received' |
                                -- 'questionnaire_submitted' | 'document_uploaded' |
                                -- 'timeline_created' | 'floor_plan_created'

  -- Dependency: this task is BLOCKED until the dependency task is complete
  depends_on_task_id    uuid references public.playbook_tasks (id) on delete set null,

  -- Scoring: required tasks affect Event Readiness %; optional don't
  is_required           boolean not null default true,

  -- Future: auto_reminder_days int[], late_notice_days int[]
  -- Added when the notification/sequence engine is built

  sort_order            smallint not null default 0,
  created_at            timestamptz not null default now(),
  check (char_length(trim(title)) > 0)
);

create index playbook_tasks_template on public.playbook_tasks (template_id, sort_order);

-- event_tasks -----------------------------------------------------------------
-- Generated instances when an event is assigned a playbook template.
-- One event_task per playbook_task per event.
create table public.event_tasks (
  id                       uuid primary key default gen_random_uuid(),
  venue_id                 uuid not null references public.venues  (id) on delete cascade,
  event_id                 uuid not null references public.events  (id) on delete cascade,
  template_task_id         uuid references public.playbook_tasks   (id) on delete set null,

  title                    text not null,
  description              text,
  owner_type               text not null default 'coordinator'
                             check (owner_type in ('coordinator', 'couple', 'vendor', 'team')),
  visibility               text not null default 'coordinator_only',
  due_date                 date not null,   -- real date: event_date + days_offset
  days_offset              integer not null, -- preserved for recalculation if event date changes
  category                 text not null default 'custom',
  auto_complete_trigger    text,
  is_required              boolean not null default true,

  -- Status lifecycle:
  --   pending   → task is due in the future, no dependency issues
  --   blocked   → dependency task is not yet complete
  --   complete  → done (manually or auto-completed)
  --   overdue   → past due_date, not complete (computed at read time, stored for querying)
  --   waived    → coordinator chose to skip this task
  status                   text not null default 'pending'
                             check (status in ('pending', 'blocked', 'complete', 'overdue', 'waived')),

  -- Dependency: this task is blocked until its dependency is complete
  depends_on_event_task_id uuid references public.event_tasks (id) on delete set null,

  -- Completion tracking
  completed_at             timestamptz,
  completed_by             text,   -- 'system' | coordinator name | 'couple' | 'vendor'
  notes                    text,

  sort_order               smallint not null default 0,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  check (char_length(trim(title)) > 0)
);

create index event_tasks_event  on public.event_tasks (event_id, due_date);
create index event_tasks_venue  on public.event_tasks (venue_id, status);
create index event_tasks_status on public.event_tasks (event_id, status)
  where status in ('pending', 'blocked', 'overdue');

create trigger event_tasks_updated_at
  before update on public.event_tasks
  for each row execute function public.set_updated_at();

-- RLS -------------------------------------------------------------------------
alter table public.playbook_templates enable row level security;
alter table public.playbook_tasks      enable row level security;
alter table public.event_tasks         enable row level security;

create policy playbook_templates_all on public.playbook_templates
  for all
  using      (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()));

create policy playbook_tasks_all on public.playbook_tasks
  for all
  using      (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()));

create policy event_tasks_all on public.event_tasks
  for all
  using      (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()));

grant select, insert, update, delete on public.playbook_templates to authenticated;
grant select, insert, update, delete on public.playbook_tasks      to authenticated;
grant select, insert, update, delete on public.event_tasks         to authenticated;

notify pgrst, 'reload schema';
