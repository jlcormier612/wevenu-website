-- Navigation/IA terminology: bring already-published Guidance article copy in
-- line with the final left navigation.
--
-- The "Sales" section is gone; Leads now lives under "Your Relationships".
-- 20261386000000_help_guides_final_content.sql already ran and seeded this
-- copy, so the text is corrected here rather than by editing that migration.
--
-- Note the columns: success_library_articles has no single "body" column. The
-- editorial body is stored in why_it_matters, with the remaining prose split
-- across when_to_use / best_practices / common_mistakes. Today every
-- occurrence is in why_it_matters; all four are rewritten anyway so a later
-- content pass that moves a paragraph cannot leave stale navigation behind.
--
-- Targeted substring replacement, not a reseed: the editorial source of truth
-- (lib/help-guides/final-articles.ts) carries the same change, and rewriting
-- whole rows here would fight any later content migration.
--
-- Idempotent, and deliberately narrow: it rewrites the navigation path
-- "Sales → Leads" only, leaving every other use of "Sales" (sales-cohort
-- metrics, ordinary prose) untouched.

update public.success_library_articles
   set why_it_matters  = replace(why_it_matters,  'Sales → Leads', 'Your Relationships → Leads'),
       when_to_use     = replace(when_to_use,     'Sales → Leads', 'Your Relationships → Leads'),
       best_practices  = replace(best_practices,  'Sales → Leads', 'Your Relationships → Leads'),
       common_mistakes = replace(common_mistakes, 'Sales → Leads', 'Your Relationships → Leads')
 where why_it_matters  like '%Sales → Leads%'
    or when_to_use     like '%Sales → Leads%'
    or best_practices  like '%Sales → Leads%'
    or common_mistakes like '%Sales → Leads%';

-- The guidance destination is no longer called "Help & Guides". Seeded by an
-- earlier content pass; corrected here for any row that still carries it.
update public.success_library_articles
   set why_it_matters  = replace(replace(why_it_matters,  'open Help & Guides (Overview → Help & Guides)', 'open Guidance (Overview → Guidance)'), 'Overview → Help & Guides', 'Overview → Guidance'),
       when_to_use     = replace(replace(when_to_use,     'open Help & Guides (Overview → Help & Guides)', 'open Guidance (Overview → Guidance)'), 'Overview → Help & Guides', 'Overview → Guidance'),
       best_practices  = replace(replace(best_practices,  'open Help & Guides (Overview → Help & Guides)', 'open Guidance (Overview → Guidance)'), 'Overview → Help & Guides', 'Overview → Guidance'),
       common_mistakes = replace(replace(common_mistakes, 'open Help & Guides (Overview → Help & Guides)', 'open Guidance (Overview → Guidance)'), 'Overview → Help & Guides', 'Overview → Guidance')
 where why_it_matters  like '%Overview → Help & Guides%'
    or when_to_use     like '%Overview → Help & Guides%'
    or best_practices  like '%Overview → Help & Guides%'
    or common_mistakes like '%Overview → Help & Guides%';

notify pgrst, 'reload schema';
