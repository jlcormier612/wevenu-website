-- ============================================================================
-- Sprint 56: Invitations & Guest Experience
--
-- "The website becomes the place where our guests interact with our wedding."
--
-- Every guest invitation creates:
--   engagement · RSVP activity · signals · momentum · reasons to return
--
-- 1. invitation_emails — log of every invitation email sent
--    Source of truth for "who was invited, when, via which channel"
--
-- 2. SECURITY DEFINER: send_invitations(token, guest_ids[])
--    Validates portal session, constructs personalized RSVP links,
--    triggers email delivery, marks guests as invited.
--
-- 3. get_rsvp_context(rsvp_token)
--    Public function: validates token, returns guest info + event/venue context
--    for the personalized /rsvp/{token} page.
-- ============================================================================

-- ── 1. Invitation email log ───────────────────────────────────────────────────

create table public.invitation_emails (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues(id) on delete cascade,
  client_id   uuid not null references public.clients(id) on delete cascade,
  guest_id    uuid not null references public.couple_guests(id) on delete cascade,

  email_type  text not null default 'invitation' check (email_type in (
    'invitation',     -- primary wedding invitation
    'save_the_date',  -- early save-the-date
    'reminder',       -- RSVP reminder (not yet responded)
    'update'          -- event details changed
  )),

  sent_at     timestamptz not null default now(),
  recipient   text not null,   -- email address at time of send
  subject     text,
  status      text not null default 'sent' check (status in ('sent', 'delivered', 'bounced', 'failed')),
  provider_id text,            -- Resend message ID

  created_at  timestamptz not null default now()
);

alter table public.invitation_emails enable row level security;

create policy "venue owner reads invitation emails"
  on public.invitation_emails for select
  using (exists (
    select 1 from public.venues
    where id = invitation_emails.venue_id
      and owner_user_id = auth.uid()
  ));

grant select on public.invitation_emails to authenticated;

create index invitation_emails_guest  on public.invitation_emails (guest_id);
create index invitation_emails_client on public.invitation_emails (client_id, sent_at desc);

-- ── 2. get_rsvp_context: public guest RSVP page ──────────────────────────────
-- Called by /rsvp/[token] — no auth required
-- Returns personalized context: guest name, event details, venue info

create or replace function public.get_rsvp_context(p_rsvp_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guest   public.couple_guests%rowtype;
  v_event   record;
  v_client  public.clients%rowtype;
  v_venue   public.venues%rowtype;
  v_website public.couple_websites%rowtype;
begin
  select * into v_guest
  from public.couple_guests
  where rsvp_token = p_rsvp_token;

  if not found then
    return jsonb_build_object('error', 'invalid_link');
  end if;

  select * into v_venue from public.venues where id = v_guest.venue_id;
  select * into v_client from public.clients where id = v_guest.client_id;
  select e.id, e.name, e.event_date, e.event_type, e.setup_time
  into v_event
  from public.events e
  where e.client_id = v_guest.client_id and e.venue_id = v_guest.venue_id
    and e.status not in ('cancelled')
  order by e.event_date asc limit 1;

  select * into v_website
  from public.couple_websites
  where client_id = v_guest.client_id and venue_id = v_guest.venue_id and is_published = true;

  return jsonb_build_object(
    'guest', jsonb_build_object(
      'id',           v_guest.id,
      'firstName',    v_guest.first_name,
      'lastName',     v_guest.last_name,
      'rsvpStatus',   v_guest.rsvp_status,
      'rsvpNote',     v_guest.rsvp_note,
      'dietary',      v_guest.dietary_restrictions,
      'plusOne',      v_guest.plus_one,
      'plusOneName',  v_guest.plus_one_name
    ),
    'couple', jsonb_build_object(
      'firstName',        v_client.first_name,
      'partnerFirstName', v_client.partner_first_name
    ),
    'event', case when v_event.id is not null then jsonb_build_object(
      'name',      v_event.name,
      'eventDate', v_event.event_date,
      'eventType', v_event.event_type
    ) else null end,
    'venue', jsonb_build_object(
      'name', v_venue.name
    ),
    'websiteSlug', case when v_website.slug is not null then v_website.slug else null end,
    'accentColor', case when v_website.accent_color is not null then v_website.accent_color else '#5D6F5D' end
  );
end;
$$;

grant execute on function public.get_rsvp_context(text) to anon, authenticated;

-- ── 3. send_invitations: bulk invitation dispatch via portal token ────────────
-- Validates token, logs each invitation, marks rsvp_sent_at.
-- Actual email delivery happens in the API route (Resend).

create or replace function public.log_invitations_sent(
  p_token     text,
  p_guest_ids uuid[],
  p_email_type text default 'invitation'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
  v_guest   public.couple_guests%rowtype;
  v_count   integer := 0;
begin
  select * into v_session from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;

  foreach v_guest.id in array p_guest_ids loop
    select * into v_guest from public.couple_guests
    where id = v_guest.id
      and client_id = v_session.client_id
      and venue_id = v_session.venue_id
      and email is not null;

    if found then
      -- Mark as sent
      update public.couple_guests
      set rsvp_sent_at = coalesce(rsvp_sent_at, now()), updated_at = now()
      where id = v_guest.id;

      -- Log invitation email
      insert into public.invitation_emails
        (venue_id, client_id, guest_id, email_type, recipient, subject, status)
      values
        (v_session.venue_id, v_session.client_id, v_guest.id,
         p_email_type, v_guest.email,
         'You''re invited! ' || (select first_name from public.clients where id = v_session.client_id) || '''s Wedding',
         'sent');

      v_count := v_count + 1;
    end if;
  end loop;

  -- Log activity
  insert into public.couple_portal_events (venue_id, client_id, session_id, event_type, event_data)
  values (v_session.venue_id, v_session.client_id, v_session.id,
          'invitations_sent', jsonb_build_object('count', v_count, 'type', p_email_type));

  return jsonb_build_object('ok', true, 'sent', v_count);
end;
$$;

grant execute on function public.log_invitations_sent(text, uuid[], text) to anon, authenticated;

notify pgrst, 'reload schema';
