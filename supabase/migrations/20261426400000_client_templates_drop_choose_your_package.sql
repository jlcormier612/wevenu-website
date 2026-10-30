-- R3 — an approved package never appears as an open choice.
--
-- 20261408400000 removed the pre-booking "Choose your package" task from the
-- official Client Planning starter (PB-CLIENT-01) only. Venue-owned copies of
-- client checklists can still carry it, so every new event applied from them
-- gets a manual package task that ignores the real package approval.
--
-- Scope: playbook_tasks on client-kind templates, any venue.
-- Existing event_tasks rows keep their title and status; their
-- template_task_id link clears via the existing ON DELETE SET NULL.
-- Venue Planning templates are untouched.

delete from public.playbook_tasks pt
using public.playbook_templates t
where pt.template_id = t.id
  and pt.venue_id = t.venue_id
  and t.kind = 'client'
  and lower(btrim(pt.title)) = 'choose your package';
