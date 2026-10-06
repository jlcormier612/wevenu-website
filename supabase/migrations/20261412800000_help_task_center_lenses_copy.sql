-- Guidance copy: name the current Task Center lenses in the published article.
-- Editorial source: lib/help-guides/final-articles.ts (same wording).
-- Does not rewrite historical seed migration 20261386000000; corrects live rows.

update public.success_library_articles
   set why_it_matters = replace(
         why_it_matters,
         'Use the task views to see the work that belongs to you, your team, or the broader venue task list.

The exact views may be labeled according to the current Task Center interface, but the underlying idea is simple:',
         'Choose a lens:

* **My Work** — work assigned to you
* **By Person** — work grouped by who it''s assigned to
* **All Team Work** — the full venue task list

These lenses are different views over the same tasks. They are not separate permission boundaries.'
       ),
       updated_at = timezone('utc', now())
 where slug = 'how-does-task-center-work'
   and why_it_matters like '%The exact views may be labeled according to the current Task Center interface%';
