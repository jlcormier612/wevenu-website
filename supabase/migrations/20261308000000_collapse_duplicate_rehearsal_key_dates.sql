-- ============================================================================
-- Collapse exact-duplicate "Rehearsal…" Key Dates that already agree with
-- clients.rehearsal_date.
--
-- clients.rehearsal_date and a manually-added "Rehearsal Dinner" row in
-- client_key_dates were two independent, silently-driftable sources for
-- the same fact (see lib/clients/validation.ts's validateKeyDateInput and
-- components/clients/key-dates-section.tsx, which now treat
-- clients.rehearsal_date as canonical and render it as a synthesized Key
-- Date instead of a second stored row). This only removes rows that are
-- pure duplicates of that canonical value — same date, label starting
-- with "rehearsal" — so nothing with a genuinely different date is
-- touched; a real conflict stays visible as two entries rather than being
-- silently resolved by this migration guessing which one is correct.
-- ============================================================================
delete from public.client_key_dates ckd
using public.clients c
where ckd.client_id = c.id
  and c.rehearsal_date is not null
  and ckd.date = c.rehearsal_date
  and ckd.label ~* '^rehearsal\b';
