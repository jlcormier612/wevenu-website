-- ============================================================================
-- Couple Tasks Impl 7 — Final Payment verified completion (Option B)
--
-- 1. Typed obligation_kind on payment_line_items (forward-only; NEVER backfill
--    'final' from labels).
-- 2. Durable event_tasks.payment_line_item_id binding (task → specific line).
-- 3. Migrate couple Final payment tasks from broad payment_received to
--    final_payment_obligation_paid (safe identity only — not Verify deposit).
-- 4. New one-shot Luv type final_payment_obligation_paid (≠ paid-in-full).
-- ============================================================================

-- ── 1. payment_line_items.obligation_kind ─────────────────────────────────────

alter table public.payment_line_items
  add column if not exists obligation_kind text;

comment on column public.payment_line_items.obligation_kind is
  'Authoritative payment role set at creation: deposit | installment | final | other. Nullable for legacy rows — never inferred from label at completion.';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'payment_line_items_obligation_kind_check'
      and conrelid = 'public.payment_line_items'::regclass
  ) then
    alter table public.payment_line_items
      add constraint payment_line_items_obligation_kind_check
      check (
        obligation_kind is null
        or obligation_kind in ('deposit', 'installment', 'final', 'other')
      );
  end if;
end $$;

create index if not exists payment_line_items_schedule_obligation_kind
  on public.payment_line_items (schedule_id, obligation_kind)
  where obligation_kind is not null;

-- ── 2. event_tasks.payment_line_item_id (Option B binding) ────────────────────

alter table public.event_tasks
  add column if not exists payment_line_item_id uuid
    references public.payment_line_items (id) on delete set null;

comment on column public.event_tasks.payment_line_item_id is
  'Option B: couple Final Payment task bound to a specific payment_line_items row. Verification = that line status=paid. Null until a final line is created/bound.';

create index if not exists event_tasks_payment_line_item
  on public.event_tasks (payment_line_item_id)
  where payment_line_item_id is not null;

-- ── 3. Luv celebration type (obligation paid ≠ paid-in-full) ─────────────

alter table public.luv_celebrations
  drop constraint if exists luv_celebrations_celebration_type_check;

alter table public.luv_celebrations
  add constraint luv_celebrations_celebration_type_check
  check (celebration_type in (
    'contract_signed',
    'final_payment_received',
    'guest_list_submitted',
    'timeline_submitted',
    'website_published',
    'vendor_list_submitted',
    'seating_submitted',
    'questionnaire_submitted',
    'insurance_uploaded',
    'timeline_shared_with_vendor',
    'final_payment_obligation_paid'
  ));

-- ── 4. Safe trigger migration (couple Final payment only) ─────────────────────
-- Identity (conservative): title ILIKE 'Final payment' + owner_type = couple
-- + auto_complete_trigger = payment_received.
-- Does NOT touch coordinator "Verify deposit" (also payment_received).

update public.playbook_tasks
set auto_complete_trigger = 'final_payment_obligation_paid'
where auto_complete_trigger = 'payment_received'
  and owner_type = 'couple'
  and lower(trim(title)) = 'final payment';

update public.event_tasks
set auto_complete_trigger = 'final_payment_obligation_paid'
where auto_complete_trigger = 'payment_received'
  and owner_type = 'couple'
  and lower(trim(title)) = 'final payment';
