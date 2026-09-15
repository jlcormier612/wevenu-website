-- Portal + Dashboard remediation (sandbox customer-facing defects)
-- A/B: Couple portal Timeline shows venue-owned framework (architecture §12 /
--       types.ts mutual visibility — not gated by wedding_party tags).
-- D:   Mark portal-visible system messages read; optional mark_read for badge.
-- E:   Luv stale-lead CTA preserves the same 7-day contact filter.
-- C:   Grants for ops inspection of floor-plan offer tables.

-- ── B. Timeline: venue framework visible to the couple ───────────────────────
create or replace function public.get_portal_run_of_show(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session          public.client_portal_sessions%rowtype;
  v_effective_role   text;
  v_event_id         uuid;
  v_entries          jsonb;
  v_sections         jsonb;
  v_last_submitted   timestamptz;
  v_submitted_count  integer;
  v_live_count       integer;
  v_has_unpublished  boolean;
begin
  select * into v_session
  from public.client_portal_sessions
  where access_token = p_token
    and (expires_at is null or expires_at > now())
  limit 1;

  if v_session.id is null then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  if v_session.contact_id is not null then
    select portal_role into v_effective_role
    from public.client_contacts
    where id = v_session.contact_id;
    v_effective_role := coalesce(v_effective_role, v_session.access_level);
  else
    v_effective_role := v_session.access_level;
  end if;

  v_event_id := coalesce(
    v_session.event_id,
    public._current_event_for_client(v_session.client_id, v_session.venue_id)
  );

  if v_event_id is null then
    return jsonb_build_object('entries', '[]'::jsonb, 'sections', '[]'::jsonb, 'lastSubmittedAt', null, 'hasUnpublishedChanges', false);
  end if;

  -- Couple live view: their own draft (owner='client') plus the venue's
  -- structural framework (owner='venue'). Wedding-party / guest / vendor tags
  -- are external publishing decisions — they do not gate couple↔venue mutual
  -- visibility of the venue framework the couple plans inside.
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',          te.id,
        'title',       te.title,
        'description', te.description,
        'entryTime',   te.entry_time,
        'dayOffset',   te.day_offset,
        'sectionId',   te.section_id,
        'sortOrder',   te.sort_order,
        'owner',       te.owner,
        'lockState',   te.lock_state,
        'audiences',   te.audiences,
        'canEdit',       te.owner = 'client' and v_effective_role in ('full_access', 'planning', 'couple'),
        'canManageVisibility', te.owner = 'client' and v_effective_role in ('full_access', 'planning', 'couple'),
        'links', (
          select coalesce(
            jsonb_agg(jsonb_build_object('id', l.id, 'url', l.url, 'label', l.label) order by l.sort_order, l.created_at),
            '[]'::jsonb
          )
          from public.timeline_entry_links l
          where l.timeline_entry_id = te.id and l.venue_id = v_session.venue_id
        ),
        'attachments', (
          select coalesce(
            jsonb_agg(jsonb_build_object('id', a.id, 'name', coalesce(d.name, d.file_name), 'url', d.storage_url) order by a.sort_order, a.created_at),
            '[]'::jsonb
          )
          from public.timeline_entry_attachments a
          join public.documents d on d.id = a.document_id
          where a.timeline_entry_id = te.id and a.venue_id = v_session.venue_id
        )
      )
      order by te.day_offset, te.entry_time asc nulls last, te.sort_order, te.created_at
    ),
    '[]'::jsonb
  )
  into v_entries
  from public.timeline_entries te
  where te.event_id = v_event_id
    and te.venue_id = v_session.venue_id
    and te.owner in ('client', 'venue');

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', s.id, 'name', s.name, 'sortOrder', s.sort_order,
        'clientCanAdd', s.client_can_add and v_effective_role in ('full_access', 'planning', 'couple')
      )
      order by s.sort_order
    ),
    '[]'::jsonb
  )
  into v_sections
  from public.timeline_sections s
  where s.event_id = v_event_id
    and s.venue_id = v_session.venue_id;

  select created_at, entry_count into v_last_submitted, v_submitted_count
  from public.timeline_submissions
  where event_id = v_event_id and venue_id = v_session.venue_id
  order by created_at desc limit 1;

  select count(*) into v_live_count
  from public.timeline_entries
  where event_id = v_event_id and venue_id = v_session.venue_id and owner = 'client';

  if v_last_submitted is null then
    v_has_unpublished := v_live_count > 0;
  else
    v_has_unpublished := v_live_count != coalesce(v_submitted_count, 0)
      or exists (
        select 1 from public.timeline_entries
        where event_id = v_event_id and venue_id = v_session.venue_id
          and owner = 'client' and updated_at > v_last_submitted
      );
  end if;

  return jsonb_build_object(
    'entries', v_entries, 'sections', v_sections,
    'lastSubmittedAt', v_last_submitted, 'hasUnpublishedChanges', v_has_unpublished
  );
end;
$$;

grant execute on function public.get_portal_run_of_show(text) to anon, authenticated;

-- ── D. Messages: mark system + venue_staff; optional mark_read ───────────────
drop function if exists public.get_portal_conversation(text);

create or replace function public.get_portal_conversation(p_token text, p_mark_read boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_client_id uuid;
  v_venue_id  uuid;
  v_relationship_id uuid;
  v_conversation_id uuid;
begin
  select cps.client_id, cps.venue_id into v_client_id, v_venue_id
  from public.client_portal_sessions cps
  where cps.access_token = p_token
    and (cps.expires_at is null or cps.expires_at > now())
  limit 1;

  if v_client_id is null then
    return '{"error":"invalid_token"}'::jsonb;
  end if;

  v_relationship_id := public.resolve_relationship_id_for_client(v_client_id);
  if v_relationship_id is null then
    return '{"error":"no_relationship"}'::jsonb;
  end if;

  select id into v_conversation_id
  from public.conversations
  where relationship_id = v_relationship_id
    and conversation_kind = 'venue_couple';
  if v_conversation_id is null then
    return '{"error":"no_conversation"}'::jsonb;
  end if;

  if coalesce(p_mark_read, true) then
    -- Portal maps venue_staff + system → "venue" bubbles. Both must clear on view.
    update public.conversation_messages set contact_read_at = now()
    where conversation_id = v_conversation_id
      and sender_type in ('venue_staff', 'system')
      and contact_read_at is null
      and channel not in ('internal_note', 'phone_log', 'voicemail', 'push');

    update public.conversations set contact_unread = 0 where id = v_conversation_id;
  end if;

  return (
    select jsonb_build_object(
      'conversation_id', v_conversation_id,
      'messages', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', cm.id, 'sender_type', cm.sender_type, 'channel', cm.channel,
              'body', cm.body,
              'sent_at', cm.sent_at, 'contact_read_at', cm.contact_read_at,
              'venue_read_at', cm.venue_read_at,
              'attachments', coalesce(
                (select jsonb_agg(jsonb_build_object(
                    'id', a.id, 'fileUrl', a.file_url, 'fileName', a.file_name,
                    'fileSize', a.file_size, 'mimeType', a.mime_type
                  ) order by a.created_at)
                 from public.conversation_message_attachments a
                 where a.message_id = cm.id),
                '[]'::jsonb
              )
            )
            order by cm.sent_at asc
          )
          from public.conversation_messages cm
          where cm.conversation_id = v_conversation_id
            and cm.channel not in ('internal_note', 'phone_log', 'voicemail', 'push')
        ),
        '[]'::jsonb
      )
    )
  );
end;
$$;

grant execute on function public.get_portal_conversation(text, boolean) to anon, authenticated;

-- ── E. Luv stale-lead CTA → filtered leads destination ───────────────────────
create or replace function generate_venue_recommendations()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id          uuid;
  v_stale_leads       int;
  v_pipeline_score    int;
  v_insight_id        uuid;
  v_insight_evidence  jsonb;
  v_monthly_avgs      jsonb;
  v_next_month_num    int;
  v_next_month_name   text;
  v_overall_avg       numeric;
  v_next_month_avg    numeric;
  v_next_ratio        numeric;
  v_pacing_ratio      numeric;
  v_days_elapsed      text;
  v_recs_generated    int := 0;
begin
  select venue_id into v_venue_id
  from venue_users where user_id = auth.uid() limit 1;

  if v_venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'no venue');
  end if;

  -- ── 1. Lead Follow-Up ─────────────────────────────────────────────────────

  if not exists (
    select 1 from luv_recommendations
    where venue_id = v_venue_id
      and type = 'lead_followup'
      and dismissed_at > now() - interval '7 days'
  ) then
    select count(*)::int into v_stale_leads
    from leads
    where venue_id = v_venue_id
      and status not in ('won', 'lost', 'cancelled')
      and (last_contacted_at is null or last_contacted_at < current_date - 7);

    if v_stale_leads >= 2 then
      select coalesce(
        (dimensions -> 'pipelineActivity' ->> 'score')::int, 70
      ) into v_pipeline_score
      from venue_health_scores where venue_id = v_venue_id;

      insert into luv_recommendations
        (venue_id, type, title, body, priority, ctas, metadata, dismissed_at, completed_at, expires_at)
      values (
        v_venue_id,
        'lead_followup',
        v_stale_leads::text || ' active lead' ||
          (case when v_stale_leads <> 1 then 's haven''t' else ' hasn''t' end) ||
          ' been contacted in 7+ days',
        'These leads may cool off without a nudge. A short follow-up keeps the relationship warm and your pipeline moving.',
        case when coalesce(v_pipeline_score, 70) < 50 then 80 else 65 end,
        '[{"label":"Draft follow-up messages \u2728","target":"follow_up_messages","type":"generate"},{"label":"Review inquiries \u2192","target":"/leads?attention=stale_contact","type":"navigate"}]'::jsonb,
        jsonb_build_object(
          'staleLeadCount', v_stale_leads,
          'evidenceBullets', jsonb_build_array(
            v_stale_leads::text || ' active ' ||
              case when v_stale_leads = 1 then 'inquiry hasn''t' else 'inquiries haven''t' end ||
              ' been contacted in 7+ days',
            case when coalesce(v_pipeline_score, 70) < 50
              then 'Pipeline activity is running below healthy levels — outreach is especially important now'
              else 'Regular follow-up is one of the strongest drivers of inquiry conversion'
            end
          )
        ),
        null, null,
        now() + interval '3 days'
      )
      on conflict (venue_id, type) do update
        set title        = excluded.title,
            body         = excluded.body,
            priority     = excluded.priority,
            ctas         = excluded.ctas,
            metadata     = excluded.metadata,
            dismissed_at = null,
            completed_at = null,
            expires_at   = excluded.expires_at;

      v_recs_generated := v_recs_generated + 1;
    else
      delete from luv_recommendations
      where venue_id = v_venue_id
        and type = 'lead_followup'
        and dismissed_at is null
        and completed_at is null;
    end if;
  end if;

  -- ── 2. Inquiry Reactivation ────────────────────────────────────────────────

  if not exists (
    select 1 from luv_recommendations
    where venue_id = v_venue_id
      and type = 'inquiry_reactivation'
      and dismissed_at > now() - interval '7 days'
  ) then
    select id, evidence into v_insight_id, v_insight_evidence
    from luv_insights
    where venue_id = v_venue_id
      and type = 'inquiry_pacing'
      and is_actionable = true
      and confidence in ('medium', 'high')
    limit 1;

    if v_insight_id is not null then
      v_pacing_ratio := coalesce((v_insight_evidence ->> 'pacingRatio')::numeric, 0.75);
      v_days_elapsed := coalesce(v_insight_evidence ->> 'daysElapsed', 'Several');

      insert into luv_recommendations
        (venue_id, insight_id, type, title, body, priority, ctas, metadata, dismissed_at, completed_at, expires_at)
      values (
        v_venue_id,
        v_insight_id,
        'inquiry_reactivation',
        'Your inquiry volume is below average this month',
        'This is a good moment to strengthen your presence — revisit your packages, refresh your listings, or reach out to warm leads who haven''t responded yet.',
        70,
        '[{"label":"Create seasonal promotion \u2728","target":"seasonal_promo","type":"generate"},{"label":"View pipeline \u2192","target":"/leads","type":"navigate"},{"label":"Open Packages \u2192","target":"/library/packages","type":"navigate"}]'::jsonb,
        jsonb_build_object(
          'insightId', v_insight_id,
          'evidenceBullets', jsonb_build_array(
            'Inquiry volume is ' ||
              round((1 - v_pacing_ratio) * 100)::text ||
              '% below your monthly average',
            v_days_elapsed || ' days into the month — pacing is behind historical baseline',
            'Venues that increase visibility during slower periods often recover within 2–3 weeks'
          )
        ),
        null, null,
        now() + interval '14 days'
      )
      on conflict (venue_id, type) do update
        set insight_id   = excluded.insight_id,
            title        = excluded.title,
            body         = excluded.body,
            ctas         = excluded.ctas,
            metadata     = excluded.metadata,
            dismissed_at = null,
            completed_at = null,
            expires_at   = excluded.expires_at;

      v_recs_generated := v_recs_generated + 1;
    else
      delete from luv_recommendations
      where venue_id = v_venue_id
        and type = 'inquiry_reactivation'
        and dismissed_at is null
        and completed_at is null;
    end if;
  end if;

  -- ── 3. Seasonal Inventory Prep ─────────────────────────────────────────────

  if not exists (
    select 1 from luv_recommendations
    where venue_id = v_venue_id
      and type = 'seasonal_prep'
      and dismissed_at > now() - interval '14 days'
  ) then
    select value into v_monthly_avgs
    from luv_memories
    where venue_id = v_venue_id and key = 'monthly_inquiry_averages';

    if v_monthly_avgs is not null and jsonb_array_length(v_monthly_avgs) >= 6 then
      v_next_month_num := (extract(month from now())::int % 12) + 1;

      select
        avg((elem ->> 'avg')::numeric),
        max(case when (elem ->> 'month')::int = v_next_month_num
              then (elem ->> 'avg')::numeric end)
      into v_overall_avg, v_next_month_avg
      from jsonb_array_elements(v_monthly_avgs) as elem;

      if v_overall_avg > 0 and v_next_month_avg is not null then
        v_next_ratio := v_next_month_avg / v_overall_avg;

        if v_next_ratio >= 1.35 then
          v_next_month_name := trim(to_char(
            date_trunc('month', now()) + interval '1 month', 'Month'
          ));

          insert into luv_recommendations
            (venue_id, type, title, body, priority, ctas, metadata, dismissed_at, completed_at, expires_at)
          values (
            v_venue_id,
            'seasonal_prep',
            v_next_month_name || ' is historically one of your peak months — it''s coming up soon',
            'Based on past years, ' || v_next_month_name ||
              ' brings well above your average inquiry volume. Opening availability early and refreshing your packages now could help you capture more bookings.',
            60,
            '[{"label":"Prepare availability plan \u2728","target":"availability_plan","type":"generate"},{"label":"View calendar \u2192","target":"/calendar","type":"navigate"},{"label":"Manage availability \u2192","target":"/settings/availability","type":"navigate"}]'::jsonb,
            jsonb_build_object(
              'nextMonthNum',  v_next_month_num,
              'nextMonthName', v_next_month_name,
              'nextRatio',     round(v_next_ratio, 2),
              'evidenceBullets', jsonb_build_array(
                v_next_month_name || ' historically brings ' ||
                  round((v_next_ratio - 1) * 100)::text ||
                  '% more inquiries than your monthly average',
                'Based on ' || jsonb_array_length(v_monthly_avgs)::text || ' months of historical inquiry data',
                'Venues that prepare 3–4 weeks early capture more bookings during peak months'
              )
            ),
            null, null,
            now() + interval '21 days'
          )
          on conflict (venue_id, type) do update
            set title        = excluded.title,
                body         = excluded.body,
                ctas         = excluded.ctas,
                metadata     = excluded.metadata,
                dismissed_at = null,
                completed_at = null,
                expires_at   = excluded.expires_at;

          v_recs_generated := v_recs_generated + 1;
        else
          delete from luv_recommendations
          where venue_id = v_venue_id
            and type = 'seasonal_prep'
            and dismissed_at is null
            and completed_at is null;
        end if;
      end if;
    end if;
  end if;

  -- Keep already-stored lead_followup CTAs aligned with the filter destination.
  update luv_recommendations
  set ctas = (
    select jsonb_agg(
      case
        when elem->>'type' = 'navigate' and elem->>'target' = '/leads'
          then jsonb_set(elem, '{target}', '"/leads?attention=stale_contact"')
        else elem
      end
    )
    from jsonb_array_elements(ctas) as elem
  )
  where type = 'lead_followup';

  return jsonb_build_object('ok', true, 'generated', v_recs_generated);
end;
$$;


-- Ops grants (service_role) for floor-plan offer inspection — same pattern as
-- task_reminders / venue_spaces grants. Does not weaken RLS for authenticated.
grant select on public.floor_plans to service_role;
grant select on public.event_floor_plan_offers to service_role;
grant select on public.floor_plan_objects to service_role;
