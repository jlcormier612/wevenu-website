-- ============================================================================
-- Sprint 84: Shared Memories, Feedback & Testimonials
--
-- "Most platforms only care about public reviews.
--  We're building: relationship management, service recovery, testimonials,
--  and referrals — all in one private-first flow."
--
-- Changes:
--   1. couple_venue_feedback     — private feedback from couple to venue
--   2. wevenu_platform_feedback  — separate NPS feedback to Wevenu only
--   3. couple_referrals          — post-wedding referrals to venue
--   4. couple_memories           — shared photos from couple to venue
--   5. submit_venue_feedback()   — portal RPC
--   6. submit_wevenu_feedback()  — portal RPC
--   7. submit_couple_referral()  — portal RPC
--   8. add_couple_memory()       — portal RPC
--   9. get_couple_memories()     — portal RPC
--  10. get_portal_post_wedding_status() — portal RPC
--  11. get_event_post_wedding_data()    — venue-side RPC
--  12. resolve_feedback()               — venue-side RPC
--  13. approve_feedback_public()        — venue-side RPC
--  14. update_referral_status()         — venue-side RPC
--  15. approve_couple_memory()          — venue-side RPC
-- ============================================================================


-- ── 1. couple_venue_feedback ──────────────────────────────────────────────────
-- Private feedback from couple to venue. Never auto-public.
-- Permission must be explicitly granted by couple; venue must still approve.

create table public.couple_venue_feedback (
  id                   uuid primary key default gen_random_uuid(),
  venue_id             uuid not null references public.venues(id) on delete cascade,
  event_id             uuid not null references public.events(id) on delete cascade,

  -- Rating & qualitative
  overall_rating       int  not null check (overall_rating between 1 and 5),
  loved_most           text,
  could_improve        text,
  would_recommend      boolean not null default true,

  -- Public permission — couple grants, venue still approves before anything goes out
  public_permission    text not null default 'none'
    check (public_permission in ('none', 'review_only', 'review_and_names', 'review_and_photos')),

  -- Venue response
  venue_status         text not null default 'pending'
    check (venue_status in ('pending', 'reviewed', 'resolved')),
  venue_response       text,                       -- internal note from coordinator
  approved_for_public_at timestamptz,              -- set when venue clicks "Approve"

  submitted_at         timestamptz not null default now(),
  created_at           timestamptz not null default now(),

  unique (event_id)    -- one feedback per event
);

alter table public.couple_venue_feedback enable row level security;

create policy "venue owner manages feedback"
  on public.couple_venue_feedback for all
  using (exists (
    select 1 from public.venues v
    where v.id = couple_venue_feedback.venue_id
      and v.owner_user_id = auth.uid()
  ));

grant select, insert, update, delete on public.couple_venue_feedback to authenticated;


-- ── 2. wevenu_platform_feedback ───────────────────────────────────────────────
-- Entirely separate from venue feedback. Goes only to Wevenu. Never to venue.
-- NPS + open comments + feature suggestions.

create table public.wevenu_platform_feedback (
  id                   uuid primary key default gen_random_uuid(),
  event_id             uuid not null references public.events(id) on delete cascade,

  nps_score            int  check (nps_score between 0 and 10),
  comments             text,
  feature_suggestions  text,

  submitted_at         timestamptz not null default now(),

  unique (event_id)    -- one platform feedback per event
);

alter table public.wevenu_platform_feedback enable row level security;

-- No venue-user access — Wevenu internal only
create policy "no venue access to platform feedback"
  on public.wevenu_platform_feedback for all
  using (false);

grant insert on public.wevenu_platform_feedback to anon, authenticated;


-- ── 3. couple_referrals ───────────────────────────────────────────────────────
-- Post-wedding referrals: couple recommends venue to a friend.
-- Venue follows up and manages the status.

create table public.couple_referrals (
  id                   uuid primary key default gen_random_uuid(),
  venue_id             uuid not null references public.venues(id) on delete cascade,
  event_id             uuid not null references public.events(id) on delete cascade,

  referral_name        text not null,
  referral_email       text,
  referral_phone       text,
  note                 text,

  status               text not null default 'new'
    check (status in ('new', 'contacted', 'booked')),

  created_at           timestamptz not null default now()
);

alter table public.couple_referrals enable row level security;

create policy "venue owner manages referrals"
  on public.couple_referrals for all
  using (exists (
    select 1 from public.venues v
    where v.id = couple_referrals.venue_id
      and v.owner_user_id = auth.uid()
  ));

grant select, insert, update, delete on public.couple_referrals to authenticated;


-- ── 4. couple_memories ────────────────────────────────────────────────────────
-- Shared photos from couple to venue. Private by default.
-- Visibility can be elevated by couple; testimonial use still requires venue approval.

create table public.couple_memories (
  id                   uuid primary key default gen_random_uuid(),
  venue_id             uuid not null references public.venues(id) on delete cascade,
  event_id             uuid not null references public.events(id) on delete cascade,

  storage_path         text not null,
  storage_url          text not null,
  caption              text,

  visibility           text not null default 'private'
    check (visibility in ('private', 'venue', 'testimonial')),

  -- Venue approval for testimonial use
  approved_at          timestamptz,

  created_at           timestamptz not null default now()
);

alter table public.couple_memories enable row level security;

create policy "venue owner manages memories"
  on public.couple_memories for all
  using (exists (
    select 1 from public.venues v
    where v.id = couple_memories.venue_id
      and v.owner_user_id = auth.uid()
  ));

grant select, insert, update, delete on public.couple_memories to authenticated;


-- ── 5. submit_venue_feedback ──────────────────────────────────────────────────
-- Portal: couple submits private feedback to their venue.

create or replace function public.submit_venue_feedback(
  p_token           text,
  p_rating          int,
  p_loved_most      text,
  p_could_improve   text,
  p_would_recommend boolean,
  p_permission      text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session record;
begin
  select cs.event_id, cs.venue_id
  into v_session
  from public.client_portal_sessions cs
  where cs.access_token = p_token
    and (cs.expires_at is null or cs.expires_at > now());

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  if exists (
    select 1 from public.couple_venue_feedback
    where event_id = v_session.event_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'already_submitted');
  end if;

  if p_rating not between 1 and 5 then
    return jsonb_build_object('ok', false, 'error', 'invalid_rating');
  end if;

  insert into public.couple_venue_feedback (
    venue_id, event_id, overall_rating, loved_most, could_improve,
    would_recommend, public_permission
  ) values (
    v_session.venue_id,
    v_session.event_id,
    p_rating,
    nullif(trim(coalesce(p_loved_most, '')), ''),
    nullif(trim(coalesce(p_could_improve, '')), ''),
    p_would_recommend,
    case
      when p_permission in ('none', 'review_only', 'review_and_names', 'review_and_photos')
      then p_permission
      else 'none'
    end
  );

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.submit_venue_feedback(text, int, text, text, boolean, text)
  to anon, authenticated;


-- ── 6. submit_wevenu_feedback ─────────────────────────────────────────────────
-- Portal: couple submits NPS + comments to Wevenu only. Never visible to venue.

create or replace function public.submit_wevenu_feedback(
  p_token        text,
  p_nps_score    int,
  p_comments     text,
  p_suggestions  text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  select cs.event_id
  into v_event_id
  from public.client_portal_sessions cs
  where cs.access_token = p_token
    and (cs.expires_at is null or cs.expires_at > now());

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  insert into public.wevenu_platform_feedback (
    event_id, nps_score, comments, feature_suggestions
  ) values (
    v_event_id,
    case when p_nps_score between 0 and 10 then p_nps_score else null end,
    nullif(trim(coalesce(p_comments, '')), ''),
    nullif(trim(coalesce(p_suggestions, '')), '')
  )
  on conflict (event_id) do update set
    nps_score           = excluded.nps_score,
    comments            = excluded.comments,
    feature_suggestions = excluded.feature_suggestions,
    submitted_at        = now();

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.submit_wevenu_feedback(text, int, text, text)
  to anon, authenticated;


-- ── 7. submit_couple_referral ─────────────────────────────────────────────────
-- Portal: couple refers a friend to the venue.

create or replace function public.submit_couple_referral(
  p_token  text,
  p_name   text,
  p_email  text,
  p_phone  text,
  p_note   text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session record;
begin
  select cs.event_id, cs.venue_id
  into v_session
  from public.client_portal_sessions cs
  where cs.access_token = p_token
    and (cs.expires_at is null or cs.expires_at > now());

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  if trim(coalesce(p_name, '')) = '' then
    return jsonb_build_object('ok', false, 'error', 'missing_name');
  end if;

  insert into public.couple_referrals (
    venue_id, event_id, referral_name, referral_email, referral_phone, note
  ) values (
    v_session.venue_id,
    v_session.event_id,
    trim(p_name),
    nullif(trim(coalesce(p_email, '')), ''),
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_note, '')), '')
  );

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.submit_couple_referral(text, text, text, text, text)
  to anon, authenticated;


-- ── 8. add_couple_memory ──────────────────────────────────────────────────────
-- Portal: couple adds a photo memory (after upload via /api/portal/upload).

create or replace function public.add_couple_memory(
  p_token        text,
  p_storage_path text,
  p_storage_url  text,
  p_caption      text,
  p_visibility   text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session record;
  v_id      uuid;
begin
  select cs.event_id, cs.venue_id
  into v_session
  from public.client_portal_sessions cs
  where cs.access_token = p_token
    and (cs.expires_at is null or cs.expires_at > now());

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  v_id := gen_random_uuid();

  insert into public.couple_memories (
    id, venue_id, event_id, storage_path, storage_url, caption, visibility
  ) values (
    v_id,
    v_session.venue_id,
    v_session.event_id,
    p_storage_path,
    p_storage_url,
    nullif(trim(coalesce(p_caption, '')), ''),
    case
      when p_visibility in ('private', 'venue', 'testimonial') then p_visibility
      else 'private'
    end
  );

  return jsonb_build_object(
    'ok', true,
    'memory', jsonb_build_object(
      'id',          v_id,
      'storageUrl',  p_storage_url,
      'caption',     nullif(trim(coalesce(p_caption, '')), ''),
      'visibility',  coalesce(
        case when p_visibility in ('private', 'venue', 'testimonial') then p_visibility end,
        'private'
      ),
      'createdAt',   now()
    )
  );
end;
$$;

grant execute on function public.add_couple_memory(text, text, text, text, text)
  to anon, authenticated;


-- ── 9. get_couple_memories ────────────────────────────────────────────────────
-- Portal: couple fetches their own shared memories.

create or replace function public.get_couple_memories(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session record;
  v_memories jsonb;
begin
  select cs.event_id, cs.venue_id
  into v_session
  from public.client_portal_sessions cs
  where cs.access_token = p_token
    and (cs.expires_at is null or cs.expires_at > now());

  if not found then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',         m.id,
      'storageUrl', m.storage_url,
      'caption',    m.caption,
      'visibility', m.visibility,
      'createdAt',  m.created_at
    ) order by m.created_at desc
  ), '[]'::jsonb)
  into v_memories
  from public.couple_memories m
  where m.event_id = v_session.event_id
    and m.venue_id = v_session.venue_id;

  return jsonb_build_object('memories', v_memories);
end;
$$;

grant execute on function public.get_couple_memories(text) to anon, authenticated;


-- ── 10. get_portal_post_wedding_status ────────────────────────────────────────
-- Portal: check whether feedback / referral have been submitted.

create or replace function public.get_portal_post_wedding_status(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session       record;
  v_feedback_cnt  int;
  v_feedback_rating int;
  v_referral_cnt  int;
  v_memory_cnt    int;
begin
  select cs.event_id, cs.venue_id
  into v_session
  from public.client_portal_sessions cs
  where cs.access_token = p_token
    and (cs.expires_at is null or cs.expires_at > now());

  if not found then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  select count(*), coalesce(max(overall_rating), 0)
  into v_feedback_cnt, v_feedback_rating
  from public.couple_venue_feedback
  where event_id = v_session.event_id;

  select count(*) into v_referral_cnt
  from public.couple_referrals
  where event_id = v_session.event_id;

  select count(*) into v_memory_cnt
  from public.couple_memories
  where event_id = v_session.event_id
    and venue_id = v_session.venue_id;

  return jsonb_build_object(
    'feedbackSubmitted', v_feedback_cnt > 0,
    'feedbackRating',    v_feedback_rating,
    'referralSubmitted', v_referral_cnt > 0,
    'memoriesCount',     v_memory_cnt
  );
end;
$$;

grant execute on function public.get_portal_post_wedding_status(text) to anon, authenticated;


-- ── 11. get_event_post_wedding_data ───────────────────────────────────────────
-- Venue: fetch all feedback, referrals, and memories for an event.

create or replace function public.get_event_post_wedding_data(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id  uuid;
  v_feedback  jsonb;
  v_referrals jsonb;
  v_memories  jsonb;
begin
  select v.id into v_venue_id
  from public.venues v
  join public.events e on e.id = p_event_id
  where v.owner_user_id = auth.uid()
    and e.venue_id = v.id;

  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  -- Feedback
  select row_to_json(f)::jsonb
  into v_feedback
  from (
    select
      id, overall_rating, loved_most, could_improve, would_recommend,
      public_permission, venue_status, venue_response,
      approved_for_public_at, submitted_at
    from public.couple_venue_feedback
    where event_id = p_event_id and venue_id = v_venue_id
    limit 1
  ) f;

  -- Referrals
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',            r.id,
      'referralName',  r.referral_name,
      'referralEmail', r.referral_email,
      'referralPhone', r.referral_phone,
      'note',          r.note,
      'status',        r.status,
      'createdAt',     r.created_at
    ) order by r.created_at desc
  ), '[]'::jsonb)
  into v_referrals
  from public.couple_referrals r
  where r.event_id = p_event_id and r.venue_id = v_venue_id;

  -- Memories (venue-shared + testimonial only — private stays private)
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',         m.id,
      'storageUrl', m.storage_url,
      'caption',    m.caption,
      'visibility', m.visibility,
      'approvedAt', m.approved_at,
      'createdAt',  m.created_at
    ) order by m.created_at desc
  ), '[]'::jsonb)
  into v_memories
  from public.couple_memories m
  where m.event_id = p_event_id
    and m.venue_id = v_venue_id
    and m.visibility in ('venue', 'testimonial');

  return jsonb_build_object(
    'feedback',  v_feedback,
    'referrals', v_referrals,
    'memories',  v_memories
  );
end;
$$;

grant execute on function public.get_event_post_wedding_data(uuid) to authenticated;


-- ── 12. resolve_feedback ──────────────────────────────────────────────────────
-- Venue: mark feedback as reviewed/resolved with an optional internal note.

create or replace function public.resolve_feedback(
  p_feedback_id uuid,
  p_status      text,
  p_response    text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
begin
  select v.id into v_venue_id
  from public.venues v
  where v.owner_user_id = auth.uid();

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  update public.couple_venue_feedback
  set
    venue_status   = case
      when p_status in ('reviewed', 'resolved') then p_status
      else 'reviewed'
    end,
    venue_response = nullif(trim(coalesce(p_response, '')), '')
  where id = p_feedback_id
    and venue_id = v_venue_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.resolve_feedback(uuid, text, text) to authenticated;


-- ── 13. approve_feedback_public ───────────────────────────────────────────────
-- Venue: explicitly approve feedback for public testimonial use.
-- This is the gating step — nothing goes public until venue clicks this.

create or replace function public.approve_feedback_public(p_feedback_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
begin
  select v.id into v_venue_id
  from public.venues v
  where v.owner_user_id = auth.uid();

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  update public.couple_venue_feedback
  set approved_for_public_at = now()
  where id = p_feedback_id
    and venue_id = v_venue_id
    and public_permission != 'none';

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.approve_feedback_public(uuid) to authenticated;


-- ── 14. update_referral_status ────────────────────────────────────────────────
-- Venue: track outreach progress on referred friends.

create or replace function public.update_referral_status(
  p_referral_id uuid,
  p_status      text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
begin
  select v.id into v_venue_id
  from public.venues v
  where v.owner_user_id = auth.uid();

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  update public.couple_referrals
  set status = case
    when p_status in ('new', 'contacted', 'booked') then p_status
    else status
  end
  where id = p_referral_id
    and venue_id = v_venue_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.update_referral_status(uuid, text) to authenticated;


-- ── 15. approve_couple_memory ─────────────────────────────────────────────────
-- Venue: mark a memory approved for testimonial/marketing use.

create or replace function public.approve_couple_memory(p_memory_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
begin
  select v.id into v_venue_id
  from public.venues v
  where v.owner_user_id = auth.uid();

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  update public.couple_memories
  set approved_at = now()
  where id = p_memory_id
    and venue_id = v_venue_id
    and visibility = 'testimonial';

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.approve_couple_memory(uuid) to authenticated;


notify pgrst, 'reload schema';
