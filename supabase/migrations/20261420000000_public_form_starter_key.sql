-- Public Forms starters: durable idempotency key + atomic seed RPC.
-- Additive only. Does not publish, delete customer content, or claim forms by name.

-- ---------------------------------------------------------------------------
-- 1. Schema
-- ---------------------------------------------------------------------------

alter table public.public_forms
  add column if not exists starter_key text;

comment on column public.public_forms.starter_key is
  'Platform starter identity (e.g. general_venue_inquiry). Null = venue-authored/unknown provenance. Never assign from name alone.';

-- Verified Willow Grove Sandbox backfill IDs only (PUBLIC-FORMS-BACKFILL.json).
-- Do NOT broad-match internal_name across venues — that would mis-claim customer forms.
update public.public_forms
set starter_key = 'general_venue_inquiry'
where id = 'f80e069f-e231-42ad-962f-6deb83e2421d'
  and venue_id = '31f38b79-eb99-4ebc-81bc-af85767b42aa'
  and starter_key is null
  and internal_name = 'General Venue Inquiry'
  and status = 'draft';

update public.public_forms
set starter_key = 'wedding_expo_lead_capture'
where id = '3cbf6f4e-1595-40d4-bc98-602ecefa9f84'
  and venue_id = '31f38b79-eb99-4ebc-81bc-af85767b42aa'
  and starter_key is null
  and internal_name = 'Wedding Expo Lead Capture'
  and status = 'draft';

update public.public_forms
set starter_key = 'open_house_tour_interest'
where id = 'b56d4251-1275-49ef-a38a-99df1ee36065'
  and venue_id = '31f38b79-eb99-4ebc-81bc-af85767b42aa'
  and starter_key is null
  and internal_name = 'Open House & Tour Interest'
  and status = 'draft';

update public.public_forms
set starter_key = 'private_social_event_inquiry'
where id = '16eb3c94-906d-4a32-a433-a04e40c0387f'
  and venue_id = '31f38b79-eb99-4ebc-81bc-af85767b42aa'
  and starter_key is null
  and internal_name = 'Private & Social Event Inquiry'
  and status = 'draft';

create unique index if not exists public_forms_venue_starter_key_uidx
  on public.public_forms (venue_id, starter_key)
  where starter_key is not null;

-- ---------------------------------------------------------------------------
-- 2. Atomic seed RPC (form + questions in one transaction)
-- ---------------------------------------------------------------------------
-- Concurrency: unique (venue_id, starter_key) is the authority.
-- Incomplete recovery: only for rows that already carry starter_key (platform-owned).
-- Never overwrites status, titles, or questions on healthy complete starters.
-- Never claims a same-name form that lacks starter_key.

create or replace function public.seed_public_form_starter(
  p_venue_id uuid,
  p_starter_key text,
  p_internal_name text,
  p_public_title text,
  p_description text,
  p_field_config jsonb,
  p_questions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_form_id uuid;
  v_q_count int;
  v_expected int;
  v_status text;
  v_q jsonb;
  v_idx int;
begin
  if p_venue_id is null or p_starter_key is null or length(trim(p_starter_key)) = 0 then
    raise exception 'seed_public_form_starter: venue_id and starter_key required';
  end if;

  if p_starter_key not in (
    'general_venue_inquiry',
    'wedding_expo_lead_capture',
    'open_house_tour_interest',
    'private_social_event_inquiry'
  ) then
    raise exception 'seed_public_form_starter: unknown starter_key %', p_starter_key;
  end if;

  -- Staff of the venue OR service_role (provisioning). Fail closed otherwise.
  if auth.role() is distinct from 'service_role'
     and public.current_user_venue_id() is distinct from p_venue_id then
    raise exception 'seed_public_form_starter: venue access denied';
  end if;

  v_expected := coalesce(jsonb_array_length(p_questions), 0);

  select id, status
    into v_form_id, v_status
  from public.public_forms
  where venue_id = p_venue_id
    and starter_key = p_starter_key
  limit 1;

  if v_form_id is not null then
    select count(*)::int into v_q_count
    from public.public_form_questions
    where public_form_id = v_form_id;

    if v_q_count >= v_expected and v_expected > 0 then
      return jsonb_build_object(
        'status', 'skipped',
        'form_id', v_form_id,
        'form_status', v_status
      );
    end if;

    -- Incomplete platform starter: replace questions only (never change form status/content).
    delete from public.public_form_questions where public_form_id = v_form_id;
    if v_expected > 0 then
      for v_idx in 0 .. v_expected - 1 loop
        v_q := p_questions -> v_idx;
        insert into public.public_form_questions (
          public_form_id, venue_id, question_text, question_type, required, options, sort_order
        ) values (
          v_form_id,
          p_venue_id,
          v_q ->> 'question_text',
          v_q ->> 'question_type',
          coalesce((v_q ->> 'required')::boolean, false),
          case when v_q ? 'options' then v_q -> 'options' else null end,
          coalesce((v_q ->> 'sort_order')::smallint, 0)
        );
      end loop;
    end if;

    return jsonb_build_object(
      'status', 'repaired',
      'form_id', v_form_id,
      'form_status', v_status
    );
  end if;

  begin
    insert into public.public_forms (
      venue_id, internal_name, public_title, description, field_config, status, starter_key
    ) values (
      p_venue_id,
      p_internal_name,
      p_public_title,
      coalesce(p_description, ''),
      coalesce(p_field_config, '{}'::jsonb),
      'draft',
      p_starter_key
    )
    returning id into v_form_id;
  exception
    when unique_violation then
      -- Concurrent insert won — load winner and ensure questions.
      select id, status into v_form_id, v_status
      from public.public_forms
      where venue_id = p_venue_id and starter_key = p_starter_key
      limit 1;

      select count(*)::int into v_q_count
      from public.public_form_questions
      where public_form_id = v_form_id;

      if v_q_count < v_expected then
        delete from public.public_form_questions where public_form_id = v_form_id;
        if v_expected > 0 then
          for v_idx in 0 .. v_expected - 1 loop
            v_q := p_questions -> v_idx;
            insert into public.public_form_questions (
              public_form_id, venue_id, question_text, question_type, required, options, sort_order
            ) values (
              v_form_id,
              p_venue_id,
              v_q ->> 'question_text',
              v_q ->> 'question_type',
              coalesce((v_q ->> 'required')::boolean, false),
              case when v_q ? 'options' then v_q -> 'options' else null end,
              coalesce((v_q ->> 'sort_order')::smallint, 0)
            );
          end loop;
        end if;
        return jsonb_build_object('status', 'repaired', 'form_id', v_form_id, 'form_status', v_status);
      end if;

      return jsonb_build_object('status', 'skipped', 'form_id', v_form_id, 'form_status', v_status);
  end;

  if v_expected > 0 then
    for v_idx in 0 .. v_expected - 1 loop
      v_q := p_questions -> v_idx;
      insert into public.public_form_questions (
        public_form_id, venue_id, question_text, question_type, required, options, sort_order
      ) values (
        v_form_id,
        p_venue_id,
        v_q ->> 'question_text',
        v_q ->> 'question_type',
        coalesce((v_q ->> 'required')::boolean, false),
        case when v_q ? 'options' then v_q -> 'options' else null end,
        coalesce((v_q ->> 'sort_order')::smallint, 0)
      );
    end loop;
  end if;

  return jsonb_build_object(
    'status', 'created',
    'form_id', v_form_id,
    'form_status', 'draft'
  );
end;
$$;

revoke all on function public.seed_public_form_starter(
  uuid, text, text, text, text, jsonb, jsonb
) from public;

grant execute on function public.seed_public_form_starter(
  uuid, text, text, text, text, jsonb, jsonb
) to authenticated, service_role;

comment on function public.seed_public_form_starter(
  uuid, text, text, text, text, jsonb, jsonb
) is
  'Atomically install or repair one Public Forms platform starter (draft). Unique (venue_id, starter_key) is concurrency authority. Does not claim same-name customer forms.';
