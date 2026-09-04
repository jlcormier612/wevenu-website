-- ============================================================================
-- Floor Plan Studio — Staff view-only + Coordinator object edit (Phase 1).
--
-- Product:
--   Owner/Manager: full management including DELETE of plan/template rows.
--   Coordinator: create/edit plans, templates, and objects; cannot delete
--     floor_plans / floor_plan_templates rows.
--   Staff: SELECT only — no INSERT/UPDATE (and no object DELETE).
--
-- Existing RESTRICTIVE DELETE gates on floor_plans and floor_plan_templates
-- (Owner/Manager) are preserved unchanged.
--
-- floor_plan_objects previously used Owner/Manager-only DELETE (TR-G6). That
-- blocked Coordinators from removing objects while editing. Expand object
-- DELETE to Owner/Manager/Coordinator; Staff remains blocked.
--
-- floor_plan_template_objects had no DELETE role gate — add the same
-- Owner/Manager/Coordinator DELETE gate, plus Staff INSERT/UPDATE deny
-- on all four floor-plan tables and event_floor_plan_offers.
-- ============================================================================

-- ── Staff cannot INSERT/UPDATE floor plans / templates / objects / offers ─

create policy floor_plans_staff_insert_gate on public.floor_plans
  as restrictive for insert
  with check (current_user_role() is distinct from 'staff');

create policy floor_plans_staff_update_gate on public.floor_plans
  as restrictive for update
  using (current_user_role() is distinct from 'staff')
  with check (current_user_role() is distinct from 'staff');

create policy floor_plan_objects_staff_insert_gate on public.floor_plan_objects
  as restrictive for insert
  with check (current_user_role() is distinct from 'staff');

create policy floor_plan_objects_staff_update_gate on public.floor_plan_objects
  as restrictive for update
  using (current_user_role() is distinct from 'staff')
  with check (current_user_role() is distinct from 'staff');

create policy floor_plan_templates_staff_insert_gate on public.floor_plan_templates
  as restrictive for insert
  with check (current_user_role() is distinct from 'staff');

create policy floor_plan_templates_staff_update_gate on public.floor_plan_templates
  as restrictive for update
  using (current_user_role() is distinct from 'staff')
  with check (current_user_role() is distinct from 'staff');

create policy floor_plan_template_objects_staff_insert_gate on public.floor_plan_template_objects
  as restrictive for insert
  with check (current_user_role() is distinct from 'staff');

create policy floor_plan_template_objects_staff_update_gate on public.floor_plan_template_objects
  as restrictive for update
  using (current_user_role() is distinct from 'staff')
  with check (current_user_role() is distinct from 'staff');

create policy event_floor_plan_offers_staff_insert_gate on public.event_floor_plan_offers
  as restrictive for insert
  with check (current_user_role() is distinct from 'staff');

create policy event_floor_plan_offers_staff_update_gate on public.event_floor_plan_offers
  as restrictive for update
  using (current_user_role() is distinct from 'staff')
  with check (current_user_role() is distinct from 'staff');

create policy event_floor_plan_offers_staff_delete_gate on public.event_floor_plan_offers
  as restrictive for delete
  using (current_user_role() is distinct from 'staff');

-- ── Object DELETE: Coordinator may edit (remove objects); Staff may not ──────

drop policy if exists floor_plan_objects_delete_gate on public.floor_plan_objects;
create policy floor_plan_objects_delete_gate on public.floor_plan_objects
  as restrictive for delete
  using (current_user_role() = any (array['owner', 'manager', 'coordinator']));

create policy floor_plan_template_objects_delete_gate on public.floor_plan_template_objects
  as restrictive for delete
  using (current_user_role() = any (array['owner', 'manager', 'coordinator']));

notify pgrst, 'reload schema';
