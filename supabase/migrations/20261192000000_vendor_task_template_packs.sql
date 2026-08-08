-- Vendor task templates → named packs with multiple items.
-- Flat rows become 1-item packs named after the old title.

-- ── 1. Items (tasks within a pack) ───────────────────────────────────────────
create table if not exists public.vendor_task_template_items (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null references public.vendor_task_templates(id) on delete cascade,
  title        text not null,
  days_offset  integer,
  notes        text,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists vendor_task_template_items_template
  on public.vendor_task_template_items (template_id, sort_order);

-- Migrate existing flat templates into 1-item packs before reshaping the parent.
insert into public.vendor_task_template_items (
  template_id, title, days_offset, notes, sort_order, created_at, updated_at
)
select
  t.id,
  t.title,
  t.days_offset,
  t.notes,
  0,
  t.created_at,
  t.updated_at
from public.vendor_task_templates t
where not exists (
  select 1 from public.vendor_task_template_items i where i.template_id = t.id
);

-- Reshape parent into a pack: title → name; drop per-task days_offset;
-- pack-level notes optional (old notes now live on items).
alter table public.vendor_task_templates rename column title to name;

alter table public.vendor_task_templates drop column if exists days_offset;

update public.vendor_task_templates set notes = null
where exists (
  select 1 from public.vendor_task_template_items i
  where i.template_id = vendor_task_templates.id
);

comment on table public.vendor_task_templates is
  'Named task template packs (e.g. Gold package). Items live in vendor_task_template_items.';

comment on column public.vendor_task_templates.name is
  'Pack name shown in the library and apply UI.';

comment on column public.vendor_task_templates.notes is
  'Optional pack-level notes (not copied onto applied tasks).';

alter table public.vendor_task_template_items enable row level security;

create policy "vendor_task_template_items_vendor_select"
  on public.vendor_task_template_items for select using (
    exists (
      select 1
      from public.vendor_task_templates t
      join public.vendor_users vu on vu.vendor_id = t.vendor_id
      where t.id = vendor_task_template_items.template_id
        and vu.user_id = auth.uid()
        and vu.is_active = true
    )
  );

create policy "vendor_task_template_items_vendor_manage"
  on public.vendor_task_template_items for all using (
    exists (
      select 1
      from public.vendor_task_templates t
      join public.vendor_users vu on vu.vendor_id = t.vendor_id
      where t.id = vendor_task_template_items.template_id
        and vu.user_id = auth.uid()
        and vu.role in ('owner', 'manager')
        and vu.is_active = true
    )
  );

grant select, insert, update, delete on public.vendor_task_template_items to authenticated;

create trigger vendor_task_template_items_updated_at
  before update on public.vendor_task_template_items
  for each row execute function public.set_updated_at();

-- ── 2. Item attachments (files on template task directions) ──────────────────
create table if not exists public.vendor_task_template_item_attachments (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid not null references public.vendor_task_template_items(id) on delete cascade,
  name         text not null,
  storage_path text not null,
  storage_url  text not null,
  mime_type    text,
  file_size    bigint,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists vendor_task_template_item_attachments_item
  on public.vendor_task_template_item_attachments (item_id, sort_order);

alter table public.vendor_task_template_item_attachments enable row level security;

create policy "vendor_task_template_item_attachments_vendor_select"
  on public.vendor_task_template_item_attachments for select using (
    exists (
      select 1
      from public.vendor_task_template_items i
      join public.vendor_task_templates t on t.id = i.template_id
      join public.vendor_users vu on vu.vendor_id = t.vendor_id
      where i.id = vendor_task_template_item_attachments.item_id
        and vu.user_id = auth.uid()
        and vu.is_active = true
    )
  );

create policy "vendor_task_template_item_attachments_vendor_manage"
  on public.vendor_task_template_item_attachments for all using (
    exists (
      select 1
      from public.vendor_task_template_items i
      join public.vendor_task_templates t on t.id = i.template_id
      join public.vendor_users vu on vu.vendor_id = t.vendor_id
      where i.id = vendor_task_template_item_attachments.item_id
        and vu.user_id = auth.uid()
        and vu.role in ('owner', 'manager')
        and vu.is_active = true
    )
  );

grant select, insert, update, delete on public.vendor_task_template_item_attachments to authenticated;

-- ── 3. Applied-task attachments + item provenance ────────────────────────────
create table if not exists public.vendor_task_attachments (
  id             uuid primary key default gen_random_uuid(),
  vendor_task_id uuid not null references public.vendor_tasks(id) on delete cascade,
  name           text not null,
  storage_path   text not null,
  storage_url    text not null,
  mime_type      text,
  file_size      bigint,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now()
);

create index if not exists vendor_task_attachments_task
  on public.vendor_task_attachments (vendor_task_id, sort_order);

alter table public.vendor_task_attachments enable row level security;

create policy "vendor_task_attachments_vendor_access"
  on public.vendor_task_attachments for all using (
    exists (
      select 1
      from public.vendor_tasks vt
      join public.vendor_users vu on vu.vendor_id = vt.vendor_id
      where vt.id = vendor_task_attachments.vendor_task_id
        and vu.user_id = auth.uid()
        and vu.is_active = true
    )
  );

grant select, insert, update, delete on public.vendor_task_attachments to authenticated;

alter table public.vendor_tasks
  add column if not exists template_item_id uuid
    references public.vendor_task_template_items(id) on delete set null;

create index if not exists vendor_tasks_template_item_id
  on public.vendor_tasks (template_item_id)
  where template_item_id is not null;

comment on column public.vendor_tasks.template_id is
  'Source pack when source=template; null for ad-hoc. Editing the pack does not rewrite this row.';

comment on column public.vendor_tasks.template_item_id is
  'Source template item within the pack when source=template.';

comment on column public.vendor_tasks.notes is
  'Vendor-private directions/instructions for this task (may include plain URLs).';
