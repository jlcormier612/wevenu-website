-- ============================================================================
-- Luv Experience Completion — Work Stream 3: Celebration Framework
--
-- One small table (the "last observed state" persistence both Luv
-- architecture docs named as required and confirmed missing) logging
-- exactly 5 real Commitment Lifecycle transitions, once each per client:
-- contract signed, final payment received, guest count (guest list)
-- submitted, timeline submitted, wedding website published.
--
-- Each of the 4 couple-triggered ones is logged INSIDE its own already-
-- existing SECURITY DEFINER RPC (sign_contract, submit_guest_count,
-- submit_timeline, update_my_website), in the same transaction as the
-- real transition — never inferred from polling, never a second,
-- independently-computed detection. Every corrective body below is a
-- minimal diff against that function's actual, currently-applied
-- definition (re-read from its own migration before writing this, not
-- from memory) — nothing else about any of these four functions changes.
--
-- Final payment (coordinator-triggered, authenticated venue session, no
-- token) is logged separately at the TS layer in lib/payments/service.ts,
-- under the venue's own RLS grant below — it has no single dedicated RPC
-- the way the other four do.
--
-- Idempotent by construction: `unique (client_id, celebration_type)` means
-- a celebration can only ever fire once per client. update_my_website's
-- own "every explicit publish creates a new version" behavior (unchanged
-- here) means p_is_published:true can be sent many times; only the first
-- one is ever a celebration.
-- ============================================================================

create table public.luv_celebrations (
  id                uuid primary key default gen_random_uuid(),
  venue_id          uuid not null references public.venues(id) on delete cascade,
  client_id         uuid not null references public.clients(id) on delete cascade,
  event_id          uuid references public.events(id) on delete set null,
  celebration_type  text not null check (celebration_type in (
                      'contract_signed', 'final_payment_received',
                      'guest_list_submitted', 'timeline_submitted', 'website_published'
                    )),
  entity_id         uuid,
  fired_at          timestamptz not null default now(),
  unique (client_id, celebration_type)
);

create index luv_celebrations_venue on public.luv_celebrations (venue_id, fired_at desc);

alter table public.luv_celebrations enable row level security;

create policy luv_celebrations_venue_select
  on public.luv_celebrations for select
  using (venue_id = current_user_venue_id());

-- The one TS-side writer (final payment, authenticated venue session —
-- see lib/payments/service.ts). The 4 token-authenticated writers insert
-- via SECURITY DEFINER RPCs below, which bypass RLS as their defining
-- role, same as every other portal-token RPC in this codebase.
create policy luv_celebrations_venue_insert
  on public.luv_celebrations for insert
  with check (venue_id = current_user_venue_id());

grant select, insert on public.luv_celebrations to authenticated;

-- ── sign_contract: log Contract Signed ──────────────────────────────────────
-- Corrective add-on to the TR-L3 version (20260716100000) — identical body
-- and identical caller-visible success/failure semantics. Return type widens
-- from a bare boolean to jsonb ({ok, celebrated}) so the one TS caller
-- (lib/contracts/service.ts's signContractByToken) can learn whether this
-- was the first-ever signature without a second round trip — the same
-- shape submit_guest_count/submit_timeline/update_my_website already use.
-- Postgres requires a drop before a return-type change; create or replace
-- alone would fail here (unlike the other three, whose return type is
-- unchanged).
drop function if exists public.sign_contract(uuid, text, text, text, boolean);

create function public.sign_contract(
  p_token uuid,
  p_signer text,
  p_ip text default null,
  p_user_agent text default null,
  p_consent boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id        uuid;
  v_venue     uuid;
  v_client_id uuid;
  v_event_id  uuid;
  v_celebrated boolean := false;
begin
  if not p_consent then
    return jsonb_build_object('ok', false);
  end if;

  select id, venue_id, client_id, event_id into v_id, v_venue, v_client_id, v_event_id
  from public.contracts
  where sign_token = p_token and status = 'sent';

  if v_id is null then return jsonb_build_object('ok', false); end if;

  update public.contracts set
    status             = 'signed',
    signer_name         = trim(p_signer),
    signed_at           = now(),
    signer_ip           = p_ip,
    signer_user_agent   = p_user_agent,
    consent_confirmed   = p_consent
  where id = v_id;

  insert into public.contract_activities (venue_id, contract_id, type, title, description)
  values (v_venue, v_id, 'signed', 'Contract signed', 'Signed by ' || trim(p_signer));

  if v_client_id is not null then
    insert into public.luv_celebrations (venue_id, client_id, event_id, celebration_type, entity_id)
    values (v_venue, v_client_id, v_event_id, 'contract_signed', v_id)
    on conflict (client_id, celebration_type) do nothing
    returning true into v_celebrated;
  end if;

  return jsonb_build_object('ok', true, 'celebrated', coalesce(v_celebrated, false));
end;
$$;

-- ── submit_guest_count: log Guest List Submitted ────────────────────────────
-- Corrective add-on to 20261024000000 — identical body, one new insert
-- appended after the task-auto-complete loop, `celebrated` added to the
-- return.
create or replace function public.submit_guest_count(p_token text, p_count integer, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session   public.client_portal_sessions%rowtype;
  v_event     public.events%rowtype;
  v_submission_id uuid;
  v_completed_task_id uuid;
  v_celebrated boolean := false;
begin
  select * into v_session
  from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;

  if p_count is null or p_count < 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_count');
  end if;

  select * into v_event
  from public.events
  where client_id = v_session.client_id and venue_id = v_session.venue_id
    and status not in ('cancelled', 'complete')
  order by event_date asc limit 1;

  if v_event.id is null then
    return jsonb_build_object('ok', false, 'error', 'event_not_found');
  end if;

  insert into public.guest_count_submissions (client_id, venue_id, event_id, submitted_count, note)
  values (v_session.client_id, v_session.venue_id, v_event.id, p_count, nullif(trim(p_note), ''))
  returning id into v_submission_id;

  update public.events
  set guest_count = p_count, updated_at = now()
  where id = v_event.id;

  for v_completed_task_id in
    update public.event_tasks
    set status = 'complete', completed_at = now(), completed_by = 'system'
    where venue_id = v_session.venue_id and event_id = v_event.id
      and auto_complete_trigger = 'guest_count_finalized'
      and status in ('pending', 'blocked', 'overdue')
    returning id
  loop
    update public.event_tasks
    set status = 'pending'
    where depends_on_event_task_id = v_completed_task_id
      and status = 'blocked' and venue_id = v_session.venue_id;
  end loop;

  insert into public.luv_celebrations (venue_id, client_id, event_id, celebration_type, entity_id)
  values (v_session.venue_id, v_session.client_id, v_event.id, 'guest_list_submitted', v_submission_id)
  on conflict (client_id, celebration_type) do nothing
  returning true into v_celebrated;

  return jsonb_build_object('ok', true, 'submissionId', v_submission_id, 'count', p_count, 'celebrated', coalesce(v_celebrated, false));
end;
$$;

-- ── submit_timeline: log Timeline Submitted ─────────────────────────────────
-- Corrective add-on to 20261029010000 — identical body, one new insert
-- appended after the task-auto-complete loop, `celebrated` added to the
-- return.
create or replace function public.submit_timeline(p_access_token text, p_client_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_session_venue_id  uuid;
  v_event_id          uuid;
  v_snapshot          jsonb;
  v_count             integer;
  v_submission_id     uuid;
  v_completed_task_id uuid;
  v_celebrated        boolean := false;
begin
  select s.venue_id into v_session_venue_id
  from public.client_portal_sessions s
  where s.access_token = p_access_token and (s.expires_at is null or s.expires_at > now());
  if v_session_venue_id is null then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;

  if not exists (select 1 from public.clients c where c.id = p_client_id and c.venue_id = v_session_venue_id) then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  select e.id into v_event_id
  from public.events e
  where e.client_id = p_client_id and e.venue_id = v_session_venue_id
  order by e.event_date asc limit 1;
  if v_event_id is null then return jsonb_build_object('ok', false, 'error', 'event_not_found'); end if;

  select
    coalesce(jsonb_agg(jsonb_build_object(
      'id', te.id, 'title', te.title, 'description', te.description,
      'entryTime', te.entry_time, 'sectionId', te.section_id,
      'sortOrder', te.sort_order, 'audiences', te.audiences
    ) order by te.entry_time asc nulls last, te.sort_order, te.created_at), '[]'::jsonb),
    count(*)
  into v_snapshot, v_count
  from public.timeline_entries te
  where te.event_id = v_event_id and te.venue_id = v_session_venue_id and te.owner = 'client';

  insert into public.timeline_submissions (client_id, venue_id, event_id, snapshot, entry_count)
  values (p_client_id, v_session_venue_id, v_event_id, v_snapshot, v_count)
  returning id into v_submission_id;

  for v_completed_task_id in
    update public.event_tasks
    set status = 'complete', completed_at = now(), completed_by = 'system'
    where venue_id = v_session_venue_id and event_id = v_event_id
      and auto_complete_trigger = 'timeline_submitted'
      and status in ('pending', 'blocked', 'overdue')
    returning id
  loop
    update public.event_tasks
    set status = 'pending'
    where depends_on_event_task_id = v_completed_task_id and status = 'blocked' and venue_id = v_session_venue_id;
  end loop;

  insert into public.luv_celebrations (venue_id, client_id, event_id, celebration_type, entity_id)
  values (v_session_venue_id, p_client_id, v_event_id, 'timeline_submitted', v_submission_id)
  on conflict (client_id, celebration_type) do nothing
  returning true into v_celebrated;

  return jsonb_build_object('ok', true, 'submissionId', v_submission_id, 'entryCount', v_count, 'submittedAt', now(), 'celebrated', coalesce(v_celebrated, false));
end $$;

-- ── update_my_website: log Wedding Website Published ────────────────────────
-- Corrective add-on to 20261016000000 (Hosted Experience Phase 3, the
-- latest definition) — identical body, one new insert inside the existing
-- `if p_is_published is true then` block (after the version/status write,
-- still the same transaction), `celebrated` added to the return. Nothing
-- about the publishing/versioning behavior itself changes.
create or replace function public.update_my_website(
  p_token                text,
  p_slug                 text      default null,
  p_is_published         boolean   default null,
  p_password             text      default null,
  p_clear_password       boolean   default false,
  p_theme                text      default null,
  p_theme_palette        text      default null,
  p_accent_color         text      default null,
  p_font_pairing         text      default null,
  p_section_order        text[]    default null,
  p_content_key          text      default null,
  p_content_value        jsonb     default null,
  p_sections_enabled     text[]    default null,
  p_schedule_sync        boolean   default null,
  p_collection_id        uuid      default null,
  p_color_story_id       uuid      default null,
  p_typography_style_id  uuid      default null,
  p_action               text      default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
  v_site_id uuid;
  v_next_version int;
  v_snapshot jsonb;
  v_new_version_id uuid;
  v_celebrated boolean := false;
begin
  select * into v_session from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;

  insert into public.couple_websites (venue_id, client_id, slug)
  values (v_session.venue_id, v_session.client_id,
          coalesce(p_slug, 'wedding-' || left(gen_random_uuid()::text, 8)))
  on conflict (client_id) do update set updated_at = now()
  returning id into v_site_id;

  if p_slug is not null then
    update public.couple_websites set slug = p_slug, updated_at = now() where id = v_site_id;
  end if;
  if p_clear_password then
    update public.couple_websites set password = null, updated_at = now() where id = v_site_id;
  elsif p_password is not null then
    update public.couple_websites set password = p_password, updated_at = now() where id = v_site_id;
  end if;
  if p_theme is not null then
    update public.couple_websites set theme = p_theme, updated_at = now() where id = v_site_id;
  end if;
  if p_theme_palette is not null then
    update public.couple_websites set theme_palette = p_theme_palette, updated_at = now() where id = v_site_id;
  end if;
  if p_accent_color is not null then
    update public.couple_websites set accent_color = p_accent_color, updated_at = now() where id = v_site_id;
  end if;
  if p_font_pairing is not null then
    update public.couple_websites set font_pairing = p_font_pairing, updated_at = now() where id = v_site_id;
  end if;
  if p_section_order is not null then
    update public.couple_websites set section_order = p_section_order, updated_at = now() where id = v_site_id;
  end if;
  if p_content_key is not null and p_content_value is not null then
    update public.couple_websites
    set content = jsonb_set(content, array[p_content_key], p_content_value), updated_at = now()
    where id = v_site_id;
  end if;
  if p_sections_enabled is not null then
    update public.couple_websites set sections_enabled = p_sections_enabled, updated_at = now() where id = v_site_id;
  end if;
  if p_schedule_sync is not null then
    update public.couple_websites set schedule_sync = p_schedule_sync, updated_at = now() where id = v_site_id;
  end if;
  if p_collection_id is not null then
    update public.couple_websites set collection_id = p_collection_id, updated_at = now() where id = v_site_id;
  end if;
  if p_color_story_id is not null then
    update public.couple_websites set color_story_id = p_color_story_id, updated_at = now() where id = v_site_id;
  end if;
  if p_typography_style_id is not null then
    update public.couple_websites set typography_style_id = p_typography_style_id, updated_at = now() where id = v_site_id;
  end if;

  insert into public.experience_sections
    (experience_id, section_key, title, owner, sync_mode, sort_order)
  select v_site_id, s.section_key, s.title, s.owner, s.default_sync_mode, s.sort_order
  from (values
    ('home',         'Home & Welcome',   'guided',           'one_time_copy', 0),
    ('story',        'Your Story',       'guided',           'one_time_copy', 1),
    ('event',        'Event Details',    'couple_authored',  'manual',        2),
    ('gallery',      'Photo Gallery',    'couple_authored',  'manual',        3),
    ('schedule',     'Day-of Schedule',  'live_synced',       'live',          4),
    ('travel',       'Travel & Hotels',  'couple_authored',  'manual',        5),
    ('dress_code',   'Dress Code',       'couple_authored',  'manual',        6),
    ('bridal_party', 'Wedding Party',    'couple_authored',  'manual',        7),
    ('things_to_do', 'Things To Do',     'couple_authored',  'manual',        8),
    ('music',        'Music',            'couple_authored',  'manual',        9),
    ('registry',     'Registry',         'couple_authored',  'manual',       10),
    ('faq',          'FAQ',              'couple_authored',  'manual',       11),
    ('rsvp',         'RSVP',             'live_synced',       'live',         12)
  ) as s(section_key, title, owner, default_sync_mode, sort_order)
  on conflict (experience_id, section_key) do nothing;

  if p_content_key is not null and p_content_value is not null then
    update public.experience_sections
    set content = p_content_value, updated_at = now()
    where experience_id = v_site_id and section_key = p_content_key;
  end if;
  if p_schedule_sync is not null then
    update public.experience_sections
    set sync_mode = case when p_schedule_sync then 'live' else 'manual' end,
        data_source = case when p_schedule_sync then 'timeline_entries' else null end,
        updated_at = now()
    where experience_id = v_site_id and section_key = 'schedule';
  end if;
  if p_section_order is not null then
    update public.experience_sections es
    set sort_order = ord.i, updated_at = now()
    from unnest(p_section_order) with ordinality as ord(section_key, i)
    where es.experience_id = v_site_id and es.section_key = ord.section_key;
  end if;

  -- Publishing: a commitment, not a save. Every explicit publish (first
  -- time, or a re-publish while already published) writes a new frozen
  -- snapshot and repoints current_version_id at it.
  if p_is_published is true then
    select coalesce(max(version_number), 0) + 1 into v_next_version
    from public.experience_versions where experience_id = v_site_id;

    select jsonb_build_object(
      'slug', w.slug,
      'collectionId', w.collection_id, 'colorStoryId', w.color_story_id, 'typographyStyleId', w.typography_style_id,
      'theme', coalesce(c.key, w.theme), 'themePalette', coalesce(cs.name, w.theme_palette), 'fontPairing', coalesce(ts.key, w.font_pairing),
      'accentColor', w.accent_color, 'scheduleSync', w.schedule_sync,
      'sections', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'key', es.section_key, 'title', es.title, 'owner', es.owner, 'syncMode', es.sync_mode,
          'sortOrder', es.sort_order, 'visibility', es.visibility,
          'content', case when es.sync_mode = 'live' then null else es.content end
        ) order by es.sort_order), '[]'::jsonb)
        from public.experience_sections es where es.experience_id = w.id
      )
    )
    into v_snapshot
    from public.couple_websites w
    left join public.collections c on c.id = w.collection_id
    left join public.color_stories cs on cs.id = w.color_story_id
    left join public.typography_styles ts on ts.id = w.typography_style_id
    where w.id = v_site_id;

    insert into public.experience_versions (experience_id, version_number, snapshot)
    values (v_site_id, v_next_version, v_snapshot)
    returning id into v_new_version_id;

    update public.couple_websites
    set status = 'published', current_version_id = v_new_version_id, updated_at = now()
    where id = v_site_id;

    insert into public.luv_celebrations (venue_id, client_id, celebration_type, entity_id)
    values (v_session.venue_id, v_session.client_id, 'website_published', v_site_id)
    on conflict (client_id, celebration_type) do nothing
    returning true into v_celebrated;
  elsif p_is_published is false then
    update public.couple_websites set status = 'draft', updated_at = now() where id = v_site_id;
  end if;

  if p_action = 'archive' then
    update public.couple_websites set status = 'archived', updated_at = now() where id = v_site_id;
  elsif p_action = 'unarchive' then
    update public.couple_websites set status = 'published', updated_at = now() where id = v_site_id;
  end if;

  return jsonb_build_object('ok', true, 'siteId', v_site_id, 'celebrated', coalesce(v_celebrated, false));
end;
$$;

grant execute on function public.sign_contract(uuid, text, text, text, boolean) to anon, authenticated;
grant execute on function public.submit_guest_count(text, integer, text) to anon, authenticated;
grant execute on function public.submit_timeline(text, uuid) to anon, authenticated;
grant execute on function public.update_my_website(text, text, boolean, text, boolean, text, text, text, text, text[], text, jsonb, text[], boolean, uuid, uuid, uuid, text) to anon, authenticated;
