-- ============================================================================
-- Tour confirmation as its own concept, separate from tour status.
--
-- Scheduled means the appointment exists but attendance hasn't been
-- confirmed. Sending a confirmation request does not itself change status —
-- it only records that a request went out. The prospect's own affirmative
-- click flips the tour to Confirmed automatically; a venue staff member can
-- also mark it Confirmed manually when confirmation happened outside the
-- system (a phone call, in person). Either way confirmed_at/
-- confirmation_source records how it actually happened — no new customer-
-- facing status is introduced; Scheduled/Confirmed/Completed/Cancelled/
-- No Show are unchanged.
--
-- confirm_token follows the exact precedent already established for
-- contracts.sign_token (supabase/migrations/20260626300000_contracts_
-- foundation.sql): a plain unique column on the row itself, validity gated
-- by status rather than an expiry, "possession of the URL is consent."
-- Reads/writes go through SECURITY DEFINER RPCs (matching this table's own
-- existing get_venue_by_tour_key/book_tour pattern) rather than a new anon
-- RLS policy, since tour_appointments deliberately has zero anon grants
-- today.
-- ============================================================================

alter table public.tour_appointments
  add column confirmation_requested_at timestamptz,
  add column confirmation_source text check (confirmation_source in ('manual', 'prospect_link')),
  add column confirm_token uuid not null default gen_random_uuid();

create unique index tour_appointments_confirm_token
  on public.tour_appointments (confirm_token);

comment on column public.tour_appointments.confirmation_requested_at is
  'When a confirmation request was sent to the prospect. Does not itself change status — only the prospect confirming (or staff marking it manually) does that.';
comment on column public.tour_appointments.confirmation_source is
  'How the tour became Confirmed: prospect_link (they clicked the confirmation link) or manual (staff marked it, confirmation happened outside the system). Null until confirmed.';
comment on column public.tour_appointments.confirm_token is
  'Public confirmation-link token. Same shape as contracts.sign_token — a plain unique column, not a separate tokens table.';

-- ── Public read by token (no auth) --------------------------------------------

create or replace function public.get_tour_by_confirm_token(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
begin
  select ta.status, ta.scheduled_at, ta.duration_minutes, ta.contact_name,
         v.name as venue_name, v.primary_color, v.logo_url, v.timezone
  into v_row
  from public.tour_appointments ta
  join public.venues v on v.id = ta.venue_id
  where ta.confirm_token = p_token;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', v_row.status,
    'scheduledAt', v_row.scheduled_at,
    'durationMinutes', v_row.duration_minutes,
    'contactName', v_row.contact_name,
    'venueName', v_row.venue_name,
    'primaryColor', coalesce(v_row.primary_color, '#5D6F5D'),
    'logoUrl', v_row.logo_url,
    'timezone', v_row.timezone
  );
end;
$$;

grant execute on function public.get_tour_by_confirm_token(uuid) to anon, authenticated;

-- ── Public confirm by token (no auth) — the only path that can ever set ------
-- ── confirmation_source = 'prospect_link' -------------------------------------

create or replace function public.confirm_tour_by_token(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appt record;
begin
  -- Row lock, not a prior read trusted from the page — same "never trust the
  -- earlier read" discipline sign_contract already uses, so a double-click
  -- or a stale page can't double-fire the activity log insert below.
  select id, venue_id, lead_id, contact_name, status
  into v_appt
  from public.tour_appointments
  where confirm_token = p_token
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_appt.status = 'confirmed' then
    return jsonb_build_object('ok', true, 'alreadyConfirmed', true);
  end if;

  if v_appt.status <> 'scheduled' then
    return jsonb_build_object('ok', false, 'error', 'not_confirmable');
  end if;

  update public.tour_appointments
  set status = 'confirmed',
      confirmed_at = now(),
      confirmation_source = 'prospect_link',
      updated_at = now()
  where id = v_appt.id;

  if v_appt.lead_id is not null then
    insert into public.lead_activities (venue_id, lead_id, type, title, description)
    values (
      v_appt.venue_id, v_appt.lead_id, 'tour_confirmed', 'Tour confirmed',
      coalesce(v_appt.contact_name, 'The prospect') || ' confirmed their tour online.'
    );
  end if;

  return jsonb_build_object('ok', true, 'alreadyConfirmed', false);
end;
$$;

grant execute on function public.confirm_tour_by_token(uuid) to anon, authenticated;
