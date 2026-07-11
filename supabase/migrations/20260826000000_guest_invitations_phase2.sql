-- ============================================================================
-- Guest Experience — Phase 2: Invitations & Responses
--
-- Implements docs/guest-experience-implementation-plan.md's Phase 2, on top
-- of Phase 1's Guest & Household Foundation. Scope: invitation lifecycle
-- tracking, household-level invitation actions, and a couple-facing
-- invitation/RSVP progress view. RSVP itself (rsvp_status, submit_rsvp, the
-- guest-facing /rsvp/[token] page) is reused untouched in its actual
-- mechanics — only extended so the two write paths (sending, responding)
-- also keep the new, separate invitation_status current.
--
-- invitation_status is deliberately not rsvp_status:
--   draft/ready   — the couple's own pre-send checklist state (never emailed)
--   sent          — an invitation email went out, OR the couple marked a
--                   no-email guest sent by another means (paper, verbal)
--   delivered/opened — populated only by an email-provider webhook; no such
--                   webhook exists yet, so these are modeled but currently
--                   unreachable ("where technically available" per spec)
--   responded     — submit_rsvp ran for this guest (says nothing about what
--                   they said — that's rsvp_status's job)
--   declined      — the COUPLE withdrew this invitation; unrelated to a
--                   guest's own RSVP answer, which is why this isn't a
--                   duplicate of rsvp_status's 'declined'
-- ============================================================================

-- ── 1. invitation_status column ──────────────────────────────────────────────

alter table public.couple_guests
  add column invitation_status text not null default 'draft'
    check (invitation_status in ('draft', 'ready', 'sent', 'delivered', 'opened', 'responded', 'declined'));

create index couple_guests_invitation_status on public.couple_guests (client_id, invitation_status);

-- Backfill from existing history so guests already invited/responded under
-- the old (invitation-status-less) system don't all appear to be untouched
-- drafts.
update public.couple_guests set invitation_status = 'sent' where rsvp_sent_at is not null;
update public.couple_guests set invitation_status = 'responded' where rsvp_responded_at is not null;

-- ── 2. submit_rsvp — same signature, additionally marks invitation_status ────
-- The dangling pre-Sprint-73 6-arg overload was never dropped when the
-- 10-arg version replaced it in practice; cleaned up here rather than left
-- standing (same class of issue Phase 1 found and fixed on add_couple_guest).

drop function if exists public.submit_rsvp(text, text, boolean, text, text, text);

create or replace function public.submit_rsvp(
  p_rsvp_token         text,
  p_status             text,
  p_plus_one           boolean  default false,
  p_plus_one_name      text     default null,
  p_dietary            text     default null,
  p_note               text     default null,
  p_meal_choice        text     default null,
  p_plus_one_meal      text     default null,
  p_answers            jsonb    default null,
  p_household_responses jsonb   default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guest             public.couple_guests%rowtype;
  v_total_responses   int;
  v_attending_count   int;
  v_pending_count     int;
  v_total_guests      int;
  v_ans               jsonb;
  v_hm                jsonb;
  v_couple_name       text;
begin
  select * into v_guest
  from public.couple_guests
  where rsvp_token = p_rsvp_token;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_rsvp_link');
  end if;

  if p_status not in ('attending', 'declined', 'maybe') then
    return jsonb_build_object('ok', false, 'error', 'invalid_status');
  end if;

  -- Update main guest record
  update public.couple_guests
  set rsvp_status          = p_status,
      rsvp_responded_at    = now(),
      plus_one             = coalesce(p_plus_one, plus_one),
      plus_one_name        = coalesce(p_plus_one_name, plus_one_name),
      dietary_restrictions = coalesce(p_dietary, dietary_restrictions),
      rsvp_note            = coalesce(p_note, rsvp_note),
      rsvp_at              = now(),
      meal_choice          = coalesce(p_meal_choice, meal_choice),
      plus_one_meal        = coalesce(p_plus_one_meal, plus_one_meal),
      invitation_status    = 'responded',
      updated_at           = now()
  where rsvp_token = p_rsvp_token;

  -- Upsert custom question answers
  if p_answers is not null then
    for v_ans in select * from jsonb_array_elements(p_answers)
    loop
      begin
        insert into public.rsvp_answers (guest_id, question_id, answer_text)
        values (
          v_guest.id,
          (v_ans->>'questionId')::uuid,
          v_ans->>'answer'
        )
        on conflict (guest_id, question_id) do update
          set answer_text = excluded.answer_text;
      exception when others then null;
      end;
    end loop;
  end if;

  -- Update household members RSVPs
  if p_household_responses is not null and v_guest.household_id is not null then
    for v_hm in select * from jsonb_array_elements(p_household_responses)
    loop
      begin
        update public.couple_guests
        set rsvp_status       = v_hm->>'status',
            rsvp_responded_at = now(),
            meal_choice       = v_hm->>'mealChoice',
            invitation_status = 'responded',
            updated_at        = now()
        where id             = (v_hm->>'guestId')::uuid
          and household_id   = v_guest.household_id
          and client_id      = v_guest.client_id
          and (v_hm->>'status') in ('attending', 'declined', 'maybe');
      exception when others then null;
      end;
    end loop;
  end if;

  -- Log the RSVP event
  begin
    insert into public.couple_portal_events
      (venue_id, client_id, event_type, event_data)
    values
      (v_guest.venue_id, v_guest.client_id, 'rsvp_received',
       jsonb_build_object('guestId', v_guest.id, 'status', p_status));
  exception when others then null;
  end;

  -- ── Smart Moments ───────────────────────────────────────────────────────────

  begin
    select count(*) into v_total_responses
    from public.couple_guests
    where client_id = v_guest.client_id and rsvp_status != 'pending';

    select count(*) into v_attending_count
    from public.couple_guests
    where client_id = v_guest.client_id and rsvp_status = 'attending';

    select count(*) into v_pending_count
    from public.couple_guests
    where client_id = v_guest.client_id and rsvp_status = 'pending';

    select count(*) into v_total_guests
    from public.couple_guests
    where client_id = v_guest.client_id;

    -- Resolve couple name for journal body
    select concat(c.first_name,
      case when c.partner_first_name is not null then ' & ' || c.partner_first_name else '' end)
    into v_couple_name
    from public.clients c
    where c.id = v_guest.client_id;

    -- First RSVP received
    if v_total_responses = 1 then
      if not exists (
        select 1 from public.couple_journal_entries
        where client_id = v_guest.client_id and milestone = 'first_rsvp'
      ) then
        insert into public.couple_journal_entries
          (client_id, entry_date, title, body, milestone, source)
        values (
          v_guest.client_id,
          current_date,
          'First RSVP is in! 🎉',
          v_guest.first_name || ' just responded to your invitation. The RSVPs are starting to roll in!',
          'first_rsvp',
          'auto'
        );
      end if;
    end if;

    -- 50 guests attending
    if v_attending_count = 50 then
      if not exists (
        select 1 from public.couple_journal_entries
        where client_id = v_guest.client_id and milestone = 'attending_50'
      ) then
        insert into public.couple_journal_entries
          (client_id, entry_date, title, body, milestone, source)
        values (
          v_guest.client_id,
          current_date,
          '50 guests are coming! 🥂',
          'You''ve hit a milestone — 50 people have said yes to celebrating your wedding. The party is growing!',
          'attending_50',
          'auto'
        );
      end if;
    end if;

    -- Everyone responded
    if v_pending_count = 0 and v_total_guests > 0 then
      if not exists (
        select 1 from public.couple_journal_entries
        where client_id = v_guest.client_id and milestone = 'all_responded'
      ) then
        insert into public.couple_journal_entries
          (client_id, entry_date, title, body, milestone, source)
        values (
          v_guest.client_id,
          current_date,
          'Everyone has RSVPed! 💌',
          'All ' || v_total_guests || ' guests have responded. ' || v_attending_count || ' people are celebrating with you.',
          'all_responded',
          'auto'
        );
      end if;
    end if;

  exception when others then null;
  end;

  -- Return guest context for confirmation screen
  return jsonb_build_object(
    'ok',        true,
    'guestName', v_guest.first_name,
    'status',    p_status
  );
end;
$$;

grant execute on function public.submit_rsvp(text,text,boolean,text,text,text,text,text,jsonb,jsonb) to anon, authenticated;

-- ── 3. log_invitations_sent — same signature, additionally marks invitation_status ──
-- Never downgrades a guest who already responded or was withdrawn — a
-- reminder send (or a stray re-send) should not erase that.

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
      set rsvp_sent_at = coalesce(rsvp_sent_at, now()),
          invitation_status = case
            when invitation_status in ('responded', 'declined') then invitation_status
            else 'sent'
          end,
          updated_at = now()
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

-- ── 4. set_guest_invitation_status — the couple's own manual lifecycle control ──
-- Bulk-capable (array of one = a single guest; array of a household's
-- member ids = the household action) rather than two separate RPCs, same
-- convention log_invitations_sent already uses. Only the couple's own
-- claims are settable here — 'delivered'/'opened' need a real email-provider
-- webhook (not built; there's nothing to verify them against yet) and
-- 'responded' only ever comes from an actual RSVP via submit_rsvp.
create or replace function public.set_guest_invitation_status(
  p_token text, p_guest_ids uuid[], p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
  v_count   integer;
begin
  select * into v_session from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;
  if v_session.access_level in ('financial', 'reminders_only') then
    return jsonb_build_object('ok', false, 'error', 'insufficient_access');
  end if;

  if p_status not in ('draft', 'ready', 'sent', 'declined') then
    return jsonb_build_object('ok', false, 'error', 'invalid_status');
  end if;

  update public.couple_guests
  set invitation_status = p_status, updated_at = now()
  where id = any(p_guest_ids)
    and client_id = v_session.client_id
    and venue_id = v_session.venue_id;

  get diagnostics v_count = row_count;
  return jsonb_build_object('ok', true, 'updated', v_count);
end;
$$;

grant execute on function public.set_guest_invitation_status(text, uuid[], text) to anon, authenticated;

-- ── 5. get_invitation_progress — the couple-facing dashboard aggregation ─────

create or replace function public.get_invitation_progress(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_session public.client_portal_sessions%rowtype;
begin
  select * into v_session from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('error', 'invalid_token'); end if;

  return jsonb_build_object(
    'invitationStats', (
      select jsonb_build_object(
        'draft',     count(*) filter (where invitation_status = 'draft'),
        'ready',     count(*) filter (where invitation_status = 'ready'),
        'sent',      count(*) filter (where invitation_status = 'sent'),
        'delivered', count(*) filter (where invitation_status = 'delivered'),
        'opened',    count(*) filter (where invitation_status = 'opened'),
        'responded', count(*) filter (where invitation_status = 'responded'),
        'declined',  count(*) filter (where invitation_status = 'declined')
      )
      from public.couple_guests
      where client_id = v_session.client_id and venue_id = v_session.venue_id
    ),
    'pendingCount', (
      select count(*) from public.couple_guests
      where client_id = v_session.client_id and venue_id = v_session.venue_id
        and invitation_status in ('sent', 'delivered', 'opened')
        and rsvp_status = 'pending'
    ),
    'outstandingHouseholds', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', h.id, 'name', h.name,
        'totalMembers', member_counts.total,
        'respondedMembers', member_counts.responded
      ) order by h.name)
      from public.couple_households h
      join lateral (
        select count(*) as total,
               count(*) filter (where g.rsvp_status != 'pending') as responded
        from public.couple_guests g
        where g.household_id = h.id and g.invitation_status != 'declined'
      ) member_counts on true
      where h.client_id = v_session.client_id and h.venue_id = v_session.venue_id
        and member_counts.total > 0
        and member_counts.responded < member_counts.total
    ), '[]'::jsonb),
    'recentlyResponded', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id,
        'name', trim(g.first_name || ' ' || coalesce(g.last_name, '')),
        'rsvpStatus', g.rsvp_status,
        'respondedAt', g.rsvp_responded_at,
        'householdName', h.name
      ) order by g.rsvp_responded_at desc)
      from public.couple_guests g
      left join public.couple_households h on h.id = g.household_id
      where g.client_id = v_session.client_id and g.venue_id = v_session.venue_id
        and g.rsvp_responded_at is not null
      limit 8
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.get_invitation_progress(text) to anon, authenticated;

-- ── 6. get_couple_guests — same signature, now also returns invitationStatus ──

create or replace function public.get_couple_guests(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
begin
  select * into v_session
  from public.client_portal_sessions
  where access_token = p_token
    and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('error', 'invalid_token'); end if;

  return jsonb_build_object(
    'guests', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',            g.id,
          'firstName',     g.first_name,
          'lastName',      g.last_name,
          'email',         g.email,
          'phone',         g.phone,
          'isChild',       g.is_child,
          'plusOne',       g.plus_one,
          'plusOneName',   g.plus_one_name,
          'plusOneMeal',   g.plus_one_meal,
          'rsvpStatus',    g.rsvp_status,
          'rsvpNote',      g.rsvp_note,
          'dietary',       g.dietary_restrictions,
          'mealChoice',    g.meal_choice,
          'householdId',   g.household_id,
          'householdName', h.name,
          'notes',         g.notes,
          'rsvpToken',     g.rsvp_token,
          'rsvpSentAt',    g.rsvp_sent_at,
          'invitationStatus', g.invitation_status
        ) order by h.name nulls last, g.sort_order, g.first_name
      )
      from public.couple_guests g
      left join public.couple_households h on h.id = g.household_id
      where g.client_id = v_session.client_id
        and g.venue_id  = v_session.venue_id
    ), '[]'::jsonb),
    'stats', (
      select jsonb_build_object(
        'total',        count(*),
        'attending',    count(*) filter (where rsvp_status = 'attending'),
        'declined',     count(*) filter (where rsvp_status = 'declined'),
        'pending',      count(*) filter (where rsvp_status = 'pending'),
        'children',     count(*) filter (where is_child = true),
        'withPlusOnes', count(*) filter (where plus_one = true and rsvp_status = 'attending')
      )
      from public.couple_guests
      where client_id = v_session.client_id and venue_id = v_session.venue_id
    )
  );
end;
$$;

notify pgrst, 'reload schema';
