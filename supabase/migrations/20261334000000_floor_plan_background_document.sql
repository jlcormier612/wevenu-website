-- ============================================================================
-- Floor Plan Phase 2 — Document / background unification
--
-- The uploaded PDF/image is a real business Document (source of record).
-- background_image_url remains the editor/render surface: the same file for
-- images, or a technical derivative (e.g. PDF page-1 raster) that must never
-- be registered as a second user-facing Document.
--
-- Legacy plans keep background_image_url only (background_document_id null).
-- Space association stays on floor_plans.space_id / floor_plan_templates.space_id;
-- Event association on floor_plans.event_id (+ documents.event_id when scoped).
-- Venue-level documents cover reusable master / general reference files.
-- ============================================================================

alter table public.floor_plans
  add column if not exists background_document_id uuid
    references public.documents (id) on delete set null;

alter table public.floor_plan_templates
  add column if not exists background_document_id uuid
    references public.documents (id) on delete set null;

create index if not exists floor_plans_background_document
  on public.floor_plans (background_document_id)
  where background_document_id is not null;

create index if not exists floor_plan_templates_background_document
  on public.floor_plan_templates (background_document_id)
  where background_document_id is not null;

comment on column public.floor_plans.background_document_id is
  'Source-of-record Document for the uploaded floor-plan file. background_image_url is the editor/render URL (legacy, same image, or a non-Document derivative).';

comment on column public.floor_plan_templates.background_document_id is
  'Source-of-record Document for the uploaded floor-plan file. background_image_url is the editor/render URL (legacy, same image, or a non-Document derivative).';

notify pgrst, 'reload schema';
