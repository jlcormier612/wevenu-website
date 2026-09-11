-- Key Dates product retirement — remove obsolete freeform table + portal RPC.
--
-- Preconditions (product):
--   - Live UI/API/Dashboard/Calendar/Luv/Migration-create paths already retired
--   - Sandbox client_key_dates rows dispositioned to zero
--
-- Intentionally preserved (do not touch here):
--   - Historical migrations that created/used this table or RPC
--   - migration_records / types vocabulary target_entity_type = 'key_date'
--   - client_activities rows with type = 'key_date_added'
--   - clients.rehearsal_date (Client Info — not Key Dates)

-- Portal RPC (SECURITY DEFINER) — no remaining app callers.
drop function if exists public.get_portal_key_dates(text);

-- Policies are dropped with the table; drop explicitly for clarity / older PG.
drop policy if exists client_key_dates_delete_gate on public.client_key_dates;
drop policy if exists client_key_dates_all on public.client_key_dates;

drop table if exists public.client_key_dates;
