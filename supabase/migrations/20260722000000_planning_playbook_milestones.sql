-- ============================================================================
-- Planning Playbooks — Milestones
--
-- Replaces the fixed 4-value TaskPhase enum (planning/final_details/
-- wedding_day/post_wedding) with venue-editable Milestones — the one new
-- entity approved in docs/planning-playbook-experience-design.md, justified
-- there because a fixed enum can't be renamed or reordered by a venue, and
-- "feels like planning an event" requires that it can be.
--
-- Two-layer pattern (Engineering Standard #11 — shared definition vs. situated
-- execution, applied here as canonical kind vs. custom label): a milestone's
-- `name` is fully venue-editable; an optional, nullable `kind` carries the
-- small set of system-meaningful facts a milestone can opt into:
--   'event_day'     — drives the Couple Portal's day-of takeover view
--   'final_stretch' — drives the Couple Portal's pre-wedding nudge banner
-- A milestone with kind = null is pure organization with no special system
-- behavior — this is what lets a venue add "Vendor Selection" or any other
-- custom chapter with zero side effects, while the two system-relied-upon
-- moments stay resolvable regardless of what a venue calls them.
--
-- playbook_tasks.milestone_id is a live FK — both are "definition side"
-- (Standard #11), edited together. event_tasks instead gets a milestone_name
-- + milestone_kind snapshot, copied at apply-time — matching the
-- already-confirmed pattern that applying a playbook COPIES tasks so editing
-- a playbook never silently alters events already in progress
-- (docs/planning-playbooks-design.md).
-- ============================================================================

create table public.playbook_milestones (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.playbook_templates (id) on delete cascade,
  venue_id    uuid not null references public.venues (id) on delete cascade,
  name        text not null,
  kind        text check (kind in ('event_day', 'final_stretch')),
  sort_order  smallint not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (char_length(trim(name)) > 0)
);

create index playbook_milestones_template on public.playbook_milestones (template_id, sort_order);
-- At most one event_day / final_stretch milestone per template — both optional,
-- but unambiguous when present, since the Couple Portal keys off of them.
create unique index playbook_milestones_one_event_day     on public.playbook_milestones (template_id) where kind = 'event_day';
create unique index playbook_milestones_one_final_stretch on public.playbook_milestones (template_id) where kind = 'final_stretch';

create trigger playbook_milestones_updated_at
  before update on public.playbook_milestones
  for each row execute function public.set_updated_at();

alter table public.playbook_milestones enable row level security;

create policy playbook_milestones_all on public.playbook_milestones
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.playbook_milestones to authenticated;

-- ── Seed all 4 milestones for every existing template ───────────────────────
-- (Every template gets all four regardless of which phases its tasks actually
-- use today, so a venue adding a new task later always has somewhere to put it.)
insert into public.playbook_milestones (template_id, venue_id, name, kind, sort_order)
select t.id, t.venue_id, m.name, m.kind, m.sort_order
from public.playbook_templates t
cross join (values
  ('Planning',      null::text,       0::smallint),
  ('Final Details', 'final_stretch',  1::smallint),
  ('Wedding Day',   'event_day',      2::smallint),
  ('Post-Wedding',  null::text,       3::smallint)
) as m(name, kind, sort_order);

-- ── playbook_tasks: add milestone_id, backfill from phase, drop phase ───────
alter table public.playbook_tasks add column milestone_id uuid references public.playbook_milestones (id) on delete set null;

update public.playbook_tasks pt
set milestone_id = pm.id
from public.playbook_milestones pm
where pm.template_id = pt.template_id
  and pm.sort_order = case coalesce(pt.phase, 'planning')
    when 'planning'      then 0
    when 'final_details' then 1
    when 'wedding_day'   then 2
    when 'post_wedding'  then 3
  end;

alter table public.playbook_tasks alter column milestone_id set not null;
create index playbook_tasks_milestone on public.playbook_tasks (milestone_id, sort_order);
alter table public.playbook_tasks drop column phase;

-- ── event_tasks: snapshot milestone_name/milestone_kind, drop phase ─────────
alter table public.event_tasks add column milestone_name text;
alter table public.event_tasks add column milestone_kind text check (milestone_kind in ('event_day', 'final_stretch'));

update public.event_tasks et
set milestone_name = case coalesce(et.phase, 'planning')
    when 'planning'      then 'Planning'
    when 'final_details' then 'Final Details'
    when 'wedding_day'   then 'Wedding Day'
    when 'post_wedding'  then 'Post-Wedding'
  end,
  milestone_kind = case coalesce(et.phase, 'planning')
    when 'final_details' then 'final_stretch'
    when 'wedding_day'   then 'event_day'
    else null
  end;

alter table public.event_tasks alter column milestone_name set not null;
alter table public.event_tasks drop column phase;

-- ── applyPlaybookToEvent now writes milestone_name/milestone_kind instead of
--    phase — no DB-side change needed beyond the columns above; the insert
--    is done from the application layer (lib/playbooks/repository.ts).

-- ── get_portal_tasks: return milestone name/kind instead of phase ───────────
create or replace function public.get_portal_tasks(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session       public.client_portal_sessions%rowtype;
  v_effective_role text;
  v_event         record;
  v_tasks         jsonb;
begin
  select * into v_session
  from public.client_portal_sessions
  where access_token = p_token
    and (expires_at is null or expires_at > now());
  if not found then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  -- Effective role: contact's portal_role overrides session access_level
  if v_session.contact_id is not null then
    select portal_role into v_effective_role
    from public.client_contacts
    where id = v_session.contact_id;
    v_effective_role := coalesce(v_effective_role, v_session.access_level);
  else
    v_effective_role := v_session.access_level;
  end if;

  -- Financial-only contacts cannot see planning tasks
  if v_effective_role = 'financial' or v_effective_role = 'reminders_only' then
    return jsonb_build_object('tasks', '[]'::jsonb);
  end if;

  select id, event_date into v_event
  from public.events
  where client_id = v_session.client_id
    and venue_id  = v_session.venue_id
    and status not in ('cancelled')
  order by event_date asc limit 1;

  if not found then
    return jsonb_build_object('tasks', '[]'::jsonb);
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'id',            t.id,
      'title',         t.title,
      'description',   t.description,
      'category',      t.category,
      'ownerType',     t.owner_type,
      'visibility',    t.visibility,
      'dueDate',       t.due_date,
      'daysOffset',    t.days_offset,
      'milestoneName', t.milestone_name,
      'milestoneKind', t.milestone_kind,
      'status',        t.status,
      'isRequired',    t.is_required,
      'completedAt',   t.completed_at,
      -- view_only contacts can see but not complete tasks
      'canComplete',   t.visibility = 'client_owned'
                       and t.status not in ('complete', 'waived', 'blocked')
                       and v_effective_role in ('full_access', 'planning', 'couple')
    )
    order by t.due_date asc, t.sort_order asc
  )
  into v_tasks
  from public.event_tasks t
  where t.event_id  = v_event.id
    and t.venue_id  = v_session.venue_id
    and t.visibility in ('client_visible', 'client_owned')
    and t.status   != 'waived';

  return jsonb_build_object('tasks', coalesce(v_tasks, '[]'::jsonb));
end;
$$;

notify pgrst, 'reload schema';
