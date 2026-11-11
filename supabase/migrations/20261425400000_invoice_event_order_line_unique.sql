-- Incremental EO invoicing: each Event Order line may appear on at most one
-- non-void invoice_line_items row. Void clears event_order_line_id in the app
-- layer so eligibility (and this unique index) allow a later re-freeze.
--
-- Pre-clean any accidental duplicates (keep oldest row per event_order_line_id)
-- before creating the unique index.

with ranked as (
  select
    id,
    row_number() over (
      partition by event_order_line_id
      order by created_at asc, id asc
    ) as rn
  from public.invoice_line_items
  where event_order_line_id is not null
)
update public.invoice_line_items ili
set event_order_line_id = null
from ranked
where ili.id = ranked.id
  and ranked.rn > 1;

create unique index if not exists invoice_line_items_event_order_line_unique
  on public.invoice_line_items (event_order_line_id)
  where event_order_line_id is not null;
