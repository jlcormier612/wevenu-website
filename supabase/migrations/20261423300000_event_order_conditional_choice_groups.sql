-- Parent → child conditional choice groups on Event Order Templates.
-- Additive: existing groups keep depends_on_option_ids = '{}' (always visible).
-- Frozen client_choices.definition mirrors dependsOnOptionIds; submit RPC
-- skips inactive dependent groups and rejects orphan answers on inactive children.

alter table public.event_order_template_groups
  add column if not exists depends_on_option_ids uuid[] not null default '{}';

comment on column public.event_order_template_groups.depends_on_option_ids is
  'When non-empty, this group is active only while at least one listed parent option is selected. Empty = always visible.';

create index if not exists event_order_template_groups_depends_on
  on public.event_order_template_groups using gin (depends_on_option_ids);

-- ---- submit_client_choices: honor dependsOnOptionIds on frozen definition ----

create or replace function public.submit_client_choices(
  p_token text,
  p_choices_id uuid,
  p_answers jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids record;
  v_row public.client_choices%rowtype;
  v_next int;
  v_outcome text;
  v_answers jsonb;
  v_group jsonb;
  v_group_id text;
  v_group_name text;
  v_mode text;
  v_min int;
  v_max int;
  v_option_ids jsonb;
  v_count int;
  v_opt text;
  v_allowed boolean;
  v_depends jsonb;
  v_dep_id text;
  v_parent_active boolean;
  v_selected_all jsonb := '[]'::jsonb;
  v_ans_key text;
  v_ans_val jsonb;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.event_id is null then
    return jsonb_build_object('ok', false, 'message', 'Session expired.');
  end if;

  select * into v_row
  from public.client_choices
  where id = p_choices_id and event_id = v_ids.event_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Choices not found.');
  end if;

  if v_row.status not in ('sent', 'in_progress', 'changes_requested') then
    return jsonb_build_object('ok', false, 'message', 'These choices are locked right now.');
  end if;

  v_answers := coalesce(p_answers, v_row.answers);

  -- Union of all selected option ids (for parent-active checks).
  for v_ans_key, v_ans_val in select * from jsonb_each(coalesce(v_answers, '{}'::jsonb))
  loop
    if jsonb_typeof(v_ans_val->'optionIds') = 'array' then
      v_selected_all := v_selected_all || coalesce(v_ans_val->'optionIds', '[]'::jsonb);
    end if;
  end loop;

  for v_group in
    select value from jsonb_array_elements(coalesce(v_row.definition->'groups', '[]'::jsonb))
  loop
    v_group_id := v_group->>'id';
    v_group_name := coalesce(nullif(v_group->>'name', ''), 'this group');
    v_mode := coalesce(v_group->>'selectionMode', 'multi');
    v_min := coalesce((v_group->>'minSelect')::int, 0);
    v_max := case
      when v_group->>'maxSelect' is null or v_group->>'maxSelect' = '' then null
      else (v_group->>'maxSelect')::int
    end;
    v_depends := coalesce(v_group->'dependsOnOptionIds', '[]'::jsonb);
    if jsonb_typeof(v_depends) <> 'array' then
      v_depends := '[]'::jsonb;
    end if;

    -- Parent gate: inactive dependents must not block submit and must not carry answers.
    v_parent_active := true;
    if jsonb_array_length(v_depends) > 0 then
      v_parent_active := false;
      for v_dep_id in select jsonb_array_elements_text(v_depends)
      loop
        if exists (
          select 1 from jsonb_array_elements_text(v_selected_all) s(x) where s.x = v_dep_id
        ) then
          v_parent_active := true;
          exit;
        end if;
      end loop;
    end if;

    v_option_ids := coalesce(v_answers->v_group_id->'optionIds', '[]'::jsonb);
    if jsonb_typeof(v_option_ids) <> 'array' then
      v_option_ids := '[]'::jsonb;
    end if;

    if not v_parent_active then
      if jsonb_array_length(v_option_ids) > 0 then
        return jsonb_build_object(
          'ok', false,
          'message', format('“%s” is not available for the current selections.', v_group_name)
        );
      end if;
      continue;
    end if;

    for v_opt in select jsonb_array_elements_text(v_option_ids)
    loop
      select exists (
        select 1
        from jsonb_array_elements(coalesce(v_row.definition->'options', '[]'::jsonb)) opt
        where opt->>'id' = v_opt
          and opt->>'groupId' = v_group_id
      ) into v_allowed;
      if not v_allowed then
        return jsonb_build_object(
          'ok', false,
          'message', format('“%s” includes an option that is not part of this selection request.', v_group_name)
        );
      end if;
    end loop;

    select count(distinct x)::int into v_count
    from jsonb_array_elements_text(v_option_ids) as t(x);

    if v_mode = 'single' and v_count > 1 then
      return jsonb_build_object(
        'ok', false,
        'message', format('“%s” allows only one selection.', v_group_name)
      );
    end if;

    if v_count < v_min then
      return jsonb_build_object(
        'ok', false,
        'message', case
          when v_min = 1 then format('Choose an option for “%s” before submitting.', v_group_name)
          else format('“%s” requires at least %s selections.', v_group_name, v_min)
        end
      );
    end if;

    if v_max is not null and v_count > v_max then
      return jsonb_build_object(
        'ok', false,
        'message', format('“%s” allows at most %s selections.', v_group_name, v_max)
      );
    end if;
  end loop;

  v_outcome := case
    when v_row.status = 'changes_requested' then 'resubmitted'
    else 'submitted'
  end;

  select coalesce(max(submission_number), 0) + 1 into v_next
  from public.client_choices_submissions
  where client_choices_id = v_row.id;

  insert into public.client_choices_submissions (
    venue_id, client_choices_id, event_id, submission_number,
    outcome_status, snapshot, submitted_by
  ) values (
    v_row.venue_id, v_row.id, v_row.event_id, v_next,
    v_outcome,
    jsonb_build_object(
      'definition', v_row.definition,
      'answers', v_answers,
      'name', v_row.name
    ),
    'client'
  );

  update public.client_choices
  set
    answers = v_answers,
    status = v_outcome,
    submitted_at = now(),
    changes_requested_note = null,
    changes_requested_at = null,
    opened_at = coalesce(opened_at, now())
  where id = v_row.id;

  insert into public.client_choices_activities (venue_id, client_choices_id, type, title)
  values (
    v_row.venue_id, v_row.id,
    v_outcome,
    case when v_outcome = 'resubmitted' then 'Client resubmitted choices' else 'Client submitted choices' end
  );

  return jsonb_build_object('ok', true, 'status', v_outcome, 'submissionNumber', v_next);
end;
$$;

comment on function public.submit_client_choices(text, uuid, jsonb) is
  'Portal couple submit — validates required/exclusive groups; skips inactive dependsOnOptionIds children; rejects orphan child answers.';

notify pgrst, 'reload schema';
