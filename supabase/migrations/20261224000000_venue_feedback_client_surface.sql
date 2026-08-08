-- Product feedback: client (couple portal) submissions + surface tag.
-- Venue staff / vendor / client are distinguished by actor columns + surface.

-- 1. Optional client actor + surface
alter table public.venue_feedback
  add column if not exists client_id uuid references public.clients(id) on delete set null;

alter table public.venue_feedback
  add column if not exists surface text;

update public.venue_feedback
set surface = case
  when vendor_id is not null then 'vendor'
  else 'venue'
end
where surface is null;

alter table public.venue_feedback
  alter column surface set default 'venue';

-- Portal token submissions may not have an auth user
alter table public.venue_feedback
  alter column user_id drop not null;

-- 2. Actor check:
--   venue staff  — venue_id set, no vendor/client
--   vendor       — vendor_id set, no client; venue_id optional (related venue)
--   client       — client_id + venue_id set, no vendor
alter table public.venue_feedback
  drop constraint if exists venue_feedback_actor_chk;

alter table public.venue_feedback
  add constraint venue_feedback_actor_chk check (
    (
      venue_id is not null
      and vendor_id is null
      and client_id is null
    )
    or (
      vendor_id is not null
      and client_id is null
    )
    or (
      client_id is not null
      and venue_id is not null
      and vendor_id is null
    )
  );

alter table public.venue_feedback
  drop constraint if exists venue_feedback_identity_chk;

alter table public.venue_feedback
  add constraint venue_feedback_identity_chk check (
    user_id is not null or client_id is not null
  );

alter table public.venue_feedback
  drop constraint if exists venue_feedback_surface_chk;

alter table public.venue_feedback
  add constraint venue_feedback_surface_chk check (
    surface is null or surface in ('venue', 'vendor', 'client')
  );

create index if not exists venue_feedback_client_id_idx
  on public.venue_feedback (client_id)
  where client_id is not null;

create index if not exists venue_feedback_surface_idx
  on public.venue_feedback (surface);

-- 3. Client portal insert via security-definer RPC (token auth, no coordinator session)
create or replace function public.submit_product_feedback_from_portal(
  p_token              text,
  p_type               text,
  p_subject            text default null,
  p_body               text default '',
  p_rating             int default null,
  p_allow_public_share boolean default false,
  p_metadata           jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
  v_user_id uuid;
  v_feedback_id uuid;
  v_type public.feedback_type;
  v_allow boolean;
  v_meta jsonb;
begin
  select *
  into v_session
  from public.client_portal_sessions cs
  where cs.access_token = p_token
    and (cs.expires_at is null or cs.expires_at > now());

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  begin
    v_type := p_type::public.feedback_type;
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'invalid_type');
  end;

  if v_type <> 'nps' and length(trim(coalesce(p_body, ''))) = 0 then
    return jsonb_build_object('ok', false, 'error', 'missing_body');
  end if;

  if v_type = 'nps' and (p_rating is null or p_rating < 1 or p_rating > 10) then
    return jsonb_build_object('ok', false, 'error', 'missing_rating');
  end if;

  v_allow := (v_type = 'nps' and coalesce(p_allow_public_share, false));
  v_user_id := auth.uid();
  v_meta := coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
    'surface', 'client',
    'allow_public_share', v_allow,
    'portal_session_id', v_session.id,
    'client_id', v_session.client_id,
    'venue_id', v_session.venue_id
  );

  insert into public.venue_feedback (
    venue_id,
    vendor_id,
    client_id,
    user_id,
    type,
    subject,
    body,
    rating,
    allow_public_share,
    surface,
    metadata
  ) values (
    v_session.venue_id,
    null,
    v_session.client_id,
    v_user_id,
    v_type,
    nullif(trim(coalesce(p_subject, '')), ''),
    coalesce(p_body, ''),
    case when p_rating between 1 and 10 then p_rating else null end,
    v_allow,
    'client',
    v_meta
  )
  returning id into v_feedback_id;

  return jsonb_build_object(
    'ok', true,
    'id', v_feedback_id,
    'venue_id', v_session.venue_id,
    'client_id', v_session.client_id
  );
end;
$$;

grant execute on function public.submit_product_feedback_from_portal(
  text, text, text, text, int, boolean, jsonb
) to anon, authenticated;
