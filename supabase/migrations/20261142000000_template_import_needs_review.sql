-- ============================================================================
-- Template-import review (2026-07-22) — persist "needs review" per item
-- instead of only a one-time import-count toast.
--
-- Timeline Templates and Planning (Playbook) Templates both import an
-- estimated timing when the source text didn't state one explicitly. Before
-- this, that fact only ever showed up in a toast right after import ("Luv
-- estimated timing for 3 of them") — dismiss the toast and there was no way
-- to find which items still need a real timing set. This makes it a real,
-- persistent column so the Template Editor can flag it until a coordinator
-- actually saves over the item (see timeline-template-editor.tsx and
-- playbook-builder.tsx, both of which now clear this on save).
-- ============================================================================

alter table public.timeline_template_items
  add column needs_review boolean not null default false;

alter table public.playbook_tasks
  add column needs_review boolean not null default false;

notify pgrst, 'reload schema';
