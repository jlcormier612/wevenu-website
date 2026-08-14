-- ============================================================================
-- Work Package D6 §57 — the D2-identified Template Permission Defect,
-- resolved. Confirmed by directly reading RLS policies across all 8
-- template tables: only `contract_templates` and `playbook_templates` had
-- a real DELETE-role gate (Owner/Manager only, matching
-- contract_templates_delete_gate/playbook_templates_delete_gate).
-- `inventory_templates` had an app-layer check (lib/event-inventory/
-- service.ts's own deleteTemplate()) but no RLS backstop — every other
-- write path in this codebase treats the app check as UX, RLS as the real
-- boundary. `floor_plan_templates`, `message_templates`,
-- `pipeline_templates`, `timeline_templates`, and `questionnaire_templates`
-- had neither — any authenticated venue member (Staff/Coordinator
-- included) could delete any of these templates outright, app UI or
-- direct API call.
--
-- Fix: the exact same DELETE-role-gate pattern already established and
-- working for contract_templates/playbook_templates, applied consistently
-- to the remaining 6. Critically: `AS RESTRICTIVE`, matching the two
-- already-correct policies exactly — a PERMISSIVE policy here would be a
-- silent no-op, since Postgres OR's multiple PERMISSIVE policies for the
-- same command together, and the existing venue-scoped `_all` policy (no
-- role check) would still pass on its own. RESTRICTIVE policies are AND'd
-- with every other applicable policy instead, which is what actually
-- narrows access.
-- ============================================================================

create policy floor_plan_templates_delete_gate on public.floor_plan_templates
  as restrictive
  for delete
  using (current_user_role() = any (array['owner', 'manager']));

create policy message_templates_delete_gate on public.message_templates
  as restrictive
  for delete
  using (current_user_role() = any (array['owner', 'manager']));

create policy pipeline_templates_delete_gate on public.pipeline_templates
  as restrictive
  for delete
  using (current_user_role() = any (array['owner', 'manager']));

create policy timeline_templates_delete_gate on public.timeline_templates
  as restrictive
  for delete
  using (current_user_role() = any (array['owner', 'manager']));

create policy questionnaire_templates_delete_gate on public.questionnaire_templates
  as restrictive
  for delete
  using (current_user_role() = any (array['owner', 'manager']));

create policy inventory_templates_delete_gate on public.inventory_templates
  as restrictive
  for delete
  using (current_user_role() = any (array['owner', 'manager']));

notify pgrst, 'reload schema';
