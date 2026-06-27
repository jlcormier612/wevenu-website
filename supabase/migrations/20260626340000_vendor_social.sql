-- ============================================================================
-- Sprint 17 addition — Vendor social media fields
-- The wedding industry is highly visual and relationship-driven; vendors
-- need Instagram, Facebook, Pinterest, and TikTok URLs alongside their
-- existing contact information.
-- ============================================================================

alter table public.vendors
  add column instagram_url text,
  add column facebook_url  text,
  add column pinterest_url text,
  add column tiktok_url    text;

notify pgrst, 'reload schema';
