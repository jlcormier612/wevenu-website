-- Work Package D4 — closes a real enforcement gap in the Document Domain
-- foundation (D1). `canonical_document_versions.locked_at` was documented
-- as "the immutability marker," and `lockVersion()` sets it exactly once
-- via an app-level `WHERE locked_at IS NULL` guard — but nothing at the
-- database level ever stopped an `authenticated` UPDATE from changing
-- `content` (or re-stamping `locked_at`) on a version after it was
-- locked. Confirmed by a real transactional test during D4 validation:
-- an UPDATE against a locked, finalized Contract's current version
-- succeeded. `canonical_document_representations` already has this same
-- protection (UPDATE revoked for all roles); versions need the
-- equivalent, but as a trigger rather than a blanket REVOKE, because
-- `createVersion()` legitimately still flips `is_current` to false on a
-- prior (possibly locked) version when a new one is requested — only
-- `content` and `locked_at` itself must become truly frozen once set.

create or replace function canonical_document_versions_enforce_immutability()
returns trigger
language plpgsql
as $$
begin
  if old.locked_at is not null then
    if new.content is distinct from old.content
       or new.locked_at is distinct from old.locked_at
       or new.document_id is distinct from old.document_id
       or new.sequence_number is distinct from old.sequence_number
    then
      raise exception 'canonical_document_versions: version % is locked and immutable', old.id
        using errcode = '23001'; -- restrict_violation
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists canonical_document_versions_immutability on canonical_document_versions;
create trigger canonical_document_versions_immutability
  before update on canonical_document_versions
  for each row
  execute function canonical_document_versions_enforce_immutability();
