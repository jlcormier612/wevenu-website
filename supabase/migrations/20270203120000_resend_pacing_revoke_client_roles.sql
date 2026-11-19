-- RESEND-SCALE Phase D: enforce service_role-only EXECUTE on
-- acquire_resend_send_slot.
--
-- Root cause: CREATE FUNCTION applied default privileges that granted
-- EXECUTE to anon/authenticated directly. Prior migrations only
-- REVOKE … FROM PUBLIC, which does not remove those role grants.
-- Forward-only: does not edit 20270201120000 / 20270202120000.
-- Does NOT change sliding-window grant/deny semantics or 9/6/3 caps.

revoke all on function public.acquire_resend_send_slot(text, integer, integer, integer, bigint)
  from public;
revoke all on function public.acquire_resend_send_slot(text, integer, integer, integer, bigint)
  from anon;
revoke all on function public.acquire_resend_send_slot(text, integer, integer, integer, bigint)
  from authenticated;

grant execute on function public.acquire_resend_send_slot(text, integer, integer, integer, bigint)
  to service_role;

-- Assert intended privileges and that no unintended overload remains.
do $$
declare
  v_sig text := 'public.acquire_resend_send_slot(text, integer, integer, integer, bigint)';
  v_overload_count integer;
begin
  select count(*) into v_overload_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'acquire_resend_send_slot';

  if v_overload_count <> 1 then
    raise exception
      'acquire_resend_send_slot overload count=% (expected 1) — refusing to leave ambiguous EXECUTE surface',
      v_overload_count;
  end if;

  if has_function_privilege('anon', v_sig, 'execute') then
    raise exception 'anon still has EXECUTE on % after revoke', v_sig;
  end if;
  if has_function_privilege('authenticated', v_sig, 'execute') then
    raise exception 'authenticated still has EXECUTE on % after revoke', v_sig;
  end if;
  if not has_function_privilege('service_role', v_sig, 'execute') then
    raise exception 'service_role missing EXECUTE on % after grant', v_sig;
  end if;
end;
$$;

comment on function public.acquire_resend_send_slot(text, integer, integer, integer, bigint) is
  'Atomically claim one Resend send slot in a sliding lookback window. Critical vs bulk caps enforce reserved capacity. retry_after_ms is clamped. EXECUTE: service_role only. Fail-closed for callers on error.';
