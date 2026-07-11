-- ============================================================================
-- Booking Floor Plan Workspace — a booking may hold many floor plans
-- (Ceremony, Reception, Cocktail Hour, Rain Backup, ...), not just one.
-- Drops the one-per-event constraint and adds the per-plan fields the
-- workspace needs: an optional venue space, and a client-access flag whose
-- values are reserved now so Client Collaboration doesn't need another
-- migration later — no UI or logic reads it yet.
-- ============================================================================

alter table public.floor_plans drop constraint floor_plans_event_id_key;

alter table public.floor_plans
  add column space_id uuid references public.venue_spaces (id) on delete set null;

-- Client Collaboration (not built yet) — 'hidden' until that feature exists.
alter table public.floor_plans
  add column client_access text not null default 'hidden'
    check (client_access in ('edit', 'view', 'hidden'));

notify pgrst, 'reload schema';
