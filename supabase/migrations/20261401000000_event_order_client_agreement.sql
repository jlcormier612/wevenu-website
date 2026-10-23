-- Event Order client agreement (distinct from venue finalize + share).
-- Share delivers a reviewable snapshot; client_agreed_at records mutual agreement.
-- Reopen clears agreement so a deliberate re-share + re-agree path is required.

alter table public.event_orders
  add column if not exists client_agreed_at timestamptz;

alter table public.event_orders
  add column if not exists client_agreed_name text;

alter table public.event_orders
  add column if not exists client_agreed_revision integer;

comment on column public.event_orders.client_agreed_at is
  'When the client accepted the shared Event Order. Null until accepted; cleared on venue reopen.';
comment on column public.event_orders.client_agreed_name is
  'Display name the client typed when accepting.';
comment on column public.event_orders.client_agreed_revision is
  'Event Order revision that was agreed. Re-share after reopen requires a new acceptance.';

drop function if exists public.get_event_order_for_portal(text);

create function public.get_event_order_for_portal(p_token text)
returns table (
  id            uuid,
  status        text,
  revision      int,
  shared_at     timestamptz,
  client_agreed_at timestamptz,
  client_agreed_name text,
  client_agreed_revision integer,
  section_id    uuid,
  section_name  text,
  line_id       uuid,
  line_description text,
  line_quantity numeric,
  line_amount   numeric,
  line_sort_order smallint,
  line_is_included boolean,
  line_unit text,
  line_unit_price numeric,
  line_notes text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
  v_order public.event_orders%rowtype;
  v_snap public.event_order_share_snapshots%rowtype;
  v_line jsonb;
  v_sections jsonb;
  v_lines jsonb;
  v_sec_name text;
  v_sec_id uuid;
begin
  select * into v_session
  from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return; end if;

  select eo.* into v_order
  from public.event_orders eo
  join public.events e on e.id = eo.event_id
  where e.client_id = v_session.client_id
    and eo.venue_id = v_session.venue_id
    and eo.shared_at is not null
  order by eo.updated_at desc
  limit 1;
  if not found then return; end if;

  select * into v_snap
  from public.event_order_share_snapshots
  where event_order_id = v_order.id
  order by shared_at desc
  limit 1;

  if found then
    v_sections := coalesce(v_snap.payload->'sections', '[]'::jsonb);
    v_lines := coalesce(v_snap.payload->'lines', '[]'::jsonb);

    for v_line in select * from jsonb_array_elements(v_lines)
    loop
      v_sec_id := nullif(v_line->>'sectionId', '')::uuid;
      v_sec_name := null;
      if v_sec_id is not null then
        select s->>'name' into v_sec_name
        from jsonb_array_elements(v_sections) s
        where (s->>'id') = v_line->>'sectionId'
        limit 1;
      end if;

      id := v_order.id;
      status := v_order.status;
      revision := v_snap.revision;
      shared_at := v_snap.shared_at;
      client_agreed_at := v_order.client_agreed_at;
      client_agreed_name := v_order.client_agreed_name;
      client_agreed_revision := v_order.client_agreed_revision;
      section_id := v_sec_id;
      section_name := v_sec_name;
      line_id := nullif(v_line->>'id', '')::uuid;
      line_description := v_line->>'description';
      line_quantity := coalesce((v_line->>'quantity')::numeric, 1);
      line_amount := coalesce((v_line->>'amount')::numeric, 0);
      line_sort_order := coalesce((v_line->>'sortOrder')::smallint, 0);
      line_is_included := coalesce((v_line->>'isIncluded')::boolean, true);
      line_unit := v_line->>'unit';
      line_unit_price := nullif(v_line->>'unitPrice', '')::numeric;
      line_notes := v_line->>'notes';
      return next;
    end loop;

    if jsonb_array_length(v_lines) = 0 then
      id := v_order.id;
      status := v_order.status;
      revision := v_snap.revision;
      shared_at := v_snap.shared_at;
      client_agreed_at := v_order.client_agreed_at;
      client_agreed_name := v_order.client_agreed_name;
      client_agreed_revision := v_order.client_agreed_revision;
      section_id := null;
      section_name := null;
      line_id := null;
      line_description := null;
      line_quantity := null;
      line_amount := null;
      line_sort_order := null;
      line_is_included := null;
      line_unit := null;
      line_unit_price := null;
      line_notes := null;
      return next;
    end if;
    return;
  end if;

  return query
  select
    eo.id, eo.status, eo.revision, eo.shared_at,
    eo.client_agreed_at, eo.client_agreed_name, eo.client_agreed_revision,
    eol.section_id, es.name,
    eol.id, eol.description, eol.quantity, eol.amount, eol.sort_order,
    eol.is_included, eol.unit, eol.unit_price, eol.notes
  from public.event_orders eo
  left join public.event_order_lines eol on eol.event_order_id = eo.id
  left join public.event_order_sections es on es.id = eol.section_id
  where eo.id = v_order.id
  order by eol.sort_order;
end;
$$;

grant execute on function public.get_event_order_for_portal(text) to anon, authenticated, service_role;

create or replace function public.accept_event_order_for_portal(
  p_token text,
  p_agreed_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
  v_order public.event_orders%rowtype;
  v_name text := nullif(trim(coalesce(p_agreed_name, '')), '');
begin
  if v_name is null or char_length(v_name) < 2 then
    return jsonb_build_object('ok', false, 'message', 'Enter your name to accept the Event Order.');
  end if;

  select * into v_session
  from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then
    return jsonb_build_object('ok', false, 'message', 'Portal session not found.');
  end if;

  select eo.* into v_order
  from public.event_orders eo
  join public.events e on e.id = eo.event_id
  where e.client_id = v_session.client_id
    and eo.venue_id = v_session.venue_id
    and eo.shared_at is not null
  order by eo.updated_at desc
  limit 1
  for update of eo;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'No shared Event Order for this event.');
  end if;

  if v_order.status <> 'finalized' then
    return jsonb_build_object('ok', false, 'message', 'This Event Order is not ready for agreement yet.');
  end if;

  if v_order.client_agreed_at is not null
     and v_order.client_agreed_revision is not distinct from v_order.revision then
    return jsonb_build_object(
      'ok', true,
      'already', true,
      'client_agreed_at', v_order.client_agreed_at,
      'client_agreed_revision', v_order.client_agreed_revision
    );
  end if;

  update public.event_orders
  set
    client_agreed_at = now(),
    client_agreed_name = v_name,
    client_agreed_revision = revision,
    updated_at = now()
  where id = v_order.id;

  insert into public.event_order_activities (venue_id, event_order_id, type, title, description)
  values (
    v_order.venue_id,
    v_order.id,
    'client_agreed',
    'Client accepted Event Order',
    'Accepted by ' || v_name || ' — revision ' || v_order.revision::text
  );

  return jsonb_build_object(
    'ok', true,
    'already', false,
    'client_agreed_at', now(),
    'client_agreed_revision', v_order.revision
  );
end;
$$;

grant execute on function public.accept_event_order_for_portal(text, text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
