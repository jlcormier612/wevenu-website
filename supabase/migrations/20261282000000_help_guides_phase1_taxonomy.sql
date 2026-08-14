-- Help & Guides Phase 1: reclassify existing Success Library articles into the
-- task-oriented taxonomy (docs/help-guides-information-architecture.md).
-- Content and slugs are preserved. Table remains success_library_articles.

update public.success_library_articles
set goal_category = 'Finding & Booking Clients', updated_at = now()
where slug = 'signing-your-first-contract';

update public.success_library_articles
set goal_category = 'Contracts & Payments', updated_at = now()
where slug = 'getting-paid-on-time';

update public.success_library_articles
set goal_category = 'Building the Event', updated_at = now()
where slug = 'creating-your-first-package';

update public.success_library_articles
set goal_category = 'Working With Clients', updated_at = now()
where slug = 'inviting-your-first-couple';

update public.success_library_articles
set goal_category = 'Vendors', updated_at = now()
where slug = 'working-with-your-vendor-network';
