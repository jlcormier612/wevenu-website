-- ============================================================================
-- Drop the legacy token-based vendor portal (/v/[token])
--
-- Confirmed dead in docs/vendor-network-charter-review.md and removed from
-- the app in this same change: the shell component, its 5 API routes, the
-- `lib/vendor-portal/service.ts` session helpers, and every UI entry point
-- that generated a link to it (vendor detail page, event vendor assignment
-- row). This migration removes the now-unreferenced schema underneath —
-- leaving it in place after every caller is gone would be exactly the
-- "partial reference" this cleanup exists to avoid.
--
-- `lib/vendor-portal/types.ts` is NOT touched — its types (VendorTimelineEntry,
-- VendorTask, VendorDocument) are still live, reused by the real, authenticated
-- vendor event workspace (lib/vendor-events/service.ts).
--
-- Verified before dropping: no foreign key anywhere references
-- vendor_portal_sessions, and every function below is confirmed unreferenced
-- by any remaining application code.
-- ============================================================================

drop function if exists public.get_vendor_portal_context(text);
drop function if exists public.get_vendor_event_timeline(text, uuid);
drop function if exists public.get_vendor_event_tasks(text, uuid);
drop function if exists public.get_vendor_event_documents(text, uuid);
drop function if exists public.complete_vendor_task(text, uuid);
drop function if exists public.vendor_self_checkin(text, uuid, text);

drop table if exists public.vendor_portal_sessions cascade;
