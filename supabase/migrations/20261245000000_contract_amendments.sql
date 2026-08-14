-- ============================================================================
-- Work Package D4 — Contract amendment lineage. Mirrors
-- invoices.amends_invoice_id exactly (20260926000000_invoice_amendments_...):
-- a self-reference, set only on a newly-created amendment, at the Contract
-- business-object level. The Document Domain records the SAME lineage fact
-- once the amendment is actually sent and a canonical Document exists for it
-- (canonical_document_references, reference_type='supersedes') — this column
-- is what lets the app know "this is an amendment of X" from the moment of
-- creation, before that Document exists yet.
-- ============================================================================

alter table public.contracts
  add column if not exists amends_contract_id uuid references public.contracts (id) on delete set null;

create index if not exists contracts_amends on public.contracts (amends_contract_id) where amends_contract_id is not null;

notify pgrst, 'reload schema';
