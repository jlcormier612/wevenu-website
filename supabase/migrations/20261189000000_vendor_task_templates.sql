-- Vendor task templates: reusable defs vendors apply manually onto event-scoped
-- vendor_tasks. Flat library (one task per row) — not venue playbooks.

create table if not exists public.vendor_task_templates (
  id           uuid primary key default gen_random_uuid(),
  vendor_id    uuid not null references public.vendors(id) on delete cascade,
  title        text not null,
  notes        text,
  days_offset  integer,
  package_id   uuid references public.vendor_packages(id) on delete set null,
  event_type   text,
  is_active    boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists vendor_task_templates_vendor
  on public.vendor_task_templates (vendor_id, sort_order);

alter table public.vendor_task_templates enable row level security;

-- Active vendor users can read their org's templates (mirror vendor_tasks).
create policy "vendor_task_templates_vendor_select" on public.vendor_task_templates
  for select using (
    exists (
      select 1 from public.vendor_users vu
      where vu.vendor_id = vendor_task_templates.vendor_id
        and vu.user_id = auth.uid()
        and vu.is_active = true
    )
  );

-- Owner/manager mutate like vendor_packages.
create policy "vendor_task_templates_vendor_manage" on public.vendor_task_templates
  for all using (
    exists (
      select 1 from public.vendor_users vu
      where vu.vendor_id = vendor_task_templates.vendor_id
        and vu.user_id = auth.uid()
        and vu.role in ('owner', 'manager')
        and vu.is_active = true
    )
  );

grant select, insert, update, delete on public.vendor_task_templates to authenticated;

create trigger vendor_task_templates_updated_at
  before update on public.vendor_task_templates
  for each row execute function public.set_updated_at();

-- Extend vendor_tasks with template provenance + relative offset snapshot.
alter table public.vendor_tasks
  add column if not exists template_id uuid references public.vendor_task_templates(id) on delete set null,
  add column if not exists days_offset integer;

create index if not exists vendor_tasks_template_id
  on public.vendor_tasks (template_id)
  where template_id is not null;

-- No source check constraint today; document allowed values for app use:
-- 'manual' | 'venue' | 'luv' | 'automation' | 'template'
comment on column public.vendor_tasks.source is
  'manual | venue | luv | automation | template';

comment on column public.vendor_tasks.template_id is
  'Source template when source=template; null for ad-hoc. Editing the template does not rewrite this row.';

comment on column public.vendor_tasks.days_offset is
  'Snapshot of template days_offset at apply time (event_date + offset → due_date).';
