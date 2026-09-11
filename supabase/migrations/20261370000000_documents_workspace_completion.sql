-- Documents / Assets workstream completion
--
-- 1. Event Orders join the venue Documents Workspace union (representation/link).
-- 2. Questionnaire rows carry the couple relationship name.
-- 3. Generic upload file-replace history (append-only prior files).
-- 4. documents bucket becomes private; storage access is venue-path scoped.
-- 5. Pin/interaction doc_type accepts event_order.
--
-- Contracts / Inbox / Event Order signing+share architecture are not rewritten.

-- ── Pins / interactions: allow event_order ────────────────────────────────

alter table public.document_workspace_pins
  drop constraint if exists document_workspace_pins_doc_type_check;
alter table public.document_workspace_pins
  add constraint document_workspace_pins_doc_type_check
  check (doc_type in ('document', 'contract', 'invoice', 'floor_plan', 'questionnaire', 'event_order'));

alter table public.document_workspace_interactions
  drop constraint if exists document_workspace_interactions_doc_type_check;
alter table public.document_workspace_interactions
  add constraint document_workspace_interactions_doc_type_check
  check (doc_type in ('document', 'contract', 'invoice', 'floor_plan', 'questionnaire', 'event_order'));

-- ── Generic upload prior-file history ─────────────────────────────────────

create table if not exists public.document_file_versions (
  id              uuid primary key default gen_random_uuid(),
  venue_id        uuid not null references public.venues (id) on delete cascade,
  document_id     uuid not null references public.documents (id) on delete cascade,
  version_number  integer not null check (version_number > 0),
  file_name       text not null,
  file_size       bigint,
  mime_type       text,
  storage_path    text not null,
  storage_url     text not null,
  replaced_by     uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (document_id, version_number)
);

create index if not exists document_file_versions_doc
  on public.document_file_versions (document_id, version_number desc);

alter table public.document_file_versions enable row level security;

drop policy if exists document_file_versions_all on public.document_file_versions;
create policy document_file_versions_all on public.document_file_versions
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, delete on public.document_file_versions to authenticated;

-- Atomically archive the current file and point the document at the new one.
-- Caller uploads the new object first. On failure the new object is the
-- caller's to remove — this function never deletes storage.
create or replace function public.replace_document_file(
  p_document_id uuid,
  p_file_name   text,
  p_file_size   bigint,
  p_mime_type   text,
  p_storage_path text,
  p_storage_url  text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid := public.current_user_venue_id();
  v_doc public.documents%rowtype;
  v_next int;
begin
  if v_venue_id is null then
    return jsonb_build_object('ok', false, 'reason', 'unauthorized');
  end if;
  if p_document_id is null or coalesce(trim(p_storage_path), '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  select * into v_doc
  from public.documents
  where id = p_document_id and venue_id = v_venue_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  -- Idempotent: same current object already attached.
  if v_doc.storage_path = p_storage_path then
    return jsonb_build_object('ok', true, 'documentId', v_doc.id, 'version', 1 + (
      select count(*) from public.document_file_versions where document_id = v_doc.id
    ), 'idempotent', true);
  end if;

  select coalesce(max(version_number), 0) + 1 into v_next
  from public.document_file_versions
  where document_id = v_doc.id;

  insert into public.document_file_versions (
    venue_id, document_id, version_number, file_name, file_size, mime_type,
    storage_path, storage_url, replaced_by
  ) values (
    v_venue_id, v_doc.id, v_next, v_doc.file_name, v_doc.file_size, v_doc.mime_type,
    v_doc.storage_path, v_doc.storage_url, auth.uid()
  );

  update public.documents
  set file_name = coalesce(nullif(trim(p_file_name), ''), v_doc.file_name),
      file_size = p_file_size,
      mime_type = p_mime_type,
      storage_path = p_storage_path,
      storage_url = p_storage_url
  where id = v_doc.id and venue_id = v_venue_id;

  return jsonb_build_object(
    'ok', true,
    'documentId', v_doc.id,
    'version', v_next + 1,
    'archivedVersion', v_next
  );
end;
$$;

grant execute on function public.replace_document_file(uuid, text, bigint, text, text, text) to authenticated;

-- ── get_venue_documents: Event Orders + questionnaire relationship ────────

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

        -- Event Orders — producer-owned; Workspace is a representation/link.
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
      ) docs
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.get_venue_documents(uuid, uuid, uuid, uuid) to authenticated;

-- ── Private documents bucket + venue-path storage policies ────────────────
-- Contract / Event Order PDFs stay on their own private buckets.

update storage.buckets
  set public = false
  where id = 'documents';

drop policy if exists documents_storage_insert on storage.objects;
drop policy if exists documents_storage_select on storage.objects;
drop policy if exists documents_storage_delete on storage.objects;

-- Path convention: {venue_id}/{entity_type}/{entity_id}/{file}
create policy documents_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.current_user_venue_id()::text
  );

create policy documents_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.current_user_venue_id()::text
  );

create policy documents_storage_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.current_user_venue_id()::text
  )
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.current_user_venue_id()::text
  );

create policy documents_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.current_user_venue_id()::text
  );

notify pgrst, 'reload schema';
