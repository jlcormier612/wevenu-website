-- ============================================================================
-- Program 2, Phase 2B (part 1) — Close the Client-with-no-Lead gap, add the
-- per-venue rollout flag.
--
-- docs/architecture-delta-phase-2a-backend.md named this gap explicitly:
-- a Client created directly (createClient_, no originating Lead) has
-- clients.lead_id = null, so resolve_relationship_id_for_client() — which
-- joined client -> lead -> relationship — returned null for it. Every
-- portal user needs a working conversation before UI cutover, so this
-- closes it now rather than discovering it as a live bug in 2B.
--
-- Fix: give clients their own relationship_id directly, populated at
-- create time regardless of origin (converted from a Lead, or created
-- directly). This also simplifies resolve_relationship_id_for_client from a
-- three-table join down to a single-column read.
--
-- Also adds venues.conversation_experience_enabled — the per-venue rollout
-- flag docs/conversation-experience-cutover.md's staged rollout depends on
-- (dogfood -> opt-in beta -> default-on -> retirement), following the exact
-- pattern already established by venues.tour_scheduling_enabled.
-- ============================================================================

alter table public.clients
  add column relationship_id uuid references public.venue_customer_relationships(id) on delete set null;

create index clients_relationship on public.clients (relationship_id) where relationship_id is not null;

-- Backfill: clients converted from a Lead inherit that Lead's relationship_id
-- directly (no re-resolution needed — the Lead already has one).
update public.clients c
set relationship_id = l.relationship_id
from public.leads l
where c.lead_id = l.id
  and c.relationship_id is null;

-- Backfill: clients created directly (no Lead) resolve/create one via the
-- same shared function every other entry point uses.
do $$
declare
  r record;
  v_rel_id uuid;
begin
  for r in
    select id, venue_id, email, first_name, last_name
    from public.clients
    where lead_id is null and relationship_id is null
  loop
    v_rel_id := public.find_or_create_relationship(r.venue_id, r.email, r.first_name, r.last_name);
    update public.clients set relationship_id = v_rel_id where id = r.id;
  end loop;
end $$;

-- Simplify the resolver now that every Client carries its own
-- relationship_id directly — no more join through leads required. Signature
-- is unchanged, so every existing caller (the sync triggers, the backfill,
-- the portal RPCs) picks this up automatically.
create or replace function public.resolve_relationship_id_for_client(p_client_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select relationship_id from public.clients where id = p_client_id
$$;

-- ---- Wire the two client-creating paths (lib/clients/repository.ts's
-- insertClient, shared by direct-create and lead-conversion) to populate
-- relationship_id going forward -- done in the TS layer, not here, since
-- resolving via an already-known Lead's relationship_id doesn't need a
-- database round trip through find_or_create_relationship at all.

-- ---- Per-venue rollout flag --------------------------------------------------
alter table public.venues
  add column conversation_experience_enabled boolean not null default false;
