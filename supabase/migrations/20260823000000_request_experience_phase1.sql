-- ============================================================================
-- Wedding Workspace – Request Experience (Phase 1)
--
-- Additive only. Does not redesign the Request Framework's shape (same 8
-- statuses, same 7 types, same 3 visibility values, same requests /
-- request_lifecycle_events tables) — it completes the client-facing half
-- that Request Framework Foundation deliberately left unbuilt.
--
-- New columns on requests:
--   source_feature / source_id  — which feature created this Request, so
--     the Wedding Workspace can label "Origin: Planning" and both Request
--     Detail pages can offer "Open Related Item". Mirrors the exact
--     source_type/source_id pattern already used on event_tasks.
--   response_text / response_file_url — what the client actually submitted
--     (an answer, a decision, an uploaded file). Generic across all 7
--     request types on purpose — one field pair, not one per type.
--   client_action_enabled — gates whether the client can act on this
--     Request at all (default true). Named generically, not task-specific,
--     since "only if the Request explicitly allows it" (Requirement 4) is
--     useful for any type, not only Task.
--
-- Portal (token-scoped) RPCs mirror the existing pattern used by every
-- other Wedding Workspace feature (get_couple_documents, get_portal_tasks,
-- etc.) — _resolve_portal_ids(p_token) is the same helper they all use.
-- ============================================================================

alter table public.requests
  add column source_feature text check (source_feature is null or source_feature in (
    'planning', 'timeline', 'documents', 'contracts', 'floor_plans', 'guests', 'manual'
  )),
  add column source_id uuid,
  add column response_text text,
  add column response_file_url text,
  add column client_action_enabled boolean not null default true;

create index requests_source on public.requests (source_feature, source_id) where source_feature is not null;

-- Storage bucket for client-uploaded Request responses (Upload type) --------
insert into storage.buckets (id, name, public)
values ('request-uploads', 'request-uploads', true)
on conflict (id) do nothing;

create policy "request_uploads_storage_insert" on storage.objects
  for insert to authenticated, anon
  with check (bucket_id = 'request-uploads');

create policy "request_uploads_storage_select" on storage.objects
  for select to authenticated, anon
  using (bucket_id = 'request-uploads');

-- ── get_portal_requests: the Wedding Workspace Request Center's list ─────
-- Visible to the client when shared (always) or completed-visibility once
-- actually completed (share-on-finish pattern) — never venue_only, never a
-- still-Draft request the venue hasn't sent yet.
create or replace function public.get_portal_requests(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids record;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.client_id is null then return jsonb_build_object('requests', '[]'::jsonb); end if;

  return jsonb_build_object(
    'requests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'title', r.title, 'description', r.description,
        'requestType', r.request_type, 'status', r.status, 'visibility', r.visibility,
        'dueDate', r.due_date, 'sourceFeature', r.source_feature,
        'clientActionEnabled', r.client_action_enabled,
        'createdAt', r.created_at, 'completedAt', r.completed_at
      ) order by r.due_date asc nulls last, r.created_at desc)
      from public.requests r
      where r.client_id = v_ids.client_id
        and r.status != 'draft'
        and (r.visibility = 'shared' or (r.visibility = 'completed' and r.status = 'completed'))
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.get_portal_requests(text) to anon, authenticated;

-- ── get_portal_request_detail: Request Detail — info, history, linked booking ─
-- Auto-transitions Sent → Viewed the first time the client opens it (the
-- only place 'viewed' is ever actually reached) and logs that transition
-- exactly like any other status change.
create or replace function public.get_portal_request_detail(p_token text, p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids record;
  v_req public.requests%rowtype;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.client_id is null then return null; end if;

  select * into v_req from public.requests
  where id = p_request_id and client_id = v_ids.client_id
    and status != 'draft'
    and (visibility = 'shared' or (visibility = 'completed' and status = 'completed'));
  if not found then return null; end if;

  if v_req.status = 'sent' then
    update public.requests set status = 'viewed', updated_at = now()
    where id = v_req.id
    returning * into v_req;
    insert into public.request_lifecycle_events (request_id, event_type, from_status, to_status)
    values (v_req.id, 'status_changed', 'sent', 'viewed');
  end if;

  return jsonb_build_object(
    'id', v_req.id, 'title', v_req.title, 'description', v_req.description,
    'requestType', v_req.request_type, 'status', v_req.status, 'visibility', v_req.visibility,
    'dueDate', v_req.due_date, 'sourceFeature', v_req.source_feature,
    'responseText', v_req.response_text, 'responseFileUrl', v_req.response_file_url,
    'clientActionEnabled', v_req.client_action_enabled,
    'createdAt', v_req.created_at, 'completedAt', v_req.completed_at, 'reviewedAt', v_req.reviewed_at,
    'history', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'eventType', e.event_type, 'fromStatus', e.from_status,
        'toStatus', e.to_status, 'createdAt', e.created_at
      ) order by e.created_at asc)
      from public.request_lifecycle_events e where e.request_id = v_req.id
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.get_portal_request_detail(text, uuid) to anon, authenticated;

-- ── submit_portal_request: the one client-side action for every type ─────
-- "Submit information", "Upload", "Approve/Reject", "Confirm", "Select",
-- and "Mark Complete" (Task) all funnel through this single transition —
-- one workflow, differentiated only by what the Wedding Workspace UI sends
-- as response_text/response_file_url, not by a second status machine.
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

  update public.requests set
    response_text = coalesce(p_response_text, response_text),
    response_file_url = coalesce(p_response_file_url, response_file_url),
    status = 'submitted',
    updated_at = now()
  where id = v_req.id;

  insert into public.request_lifecycle_events (request_id, event_type, from_status, to_status)
  values (v_req.id, 'status_changed', v_req.status, 'submitted');

  return jsonb_build_object('ok', true, 'status', 'submitted');
end;
$$;

grant execute on function public.submit_portal_request(text, uuid, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
