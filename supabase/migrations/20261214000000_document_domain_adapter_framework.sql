-- ============================================================================
-- Document Domain — Phase 5 (2A): Canonical Adapter Framework, DB side.
--
-- Additive with one narrow exception, explained rather than silently
-- made (per this phase's own FINAL RULE): building the Producer
-- Readiness Table (docs/document-domain-producer-readiness.md) surfaced
-- that canonical_document_references.reference_type — created in
-- 20261213000000_document_domain_foundation.sql — was constrained to a
-- closed 7-value CHECK enum ('contract','invoice','message','task',
-- 'playbook','vendor_library_source','supersedes'). That list has no
-- room for Floor Plans, Timelines, Questionnaires, or AI Drafts —
-- meaning 4 of the 8 real producers this phase must assess could never
-- create a Reference at all, not because of anything the certified
-- architecture requires, but because of an inconsistency in how Phase 4
-- implemented it. The certified architecture is explicit that
-- classification fields like this one must be "extensible without
-- schema change" (canonical-architecture.md §2, applied correctly to
-- Document.type, missed here). Widening this CHECK to free text is not
-- a change to the certified architecture — it is correcting Phase 4's
-- own implementation to actually match a principle that was already
-- certified. Nothing about this alters tested behavior: no
-- reference_type value outside the original 7 was ever exercised by
-- Phase 4's own validation, so nothing regresses.
--
-- Everything else in this file is purely additive — no other ALTER on
-- any table, trigger, or function from 20261213000000. "The Document
-- Foundation remains unchanged" otherwise holds exactly as stated: this
-- file adds the one new function that the shared TypeScript adapter
-- framework (lib/document-domain/) calls as its sole write path for
-- "adapt a producer record."
--
-- Idempotency protection (§4/§8 of this phase's brief) genuinely requires
-- database-level atomicity — a check-then-insert done from two round
-- trips in application code is inherently racy under concurrent calls
-- (e.g. two webhook retries for the same contract signing arriving
-- together). This function makes "has this producer record already been
-- adapted" and "create it if not" one atomic operation, using the unique
-- constraint Phase 4 already created on canonical_document_references as
-- the actual arbiter — reusing existing validation, not duplicating it.
-- ============================================================================

-- Correction (see header) — widen reference_type to match Document.type's
-- own extensibility principle. Every reference_type value this phase
-- actually uses ('contract', 'vendor_library_source', etc.) keeps working
-- unchanged; this only removes the ceiling that blocked new ones.
alter table public.canonical_document_references
  drop constraint if exists canonical_document_references_reference_type_check;

comment on column public.canonical_document_references.reference_type is
  'Free text, extensible without schema change — same reasoning as canonical_documents.type. Corrected from a closed CHECK enum in 20261214000000; see that migration''s header.';

create or replace function public.adapt_producer_to_canonical_document(
  p_owner_type      text,
  p_owner_id        uuid,
  p_source          text,
  p_type            text,
  p_behavior        text,
  p_name            text,
  p_reference_type  text,
  p_reference_id    uuid,
  p_reference_role  text default 'produced_by'
)
returns table (document_id uuid, created boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_document_id uuid;
begin
  -- Fast path: this exact producer record was already adapted by an
  -- earlier call (the common case for a retried/duplicate call).
  select cdr.document_id into v_document_id
  from public.canonical_document_references cdr
  where cdr.reference_type = p_reference_type
    and cdr.reference_id = p_reference_id
    and cdr.role = p_reference_role;

  if v_document_id is not null then
    return query select v_document_id, false;
    return;
  end if;

  -- Not found (as far as we could see without a lock) — attempt to
  -- create it. canonical_documents_owner_id_shape (Phase 4) validates
  -- the owner shape here automatically; a bad owner raises from this
  -- INSERT exactly as it would from any other caller, reused not
  -- duplicated.
  insert into public.canonical_documents (owner_type, owner_id, source, type, behavior, name)
  values (p_owner_type, p_owner_id, p_source, p_type, p_behavior, p_name)
  returning id into v_document_id;

  begin
    insert into public.canonical_document_references (document_id, reference_type, reference_id, role)
    values (v_document_id, p_reference_type, p_reference_id, p_reference_role);
  exception when unique_violation then
    -- Lost a race against a concurrent caller adapting the same producer
    -- record between our fast-path check and this insert. Discard the
    -- orphaned Document we just created (it has no reference and nothing
    -- else could have linked to it in this same transaction) and return
    -- the winner's id instead — the caller sees exactly the same result
    -- either way: one canonical Document, whichever call created it.
    delete from public.canonical_documents where id = v_document_id;

    select cdr.document_id into v_document_id
    from public.canonical_document_references cdr
    where cdr.reference_type = p_reference_type
      and cdr.reference_id = p_reference_id
      and cdr.role = p_reference_role;

    return query select v_document_id, false;
    return;
  end;

  return query select v_document_id, true;
end;
$$;

comment on function public.adapt_producer_to_canonical_document is
  'Document Domain Adapter Framework (Phase 5). Atomic, idempotent "adapt this producer record" — the sole DB entry point the shared TypeScript framework uses to create a canonical Document from any producer. Safe under concurrent duplicate calls.';

grant execute on function public.adapt_producer_to_canonical_document(
  text, uuid, text, text, text, text, text, uuid, text
) to authenticated;

notify pgrst, 'reload schema';
