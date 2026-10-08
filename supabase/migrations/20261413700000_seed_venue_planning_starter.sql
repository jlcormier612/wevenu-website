-- Seed Standard Wedding — Venue Planning (PB-VENUE-01) for venues that
-- have no active Venue Planning template, matching Client Planning starter
-- provisioning so the Templates hub library count includes both kinds.
-- Idempotent. Does not touch Client Planning, archived templates, event_tasks,
-- or venues that already have an active kind=venue template / PB-VENUE-01 /
-- same-named template.

do $$
declare
  v record;
  t_id uuid;
  m0 uuid;
  m1 uuid;
  m2 uuid;
  m3 uuid;
  make_default boolean;
begin
  for v in
    select ve.id as venue_id
    from public.venues ve
    where not exists (
      select 1 from public.playbook_templates t
      where t.venue_id = ve.id
        and t.kind = 'venue'
        and t.is_archived = false
    )
    and not exists (
      select 1 from public.playbook_templates t
      where t.venue_id = ve.id
        and t.source_master_key = 'PB-VENUE-01'
    )
    and not exists (
      select 1 from public.playbook_templates t
      where t.venue_id = ve.id
        and t.name = 'Standard Wedding — Venue Planning'
    )
  loop
    select not exists (
      select 1 from public.playbook_templates t
      where t.venue_id = v.venue_id
        and t.kind = 'venue'
        and t.event_type = 'wedding'
        and t.is_default = true
        and t.is_archived = false
    ) into make_default;

    insert into public.playbook_templates (
      venue_id, name, kind, event_type, description, source_master_key, is_archived, is_default
    ) values (
      v.venue_id,
      'Standard Wedding — Venue Planning',
      'venue',
      'wedding',
      'Runs your team''s internal checklist for a booked event, from planning through post-event.',
      'PB-VENUE-01',
      false,
      make_default
    )
    returning id into t_id;

    insert into public.playbook_milestones (venue_id, template_id, name, sort_order, kind)
    values (v.venue_id, t_id, 'Planning', 0, null)
    returning id into m0;
    insert into public.playbook_milestones (venue_id, template_id, name, sort_order, kind)
    values (v.venue_id, t_id, 'Final Details', 1, 'final_stretch')
    returning id into m1;
    insert into public.playbook_milestones (venue_id, template_id, name, sort_order, kind)
    values (v.venue_id, t_id, 'Wedding Day', 2, 'event_day')
    returning id into m2;
    insert into public.playbook_milestones (venue_id, template_id, name, sort_order, kind)
    values (v.venue_id, t_id, 'Post-Event', 3, null)
    returning id into m3;

    insert into public.playbook_tasks (
      venue_id, template_id, title, description, owner_type, visibility,
      days_offset, due_date_rule_kind, category, milestone_id, auto_complete_trigger,
      depends_on_task_id, is_required, sort_order, reminder_before_days,
      escalation_after_days, notify_on_assign, notify_on_complete, action_type, action_label
    ) values
      (v.venue_id, t_id, 'Build timeline', 'Build the complete day-of timeline.', 'coordinator', 'coordinator_only', -21, 'relative_to_event', 'planning', m0, 'timeline_created', null, true, 0, null, null, false, false, null, null),
      (v.venue_id, t_id, 'Create floor plan', null, 'coordinator', 'coordinator_only', -14, 'relative_to_event', 'planning', m0, 'floor_plan_created', null, true, 1, null, null, false, false, null, null),
      (v.venue_id, t_id, 'Confirm rentals', 'Confirm final counts and delivery windows with rental vendors.', 'vendor', 'vendor_owned', -14, 'relative_to_event', 'communication', m0, null, null, true, 2, null, null, false, false, null, null),
      (v.venue_id, t_id, 'Vendor COIs in file', 'Ensure all required insurance certificates are uploaded.', 'coordinator', 'coordinator_only', -7, 'relative_to_event', 'document', m1, 'document_uploaded_insurance', null, true, 3, null, 2, false, false, null, null),
      (v.venue_id, t_id, 'Prepare venue', null, 'team', 'coordinator_only', 0, 'relative_to_event', 'meeting', m2, null, null, true, 4, null, null, false, false, null, null),
      (v.venue_id, t_id, 'Day-of setup', null, 'team', 'coordinator_only', 0, 'relative_to_event', 'meeting', m2, null, null, true, 5, null, null, false, false, null, null),
      (v.venue_id, t_id, 'Send thank-you note', 'Send a warm thank-you to the client.', 'coordinator', 'coordinator_only', 3, 'relative_to_event', 'communication', m3, null, null, false, 6, null, null, false, false, null, null);
  end loop;
end $$;
