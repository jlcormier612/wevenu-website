-- ============================================================================
-- submit_portal_request: return clientId + fromStatus alongside ok/status so
-- the API route layer can emit a "client_submitted" lifecycle hook event
-- (Requirement 7) without an extra authenticated read the portal route has
-- no session to perform.
-- ============================================================================

create or replace function public.submit_portal_request(
  p_token text, p_request_id uuid, p_response_text text, p_response_file_url text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids record;
  v_req public.requests%rowtype;
  v_from_status text;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.client_id is null then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;

  select * into v_req from public.requests
  where id = p_request_id and client_id = v_ids.client_id
    and (visibility = 'shared' or (visibility = 'completed' and status = 'completed'));
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if not v_req.client_action_enabled then
    return jsonb_build_object('ok', false, 'error', 'action_not_allowed');
  end if;
  if v_req.status not in ('sent', 'viewed', 'in_progress') then
    return jsonb_build_object('ok', false, 'error', 'not_actionable', 'status', v_req.status);
  end if;

  v_from_status := v_req.status;

  update public.requests set
    response_text = coalesce(p_response_text, response_text),
    response_file_url = coalesce(p_response_file_url, response_file_url),
    status = 'submitted',
    updated_at = now()
  where id = v_req.id;

  insert into public.request_lifecycle_events (request_id, event_type, from_status, to_status)
  values (v_req.id, 'status_changed', v_from_status, 'submitted');

  return jsonb_build_object(
    'ok', true, 'status', 'submitted',
    'clientId', v_ids.client_id, 'fromStatus', v_from_status
  );
end;
$$;

grant execute on function public.submit_portal_request(text, uuid, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
