-- ============================================================================
-- Hosted Experience Platform — Phase 1: link couple_websites to the catalog
--
-- Additive, alongside the existing theme/theme_palette/font_pairing string
-- columns (docs/hosted-experience-platform-architecture-spec.md §12,
-- "transition window" — not a cutover). These new FK columns become
-- authoritative in a later phase once the RPCs and Studio picker are
-- migrated onto them; for Phase 1 they are populated and kept correct via
-- backfill, but the render/RPC path continues to use the string columns
-- unchanged, to avoid a behavior-change risk beyond this phase's actual
-- goal (catalog foundation + closing the Font Pairing rendering gap, which
-- is done in application code against the existing font_pairing string —
-- see resolveTheme()).
-- ============================================================================

alter table public.couple_websites
  add column collection_id       uuid references public.collections(id) on delete set null,
  add column color_story_id      uuid references public.color_stories(id) on delete set null,
  add column typography_style_id uuid references public.typography_styles(id) on delete set null;

create index couple_websites_collection on public.couple_websites (collection_id);

-- Backfill from the existing string columns. theme -> collections.key
-- directly. theme_palette is stored as the palette's display name
-- (case-insensitive match, same logic resolveTheme() already uses) ->
-- color_stories matched by lower(name) within the resolved collection.
-- font_pairing -> typography_styles.key directly (global catalog, no
-- collection scoping in this phase).
update public.couple_websites w
set collection_id = c.id
from public.collections c
where w.theme = c.key
  and w.collection_id is null;

update public.couple_websites w
set color_story_id = cs.id
from public.color_stories cs
where cs.collection_id = w.collection_id
  and w.theme_palette is not null
  and lower(cs.name) = lower(w.theme_palette)
  and w.color_story_id is null;

update public.couple_websites w
set typography_style_id = ts.id
from public.typography_styles ts
where w.font_pairing is not null
  and ts.key = w.font_pairing
  and w.typography_style_id is null;
