-- ============================================================================
-- Document Domain — Phase 4: Foundation.
--
-- Implements the certified canonical Document architecture
-- (docs/document-domain-canonical-architecture.md,
--  docs/document-domain-type-matrix-validation.md) as new, additive schema.
--
-- Touches NOTHING existing. `documents`, `contracts`, `invoices`,
-- `couple_documents`, `vendor_library_documents`, `floor_plans`,
-- `conversation_message_attachments`, `event_questionnaires` are all
-- untouched — every existing feature continues to read/write exactly as
-- it does today. This migration creates a parallel, empty foundation that
-- nothing yet writes to, matching the explicit Phase 4 mandate: "No
-- existing feature has changed. No user-visible behavior has changed."
--
-- Naming: prefixed `canonical_document_*` (and `canonical_documents` for
-- the root table) specifically to avoid colliding with the existing
-- `documents` table, which this is NOT replacing in this phase — see
-- docs/document-domain-adapter-plan.md for the eventual migration path.
--
-- Structure (matches the certified tree exactly):
--
--   canonical_documents
--       |
--       +-- canonical_document_versions
--       |       |
--       |       +-- canonical_document_representations
--       |
--       +-- canonical_document_references   (Business Object / Message /
--       |                                     Task links — reference only,
--       |                                     never ownership)
--       +-- canonical_document_shares       (Sharing grants)
--       +-- canonical_document_audit        (append-only history)
--       +-- canonical_document_events       (automation outbox, unwired)
--
-- Design decision requiring a note, not a halt (see FINAL RULE): the
-- certified architecture lists "Status" as a single Document property and
-- separately calls out an 8-state lifecycle. This phase's own brief titles
-- one of its sections "VERSION TRANSITIONS," which could be read as
-- implying Versions carry their own independent status. Resolved without
-- contradicting the certified architecture: canonical_documents.status is
-- the ONE authoritative 8-state lifecycle field (matches the architecture
-- one-to-one, §2). canonical_document_versions does NOT carry a second,
-- parallel status enum — that would be exactly the kind of redundant,
-- driftable state the architecture's Entity Model explicitly forbids
-- ("every property must have one clear responsibility, nothing
-- redundant"). Versions instead carry the minimal facts that make a
-- Document's status transitions meaningful: which version is current, and
-- when a version became permanently locked. "Version transitions" are
-- real — they are the specific lifecycle transitions (finalization,
-- supersession) that a new or newly-locked Version triggers on its
-- parent Document, not a second state machine. Documented here in full
-- per the brief's own instruction to explain reasoning before proceeding
-- rather than silently choosing, without treating this as a change to
-- the certified architecture (no property was omitted or added; this is
-- an implementation clarification of an underspecified relationship
-- between two already-certified properties).
-- ============================================================================


-- ── canonical_documents ──────────────────────────────────────────────────────
-- The Document entity (architecture §2), one-to-one with the certified
-- property list. Ownership (§3) is five exclusive types, never duplicated
-- across columns — owner_type + a single polymorphic owner_id, not five
-- separate nullable FK columns.

create table public.canonical_documents (
  id                  uuid primary key default gen_random_uuid(),

  -- Owner (§3) — exactly one of the five certified owner types. owner_id
  -- maps to venues.id / clients.id ("Relationship" in product language,
  -- per the architecture's own note that Relationship = the couple's
  -- whole journey, backed today by the `clients` table) / events.id /
  -- vendors.id; null only for 'system'.
  owner_type          text not null check (owner_type in ('system','venue','relationship','event','vendor')),
  owner_id            uuid,
  constraint canonical_documents_owner_id_shape
    check ((owner_type = 'system' and owner_id is null) or (owner_type <> 'system' and owner_id is not null)),

  -- Source (§2) — how the Document came to exist. Independent of Owner.
  source              text not null check (source in ('uploaded','generated','negotiated','ai_generated')),

  -- Type (§2) — extensible business meaning. Deliberately free text, not
  -- a CHECK enum: the architecture requires new Document Types to be
  -- addable as data, never a schema change (§9 of the canonical doc).
  type                text not null,

  -- Behavior (§4C of the Type Matrix validation) — exactly one of the six
  -- certified behaviors; determines which lifecycle states, and which
  -- capabilities (signable, approvable, generates a representation), are
  -- structurally meaningful for this Document. See
  -- canonical_document_behavior_capabilities() below — capabilities are
  -- derived from Behavior, not stored redundantly per-row.
  behavior            text not null check (behavior in
                         ('collaborative','venue_authored','negotiated','reference','generated','submitted')),

  -- Status (§2, §4B) — the single authoritative 8-state lifecycle field.
  status              text not null default 'draft' check (status in
                         ('draft','in_review','shared','pending_action','finalized','superseded','archived','deleted')),

  -- Metadata (§2) — free-form, Type-specific, never drives lifecycle logic.
  name                text not null,
  notes               text,
  tags                text[] not null default '{}',

  -- Expiry (§2) — independent of Retention and Archiving.
  expires_at          date,

  -- Retention (§2) — a policy pointer, not a deletion trigger by itself.
  -- Free text intentionally (e.g. "7-years-financial", "indefinite") —
  -- policy definitions belong to a future retention-rules table this
  -- phase does not build (out of scope: "no dashboards, no reports" and
  -- this is neither, but a full retention-policy engine is a Document
  -- Center feature, not foundation).
  retention_policy    text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index canonical_documents_owner on public.canonical_documents (owner_type, owner_id);
create index canonical_documents_status on public.canonical_documents (status);
create index canonical_documents_type on public.canonical_documents (type);
create index canonical_documents_expires on public.canonical_documents (expires_at) where expires_at is not null;

create trigger canonical_documents_updated_at
  before update on public.canonical_documents
  for each row execute function public.set_updated_at();

comment on table public.canonical_documents is
  'Document Domain foundation (Phase 4). Canonical Document entity per docs/document-domain-canonical-architecture.md. Not yet written to by any existing feature — see docs/document-domain-adapter-plan.md.';


-- ── canonical_document_versions ──────────────────────────────────────────────
-- The Version entity (§3 of this phase's brief: "Documents own Versions").
-- Deliberately minimal — see the design-decision note above for why this
-- does not carry its own parallel status enum.

create table public.canonical_document_versions (
  id                uuid primary key default gen_random_uuid(),
  document_id       uuid not null references public.canonical_documents(id) on delete cascade,

  sequence_number   integer not null,
  is_current        boolean not null default true,

  -- Living content, for behaviors that have it (Negotiated, Collaborative,
  -- Venue Authored) while still open. Null for pure Uploaded/Submitted
  -- types, where content and Representation coincide by design (§0 of
  -- the canonical architecture) — there is nothing to store here because
  -- the uploaded file itself, not text content, IS the record.
  content           text,

  -- Set exactly once, at the moment this version becomes permanently
  -- locked (signed / approved / submitted / generated-and-finalized).
  -- Never cleared. A non-null locked_at is what "immutable" means for a
  -- version's content going forward.
  locked_at         timestamptz,

  created_by_type   text not null check (created_by_type in ('system','venue','relationship','event','vendor','ai')),
  created_by_id     uuid,

  created_at        timestamptz not null default now()
);

-- At most one current version per document — Postgres has no inline CHECK
-- for this, so it's a partial unique index instead.
create unique index canonical_document_versions_one_current
  on public.canonical_document_versions (document_id) where is_current;

create unique index canonical_document_versions_sequence_unique
  on public.canonical_document_versions (document_id, sequence_number);

create index canonical_document_versions_document on public.canonical_document_versions (document_id, sequence_number desc);

comment on table public.canonical_document_versions is
  'Document Domain foundation (Phase 4). Versions own Representations; Documents own Versions. A Version never belongs to more than one Document, and a Representation never belongs to more than one Version — see canonical_document_representations.';


-- ── canonical_document_representations ───────────────────────────────────────
-- The Representation entity (§4 of this phase's brief). Belongs to exactly
-- one Version — never a document_id column exists on this table, which is
-- the actual enforcement mechanism for "Representations belong to
-- Versions, never directly to Documents": there is no column to violate
-- the rule with.

create table public.canonical_document_representations (
  id                    uuid primary key default gen_random_uuid(),
  version_id            uuid not null references public.canonical_document_versions(id) on delete cascade,

  representation_type   text not null check (representation_type in
                           ('pdf','image','print_layout','export','signed_copy')),
  -- 'preview'/'thumbnail' deliberately excluded from this enum — the
  -- certified Type Matrix validation (§7) found these are storage
  -- derivatives with zero trust/lifecycle weight, not Representations.
  -- They belong in front-end caching, not this table.

  -- Storage abstraction (§9 of this phase's brief) — a provider-agnostic
  -- pointer. No bucket is created, no file is written, by this migration.
  storage_provider      text not null default 'supabase' check (storage_provider in ('supabase','external')),
  storage_path          text,
  storage_url           text,
  mime_type             text,
  byte_size             bigint,
  checksum              text,

  generated_by_type     text not null check (generated_by_type in ('system','venue','relationship','event','vendor','ai')),
  generated_by_id       uuid,

  created_at            timestamptz not null default now()

  -- Deliberately no updated_at. A Representation is immutable (canonical
  -- architecture §4A) — a row that can never change has no meaningful
  -- "last updated" concept. Omitting the column is part of enforcing
  -- immutability, not an oversight; there is a REVOKE below making this
  -- structural, not just conventional.
);

create index canonical_document_representations_version on public.canonical_document_representations (version_id);

comment on table public.canonical_document_representations is
  'Document Domain foundation (Phase 4). Immutable once created — UPDATE is revoked for all roles below. A new Representation is always a new row, never a modification of an existing one.';


-- ── canonical_document_references ────────────────────────────────────────────
-- "Zero-or-more Reference links" (architecture §2/§5) — Business Objects,
-- Messages, Tasks, Playbooks, and the two ownership-change edge cases
-- (Relationship merge, Venue transfer — Type Matrix §12) all use this one
-- mechanism. Deliberately the ONLY place non-owning relationships are
-- recorded, so a Document's "produced by" Contract and its "attached to"
-- Message use the same table, not two competing ones.

create table public.canonical_document_references (
  id              uuid primary key default gen_random_uuid(),
  document_id     uuid not null references public.canonical_documents(id) on delete cascade,

  reference_type  text not null check (reference_type in
                     ('contract','invoice','message','task','playbook','vendor_library_source','supersedes')),
  reference_id    uuid not null,

  -- 'produced_by' | 'attached_to' | 'required_by' | 'cloned_from' |
  -- 'supersedes' — free text (extensible without schema change, same
  -- reasoning as Document.type), never structural.
  role            text not null,

  created_at      timestamptz not null default now(),
  unique (document_id, reference_type, reference_id, role)
);

create index canonical_document_references_document on public.canonical_document_references (document_id);
create index canonical_document_references_target on public.canonical_document_references (reference_type, reference_id);

comment on table public.canonical_document_references is
  'Document Domain foundation (Phase 4). Every non-owning relationship a Document participates in — Business Object linkage, message/task attachment, supersession chains, and the explicit-audited owner-change edge cases (Type Matrix §12).';


-- ── canonical_document_shares ────────────────────────────────────────────────
-- Sharing (§2) — explicit, revocable grants of Visibility. Visibility
-- itself (§2: "who can currently see this") is deliberately NOT a stored
-- column on canonical_documents — it is computed from the existence of a
-- non-revoked row here, via canonical_document_is_shared() below. Storing
-- it redundantly on the Document row would be exactly the kind of
-- driftable duplicate state the architecture forbids.

create table public.canonical_document_shares (
  id                uuid primary key default gen_random_uuid(),
  document_id       uuid not null references public.canonical_documents(id) on delete cascade,

  shared_with_type  text not null check (shared_with_type in ('relationship','vendor','venue')),
  shared_with_id    uuid not null,

  shared_by_type    text not null check (shared_by_type in ('venue','system')),
  shared_by_id      uuid,

  revoked_at        timestamptz,

  created_at        timestamptz not null default now()
);

create index canonical_document_shares_document on public.canonical_document_shares (document_id) where revoked_at is null;
create index canonical_document_shares_target on public.canonical_document_shares (shared_with_type, shared_with_id) where revoked_at is null;

comment on table public.canonical_document_shares is
  'Document Domain foundation (Phase 4). Visibility is derived from this table (see canonical_document_is_shared()), never stored redundantly on canonical_documents.';


-- ── canonical_document_audit ─────────────────────────────────────────────────
-- Audit (§2) — present for every Document, unlike today's landscape where
-- only contract_activities exists (Phase 1 finding). Append-only: no
-- UPDATE or DELETE grant to any role below.

create table public.canonical_document_audit (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid not null references public.canonical_documents(id) on delete cascade,
  version_id    uuid references public.canonical_document_versions(id) on delete set null,

  action        text not null,
  actor_type    text not null check (actor_type in ('system','venue','relationship','event','vendor','ai')),
  actor_id      uuid,
  detail        jsonb not null default '{}',

  created_at    timestamptz not null default now()
);

create index canonical_document_audit_document on public.canonical_document_audit (document_id, created_at desc);

comment on table public.canonical_document_audit is
  'Document Domain foundation (Phase 4). Append-only — INSERT only, no UPDATE/DELETE grants below. The audit trail every Document type gets, not just Contracts.';


-- ── canonical_document_events ────────────────────────────────────────────────
-- Automation event infrastructure (§6 of this phase's brief) — the ten
-- canonical event types certified in the Type Matrix validation (§9),
-- and ONLY those ten. No document-specific events. This is infrastructure
-- only: nothing in this migration triggers automatically on INSERT/UPDATE
-- of any other table. emit_canonical_document_event() below is a callable
-- function, not a wired trigger — matching "no implementation wiring yet."

create table public.canonical_document_events (
  id              uuid primary key default gen_random_uuid(),
  document_id     uuid not null references public.canonical_documents(id) on delete cascade,
  version_id      uuid references public.canonical_document_versions(id) on delete set null,

  event_type      text not null check (event_type in (
                     'document_uploaded','document_generated','document_shared',
                     'document_viewed','document_approved','document_signed',
                     'document_superseded','document_expired','document_archived','document_deleted'
                   )),

  actor_type      text not null check (actor_type in ('system','venue','relationship','event','vendor','ai')),
  actor_id        uuid,
  payload         jsonb not null default '{}',

  created_at      timestamptz not null default now(),
  -- Null = not yet consumed by any downstream automation. Nothing sets
  -- this in this migration — it exists so a future consumer (a
  -- Playbook trigger, matching the real, already-working
  -- triggerAutoComplete() pattern from Phase 1) has somewhere to record
  -- that it has processed an event, without this phase wiring that
  -- consumer itself.
  processed_at    timestamptz
);

create index canonical_document_events_unprocessed on public.canonical_document_events (created_at) where processed_at is null;
create index canonical_document_events_document on public.canonical_document_events (document_id, created_at desc);

comment on table public.canonical_document_events is
  'Document Domain foundation (Phase 4). Automation outbox — the ten canonical event types, infrastructure only. Nothing inserts into this table automatically yet; see emit_canonical_document_event().';


-- ── Helper: resolve a polymorphic owner to its venue ─────────────────────────
-- Needed because owner_id is polymorphic (venues.id / clients.id / events.id
-- / vendors.id depending on owner_type) — RLS needs one function to resolve
-- "which venue does this Document ultimately belong to," rather than
-- duplicating that logic in every policy.

create or replace function public.canonical_document_owner_venue_id(p_owner_type text, p_owner_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select case p_owner_type
    when 'venue'        then p_owner_id
    when 'relationship'  then (select venue_id from public.clients where id = p_owner_id)
    when 'event'         then (select venue_id from public.events  where id = p_owner_id)
    -- Vendor-owned documents (library items) are not scoped to any single
    -- venue by design (architecture §3 — a vendor works with many venues)
    -- — resolved to null; access is via current_user_vendor_id() instead,
    -- not venue membership. See RLS below.
    else null
  end;
$$;

comment on function public.canonical_document_owner_venue_id is
  'Resolves a polymorphic Document owner to the venue that can staff-side manage it, or null when ownership is not venue-scoped (system, vendor).';


-- ── Helper: is a Document currently shared with anyone? ──────────────────────
-- Visibility (§2) computed from Sharing, never stored redundantly.

create or replace function public.canonical_document_is_shared(p_document_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.canonical_document_shares
    where document_id = p_document_id and revoked_at is null
  );
$$;


-- ── Helper: Behavior -> capability lookup ─────────────────────────────────────
-- Signable / Approvable / "generates a representation" (architecture §2:
-- Generation, Signing, Approval) are fully determined by Behavior — see
-- the Type Matrix validation (§4C), where every real and conceptual
-- Document Type's capabilities followed directly from its Behavior with
-- zero exceptions. Stored as a lookup function, not per-row boolean
-- columns, so these facts can never drift out of sync with Behavior —
-- exactly the "nothing redundant" rule the Entity Model requires.

create or replace function public.canonical_document_behavior_capabilities(p_behavior text)
returns jsonb
language sql
immutable
as $$
  select case p_behavior
    when 'negotiated'      then '{"signable": true,  "approvable": false, "generates_representation": true}'::jsonb
    when 'submitted'       then '{"signable": false, "approvable": true,  "generates_representation": false}'::jsonb
    when 'venue_authored'  then '{"signable": false, "approvable": false, "generates_representation": true}'::jsonb
    when 'collaborative'   then '{"signable": false, "approvable": true,  "generates_representation": true}'::jsonb
    when 'reference'       then '{"signable": false, "approvable": false, "generates_representation": false}'::jsonb
    when 'generated'       then '{"signable": false, "approvable": false, "generates_representation": true}'::jsonb
    else '{"signable": false, "approvable": false, "generates_representation": false}'::jsonb
  end;
$$;


-- ── Lifecycle engine: validate a status transition ───────────────────────────
-- §8 of this phase's brief: "Implement the lifecycle engine... exactly as
-- certified." One transition table, enforced by trigger, no UI involved.

create or replace function public.canonical_document_validate_status_transition(p_from text, p_to text)
returns boolean
language sql
immutable
as $$
  select case
    when p_from = p_to then true  -- no-op update (e.g. touching another column) is always valid
    when p_from = 'draft'          and p_to in ('in_review','shared','archived','deleted') then true
    when p_from = 'in_review'      and p_to in ('draft','shared','archived') then true
    when p_from = 'shared'         and p_to in ('pending_action','finalized','archived') then true
    when p_from = 'pending_action' and p_to in ('finalized','shared','archived') then true
    when p_from = 'finalized'      and p_to in ('superseded','archived') then true
    when p_from = 'superseded'     and p_to in ('archived') then true
    -- Reopening (Type Matrix §6 — Questionnaire reopened) — explicitly
    -- supported, archived back to draft only, never directly to a
    -- mid-lifecycle state.
    when p_from = 'archived'       and p_to in ('draft','deleted') then true
    when p_from = 'deleted' then false  -- terminal, no transition out
    else false
  end;
$$;

create or replace function public.canonical_documents_enforce_transition()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    if not public.canonical_document_validate_status_transition(old.status, new.status) then
      raise exception 'Invalid Document status transition: % -> %', old.status, new.status;
    end if;
    -- Immutability invariant (architecture ADR-1): once a Document reaches
    -- 'finalized', its current version's locked_at must already be set —
    -- the transition itself does not set it (that happens when the
    -- version is created/locked), this only guarantees the two facts
    -- can never disagree.
    if new.status = 'finalized' and not exists (
      select 1 from public.canonical_document_versions
      where document_id = new.id and is_current and locked_at is not null
    ) then
      raise exception 'Cannot finalize a Document whose current version is not locked';
    end if;
  end if;
  return new;
end;
$$;

create trigger canonical_documents_status_transition
  before update on public.canonical_documents
  for each row execute function public.canonical_documents_enforce_transition();


-- ── Automation: callable event emitter (unwired) ──────────────────────────────
-- §6: "Only the event definitions and infrastructure... No implementation
-- wiring yet." This function exists and works if called; nothing calls it
-- automatically from this migration.

create or replace function public.emit_canonical_document_event(
  p_document_id uuid,
  p_event_type  text,
  p_actor_type  text,
  p_actor_id    uuid default null,
  p_version_id  uuid default null,
  p_payload     jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.canonical_document_events (
    document_id, version_id, event_type, actor_type, actor_id, payload
  ) values (
    p_document_id, p_version_id, p_event_type, p_actor_type, p_actor_id, p_payload
  )
  returning id into v_id;

  insert into public.canonical_document_audit (
    document_id, version_id, action, actor_type, actor_id, detail
  ) values (
    p_document_id, p_version_id, p_event_type, p_actor_type, p_actor_id, p_payload
  );

  return v_id;
end;
$$;

grant execute on function public.emit_canonical_document_event(uuid, text, text, uuid, uuid, jsonb) to authenticated;


-- ── RLS ────────────────────────────────────────────────────────────────────
-- Permission Model (architecture §5), implemented exactly, no shortcuts.
-- Staff-side roles are expressible directly as Supabase RLS. Client/Vendor
-- portal access in this codebase is consistently mediated through
-- SECURITY DEFINER RPCs with token resolution, never direct table RLS
-- (Phase 1 finding, confirmed for contracts/couple_documents/vendor_library_
-- documents alike) — that pattern is preserved here rather than
-- reinvented: this migration builds the table-level RLS for staff and
-- vendor-authenticated access; Client/Guest access is deliberately left
-- for the future RPC layer this phase does not build ("no UI, no APIs").

alter table public.canonical_documents             enable row level security;
alter table public.canonical_document_versions     enable row level security;
alter table public.canonical_document_representations enable row level security;
alter table public.canonical_document_references   enable row level security;
alter table public.canonical_document_shares        enable row level security;
alter table public.canonical_document_audit         enable row level security;
alter table public.canonical_document_events        enable row level security;

-- canonical_documents: venue staff manage documents owned by their venue,
-- directly (owner_type='venue') or transitively (relationship/event).
create policy canonical_documents_venue_all on public.canonical_documents
  for all
  using      (public.canonical_document_owner_venue_id(owner_type, owner_id) = public.current_user_venue_id())
  with check (public.canonical_document_owner_venue_id(owner_type, owner_id) = public.current_user_venue_id());

-- Delete restricted to owner/manager — matches Phase 1's one confirmed-
-- mature finding on the existing `documents` table, generalized here.
create policy canonical_documents_delete_gate on public.canonical_documents
  as restrictive for delete
  using (public.current_user_role() in ('owner', 'manager'));

-- Vendors manage their own vendor-owned documents (library items) directly.
create policy canonical_documents_vendor_own on public.canonical_documents
  for all
  using      (owner_type = 'vendor' and owner_id = public.current_user_vendor_id())
  with check (owner_type = 'vendor' and owner_id = public.current_user_vendor_id());

-- System-owned documents (legal content, platform-wide reference) are
-- readable by everyone, matching the existing legal_documents pattern —
-- writable only by service role (no policy grants write; HQ-admin write
-- path, if ever needed, is a future addition, not part of this
-- foundation).
create policy canonical_documents_system_read on public.canonical_documents
  for select to anon, authenticated
  using (owner_type = 'system');

-- Versions/Representations/References/Shares/Audit/Events all inherit
-- their access from the parent Document — one venue-scoped policy each,
-- same shape, no duplicated ownership logic.
create policy canonical_document_versions_via_document on public.canonical_document_versions
  for all
  using (exists (
    select 1 from public.canonical_documents d
    where d.id = document_id
      and (public.canonical_document_owner_venue_id(d.owner_type, d.owner_id) = public.current_user_venue_id()
           or (d.owner_type = 'vendor' and d.owner_id = public.current_user_vendor_id()))
  ));

create policy canonical_document_representations_via_version on public.canonical_document_representations
  for all
  using (exists (
    select 1 from public.canonical_document_versions v
    join public.canonical_documents d on d.id = v.document_id
    where v.id = version_id
      and (public.canonical_document_owner_venue_id(d.owner_type, d.owner_id) = public.current_user_venue_id()
           or (d.owner_type = 'vendor' and d.owner_id = public.current_user_vendor_id()))
  ));

create policy canonical_document_references_via_document on public.canonical_document_references
  for all
  using (exists (
    select 1 from public.canonical_documents d
    where d.id = document_id
      and (public.canonical_document_owner_venue_id(d.owner_type, d.owner_id) = public.current_user_venue_id()
           or (d.owner_type = 'vendor' and d.owner_id = public.current_user_vendor_id()))
  ));

create policy canonical_document_shares_via_document on public.canonical_document_shares
  for all
  using (exists (
    select 1 from public.canonical_documents d
    where d.id = document_id
      and (public.canonical_document_owner_venue_id(d.owner_type, d.owner_id) = public.current_user_venue_id()
           or (d.owner_type = 'vendor' and d.owner_id = public.current_user_vendor_id()))
  ));

create policy canonical_document_audit_via_document on public.canonical_document_audit
  for select
  using (exists (
    select 1 from public.canonical_documents d
    where d.id = document_id
      and (public.canonical_document_owner_venue_id(d.owner_type, d.owner_id) = public.current_user_venue_id()
           or (d.owner_type = 'vendor' and d.owner_id = public.current_user_vendor_id()))
  ));

create policy canonical_document_events_via_document on public.canonical_document_events
  for select
  using (exists (
    select 1 from public.canonical_documents d
    where d.id = document_id
      and (public.canonical_document_owner_venue_id(d.owner_type, d.owner_id) = public.current_user_venue_id()
           or (d.owner_type = 'vendor' and d.owner_id = public.current_user_vendor_id()))
  ));

-- Grants — note the deliberate absence of UPDATE/DELETE on audit and
-- events (append-only), and the absence of UPDATE on representations
-- (immutable). These are structural enforcements, not just RLS.
grant select, insert, update, delete on public.canonical_documents               to authenticated;
grant select, insert, update, delete on public.canonical_document_versions       to authenticated;
grant select, insert                 on public.canonical_document_representations to authenticated;
grant select, insert, update, delete on public.canonical_document_references     to authenticated;
grant select, insert, update, delete on public.canonical_document_shares         to authenticated;
grant select, insert                 on public.canonical_document_audit          to authenticated;
grant select, insert                 on public.canonical_document_events         to authenticated;
grant select on public.canonical_documents to anon;

-- TRUNCATE is granted to `authenticated` by a platform-wide default
-- (confirmed present on the existing `documents` table too — not
-- introduced by this migration) that ordinary GRANT statements do not
-- override. TRUNCATE bypasses row-level triggers and RLS entirely by its
-- nature in Postgres, which would silently defeat the append-only /
-- immutable guarantee this phase explicitly certifies for these three
-- tables. Revoked explicitly, scoped to only the tables where that
-- guarantee is a stated architectural property — not a platform-wide
-- fix, which is out of scope for this phase.
revoke truncate on public.canonical_document_representations from authenticated;
revoke truncate on public.canonical_document_audit            from authenticated;
revoke truncate on public.canonical_document_events            from authenticated;


-- ── Reporting foundation ─────────────────────────────────────────────────────
-- §10 of this phase's brief: "canonical metrics infrastructure... no
-- dashboards, no reports." Plain views (not materialized — no scheduled
-- refresh infrastructure is in scope here), directly matching the metrics
-- certified in the Type Matrix validation §10. All will return zero rows
-- until a future phase migrates a real system onto this foundation —
-- correct and expected, not a bug in this phase.

create view public.canonical_documents_awaiting_signature as
  select d.* from public.canonical_documents d
  where d.status = 'pending_action'
    and (public.canonical_document_behavior_capabilities(d.behavior) ->> 'signable')::boolean;

create view public.canonical_documents_expired as
  select d.* from public.canonical_documents d
  where d.expires_at is not null
    and d.expires_at < current_date
    and d.status not in ('archived', 'deleted');

create view public.canonical_documents_shared_today as
  select distinct d.* from public.canonical_documents d
  join public.canonical_document_shares s on s.document_id = d.id
  where s.created_at::date = current_date
    and s.revoked_at is null;

create view public.canonical_documents_recently_generated as
  select d.* from public.canonical_documents d
  join public.canonical_document_events e on e.document_id = d.id
  where e.event_type = 'document_generated'
    and e.created_at > now() - interval '24 hours';

create view public.canonical_document_completion_by_type as
  select
    owner_type,
    type,
    count(*) filter (where status = 'finalized') as completed,
    count(*) as total,
    round(100.0 * count(*) filter (where status = 'finalized') / nullif(count(*), 0), 1) as completion_pct
  from public.canonical_documents
  group by owner_type, type;

create view public.canonical_document_version_counts as
  select document_id, count(*) as version_count
  from public.canonical_document_versions
  group by document_id;

create view public.canonical_document_average_signature_time as
  select
    d.type,
    avg(v.locked_at - d.created_at) as average_time_to_lock
  from public.canonical_documents d
  join public.canonical_document_versions v on v.document_id = d.id and v.is_current
  where v.locked_at is not null
    and (public.canonical_document_behavior_capabilities(d.behavior) ->> 'signable')::boolean
  group by d.type;

comment on view public.canonical_documents_awaiting_signature is 'Reporting foundation (Phase 4). Empty until a real system migrates onto canonical_documents.';

notify pgrst, 'reload schema';
