-- ============================================================================
-- Sprint 86: Notification Preferences
--
-- Coordinators can choose which types of in-app notifications they receive.
-- Channel preferences (email / SMS / push) are stored now but inactive —
-- the column is the right extension point when those channels activate.
--
-- Key design decisions:
--   - No prefs row = all types enabled (backward-compatible; new venues get
--     everything until they choose to opt out)
--   - create_venue_notification() is updated to check prefs before inserting,
--     so all 7 existing triggers benefit automatically — no trigger changes
--   - task_completed_couple + task_completed_vendor share one toggle
--     (coordinators want "all task completions" or none)
-- ============================================================================


-- ── 1. venue_notification_preferences ────────────────────────────────────────

create table public.venue_notification_preferences (
  venue_id                uuid primary key references public.venues(id) on delete cascade,

  -- Per-type toggles (all true by default)
  pref_new_lead           boolean not null default true,
  pref_rsvp_received      boolean not null default true,
  pref_task_completed     boolean not null default true,  -- covers both couple + vendor
  pref_vendor_checked_in  boolean not null default true,
  pref_feedback_received  boolean not null default true,
  pref_referral_received  boolean not null default true,
  pref_message_received   boolean not null default true,

  -- Future channel routing (inactive; architecture placeholder)
  channel_email           boolean not null default false,
  channel_sms             boolean not null default false,
  channel_push            boolean not null default false,

  updated_at              timestamptz not null default now()
);

alter table public.venue_notification_preferences enable row level security;

create policy "venue owner reads own prefs"
  on public.venue_notification_preferences for select
  using (exists (
    select 1 from public.venues
    where id = venue_notification_preferences.venue_id
      and owner_user_id = auth.uid()
  ));

create policy "venue owner updates own prefs"
  on public.venue_notification_preferences for update
  using (exists (
    select 1 from public.venues
    where id = venue_notification_preferences.venue_id
      and owner_user_id = auth.uid()
  ));

-- Definer functions do inserts; no direct-insert policy needed.
grant select, update on public.venue_notification_preferences to authenticated;


-- ── 2. Updated create_venue_notification ─────────────────────────────────────
-- Now checks preferences before inserting. No-prefs-row = all enabled.
-- Still wraps in EXCEPTION so notification failure never breaks the caller.

create or replace function public.create_venue_notification(
  p_venue_id uuid,
  p_event_id uuid,
  p_type     text,
  p_title    text,
  p_body     text,
  p_link     text,
  p_emoji    text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enabled boolean := true;
begin
  -- Look up per-type preference. If no row exists, default to enabled.
  select case p_type
    when 'new_lead'              then pref_new_lead
    when 'rsvp_received'         then pref_rsvp_received
    when 'task_completed_couple' then pref_task_completed
    when 'task_completed_vendor' then pref_task_completed
    when 'vendor_checked_in'     then pref_vendor_checked_in
    when 'feedback_received'     then pref_feedback_received
    when 'referral_received'     then pref_referral_received
    when 'message_received'      then pref_message_received
    else true
  end into v_enabled
  from public.venue_notification_preferences
  where venue_id = p_venue_id;

  -- No prefs row yet → treat as all enabled
  if not found then v_enabled := true; end if;
  if not v_enabled then return; end if;

  insert into public.venue_notifications (venue_id, event_id, type, title, body, link, emoji)
  values (p_venue_id, p_event_id, p_type, p_title, p_body, p_link, p_emoji);
exception when others then
  null; -- never break the caller
end;
$$;

grant execute on function public.create_venue_notification(uuid, uuid, text, text, text, text, text)
  to anon, authenticated;


-- ── 3. get_notification_preferences ─────────────────────────────────────────

create or replace function public.get_notification_preferences()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
  v_prefs    public.venue_notification_preferences%rowtype;
begin
  select id into v_venue_id
  from public.venues where owner_user_id = auth.uid();
  if not found then return jsonb_build_object('error', 'not_found'); end if;

  select * into v_prefs
  from public.venue_notification_preferences
  where venue_id = v_venue_id;

  if not found then
    -- Return defaults (mirrors table defaults)
    return jsonb_build_object(
      'prefNewLead',          true,
      'prefRsvpReceived',     true,
      'prefTaskCompleted',    true,
      'prefVendorCheckedIn',  true,
      'prefFeedbackReceived', true,
      'prefReferralReceived', true,
      'prefMessageReceived',  true,
      'channelEmail',         false,
      'channelSms',           false,
      'channelPush',          false
    );
  end if;

  return jsonb_build_object(
    'prefNewLead',          v_prefs.pref_new_lead,
    'prefRsvpReceived',     v_prefs.pref_rsvp_received,
    'prefTaskCompleted',    v_prefs.pref_task_completed,
    'prefVendorCheckedIn',  v_prefs.pref_vendor_checked_in,
    'prefFeedbackReceived', v_prefs.pref_feedback_received,
    'prefReferralReceived', v_prefs.pref_referral_received,
    'prefMessageReceived',  v_prefs.pref_message_received,
    'channelEmail',         v_prefs.channel_email,
    'channelSms',           v_prefs.channel_sms,
    'channelPush',          v_prefs.channel_push
  );
end;
$$;

grant execute on function public.get_notification_preferences() to authenticated;


-- ── 4. update_notification_preferences ──────────────────────────────────────
-- Upserts the prefs row. Passing null for any param leaves that column unchanged.

create or replace function public.update_notification_preferences(
  p_pref_new_lead          boolean default null,
  p_pref_rsvp_received     boolean default null,
  p_pref_task_completed    boolean default null,
  p_pref_vendor_checked_in boolean default null,
  p_pref_feedback_received boolean default null,
  p_pref_referral_received boolean default null,
  p_pref_message_received  boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
begin
  select id into v_venue_id
  from public.venues where owner_user_id = auth.uid();
  if not found then return jsonb_build_object('ok', false); end if;

  insert into public.venue_notification_preferences (
    venue_id,
    pref_new_lead, pref_rsvp_received, pref_task_completed,
    pref_vendor_checked_in, pref_feedback_received,
    pref_referral_received, pref_message_received,
    updated_at
  ) values (
    v_venue_id,
    coalesce(p_pref_new_lead,          true),
    coalesce(p_pref_rsvp_received,     true),
    coalesce(p_pref_task_completed,    true),
    coalesce(p_pref_vendor_checked_in, true),
    coalesce(p_pref_feedback_received, true),
    coalesce(p_pref_referral_received, true),
    coalesce(p_pref_message_received,  true),
    now()
  )
  on conflict (venue_id) do update set
    pref_new_lead           = coalesce(p_pref_new_lead,          venue_notification_preferences.pref_new_lead),
    pref_rsvp_received      = coalesce(p_pref_rsvp_received,     venue_notification_preferences.pref_rsvp_received),
    pref_task_completed     = coalesce(p_pref_task_completed,     venue_notification_preferences.pref_task_completed),
    pref_vendor_checked_in  = coalesce(p_pref_vendor_checked_in, venue_notification_preferences.pref_vendor_checked_in),
    pref_feedback_received  = coalesce(p_pref_feedback_received,  venue_notification_preferences.pref_feedback_received),
    pref_referral_received  = coalesce(p_pref_referral_received,  venue_notification_preferences.pref_referral_received),
    pref_message_received   = coalesce(p_pref_message_received,   venue_notification_preferences.pref_message_received),
    updated_at              = now();

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.update_notification_preferences(boolean, boolean, boolean, boolean, boolean, boolean, boolean)
  to authenticated;


notify pgrst, 'reload schema';
