-- ============================================================================
-- Client Identity Foundation — part 2: account session visibility
--
-- Requirement 2 ("View active sessions; revoke their own sessions") refers to
-- real Supabase Auth login sessions (browser/device sign-ins), not the
-- client_portal_sessions access-grant row. auth.sessions isn't reachable from
-- the client SDK directly, so these two SECURITY DEFINER functions expose a
-- narrow, self-only view/revoke surface.
-- ============================================================================

create or replace function public.get_my_auth_sessions()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'createdAt', s.created_at,
      'updatedAt', s.updated_at,
      'notAfter', s.not_after,
      'userAgent', s.user_agent,
      'ip', s.ip::text,
      'isCurrent', s.id = (auth.jwt() ->> 'session_id')::uuid
    )
    order by s.created_at desc
  ), '[]'::jsonb)
  from auth.sessions s
  where s.user_id = auth.uid();
$$;

grant execute on function public.get_my_auth_sessions() to authenticated;

create or replace function public.revoke_my_auth_session(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from auth.sessions where id = p_session_id and user_id = auth.uid();
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.revoke_my_auth_session(uuid) to authenticated;

notify pgrst, 'reload schema';
