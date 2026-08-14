-- HQ admin authoring for legal_documents.
-- Content fields stay immutable after insert; only is_active may change.
-- Writes are gated by is_hq_admin() (same pattern as success_library).

-- Prevent content / identity field mutation after insert. Activation flips
-- is_active only; new text requires a new version row.
create or replace function public.legal_documents_immutable_content()
returns trigger
language plpgsql
as $$
begin
  if new.document_type is distinct from old.document_type
     or new.title is distinct from old.title
     or new.version is distinct from old.version
     or new.effective_date is distinct from old.effective_date
     or new.content is distinct from old.content
  then
    raise exception
      'legal_documents content fields are immutable; create a new version instead';
  end if;
  return new;
end;
$$;

create trigger legal_documents_immutable_content
  before update on public.legal_documents
  for each row
  execute function public.legal_documents_immutable_content();

-- HQ can read all versions (active + inactive). Active remain public via
-- legal_documents_select_active.
create policy legal_documents_hq_select on public.legal_documents
  for select to authenticated
  using (public.is_hq_admin());

create policy legal_documents_hq_insert on public.legal_documents
  for insert to authenticated
  with check (public.is_hq_admin());

create policy legal_documents_hq_update on public.legal_documents
  for update to authenticated
  using (public.is_hq_admin())
  with check (public.is_hq_admin());

grant insert, update on public.legal_documents to authenticated;

notify pgrst, 'reload schema';
