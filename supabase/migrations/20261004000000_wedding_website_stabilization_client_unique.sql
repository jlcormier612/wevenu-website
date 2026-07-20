-- ============================================================================
-- Wedding Website Stabilization — Defect 1: Studio cannot save anything
--
-- docs/wedding-website-stabilization-plan.md. update_my_website's upsert
-- ("insert ... on conflict (client_id) do update ... returning id",
-- 20260701700000_sprint70_theme_palettes.sql:160-164) has always required a
-- unique constraint on client_id. None was ever created — couple_websites
-- only ever had a primary key on id and a unique index on slug, plus a
-- plain (non-unique) index on client_id
-- (20260629100000_couple_website.sql:71-72). Confirmed live: every call to
-- update_my_website fails with 42P10 ("no unique or exclusion constraint
-- matching the ON CONFLICT specification") — the Studio's save action has
-- never worked, for any couple, for any field.
--
-- The domain model already assumes exactly one website per client
-- (get_my_website looks up a single row by client_id); this constraint
-- makes that assumption real rather than adding a new rule.
-- ============================================================================

alter table public.couple_websites
  add constraint couple_websites_client_id_key unique (client_id);
