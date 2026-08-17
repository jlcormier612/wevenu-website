-- Help & Guides — Planning the Event (7 approved articles).
-- Uses existing success_library_articles pipeline (goal_category taxonomy).
-- Category string matches lib/help-guides/areas.ts exactly ('Planning the Event').
-- Approved copy mapped mechanically into the existing four Best Practice
-- sections (why_it_matters / when_to_use / best_practices / common_mistakes);
-- markdown ###/**/* stripped for the plain-text renderer. No copy rewritten.
-- Idempotent: re-running restores the approved copy for these seven slugs only.
-- Does not modify Help taxonomy, navigation, or any previously published article.

insert into public.success_library_articles
  (slug, title, goal_category, why_it_matters, when_to_use, best_practices, common_mistakes, related_features, linked_gap_keys, status)
values
  (
    'what-are-the-three-questionnaires',
    'What are the three questionnaires?',
    'Planning the Event',
    'Hello to Cheers gives you three questionnaires for three different points in the event journey:

- Client Planning Questionnaire — gathers the information you need to plan the event with your client.
- Final Details — confirms important details as the event gets closer.
- Post-Event Feedback — gives your client a place to share their experience after the event.',
    'Each questionnaire belongs to its event and has its own status.',
    'Find a questionnaire

1. Open Events and select the event.
2. Open Planning.
3. Select Questionnaires.
4. Choose the questionnaire you want to review.',
    'Questionnaires can be in different stages, including Draft, Sent, and Submitted. Reviewing a questionnaire does not send it to the client.

Navigation: Events → select an event → Planning → Questionnaires',
    '[{"label":"Open Events","href":"/events"}]'::jsonb,
    array[]::text[],
    'published'
  ),
  (
    'customize-questionnaire-template',
    'How do I customize a questionnaire template?',
    'Planning the Event',
    'Questionnaire templates give your venue a reusable starting point for the Client Planning Questionnaire, Final Details, and Post-Event Feedback.',
    'Customize a template once, then use it when you create a questionnaire for an event.',
    'Customize a questionnaire template

1. Open Library → Questionnaires & Feedback.
2. Select an existing template, or choose New questionnaire and select the form type.
3. Make the changes you want to the template.
4. Save the template.

When you use the template for an event, Hello to Cheers creates an event-specific questionnaire draft for you to review.',
    'One thing to know

The questionnaire created for an event is its own draft. Changes you make later to the Library template do not automatically change a questionnaire that has already been created for an event.

Using a template also does not send the questionnaire to the client. Review the event questionnaire before sending it.

Navigation: Library → Questionnaires & Feedback',
    '[{"label":"Questionnaires & Feedback","href":"/library/questionnaire-templates"}]'::jsonb,
    array[]::text[],
    'published'
  ),
  (
    'where-questionnaire-answers-go',
    'Where do questionnaire answers go?',
    'Planning the Event',
    'When your client completes a questionnaire, their answers stay connected to the event and are handled according to the question.',
    'Some answers can update an established event detail. Other answers remain with the questionnaire so your team can review the client''s response in context.',
    'Review questionnaire answers

1. Open Events and select the event.
2. Open Planning → Questionnaires.
3. Open the submitted questionnaire.
4. Review the client''s answers.',
    'If an answer represents an established event detail, use the appropriate event workspace to manage that information rather than treating the questionnaire response as a second source of truth.

Not every answer creates or updates information somewhere else. Some responses are simply part of the client''s questionnaire.

Navigation: Events → select an event → Planning → Questionnaires',
    '[{"label":"Open Events","href":"/events"}]'::jsonb,
    array[]::text[],
    'published'
  ),
  (
    'timeline-from-template',
    'How do I build an event Timeline from a template?',
    'Planning the Event',
    'A Timeline Template gives you a reusable starting point for your event schedule.',
    'When you apply a template, its entries are added to the event''s Timeline. You can then make changes for that event without changing the original template.',
    'Apply a Timeline Template

1. Open Events and select the event.
2. Open the event''s Timeline.
3. If the Timeline is empty, choose a template from the setup area and select Apply.
4. If the Timeline already contains entries, select Use Template.
5. Choose the Timeline Template you want to use.
6. Review the entries and times before applying the template.
7. After applying it, review the event Timeline and make any changes needed for this event.',
    'If your Timeline already has entries

Applying another template adds its entries to the existing Timeline. It does not replace or remove entries that are already there.

A Timeline created from a template is independent of the Library template. Changes you make later to the Library template do not automatically change an event that has already used it.

If the event does not yet have a start time, take a moment to review the resulting times carefully.

Navigation: Events → select an event → Timeline

Timeline Templates: Library → Timeline Templates',
    '[{"label":"Open Events","href":"/events"},{"label":"Timeline Templates","href":"/library/timeline-templates"}]'::jsonb,
    array[]::text[],
    'published'
  ),
  (
    'client-planning-vs-venue-planning',
    'What is the difference between Client Planning and Venue Planning?',
    'Planning the Event',
    'Hello to Cheers gives you two different kinds of planning checklists:

Client Planning

Client Planning is work intended for the client.

When you apply a Client Planning template, it starts as a Draft. Your venue can review the checklist before choosing Release to Client.

This gives your team a chance to make sure the planning experience is ready before the client sees it.',
    'Venue Planning

Venue Planning is internal work for your venue team.

When you apply a Venue Planning template, it becomes Active for your team to work through.',
    'Choose the right planning type

1. Open Events and select the event.
2. Open the Planning area.
3. Choose the Client Planning or Venue Planning template you want to apply.
4. Apply the template.
5. If it is Client Planning, review the Draft and release it when it is ready.
6. If it is Venue Planning, begin working from the Active checklist.',
    'Client Planning and Venue Planning are separate checklists. They are not two views of the same checklist.

Navigation: Events → select an event → Planning',
    '[{"label":"Open Events","href":"/events"},{"label":"Planning Templates","href":"/library/playbooks"}]'::jsonb,
    array[]::text[],
    'published'
  ),
  (
    'create-apply-planning-template',
    'How do I create and apply a Planning Template?',
    'Planning the Event',
    'Planning Templates help you turn the way your venue normally plans an event into a reusable checklist.',
    'A template can be used for Client Planning or Venue Planning, depending on who the work is intended for.',
    'Create a Planning Template

1. Open Library → Planning Templates.
2. Select New template.
3. Choose Client Planning or Venue Planning.
4. Choose how you want to start your template.
5. Add and organize your milestones and tasks.
6. Save the template.

Apply a Planning Template to an event

1. Open Events and select the event.
2. Open Planning.
3. Choose the planning template you want to use.
4. Apply the template.',
    'Once you apply a template, the event has its own set of planning work. Changes you make later to the Library template do not automatically change an event that is already using it.

If you''re creating Client Planning, remember that the checklist remains private until your venue chooses to release it to the client.

Navigation: Library → Planning Templates

Apply to an event: Events → select an event → Planning',
    '[{"label":"Planning Templates","href":"/library/playbooks"},{"label":"Open Events","href":"/events"}]'::jsonb,
    array[]::text[],
    'published'
  ),
  (
    'how-to-use-task-center',
    'How do I use Task Center?',
    'Planning the Event',
    'Task Center gives your team one place to see what needs attention across your active events.

Tasks are organized into helpful sections, including:

- Overdue
- Blocked
- Due Today
- Due This Week
- Upcoming',
    'You can also use the available task views to focus on work assigned to you, work for the team, or all available tasks.',
    'Use Task Center

1. Open Tasks → Task Center.
2. Choose the task view you need.
3. Start with Overdue, Blocked, and Due Today work.
4. Open the event from a task when you need the full event context.
5. Complete or waive an eligible task from Task Center.',
    'A Blocked task is waiting on its dependency to be completed.

Event tasks come from planning work applied to the event. Task Center brings that work together so your team can see what needs attention without opening every event individually.

Navigation: Tasks → Task Center',
    '[{"label":"Open Task Center","href":"/tasks"}]'::jsonb,
    array[]::text[],
    'published'
  )
on conflict (slug) do update set
  title = excluded.title,
  goal_category = excluded.goal_category,
  why_it_matters = excluded.why_it_matters,
  when_to_use = excluded.when_to_use,
  best_practices = excluded.best_practices,
  common_mistakes = excluded.common_mistakes,
  related_features = excluded.related_features,
  status = excluded.status;
