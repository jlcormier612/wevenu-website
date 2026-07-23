-- White-Glove Customer Success Workspace §2.2a step 4 — the per-venue
-- onboarding workspace reuses the Migration Center wizard for all 5
-- entities the self-service wizard already supports (couples, leads,
-- vendors, inventory, packages), not just Clients/Vendors. Same guarded
-- p_venue_id_override pattern as 20261141000000
-- (create_client_atomic/create_vendor_atomic) — honored only for a
-- genuine service_role caller, silently ignored for an authenticated venue
-- session (falls back to their own current_user_venue_id(), unchanged).
--
-- create_lead_atomic itself is `security invoker` and only touches
-- ingest_lead (already accepts venue_id as an explicit parameter, not
-- session-resolved — no change needed there); Inventory and Packages
-- already import fine for white-glove today via plain, genuinely
-- parameterized inserts (confirmed in 20261141000000's own header note).

drop function if exists public.create_lead_atomic(jsonb);

create or replace function public.create_lead_atomic(payload jsonb, p_venue_id_override uuid default null)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_venue_id uuid;
  v_result   jsonb;
begin
  v_venue_id := case
    when p_venue_id_override is not null and auth.role() = 'service_role' then p_venue_id_override
    else public.current_user_venue_id()
  end;

  if v_venue_id is null then
    raise exception 'not authorized for a venue';
  end if;
  if nullif(trim(payload ->> 'firstName'), '') is null or nullif(trim(payload ->> 'lastName'), '') is null then
    raise exception 'first and last name are required';
  end if;

  v_result := public.ingest_lead(v_venue_id, nullif(payload ->> 'source', ''), payload);

  if not (v_result ->> 'ok')::boolean then
    raise exception '%', v_result ->> 'error';
  end if;

  return (v_result ->> 'leadId')::uuid;
end;
$$;

grant execute on function public.create_lead_atomic(jsonb, uuid) to authenticated;
grant execute on function public.create_lead_atomic(jsonb, uuid) to service_role;

notify pgrst, 'reload schema';
