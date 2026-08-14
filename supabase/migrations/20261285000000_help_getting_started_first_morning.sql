-- Help & Guides P0: Getting Started — first-morning orientation article.
-- Uses existing success_library_articles pipeline (goal_category taxonomy).
-- Leaves the five previously seeded articles unchanged.

insert into public.success_library_articles
  (slug, title, goal_category, why_it_matters, when_to_use, best_practices, common_mistakes, related_features, linked_gap_keys, status)
values
  (
    'getting-started-your-first-morning',
    'Getting Started: Your First Morning',
    'Getting Started',
    'I just logged in — what do I do first? Check your Dashboard, then your Leads — everything else can wait.',
    'Use this the first time you open Hello to Cheers, or any morning when you want a simple place to start before diving into setup.',
    '1. Open Dashboard (Overview → Dashboard). Start with Morning Briefing ("What matters today, in order") and Today''s Attention ("Everything that needs a decision or an action right now").
2. Then go to Sales → Leads. That''s your live list of inquiries — the people who need a reply or a next step.
3. Open the Pipeline board from Leads only if you need to move someone to a different stage. You do not need to redesign stages on day one.
4. Do not try to configure everything this morning. Packages, Automations, contracts, and Library templates can wait until a real lead needs them.
5. When a specific question comes up, open Help & Guides (Overview → Help & Guides) and pick the guide that matches what you''re doing.',
    'Trying to set up every template, Automation, and Library item before looking at real leads. Skipping the Dashboard and jumping straight into Settings. Assuming you need a perfect Pipeline before you can answer anyone.',
    '[{"label": "Open Dashboard", "href": "/dashboard"}, {"label": "View Leads", "href": "/leads"}]'::jsonb,
    array[]::text[],
    'published'
  )
on conflict (slug) do nothing;
