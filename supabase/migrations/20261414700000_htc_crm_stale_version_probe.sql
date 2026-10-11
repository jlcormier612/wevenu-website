-- Tiny read-only probe: prove version conflict can return without invoking
-- the full-store rewrite RPC. Used only by Sandbox diagnostics (service_role).

create or replace function public.htc_crm_assert_expected_version(
  p_expected_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current bigint;
begin
  perform set_config('lock_timeout', '2000', true);
  perform set_config('statement_timeout', '5000', true);

  select version into v_current
    from public.htc_crm_store_meta
   where id = 1;

  if v_current is null then
    return jsonb_build_object('ok', true, 'version', 0, 'matched', p_expected_version = 0);
  end if;

  if p_expected_version is distinct from v_current then
    raise exception 'htc_crm_version_conflict (expected %, actual %)',
      p_expected_version, v_current
      using errcode = '40001';
  end if;

  return jsonb_build_object('ok', true, 'version', v_current, 'matched', true);
end;
$$;

revoke all on function public.htc_crm_assert_expected_version(bigint) from public, anon, authenticated;
grant execute on function public.htc_crm_assert_expected_version(bigint) to service_role;
