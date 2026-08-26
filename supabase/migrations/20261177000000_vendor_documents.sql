-- ============================================================================
-- Vendor Documents V1 — library templates + share to event for venue/couple.
--
-- 1. Ownership metadata on documents (design: docs/vendor-onboarding-and-assets-design.md)
--    so venue-uploaded and vendor-uploaded rows live in one table.
-- 2. vendor_library_documents — reusable vendor-owned templates (COI, W-9, rate
--    card) that are not tied to a venue (vendors work with many venues).
-- 3. SECURITY DEFINER RPCs for vendors to manage library + attach/share onto an
--    assigned event (documents RLS is venue-scoped; vendors never write it
--    directly). Venue reads vendor-shared event rows via normal documents RLS.
-- ============================================================================

-- ── 1. Ownership on documents ────────────────────────────────────────────────

alter table public.documents
  add column if not exists uploaded_by_type text not null default 'venue'
    check (uploaded_by_type in ('venue', 'vendor')),
  add column if not exists uploaded_by_id uuid,
  add column if not exists source_library_document_id uuid;

create index if not exists documents_uploaded_by_vendor
  on public.documents (event_id, uploaded_by_type)
  where uploaded_by_type = 'vendor';

-- ── 2. Vendor reusable library ───────────────────────────────────────────────

create table if not exists public.vendor_library_documents (
  id            uuid primary key default gen_random_uuid(),
  vendor_id     uuid not null references public.vendors (id) on delete cascade,
  name          text not null,
  file_name     text not null,
  file_size     bigint,
  mime_type     text,
  storage_path  text not null,
  storage_url   text not null,
  category      text not null default 'other'
                  check (category in (
                    'contract', 'insurance', 'inspiration', 'floor_plan',
                    'menu', 'permit', 'questionnaire', 'invoice_copy', 'other'
                  )),
  notes         text,
  expires_at    date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists vendor_library_documents_vendor
  on public.vendor_library_documents (vendor_id, created_at desc);

drop trigger if exists vendor_library_documents_updated_at on public.vendor_library_documents;
create trigger vendor_library_documents_updated_at
  before update on public.vendor_library_documents
  for each row execute function public.set_updated_at();

alter table public.documents
  drop constraint if exists documents_source_library_fk;
alter table public.documents
  add constraint documents_source_library_fk
  foreign key (source_library_document_id)
  references public.vendor_library_documents (id)
  on delete set null;

alter table public.vendor_library_documents enable row level security;

-- Vendors manage their own library via RLS; venues never touch this table
-- directly (event-shared copies live in documents).
drop policy if exists vendor_library_documents_own on public.vendor_library_documents;
create policy vendor_library_documents_own on public.vendor_library_documents
  for all
  using      (vendor_id = public.current_user_vendor_id())
  with check (vendor_id = public.current_user_vendor_id());

grant select, insert, update, delete on public.vendor_library_documents to authenticated;

-- ── 3. RPCs ──────────────────────────────────────────────────────────────────

-- Library list
create or replace function public.get_vendor_library_documents()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor_id uuid;
begin
  v_vendor_id := current_user_vendor_id();
  if v_vendor_id is null then
    return '{"error":"unauthorized"}'::jsonb;
  end if;

  return jsonb_build_object(
    'documents', coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'id', d.id,
          'name', d.name,
          'fileName', d.file_name,
          'fileSize', d.file_size,
          'mimeType', d.mime_type,
          'storagePath', d.storage_path,
          'storageUrl', d.storage_url,
          'category', d.category,
          'notes', d.notes,
          'expiresAt', d.expires_at,
          'createdAt', d.created_at
        ) order by d.created_at desc)
        from public.vendor_library_documents d
        where d.vendor_id = v_vendor_id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.get_vendor_library_documents() to authenticated;

-- Create library row (file already uploaded to storage by the API route)
create or replace function public.create_vendor_library_document(
  p_name         text,
  p_file_name    text,
  p_file_size    bigint,
  p_mime_type    text,
  p_storage_path text,
  p_storage_url  text,
  p_category     text default 'other',
  p_notes        text default null,
  p_expires_at   date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor_id uuid;
  v_id        uuid;
  v_category  text;
begin
  v_vendor_id := current_user_vendor_id();
  if v_vendor_id is null then
    return '{"ok":false,"error":"unauthorized"}'::jsonb;
  end if;

  v_category := coalesce(nullif(trim(p_category), ''), 'other');
  if v_category not in (
    'contract', 'insurance', 'inspiration', 'floor_plan',
    'menu', 'permit', 'questionnaire', 'invoice_copy', 'other'
  ) then
    return '{"ok":false,"error":"invalid_category"}'::jsonb;
  end if;

  if coalesce(nullif(trim(p_storage_url), ''), '') = ''
     or coalesce(nullif(trim(p_storage_path), ''), '') = '' then
    return '{"ok":false,"error":"missing_file"}'::jsonb;
  end if;

  insert into public.vendor_library_documents (
    vendor_id, name, file_name, file_size, mime_type,
    storage_path, storage_url, category, notes, expires_at
  ) values (
    v_vendor_id,
    coalesce(nullif(trim(p_name), ''), p_file_name),
    p_file_name,
    p_file_size,
    p_mime_type,
    p_storage_path,
    p_storage_url,
    v_category,
    nullif(trim(coalesce(p_notes, '')), ''),
    p_expires_at
  )
  returning id into v_id;

  return jsonb_build_object('ok', true, 'documentId', v_id);
end;
$$;

grant execute on function public.create_vendor_library_document(
  text, text, bigint, text, text, text, text, text, date
) to authenticated;

-- Delete library row (caller removes storage object separately if desired)
create or replace function public.delete_vendor_library_document(p_document_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor_id uuid;
  v_path      text;
begin
  v_vendor_id := current_user_vendor_id();
  if v_vendor_id is null then
    return '{"ok":false,"error":"unauthorized"}'::jsonb;
  end if;

  delete from public.vendor_library_documents
  where id = p_document_id and vendor_id = v_vendor_id
  returning storage_path into v_path;

  if v_path is null then
    return '{"ok":false,"error":"not_found"}'::jsonb;
  end if;

  return jsonb_build_object('ok', true, 'storagePath', v_path);
end;
$$;

grant execute on function public.delete_vendor_library_document(uuid) to authenticated;

-- Attach library doc or one-off upload onto an assigned event (writes documents)
create or replace function public.share_vendor_document_to_event(
  p_assignment_id          uuid,
  p_library_document_id    uuid default null,
  p_name                   text default null,
  p_file_name              text default null,
  p_file_size              bigint default null,
  p_mime_type              text default null,
  p_storage_path           text default null,
  p_storage_url            text default null,
  p_category               text default 'other',
  p_notes                  text default null,
  p_expires_at             date default null,
  p_share_with_couple      boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor_id   uuid;
  v_venue_id    uuid;
  v_event_id    uuid;
  v_doc_id      uuid;
  v_name        text;
  v_file_name   text;
  v_file_size   bigint;
  v_mime_type   text;
  v_storage_path text;
  v_storage_url  text;
  v_category    text;
  v_notes       text;
  v_expires_at  date;
begin
  v_vendor_id := current_user_vendor_id();
  if v_vendor_id is null then
    return '{"ok":false,"error":"unauthorized"}'::jsonb;
  end if;

  select eva.venue_id, eva.event_id into v_venue_id, v_event_id
  from public.event_vendor_assignments eva
  where eva.id = p_assignment_id and eva.vendor_id = v_vendor_id;

  if v_event_id is null then
    return '{"ok":false,"error":"not_found"}'::jsonb;
  end if;

  if p_library_document_id is not null then
    select
      d.name, d.file_name, d.file_size, d.mime_type,
      d.storage_path, d.storage_url, d.category, d.notes, d.expires_at
    into
      v_name, v_file_name, v_file_size, v_mime_type,
      v_storage_path, v_storage_url, v_category, v_notes, v_expires_at
    from public.vendor_library_documents d
    where d.id = p_library_document_id and d.vendor_id = v_vendor_id;

    if v_storage_url is null then
      return '{"ok":false,"error":"library_not_found"}'::jsonb;
    end if;

    -- Optional override name when attaching
    if nullif(trim(coalesce(p_name, '')), '') is not null then
      v_name := trim(p_name);
    end if;
    if p_notes is not null then
      v_notes := nullif(trim(p_notes), '');
    end if;
    if coalesce(nullif(trim(p_category), ''), '') <> '' then
      v_category := trim(p_category);
    end if;
  else
    v_name         := coalesce(nullif(trim(coalesce(p_name, '')), ''), p_file_name);
    v_file_name    := p_file_name;
    v_file_size    := p_file_size;
    v_mime_type    := p_mime_type;
    v_storage_path := p_storage_path;
    v_storage_url  := p_storage_url;
    v_category     := coalesce(nullif(trim(coalesce(p_category, '')), ''), 'other');
    v_notes        := nullif(trim(coalesce(p_notes, '')), '');
    v_expires_at   := p_expires_at;

    if coalesce(nullif(trim(coalesce(v_storage_url, '')), ''), '') = ''
       or coalesce(nullif(trim(coalesce(v_file_name, '')), ''), '') = '' then
      return '{"ok":false,"error":"missing_file"}'::jsonb;
    end if;
  end if;

  if v_category not in (
    'contract', 'insurance', 'inspiration', 'floor_plan',
    'menu', 'permit', 'questionnaire', 'invoice_copy', 'other'
  ) then
    return '{"ok":false,"error":"invalid_category"}'::jsonb;
  end if;

  insert into public.documents (
    venue_id, event_id,
    name, file_name, file_size, mime_type, storage_path, storage_url,
    category, notes, expires_at,
    shared_with_vendors, is_couple_visible,
    uploaded_by_type, uploaded_by_id, source_library_document_id
  ) values (
    v_venue_id, v_event_id,
    v_name, v_file_name, v_file_size, v_mime_type, v_storage_path, v_storage_url,
    v_category, v_notes, v_expires_at,
    false, coalesce(p_share_with_couple, false),
    'vendor', v_vendor_id, p_library_document_id
  )
  returning id into v_doc_id;

  return jsonb_build_object('ok', true, 'documentId', v_doc_id);
end;
$$;

grant execute on function public.share_vendor_document_to_event(
  uuid, uuid, text, text, bigint, text, text, text, text, text, date, boolean
) to authenticated;

-- Docs this vendor shared onto one assignment's event
create or replace function public.get_vendor_event_uploads(p_assignment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor_id uuid;
  v_event_id  uuid;
begin
  v_vendor_id := current_user_vendor_id();
  if v_vendor_id is null then
    return '{"error":"unauthorized"}'::jsonb;
  end if;

  select eva.event_id into v_event_id
  from public.event_vendor_assignments eva
  where eva.id = p_assignment_id and eva.vendor_id = v_vendor_id;

  if v_event_id is null then
    return '{"error":"not_found"}'::jsonb;
  end if;

  return jsonb_build_object(
    'documents', coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'id', d.id,
          'name', d.name,
          'category', d.category,
          'storageUrl', d.storage_url,
          'mimeType', d.mime_type,
          'notes', d.notes,
          'isCoupleVisible', d.is_couple_visible,
          'createdAt', d.created_at
        ) order by d.created_at desc)
        from public.documents d
        where d.event_id = v_event_id
          and d.uploaded_by_type = 'vendor'
          and d.uploaded_by_id = v_vendor_id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.get_vendor_event_uploads(uuid) to authenticated;

-- Cross-event: everything this vendor has shared onto events
create or replace function public.get_vendor_uploaded_documents()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor_id uuid;
begin
  v_vendor_id := current_user_vendor_id();
  if v_vendor_id is null then
    return '{"error":"unauthorized"}'::jsonb;
  end if;

  return jsonb_build_object(
    'events', coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'assignmentId', ev.id,
          'eventId', ev.event_id,
          'eventName', e.name,
          'eventDate', e.event_date,
          'venueName', v.name,
          'documents', coalesce(
            (
              select jsonb_agg(jsonb_build_object(
                'id', d.id,
                'name', d.name,
                'category', d.category,
                'storageUrl', d.storage_url,
                'mimeType', d.mime_type,
                'notes', d.notes,
                'isCoupleVisible', d.is_couple_visible
              ) order by d.created_at desc)
              from public.documents d
              where d.event_id = ev.event_id
                and d.uploaded_by_type = 'vendor'
                and d.uploaded_by_id = v_vendor_id
            ),
            '[]'::jsonb
          )
        ) order by e.event_date desc nulls last)
        from public.event_vendor_assignments ev
        join public.events e on e.id = ev.event_id
        join public.venues v on v.id = e.venue_id
        where ev.vendor_id = v_vendor_id
          and exists (
            select 1 from public.documents d
            where d.event_id = ev.event_id
              and d.uploaded_by_type = 'vendor'
              and d.uploaded_by_id = v_vendor_id
          )
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.get_vendor_uploaded_documents() to authenticated;

-- Vendor removes their own event-shared document row
create or replace function public.delete_vendor_event_document(p_document_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor_id uuid;
  v_path      text;
begin
  v_vendor_id := current_user_vendor_id();
  if v_vendor_id is null then
    return '{"ok":false,"error":"unauthorized"}'::jsonb;
  end if;

  delete from public.documents
  where id = p_document_id
    and uploaded_by_type = 'vendor'
    and uploaded_by_id = v_vendor_id
  returning storage_path into v_path;

  if v_path is null then
    return '{"ok":false,"error":"not_found"}'::jsonb;
  end if;

  return jsonb_build_object('ok', true, 'storagePath', v_path);
end;
$$;

grant execute on function public.delete_vendor_event_document(uuid) to authenticated;

notify pgrst, 'reload schema';
