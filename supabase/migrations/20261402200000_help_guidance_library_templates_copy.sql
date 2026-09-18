-- Guidance copy: venue-facing "definitions" → "templates" in two articles.
-- Editorial source: lib/help-guides/final-articles.ts (same wording).
-- Does not rewrite historical seed migration 20261386000000; corrects live rows.

update public.success_library_articles
   set why_it_matters = replace(
         why_it_matters,
         '**Library = reusable definitions.**',
         '**Library = reusable templates.**'
       ),
       updated_at = timezone('utc', now())
 where slug = 'whats-the-difference-between-a-package-inventory-and-an-inventory-template'
   and why_it_matters like '%**Library = reusable definitions.**%';

update public.success_library_articles
   set why_it_matters = replace(
         replace(
           why_it_matters,
           'The Library holds reusable definitions such as Packages and payment-plan structures.',
           'The Library holds reusable templates such as Packages and payment-plan structures.'
         ),
         'That distinction matters because changing a reusable Library definition should not silently rewrite something your venue has already committed to a client.',
         'That distinction matters because changing a reusable Library template should not silently rewrite something your venue has already committed to a client.'
       ),
       updated_at = timezone('utc', now())
 where slug = 'whats-the-difference-between-a-package-payment-schedule-and-payment'
   and (
     why_it_matters like '%reusable definitions such as Packages%'
     or why_it_matters like '%reusable Library definition should not%'
   );
