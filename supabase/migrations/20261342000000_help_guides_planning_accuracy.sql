-- Help & Guides — Planning the Event accuracy pass (Timeline + Task Center).
-- Restores accurate UI labels against live product:
--   Timeline: Use Template (empty + populated); picker confirm Apply [name]
--   Task Center: My Work / By Person / All Team Work + current urgency bands
-- Idempotent upsert for these two slugs only.

insert into public.success_library_articles
  (slug, title, goal_category, why_it_matters, when_to_use, best_practices, common_mistakes, related_features, linked_gap_keys, status)
values
  (
    'timeline-from-template',
    'How do I build an event Timeline from a template?',
    'Planning the Event',
    'A Timeline Template gives you a reusable starting point for your event schedule.',
    'When you apply a template, its entries are added to the event''s Timeline. You can then make changes for that event without changing the original template.',
    'Apply a Timeline Template

1. Open Events (or Clients) and select the booking.
2. Open the event''s Timeline tab.
3. Select Use Template — this is the button whether the Timeline is empty or already has entries.
4. Choose the Timeline Template you want to use.
5. Review the entries and times.
6. Select Apply [template name] to confirm.
7. After applying it, review the event Timeline and make any changes needed for this event.

You can also start a Timeline from Overview when none exists yet: choose a template in the setup card and select Use Template.',
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
    'how-to-use-task-center',
    'How do I use Task Center?',
    'Planning the Event',
    'Task Center gives your team one place to see what needs attention across your active events.

Work is organized into clear zones:

- Your team''s work — venue tasks (Overdue, Blocked, Due Today, Due Soon, Upcoming)
- Client progress — meaningful released client planning activity to watch
- Find — look up a client or event when you need their planning context

Team-work views (lenses):

- My Work — tasks assigned to you
- By Person — team work grouped by assignee
- All Team Work — every open venue task',
    'Start with Overdue, Blocked, and Due Today. Switch lenses when you need your own list versus the whole team.',
    'Use Task Center

1. Open Tasks → Task Center.
2. Choose a team-work view: My Work, By Person, or All Team Work.
3. Start with Overdue, Blocked, and Due Today.
4. Use Find when you need a specific client or event''s planning.
5. Open the event from a task when you need full context.
6. Complete or waive an eligible task from Task Center.',
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
  linked_gap_keys = excluded.linked_gap_keys,
  status = excluded.status,
  updated_at = now();
