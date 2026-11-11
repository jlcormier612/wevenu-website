-- Seed Standard Wedding — Client Planning (PB-CLIENT-01) for venues that
-- have no active Client Planning template, matching Contract starter provisioning.
-- Idempotent. Does not touch Venue Planning, archived templates, event_tasks,
-- or venues that already have an active kind=client template / PB-CLIENT-01 /
-- same-named template.

do $$
declare
  v record;
  t_id uuid;
  m0 uuid;
  m1 uuid;
  m2 uuid;
  make_default boolean;
begin
  for v in
    select ve.id as venue_id
    from public.venues ve
    where not exists (
      select 1 from public.playbook_templates t
      where t.venue_id = ve.id
        and t.kind = 'client'
        and t.is_archived = false
    )
    and not exists (
      select 1 from public.playbook_templates t
      where t.venue_id = ve.id
        and t.source_master_key = 'PB-CLIENT-01'
    )
    and not exists (
      select 1 from public.playbook_templates t
      where t.venue_id = ve.id
        and t.name = 'Standard Wedding — Client Planning'
    )
  loop
    select not exists (
      select 1 from public.playbook_templates t
      where t.venue_id = v.venue_id
        and t.kind = 'client'
        and t.event_type = 'wedding'
        and t.is_default = true
        and t.is_archived = false
    ) into make_default;

    insert into public.playbook_templates (
      venue_id, name, kind, event_type, description, source_master_key, is_archived, is_default
    ) values (
      v.venue_id,
      'Standard Wedding — Client Planning',
      'client',
      'wedding',
      'Guides your client through their own to-dos after booking, through post-event.',
      'PB-CLIENT-01',
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
    values (v.venue_id, t_id, 'After Your Day', 2, null)
    returning id into m2;

    insert into public.playbook_tasks (
      venue_id, template_id, title, description, owner_type, visibility,
      days_offset, due_date_rule_kind, category, milestone_id, auto_complete_trigger,
      depends_on_task_id, is_required, sort_order, reminder_before_days,
      escalation_after_days, notify_on_assign, notify_on_complete, action_type, action_label
    ) values
      (v.venue_id, t_id, 'Complete your questionnaire', 'Tell us about your vision for the day.', 'couple', 'client_owned', -90, 'relative_to_event', 'planning', m0, 'questionnaire_submitted', null, true, 0, null, null, false, false, null, null),
      (v.venue_id, t_id, 'Purchase event insurance', null, 'couple', 'client_owned', -60, 'relative_to_event', 'document', m0, 'document_uploaded_insurance', null, true, 1, null, null, false, false, null, null),
      (v.venue_id, t_id, 'Choose your vendors', 'Pick the vendors you''d like to work with, then submit your list so your venue has it.', 'couple', 'client_owned', -45, 'relative_to_event', 'planning', m0, 'vendor_selected', null, false, 2, null, null, false, false, null, null),
      (v.venue_id, t_id, 'Submit your guest count', 'We need your final headcount to plan seating, catering, and rentals.', 'couple', 'client_owned', -30, 'relative_to_event', 'planning', m1, 'guest_count_finalized', null, true, 3, null, null, false, false, null, null),
      (v.venue_id, t_id, 'Submit your seating plan', 'Arrange your tables, then submit your seating plan so your venue has it for the day.', 'couple', 'client_owned', -21, 'relative_to_event', 'planning', m1, 'seating_submitted', null, true, 4, null, null, false, false, null, null),
      (v.venue_id, t_id, 'Submit your timeline', 'Plan your Timeline, then submit it so your venue has it.', 'couple', 'client_owned', -14, 'relative_to_event', 'planning', m1, 'timeline_submitted', null, true, 5, null, null, false, false, null, null),
      (v.venue_id, t_id, 'Final payment', null, 'couple', 'client_owned', -30, 'relative_to_event', 'financial', m1, 'final_payment_obligation_paid', null, true, 6, null, null, false, false, null, null),
      (v.venue_id, t_id, 'Leave a review', 'We''d love to hear about your experience.', 'couple', 'client_owned', 14, 'relative_to_event', 'communication', m2, null, null, false, 7, null, null, false, false, null, null);
  end loop;
end $$;
