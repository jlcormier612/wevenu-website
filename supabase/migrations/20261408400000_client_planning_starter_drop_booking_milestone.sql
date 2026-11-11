-- Official Client Planning starter (PB-CLIENT-01) no longer includes a
-- pre-booking "Booking" milestone. Couples reach the client portal after
-- the venue books them, so Sign your contract / Choose your package do not
-- belong on that starter.
--
-- Scope: playbook_templates.source_master_key = 'PB-CLIENT-01' only.
-- Does not touch event_tasks (already-applied checklists stay as-is).
-- Does not touch Venue Planning or Add-again copies (source_master_key null).

delete from public.playbook_tasks pt
using public.playbook_templates t
     join public.playbook_milestones m
       on m.template_id = t.id
      and m.venue_id = t.venue_id
where t.source_master_key = 'PB-CLIENT-01'
  and t.kind = 'client'
  and pt.template_id = t.id
  and pt.venue_id = t.venue_id
  and pt.milestone_id = m.id
  and m.name = 'Booking';

delete from public.playbook_milestones m
using public.playbook_templates t
where t.source_master_key = 'PB-CLIENT-01'
  and t.kind = 'client'
  and m.template_id = t.id
  and m.venue_id = t.venue_id
  and m.name = 'Booking';

update public.playbook_templates
set description = 'Guides your client through their own to-dos after booking, through post-event.'
where source_master_key = 'PB-CLIENT-01'
  and kind = 'client';
