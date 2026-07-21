-- ============================================================================
-- Sprint 2 — Vendor Certification Pass, Phase 1a.
--
-- Three more functions in lib/vendor-events/service.ts shared the exact
-- defect Sprint 1 fixed in getVendorEventDetail: direct RLS-scoped reads/
-- writes against event_vendor_assignments/event_tasks, tables whose RLS
-- only recognizes venue_id = current_user_venue_id() (null for a vendor
-- session), never current_user_vendor_id(). Confirmed live with a real
-- signed vendor JWT before this migration:
--   - getVendorEvents: the vendor's own Events list returned empty despite
--     a real matching assignment existing — worse than a 404, a vendor
--     couldn't navigate anywhere.
--   - updateAssignmentNotes / completeEventTask: both returned HTTP 204
--     (success) while silently writing nothing — confirmed via a direct
--     superuser read showing the field never changed. The exact "reports
--     success but did nothing" shape already fixed elsewhere in this
--     register (TR-B3, TR-M2, TR-L4).
-- completeEventTask also had a second, independent bug: it received
-- vendorId but never used it to scope the update (`void vendorId`) — once
-- RLS is fixed, without this, any vendor could complete any other vendor's
-- task by knowing/guessing its id. Fixed in the same pass by requiring the
-- task's own assignment to belong to the calling vendor.
-- ============================================================================

create or replace function public.get_vendor_events()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor_id uuid;
  v_today date := current_date;
begin
  v_vendor_id := current_user_vendor_id();
  if v_vendor_id is null then
    return '{"error":"unauthorized"}'::jsonb;
  end if;

  return jsonb_build_object(
    'events', coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'assignment_id', eva.id, 'event_id', e.id, 'event_name', e.name,
          'event_date', e.event_date, 'venue_name', v.name,
          'arrival_time', eva.arrival_time,
          'is_upcoming', (e.event_date is not null and e.event_date >= v_today)
        ) order by e.event_date desc nulls last)
        from public.event_vendor_assignments eva
        join public.events e on e.id = eva.event_id
        join public.venues v on v.id = e.venue_id
        where eva.vendor_id = v_vendor_id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.get_vendor_events() to authenticated;

-- ── update_vendor_assignment_notes — vendor-authenticated write ────────────

create or replace function public.update_vendor_assignment_notes(
  p_assignment_id uuid,
  p_notes text
)
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
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  if not exists (
    select 1 from public.event_vendor_assignments
    where id = p_assignment_id and vendor_id = v_vendor_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  update public.event_vendor_assignments
  set internal_notes = nullif(p_notes, '')
  where id = p_assignment_id and vendor_id = v_vendor_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.update_vendor_assignment_notes(uuid, text) to authenticated;

-- ── complete_vendor_event_task — vendor-authenticated write ────────────────
-- Fixes both bugs at once: the RLS block, and the missing ownership check.
-- A task can only be completed by the vendor whose own assignment the
-- task's event belongs to, and only if it's vendor_owned (matches the
-- original intent of the TS-layer's now-removed, never-enforced comment).

create or replace function public.complete_vendor_event_task(p_task_id uuid)
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
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  if not exists (
    select 1 from public.event_tasks et
    join public.event_vendor_assignments eva on eva.event_id = et.event_id
    where et.id = p_task_id and et.visibility = 'vendor_owned' and eva.vendor_id = v_vendor_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  update public.event_tasks
  set status = 'complete', completed_at = now()
  where id = p_task_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.complete_vendor_event_task(uuid) to authenticated;

-- ── Missing base-level GRANTs — found live-certifying "respond to inquiry" ──
-- vendor_inquiries and vendor_tasks both have correct, real RLS policies
-- (vendor_inquiries_vendor_access, vendor_tasks_vendor_access, both `for
-- all`) but were never given the underlying GRANT that makes the
-- `authenticated` role reachable at all — a different failure mode than
-- every other bug in this migration: Postgres blocks the query at the
-- privilege level before RLS is ever evaluated, returning a real 42501
-- "permission denied" error, not a silent empty result. Confirmed live
-- with a real vendor session on both tables before this fix. This is the
-- entire Vendor Inquiries feature and the entire Personal Tasks feature
-- (create/complete/uncomplete), both completely unreachable for every real
-- vendor login until now.
grant select, insert, update, delete on public.vendor_inquiries to authenticated;
grant select, insert, update, delete on public.vendor_tasks to authenticated;

notify pgrst, 'reload schema';
