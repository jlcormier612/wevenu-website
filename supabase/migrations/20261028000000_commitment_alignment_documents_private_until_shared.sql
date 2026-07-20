-- ============================================================================
-- Commitment Alignment Sprint, Item 5 (final item) — Documents
-- docs/commitment-lifecycle-architecture.md §9's Documents row: contracts
-- and invoices' is_couple_visible column defaults `true` and nothing in
-- the codebase ever set it (grep-confirmed: referenced only in its own
-- column definition and in get_couple_documents's read filter) — meaning
-- every contract/invoice, including a never-sent Draft, has been visible
-- to the couple by default, not by the venue's explicit send action.
-- Platform principle: Private until intentionally shared.
--
-- Fix reuses the existing status lifecycle already governing Draft ->
-- Sent for both tables (no new lifecycle concept introduced): the column
-- now defaults false, and the same "send" write that already sets
-- sent_at (contracts) / issued_at (invoices) is the one place that flips
-- it true. Backfill recomputes every existing row from its own status,
-- so an already-sent contract/invoice a couple may have already seen
-- stays visible (never silently un-shared), while a still-draft one
-- (currently leaking under the old default) is correctly hidden.
-- ============================================================================

alter table public.contracts alter column is_couple_visible set default false;
alter table public.invoices  alter column is_couple_visible set default false;

update public.contracts set is_couple_visible = (status <> 'draft');
update public.invoices  set is_couple_visible = (status <> 'draft');
