-- Official Venue Planning starter (PB-VENUE-01) is for a booked event.
-- Commercial booking tasks (Send contract, Verify deposit) do not belong
-- on the venue Planning template. Preparatory work moves under Planning.
-- Vendor COIs stay under Final Details (late-stage readiness).
--
-- Scope: playbook_templates.source_master_key = 'PB-VENUE-01' only.
-- Does not touch event_tasks (already-applied checklists stay as-is).
-- Does not touch Client Planning or Add-again copies (source_master_key null).

delete from public.playbook_tasks pt
using public.playbook_templates t
where t.source_master_key = 'PB-VENUE-01'
  and t.kind = 'venue'
  and pt.template_id = t.id
  and pt.venue_id = t.venue_id
  and pt.title in ('Send contract', 'Verify deposit');

update public.playbook_milestones m
set name = 'Planning'
from public.playbook_templates t
where t.source_master_key = 'PB-VENUE-01'
  and t.kind = 'venue'
  and m.template_id = t.id
  and m.venue_id = t.venue_id
  and m.name = 'Booking';

update public.playbook_tasks pt
set milestone_id = planning.id
from public.playbook_templates t
join public.playbook_milestones planning
  on planning.template_id = t.id
 and planning.venue_id = t.venue_id
 and planning.name = 'Planning'
join public.playbook_milestones final_details
  on final_details.template_id = t.id
 and final_details.venue_id = t.venue_id
 and final_details.name = 'Final Details'
where t.source_master_key = 'PB-VENUE-01'
  and t.kind = 'venue'
  and pt.template_id = t.id
  and pt.venue_id = t.venue_id
  and pt.milestone_id = final_details.id
  and pt.title in ('Build timeline', 'Create floor plan', 'Confirm rentals');

update public.playbook_templates
set description = 'Runs your team''s internal checklist for a booked event, from planning through post-event.'
where source_master_key = 'PB-VENUE-01'
  and kind = 'venue';
