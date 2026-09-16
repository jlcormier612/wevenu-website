-- Navigation/IA terminology: bring already-published Guidance article bodies in
-- line with the final left navigation.
--
-- The "Sales" section is gone; Leads now lives under "Your Relationships".
-- 20261386000000_help_guides_final_content.sql already ran and seeded these
-- bodies, so the text is corrected here rather than by editing that migration.
--
-- Targeted substring replacement, not a reseed: the editorial source of truth
-- (lib/help-guides/final-articles.ts) carries the same change, and rewriting
-- whole bodies here would fight any later content migration.
--
-- Idempotent: re-running finds nothing left to replace. Also intentionally
-- narrow — it only rewrites the navigation path "Sales → Leads" and leaves
-- every other use of the word "Sales" (sales cohort metrics, ordinary prose)
-- untouched.

update public.success_library_articles
   set body = replace(body, 'Sales → Leads', 'Your Relationships → Leads')
 where body like '%Sales → Leads%';

-- The guidance destination itself is no longer called "Help & Guides".
-- Present in earlier seeds; kept here so any surviving row is corrected too.
update public.success_library_articles
   set body = replace(body, 'Overview → Help & Guides', 'Overview → Guidance')
 where body like '%Overview → Help & Guides%';

update public.success_library_articles
   set body = replace(body, 'open Help & Guides (Overview → Guidance)', 'open Guidance (Overview → Guidance)')
 where body like '%open Help & Guides (Overview → Guidance)%';

notify pgrst, 'reload schema';
