-- ============================================================================
-- Sprint 1 — Vendor Verification found a severe, previously undiscovered
-- bug during "vendor floor-plan visibility" live-verification: the vendor
-- per-event workspace (app/vendor/events/[id]/page.tsx ->
-- lib/vendor-events/service.ts's getVendorEventDetail) reads
-- event_vendor_assignments, timeline_entries, event_tasks, and clients
-- directly through the caller's own RLS-scoped session. None of those
-- tables' RLS policies recognize a vendor session (only
-- venue_id = current_user_venue_id(), which is null for a vendor) — every
-- OTHER vendor-facing read in this codebase already goes through a
-- SECURITY DEFINER RPC for exactly this reason (see RC2 Milestone 3's
-- vendor conversation RPCs), but this one predates that convention and was
-- never converted. Confirmed live: signed a real vendor JWT, inserted a
-- real matching assignment row, queried event_vendor_assignments directly —
-- empty result despite the row existing. Since getVendorEventDetail returns
-- null the moment the assignment fetch comes back empty, this 404s the
-- entire per-event page for every real vendor login, on every event, today.
--
-- Separately, the existing "documents" fetch inside that same function
-- queried a table that has never existed ("event_documents" — the real
-- table is "documents"), and the "clients" fetch used three columns that
-- have never existed (event_id, partner1_name, partner2_name — clients has
-- no event_id at all; the couple is reached via events.client_id, and the
-- real name columns are first_name/last_name/partner_first_name/
-- partner_last_name). Both are fixed in the same pass since they're in the
-- same function this bug lives in.
--
-- Fix: one consolidated RPC replaces every RLS-blocked read in
-- getVendorEventDetail. vendor_tasks is untouched — it already has a
-- correct vendor-scoped RLS policy (vendor_tasks_vendor_access) and stays a
-- plain client-side read.
-- ============================================================================

create or replace function public.get_vendor_event_detail(p_assignment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor_id uuid;
  v_event_id  uuid;
  v_client_id uuid;
begin
  v_vendor_id := current_user_vendor_id();
  if v_vendor_id is null then
    return null;
  end if;

  if not exists (
    select 1 from public.event_vendor_assignments
    where id = p_assignment_id and vendor_id = v_vendor_id
  ) then
    return null;
  end if;

  select e.id into v_event_id
  from public.event_vendor_assignments eva
  join public.events e on e.id = eva.event_id
  where eva.id = p_assignment_id;

  select client_id into v_client_id from public.events where id = v_event_id;

  return jsonb_build_object(
    'assignment', (
      select jsonb_build_object(
        'id', eva.id, 'event_id', eva.event_id,
        'arrival_time', eva.arrival_time, 'setup_location', eva.setup_location,
        'load_in_notes', eva.load_in_notes, 'internal_notes', eva.internal_notes,
        'notes', eva.notes, 'checked_in_at', eva.checked_in_at,
        'setup_complete_at', eva.setup_complete_at,
        'share_couple_email', eva.share_couple_email, 'share_couple_phone', eva.share_couple_phone
      )
      from public.event_vendor_assignments eva where eva.id = p_assignment_id
    ),
    'event', (
      select jsonb_build_object(
        'id', e.id, 'name', e.name, 'event_date', e.event_date, 'event_type', e.event_type,
        'venue_id', e.venue_id, 'venue_name', v.name
      )
      from public.events e
      join public.venues v on v.id = e.venue_id
      where e.id = v_event_id
    ),
    'client', (
      select jsonb_build_object(
        'first_name', c.first_name, 'last_name', c.last_name,
        'partner_first_name', c.partner_first_name, 'partner_last_name', c.partner_last_name,
        'email', c.email, 'phone', c.phone
      )
      from public.clients c where c.id = v_client_id
    ),
    'timeline', coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'id', t.id, 'entry_time', t.entry_time, 'title', t.title,
          'description', t.description, 'audiences', t.audiences
        ) order by t.entry_time nulls last)
        from public.timeline_entries t
        where t.event_id = v_event_id and t.audiences @> array['vendors']
      ),
      '[]'::jsonb
    ),
    'event_tasks', coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'id', et.id, 'title', et.title, 'description', et.description,
          'category', et.category, 'visibility', et.visibility, 'due_date', et.due_date,
          'status', et.status, 'is_required', et.is_required, 'completed_at', et.completed_at
        ))
        from public.event_tasks et
        where et.event_id = v_event_id and et.visibility in ('vendor_visible', 'vendor_owned')
      ),
      '[]'::jsonb
    ),
    'documents', coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'id', d.id, 'name', d.name, 'category', d.category,
          'storage_url', d.storage_url, 'mime_type', d.mime_type, 'notes', d.notes
        ))
        from public.documents d
        where d.event_id = v_event_id and d.shared_with_vendors = true
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.get_vendor_event_detail(uuid) to authenticated;

-- ============================================================================
-- Vendor Event Assets — floor plan sharing (Sprint 1).
--
-- Per the approved design: two distinct capabilities finish the vendor
-- experience. Conversation attachments (migration
-- 20261122000000_sprint1_vendor_conversation_attachments.sql) handle
-- ad-hoc document exchange. This is the other half — a vendor assigned to
-- an event should see the floor plan the coordinator already built in the
-- Floor Plan editor without the coordinator needing to export a PDF and
-- send it through Messages. Modeled as
-- Vendor Assignment -> Shared Event Assets -> Floor Plans: a venue-level
-- visibility flag on the structured floor_plans table (mirroring
-- client_access's existing shape exactly, one flag per plan, venue
-- controls it), not a new document to upload.
-- ============================================================================

alter table public.floor_plans
  add column shared_with_vendors boolean not null default false;

-- ── Vendor-side: every floor plan shared with vendors for one event ────────
-- Mirrors get_vendor_shared_floor_plans' sibling RPCs' auth pattern —
-- validates the vendor is actually assigned to this event before returning
-- anything, the same ownership check every other vendor RPC in this
-- codebase performs.

create or replace function public.get_vendor_shared_floor_plans(p_event_id uuid)
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

  if not exists (
    select 1 from public.event_vendor_assignments
    where event_id = p_event_id and vendor_id = v_vendor_id
  ) then
    return '{"error":"not_found"}'::jsonb;
  end if;

  return jsonb_build_object(
    'floor_plans', coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'id', fp.id, 'name', fp.name, 'updated_at', fp.updated_at
        ) order by fp.name)
        from public.floor_plans fp
        where fp.event_id = p_event_id and fp.shared_with_vendors = true
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.get_vendor_shared_floor_plans(uuid) to authenticated;

-- ── Vendor-side: one shared floor plan, with objects, read-only ────────────
-- Same shape as lib/floor-plans/repository.ts's getFloorPlan (PlanRow +
-- ObjRow), scoped to a plan that's both shared_with_vendors = true and
-- whose event this vendor is actually assigned to — a vendor can never
-- reach a plan the venue hasn't explicitly shared, even by guessing an id.

create or replace function public.get_vendor_floor_plan(p_floor_plan_id uuid)
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
    return null;
  end if;

  if not exists (
    select 1 from public.floor_plans fp
    join public.event_vendor_assignments eva on eva.event_id = fp.event_id
    where fp.id = p_floor_plan_id and fp.shared_with_vendors = true and eva.vendor_id = v_vendor_id
  ) then
    return null;
  end if;

  return jsonb_build_object(
    'plan', (
      select to_jsonb(fp) from public.floor_plans fp where fp.id = p_floor_plan_id
    ),
    'objects', coalesce(
      (
        select jsonb_agg(to_jsonb(o) order by o.sort_order, o.created_at)
        from public.floor_plan_objects o
        where o.floor_plan_id = p_floor_plan_id
      ),
      '[]'::jsonb
    ),
    -- The standalone vendor viewer page (a plan can be opened in a new tab)
    -- needs event/venue context to render its own header without a second
    -- round trip through a different vendor-scoped fetch.
    'event', (
      select jsonb_build_object('id', e.id, 'name', e.name, 'event_date', e.event_date)
      from public.floor_plans fp
      join public.events e on e.id = fp.event_id
      where fp.id = p_floor_plan_id
    ),
    'venue', (
      select jsonb_build_object('name', v.name, 'primary_color', v.primary_color, 'logo_url', v.logo_url)
      from public.floor_plans fp
      join public.events e on e.id = fp.event_id
      join public.venues v on v.id = e.venue_id
      where fp.id = p_floor_plan_id
    )
  );
end;
$$;

grant execute on function public.get_vendor_floor_plan(uuid) to authenticated;

notify pgrst, 'reload schema';
