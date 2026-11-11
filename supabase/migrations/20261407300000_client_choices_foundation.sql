-- Client Choices foundation — collaborative post-contract selections.
-- Working domain only. Finalize applies into Event Order; money stays on
-- existing invoice / payment-plan machinery. Append-only submissions.
-- Additive. Does not mutate contracts, commercial_selections, or invent
-- a second financial system.

-- ---- 1. Templates (library) ---------------------------------------------------

create table public.client_choices_templates (
  id            uuid primary key default gen_random_uuid(),
  venue_id      uuid not null references public.venues (id) on delete cascade,
  name          text not null check (char_length(trim(name)) > 0),
  description   text,
  is_archived   boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index client_choices_templates_venue on public.client_choices_templates (venue_id);

create trigger client_choices_templates_updated_at
  before update on public.client_choices_templates
  for each row execute function public.set_updated_at();

create table public.client_choices_template_sections (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid not null references public.client_choices_templates (id) on delete cascade,
  venue_id      uuid not null references public.venues (id) on delete cascade,
  name          text not null check (char_length(trim(name)) > 0),
  guidance      text,
  sort_order    smallint not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index client_choices_template_sections_order
  on public.client_choices_template_sections (template_id, sort_order);

create trigger client_choices_template_sections_updated_at
  before update on public.client_choices_template_sections
  for each row execute function public.set_updated_at();

create table public.client_choices_template_groups (
  id               uuid primary key default gen_random_uuid(),
  template_id      uuid not null references public.client_choices_templates (id) on delete cascade,
  venue_id         uuid not null references public.venues (id) on delete cascade,
  section_id       uuid references public.client_choices_template_sections (id) on delete set null,
  name             text not null check (char_length(trim(name)) > 0),
  instructions     text,
  selection_mode   text not null default 'single'
                   check (selection_mode in ('single', 'multi')),
  min_select       smallint not null default 0 check (min_select >= 0),
  max_select       smallint check (max_select is null or max_select >= 0),
  allow_quantity   boolean not null default false,
  sort_order       smallint not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index client_choices_template_groups_order
  on public.client_choices_template_groups (template_id, sort_order);

create trigger client_choices_template_groups_updated_at
  before update on public.client_choices_template_groups
  for each row execute function public.set_updated_at();

create table public.client_choices_template_options (
  id             uuid primary key default gen_random_uuid(),
  template_id    uuid not null references public.client_choices_templates (id) on delete cascade,
  venue_id       uuid not null references public.venues (id) on delete cascade,
  group_id       uuid not null references public.client_choices_template_groups (id) on delete cascade,
  offering_id    uuid references public.offerings (id) on delete set null,
  label          text not null check (char_length(trim(label)) > 0),
  description    text,
  is_included    boolean not null default true,
  unit_price     numeric(10,2) check (unit_price is null or unit_price >= 0),
  sort_order     smallint not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index client_choices_template_options_order
  on public.client_choices_template_options (group_id, sort_order);
create index client_choices_template_options_offering
  on public.client_choices_template_options (offering_id)
  where offering_id is not null;

create trigger client_choices_template_options_updated_at
  before update on public.client_choices_template_options
  for each row execute function public.set_updated_at();

-- ---- 2. Instance (event-scoped working asset) ---------------------------------

create table public.client_choices (
  id                          uuid primary key default gen_random_uuid(),
  venue_id                    uuid not null references public.venues (id) on delete cascade,
  event_id                    uuid not null references public.events (id) on delete cascade,
  client_id                   uuid references public.clients (id) on delete set null,
  template_id                 uuid references public.client_choices_templates (id) on delete set null,

  name                        text not null check (char_length(trim(name)) > 0),
  status                      text not null default 'draft'
                              check (status in (
                                'draft',
                                'sent',
                                'in_progress',
                                'submitted',
                                'changes_requested',
                                'resubmitted',
                                'finalized'
                              )),

  access_key                  text not null unique
                              default lower(replace(gen_random_uuid()::text, '-', '')),

  -- Frozen choice definition (sections/groups/options) at create/send.
  definition                  jsonb not null default '{"sections":[],"groups":[],"options":[]}'::jsonb,
  -- Working answers keyed by group id.
  answers                     jsonb not null default '{}'::jsonb,

  sent_at                     timestamptz,
  opened_at                   timestamptz,
  submitted_at                timestamptz,
  changes_requested_at        timestamptz,
  changes_requested_note      text,
  finalized_at                timestamptz,

  event_order_id              uuid references public.event_orders (id) on delete set null,
  applied_line_ids            uuid[] not null default '{}',
  finalized_submission_number integer,

  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index client_choices_venue_event on public.client_choices (venue_id, event_id);
create index client_choices_status on public.client_choices (venue_id, status);
create unique index client_choices_access_key on public.client_choices (access_key);

create trigger client_choices_updated_at
  before update on public.client_choices
  for each row execute function public.set_updated_at();

-- ---- 3. Append-only submission / finalize snapshots ---------------------------

create table public.client_choices_submissions (
  id                 uuid primary key default gen_random_uuid(),
  venue_id           uuid not null references public.venues (id) on delete cascade,
  client_choices_id  uuid not null references public.client_choices (id) on delete cascade,
  event_id           uuid not null references public.events (id) on delete cascade,
  submission_number  integer not null check (submission_number > 0),
  outcome_status     text not null
                     check (outcome_status in ('submitted', 'resubmitted', 'finalized')),
  snapshot           jsonb not null,
  submitted_by       text not null default 'client'
                     check (submitted_by in ('client', 'venue')),
  created_at         timestamptz not null default now(),
  unique (client_choices_id, submission_number)
);

create index client_choices_submissions_order
  on public.client_choices_submissions (client_choices_id, submission_number desc);

-- ---- 4. Activity --------------------------------------------------------------

create table public.client_choices_activities (
  id                 uuid primary key default gen_random_uuid(),
  venue_id           uuid not null references public.venues (id) on delete cascade,
  client_choices_id  uuid not null references public.client_choices (id) on delete cascade,
  type               text not null,
  title              text not null,
  description        text,
  created_at         timestamptz not null default now()
);

create index client_choices_activities_order
  on public.client_choices_activities (client_choices_id, created_at desc);

-- ---- 5. RLS -------------------------------------------------------------------

alter table public.client_choices_templates          enable row level security;
alter table public.client_choices_template_sections  enable row level security;
alter table public.client_choices_template_groups    enable row level security;
alter table public.client_choices_template_options   enable row level security;
alter table public.client_choices                    enable row level security;
alter table public.client_choices_submissions        enable row level security;
alter table public.client_choices_activities         enable row level security;

create policy client_choices_templates_all on public.client_choices_templates
  for all using (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy client_choices_template_sections_all on public.client_choices_template_sections
  for all using (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy client_choices_template_groups_all on public.client_choices_template_groups
  for all using (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy client_choices_template_options_all on public.client_choices_template_options
  for all using (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy client_choices_all on public.client_choices
  for all using (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy client_choices_submissions_select on public.client_choices_submissions
  for select using (venue_id = public.current_user_venue_id());

create policy client_choices_submissions_insert on public.client_choices_submissions
  for insert with check (venue_id = public.current_user_venue_id());

create policy client_choices_activities_all on public.client_choices_activities
  for all using (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.client_choices_templates to authenticated;
grant select, insert, update, delete on public.client_choices_template_sections to authenticated;
grant select, insert, update, delete on public.client_choices_template_groups to authenticated;
grant select, insert, update, delete on public.client_choices_template_options to authenticated;
grant select, insert, update, delete on public.client_choices to authenticated;
grant select, insert on public.client_choices_submissions to authenticated;
grant select, insert on public.client_choices_submissions to service_role;
grant select, insert, update, delete on public.client_choices_activities to authenticated;

-- ---- 6. Portal RPCs -----------------------------------------------------------

create or replace function public.get_client_choices_for_portal(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_ids record;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.event_id is null then
    return jsonb_build_object('choices', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'choices', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', cc.id,
        'name', cc.name,
        'status', cc.status,
        'definition', cc.definition,
        'answers', cc.answers,
        'changesRequestedNote', cc.changes_requested_note,
        'sentAt', cc.sent_at,
        'submittedAt', cc.submitted_at,
        'finalizedAt', cc.finalized_at,
        'eventOrderId', cc.event_order_id,
        'updatedAt', cc.updated_at
      ) order by cc.created_at desc)
      from public.client_choices cc
      where cc.event_id = v_ids.event_id
        and cc.status <> 'draft'
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.get_client_choices_for_portal(text) to anon, authenticated;

create or replace function public.save_client_choices_answers(
  p_token text,
  p_choices_id uuid,
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids record;
  v_row public.client_choices%rowtype;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.event_id is null then
    return jsonb_build_object('ok', false, 'message', 'Session expired.');
  end if;

  select * into v_row
  from public.client_choices
  where id = p_choices_id and event_id = v_ids.event_id;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Choices not found.');
  end if;

  if v_row.status not in ('sent', 'in_progress', 'changes_requested') then
    return jsonb_build_object('ok', false, 'message', 'These choices are locked right now.');
  end if;

  update public.client_choices
  set
    answers = coalesce(p_answers, '{}'::jsonb),
    status = case when status = 'sent' then 'in_progress' else status end,
    opened_at = coalesce(opened_at, now())
  where id = v_row.id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.save_client_choices_answers(text, uuid, jsonb) to anon, authenticated;

create or replace function public.submit_client_choices(
  p_token text,
  p_choices_id uuid,
  p_answers jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids record;
  v_row public.client_choices%rowtype;
  v_next int;
  v_outcome text;
  v_answers jsonb;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.event_id is null then
    return jsonb_build_object('ok', false, 'message', 'Session expired.');
  end if;

  select * into v_row
  from public.client_choices
  where id = p_choices_id and event_id = v_ids.event_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Choices not found.');
  end if;

  if v_row.status not in ('sent', 'in_progress', 'changes_requested') then
    return jsonb_build_object('ok', false, 'message', 'These choices are locked right now.');
  end if;

  v_answers := coalesce(p_answers, v_row.answers);
  v_outcome := case
    when v_row.status = 'changes_requested' then 'resubmitted'
    else 'submitted'
  end;

  select coalesce(max(submission_number), 0) + 1 into v_next
  from public.client_choices_submissions
  where client_choices_id = v_row.id;

  insert into public.client_choices_submissions (
    venue_id, client_choices_id, event_id, submission_number,
    outcome_status, snapshot, submitted_by
  ) values (
    v_row.venue_id, v_row.id, v_row.event_id, v_next,
    v_outcome,
    jsonb_build_object(
      'definition', v_row.definition,
      'answers', v_answers,
      'name', v_row.name
    ),
    'client'
  );

  update public.client_choices
  set
    answers = v_answers,
    status = v_outcome,
    submitted_at = now(),
    changes_requested_note = null,
    changes_requested_at = null,
    opened_at = coalesce(opened_at, now())
  where id = v_row.id;

  insert into public.client_choices_activities (venue_id, client_choices_id, type, title)
  values (
    v_row.venue_id, v_row.id,
    v_outcome,
    case when v_outcome = 'resubmitted' then 'Client resubmitted choices' else 'Client submitted choices' end
  );

  return jsonb_build_object('ok', true, 'status', v_outcome, 'submissionNumber', v_next);
end;
$$;

grant execute on function public.submit_client_choices(text, uuid, jsonb) to anon, authenticated;

-- ---- 7. Documents workspace: include client_choices -------------------------

alter table public.document_workspace_pins
  drop constraint if exists document_workspace_pins_doc_type_check;
alter table public.document_workspace_pins
  add constraint document_workspace_pins_doc_type_check
  check (doc_type in ('document', 'contract', 'invoice', 'floor_plan', 'questionnaire', 'event_order', 'client_choices'));

alter table public.document_workspace_interactions
  drop constraint if exists document_workspace_interactions_doc_type_check;
alter table public.document_workspace_interactions
  add constraint document_workspace_interactions_doc_type_check
  check (doc_type in ('document', 'contract', 'invoice', 'floor_plan', 'questionnaire', 'event_order', 'client_choices'));

create or replace function public.get_venue_documents(
  p_lead_id   uuid default null,
  p_client_id uuid default null,
  p_event_id  uuid default null,
  p_vendor_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_venue_id uuid := public.current_user_venue_id();
begin
  if v_venue_id is null then return jsonb_build_object('documents', '[]'::jsonb); end if;

  return jsonb_build_object(
    'documents', coalesce((
      select jsonb_agg(doc order by (doc->>'createdAt') desc)
      from (
        select jsonb_build_object(
          'docType',        'document',
          'id',              d.id,
          'name',            d.name,
          'category',        d.category,
          'status',          null,
          'currentVersion',  1 + (select count(*) from public.document_file_versions v where v.document_id = d.id),
          'ownerType',       case
                                when d.lead_id   is not null then 'lead'
                                when d.client_id is not null then 'client'
                                when d.event_id  is not null then 'event'
                                when d.vendor_id is not null then 'vendor'
                                else 'venue'
                              end,
          'leadId',          d.lead_id,
          'clientId',        d.client_id,
          'eventId',         d.event_id,
          'vendorId',        d.vendor_id,
          'relationshipName', coalesce(
                                (select l.first_name || ' & ' || coalesce(nullif(l.partner_first_name, ''), l.last_name) from public.leads l where l.id = d.lead_id),
                                (select c.first_name || ' & ' || coalesce(nullif(c.partner_first_name, ''), c.last_name) from public.clients c where c.id = d.client_id),
                                (select v.business_name from public.vendors v where v.id = d.vendor_id)
                              ),
          'eventName',       (select e.name from public.events e where e.id = d.event_id),
          'fileUrl',         d.storage_url,
          'fileSize',        d.file_size,
          'mimeType',        d.mime_type,
          'isCoupleVisible', d.is_couple_visible,
          'isVendorVisible', d.shared_with_vendors,
          'uploadedByType',  d.uploaded_by_type,
          'createdAt',       d.created_at,
          'updatedAt',       d.updated_at
        ) as doc
        from public.documents d
        where d.venue_id = v_venue_id
          and (p_lead_id   is null or d.lead_id   = p_lead_id)
          and (p_client_id is null or d.client_id = p_client_id)
          and (p_event_id  is null or d.event_id  = p_event_id)
          and (p_vendor_id is null or d.vendor_id = p_vendor_id)

        union all

        select jsonb_build_object(
          'docType',         'contract',
          'id',               c.id,
          'name',             c.title,
          'category',         'contract',
          'status',           c.status,
          'currentVersion',   1,
          'ownerType',        case when c.event_id is not null then 'event' else 'client' end,
          'leadId',           null,
          'clientId',         c.client_id,
          'eventId',          c.event_id,
          'vendorId',         null,
          'relationshipName', (select cl.first_name || ' & ' || coalesce(nullif(cl.partner_first_name, ''), cl.last_name) from public.clients cl where cl.id = c.client_id),
          'eventName',        (select e.name from public.events e where e.id = c.event_id),
          'fileUrl',          null,
          'fileSize',         null,
          'mimeType',         null,
          'isCoupleVisible',  c.is_couple_visible,
          'isVendorVisible',  false,
          'uploadedByType',   'venue',
          'signToken',        case when c.status <> 'signed' then c.sign_token else null end,
          'signedAt',         c.signed_at,
          'createdAt',        c.created_at,
          'updatedAt',        c.updated_at
        ) as doc
        from public.contracts c
        where c.venue_id = v_venue_id
          and p_lead_id is null and p_vendor_id is null
          and (p_client_id is null or c.client_id = p_client_id)
          and (p_event_id  is null or c.event_id  = p_event_id)

        union all

        select jsonb_build_object(
          'docType',         'invoice',
          'id',               i.id,
          'name',             'Invoice ' || coalesce(i.invoice_number, '#'),
          'category',         'invoice',
          'status',           i.status,
          'currentVersion',   1,
          'ownerType',        case when i.event_id is not null then 'event' else 'client' end,
          'leadId',           null,
          'clientId',         i.client_id,
          'eventId',          i.event_id,
          'vendorId',         null,
          'relationshipName', (select cl.first_name || ' & ' || coalesce(nullif(cl.partner_first_name, ''), cl.last_name) from public.clients cl where cl.id = i.client_id),
          'eventName',        (select e.name from public.events e where e.id = i.event_id),
          'fileUrl',          null,
          'fileSize',         null,
          'mimeType',         null,
          'isCoupleVisible',  i.is_couple_visible,
          'isVendorVisible',  false,
          'uploadedByType',   'venue',
          'amount',           i.total,
          'balanceDue',       i.balance_due,
          'createdAt',        i.created_at,
          'updatedAt',        i.updated_at
        ) as doc
        from public.invoices i
        where i.venue_id = v_venue_id
          and p_lead_id is null and p_vendor_id is null
          and (p_client_id is null or i.client_id = p_client_id)
          and (p_event_id  is null or i.event_id  = p_event_id)

        union all

        select jsonb_build_object(
          'docType',         'floor_plan',
          'id',               fp.id,
          'name',             fp.name,
          'category',         'floor_plan',
          'status',           null,
          'currentVersion',   1,
          'ownerType',        'event',
          'leadId',           null,
          'clientId',         null,
          'eventId',          fp.event_id,
          'vendorId',         null,
          'relationshipName', (
            select cl.first_name || ' & ' || coalesce(nullif(cl.partner_first_name, ''), cl.last_name)
            from public.events e
            join public.clients cl on cl.id = e.client_id
            where e.id = fp.event_id
          ),
          'eventName',        (select e.name from public.events e where e.id = fp.event_id),
          'fileUrl',          null,
          'fileSize',         null,
          'mimeType',         null,
          'isCoupleVisible',  false,
          'isVendorVisible',  true,
          'uploadedByType',   'venue',
          'createdAt',        fp.created_at,
          'updatedAt',        fp.updated_at
        ) as doc
        from public.floor_plans fp
        where fp.venue_id = v_venue_id
          and p_lead_id is null and p_client_id is null and p_vendor_id is null
          and (p_event_id is null or fp.event_id = p_event_id)

        union all

        select jsonb_build_object(
          'docType',         'questionnaire',
          'id',               q.id,
          'name',             'Final Details Questionnaire',
          'category',         'questionnaire',
          'status',           q.status,
          'currentVersion',   1,
          'ownerType',        'event',
          'leadId',           null,
          'clientId',         (select e.client_id from public.events e where e.id = q.event_id),
          'eventId',          q.event_id,
          'vendorId',         null,
          'relationshipName', (
            select cl.first_name || ' & ' || coalesce(nullif(cl.partner_first_name, ''), cl.last_name)
            from public.events e
            join public.clients cl on cl.id = e.client_id
            where e.id = q.event_id
          ),
          'eventName',        (select e.name from public.events e where e.id = q.event_id),
          'fileUrl',          null,
          'fileSize',         null,
          'mimeType',         null,
          'isCoupleVisible',  true,
          'isVendorVisible',  false,
          'uploadedByType',   'venue',
          'createdAt',        q.created_at,
          'updatedAt',        q.updated_at
        ) as doc
        from public.event_questionnaires q
        where q.venue_id = v_venue_id
          and q.status <> 'draft'
          and p_lead_id is null and p_client_id is null and p_vendor_id is null
          and (p_event_id is null or q.event_id = p_event_id)

        union all

        select jsonb_build_object(
          'docType',         'event_order',
          'id',               eo.id,
          'name',             coalesce(nullif(e.name, ''), 'Event') || ' Event Order',
          'category',         'event_order',
          'status',           case
                                when eo.status = 'finalized' then 'finalized'
                                when eo.shared_at is not null then 'shared'
                                else 'open'
                              end,
          'currentVersion',   greatest(eo.revision, 1),
          'ownerType',        'event',
          'leadId',           null,
          'clientId',         e.client_id,
          'eventId',          eo.event_id,
          'vendorId',         null,
          'relationshipName', (select cl.first_name || ' & ' || coalesce(nullif(cl.partner_first_name, ''), cl.last_name) from public.clients cl where cl.id = e.client_id),
          'eventName',        e.name,
          'fileUrl',          null,
          'fileSize',         null,
          'mimeType',         null,
          'isCoupleVisible',  eo.shared_at is not null,
          'isVendorVisible',  false,
          'uploadedByType',   'venue',
          'hasFinalArtifact', eo.shared_at is not null,
          'createdAt',        eo.created_at,
          'updatedAt',        eo.updated_at
        ) as doc
        from public.event_orders eo
        join public.events e on e.id = eo.event_id
        where eo.venue_id = v_venue_id
          and p_lead_id is null and p_vendor_id is null
          and (p_client_id is null or e.client_id = p_client_id)
          and (p_event_id  is null or eo.event_id = p_event_id)

        union all

        select jsonb_build_object(
          'docType',         'client_choices',
          'id',               cc.id,
          'name',             cc.name,
          'category',         'client_choices',
          'status',           cc.status,
          'currentVersion',   greatest((
                                select coalesce(max(s.submission_number), 1)
                                from public.client_choices_submissions s
                                where s.client_choices_id = cc.id
                              ), 1),
          'ownerType',        'event',
          'leadId',           null,
          'clientId',         coalesce(cc.client_id, e.client_id),
          'eventId',          cc.event_id,
          'vendorId',         null,
          'relationshipName', (select cl.first_name || ' & ' || coalesce(nullif(cl.partner_first_name, ''), cl.last_name) from public.clients cl where cl.id = coalesce(cc.client_id, e.client_id)),
          'eventName',        e.name,
          'fileUrl',          null,
          'fileSize',         null,
          'mimeType',         null,
          'isCoupleVisible',  cc.status <> 'draft',
          'isVendorVisible',  false,
          'uploadedByType',   'venue',
          'hasFinalArtifact', cc.status = 'finalized',
          'createdAt',        cc.created_at,
          'updatedAt',        cc.updated_at
        ) as doc
        from public.client_choices cc
        join public.events e on e.id = cc.event_id
        where cc.venue_id = v_venue_id
          and cc.status <> 'draft'
          and p_lead_id is null and p_vendor_id is null
          and (p_client_id is null or coalesce(cc.client_id, e.client_id) = p_client_id)
          and (p_event_id  is null or cc.event_id = p_event_id)
      ) docs
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.get_venue_documents(uuid, uuid, uuid, uuid) to authenticated;

-- Couple Documents: finalized Client Choices as a permanent portal record
create or replace function public.get_couple_documents(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids record;
begin
  select * into v_ids from _resolve_portal_ids(p_token);
  if v_ids.client_id is null then return null; end if;

  return jsonb_build_object(
    'documents', coalesce((
      select jsonb_agg(doc order by (doc->>'createdAt') desc)
      from (
        select jsonb_build_object(
          'id',          c.id,
          'docType',     'contract',
          'name',        coalesce(nullif(trim(c.title),''), 'Venue Contract'),
          'status',      c.status,
          'signedAt',    c.signed_at,
          'amount',      null,
          'fileUrl',     (
            select d.storage_url
            from public.documents d
            where d.is_couple_visible = true
              and d.category = 'contract'
              and d.storage_url is not null
              and (
                (c.event_id is not null and d.event_id = c.event_id)
                or d.client_id = c.client_id
              )
            order by d.created_at desc
            limit 1
          ),
          'content',     c.content,
          'signToken',   case when c.status not in ('signed') then c.sign_token else null end,
          'uploadedBy',  'venue',
          'createdAt',   c.created_at
        )
        from contracts c
        where c.client_id = v_ids.client_id
          and c.is_couple_visible = true

        union all

        select jsonb_build_object(
          'id',         i.id,
          'docType',    'invoice',
          'name',       'Invoice ' || coalesce(i.invoice_number, '#'),
          'status',     i.status,
          'signedAt',   null,
          'amount',     i.total,
          'balanceDue', i.balance_due,
          'fileUrl',    null,
          'lineItems', (
            select coalesce(jsonb_agg(jsonb_build_object(
              'id', li.id, 'description', li.description, 'quantity', li.quantity,
              'unitPrice', li.unit_price, 'amount', li.amount, 'type', li.type
            ) order by li.sort_order), '[]'::jsonb)
            from invoice_line_items li
            where li.invoice_id = i.id
          ),
          'uploadedBy', 'venue',
          'createdAt',  i.created_at
        )
        from invoices i
        where i.client_id = v_ids.client_id
          and i.is_couple_visible = true

        union all

        select jsonb_build_object(
          'id',          d.id,
          'docType',     coalesce(d.category, 'other'),
          'name',        d.name,
          'status',      null,
          'signedAt',    null,
          'amount',      null,
          'fileUrl',     d.storage_url,
          'fileSize',    d.file_size,
          'mimeType',    d.mime_type,
          'uploadedBy',  case
            when d.uploaded_by_type = 'vendor' then 'vendor'
            else 'venue'
          end,
          'vendorName',  case
            when d.uploaded_by_type = 'vendor' then coalesce((
              select nullif(trim(vnd.business_name), '')
              from public.vendors vnd
              where vnd.id = d.uploaded_by_id
            ), 'Vendor')
            else null
          end,
          'createdAt',   d.created_at
        )
        from documents d
        where d.is_couple_visible = true
          and (d.client_id = v_ids.client_id or (v_ids.event_id is not null and d.event_id = v_ids.event_id))
          and d.category != 'contract'

        union all

        select jsonb_build_object(
          'id',              cd.id,
          'docType',         coalesce(cd.source_type, 'upload'),
          'name',            cd.name,
          'status',          null,
          'signedAt',        null,
          'amount',          null,
          'fileUrl',         cd.file_url,
          'fileSize',        cd.file_size,
          'mimeType',        cd.mime_type,
          'uploadedBy',      cd.uploaded_by,
          'shareWithVenue',  cd.share_with_venue,
          'vendorName',      null,
          'createdAt',       cd.created_at
        )
        from couple_documents cd
        where cd.client_id = v_ids.client_id

        union all

        select jsonb_build_object(
          'id',          cc.id,
          'docType',     'client_choices',
          'name',        cc.name,
          'status',      cc.status,
          'signedAt',    null,
          'amount',      null,
          'fileUrl',     null,
          'uploadedBy',  'venue',
          'vendorName',  null,
          'createdAt',   coalesce(cc.finalized_at, cc.submitted_at, cc.sent_at, cc.created_at)
        )
        from public.client_choices cc
        where cc.status = 'finalized'
          and (
            (v_ids.event_id is not null and cc.event_id = v_ids.event_id)
            or cc.client_id = v_ids.client_id
          )
      ) docs(doc)
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.get_couple_documents(text) to anon, authenticated;

notify pgrst, 'reload schema';
