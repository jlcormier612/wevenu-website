-- Velvet identity A+C — unify collection.description with picker descriptor
-- (2026-08-10). Same pattern as Midnight migration 20261242: dark Color Story
-- rebundle lives in app code (`collection-color-bundle.ts`); this migration only
-- aligns catalog copy so carousel/studio DB description matches the honest
-- moody/candlelit line (no light-romantic Met Gala oversell).

update public.collections
set description = 'Dramatic, moody & candlelit'
where key = 'velvet';
