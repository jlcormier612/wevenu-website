-- ============================================================================
-- Sprint 87: Venue Intelligence — Analytics & Health Scoring
--
-- Two RPCs:
--   get_venue_analytics()        — aggregate funnel/events/payments/adoption
--   get_client_health_scores()   — per-event health with signals for Luv
-- ============================================================================


-- ── get_venue_analytics ───────────────────────────────────────────────────────
-- All sections in one call to avoid N+1 round-trips from the client.

create or replace function public.get_venue_analytics()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
begin
  select id into v_venue_id
  from public.venues
  where owner_user_id = auth.uid();
  if not found then return jsonb_build_object('error', 'not_found'); end if;

  return jsonb_build_object(

    -- ── Lead Funnel ──────────────────────────────────────────────────────────
    'leadFunnel', (
      with l as (
        select status, source, tour_date, created_at
        from public.leads
        where venue_id = v_venue_id
          and status <> 'cancelled'
      )
      select jsonb_build_object(
        'total',        count(*),
        'contacted',    count(*) filter (where status in ('contacted','qualified','proposal_sent','won')),
        'toured',       count(*) filter (where status in ('qualified','proposal_sent','won') or tour_date is not null),
        'proposal',     count(*) filter (where status in ('proposal_sent','won')),
        'booked',       count(*) filter (where status = 'won'),
        'lost',         count(*) filter (where status = 'lost'),
        'conversionRate', case
                          when count(*) filter (where status not in ('lost')) > 0
                          then round(100.0 * count(*) filter (where status = 'won')
                               / nullif(count(*) filter (where status not in ('lost')), 0))
                          else 0 end,
        'bySource', (
          select coalesce(jsonb_agg(
            jsonb_build_object(
              'source',  coalesce(source, 'Unknown'),
              'total',   src_total,
              'booked',  src_booked,
              'rate',    case when src_total > 0 then round(100.0 * src_booked / src_total) else 0 end
            ) order by src_total desc
          ), '[]')
          from (
            select
              coalesce(source, 'unknown') as source,
              count(*) as src_total,
              count(*) filter (where status = 'won') as src_booked
            from l
            group by source
          ) s
        )
      )
      from l
    ),

    -- ── Events ───────────────────────────────────────────────────────────────
    'events', (
      with e as (
        select id, event_date, guest_count, event_type
        from public.events
        where venue_id = v_venue_id
      )
      select jsonb_build_object(
        'total',          count(*),
        'upcoming',       count(*) filter (where event_date >= current_date),
        'thisMonth',      count(*) filter (where event_date >= date_trunc('month', current_date)
                            and event_date < date_trunc('month', current_date) + interval '1 month'),
        'nextMonth',      count(*) filter (where event_date >= date_trunc('month', current_date) + interval '1 month'
                            and event_date < date_trunc('month', current_date) + interval '2 months'),
        'avgGuestCount',  coalesce(round(avg(guest_count) filter (where guest_count is not null and guest_count > 0)), 0),
        'byMonth', (
          select coalesce(jsonb_agg(
            jsonb_build_object(
              'month', to_char(mo, 'YYYY-MM'),
              'label', to_char(mo, 'Mon YYYY'),
              'count', cnt
            ) order by mo
          ), '[]')
          from (
            select date_trunc('month', event_date) as mo, count(*) as cnt
            from e
            where event_date >= date_trunc('month', current_date)
              and event_date < date_trunc('month', current_date) + interval '12 months'
            group by mo
          ) m
        )
      )
      from e
    ),

    -- ── Payments ─────────────────────────────────────────────────────────────
    'payments', (
      select jsonb_build_object(
        'totalOutstanding', coalesce(sum(i.balance_due) filter (where i.status not in ('paid','cancelled') and i.balance_due > 0), 0),
        'totalOverdue',     coalesce((
          select sum(pli.amount) from public.payment_line_items pli
          join public.payment_schedules ps on ps.id = pli.schedule_id and ps.venue_id = v_venue_id
          where pli.status = 'overdue'
        ), 0),
        'overdueCount',     coalesce((
          select count(distinct ps.event_id) from public.payment_line_items pli
          join public.payment_schedules ps on ps.id = pli.schedule_id and ps.venue_id = v_venue_id
          where pli.status = 'overdue'
        ), 0),
        'totalBilled',      coalesce(sum(i.total) filter (where i.status not in ('cancelled')), 0),
        'totalCollected',   coalesce(sum(i.total - i.balance_due) filter (where i.status not in ('cancelled')), 0),
        'completionRate',   case
                            when sum(i.total) filter (where i.status not in ('cancelled')) > 0
                            then round(100.0
                                 * sum(i.total - i.balance_due) filter (where i.status not in ('cancelled'))
                                 / sum(i.total) filter (where i.status not in ('cancelled')))
                            else 0 end
      )
      from public.invoices i
      where i.venue_id = v_venue_id
    ),

    -- ── Feature Adoption ─────────────────────────────────────────────────────
    -- "How much of the platform are active couples actually using?"
    'featureAdoption', (
      with active_events as (
        select e.id as event_id, e.client_id
        from public.events e
        where e.venue_id = v_venue_id
          and e.event_date >= current_date
          and e.event_date <= current_date + interval '18 months'
      ),
      n as (select count(*) as total from active_events)
      select jsonb_build_object(
        'totalActiveEvents', n.total,
        'websitePublished',  (select count(distinct cw.client_id)  from public.couple_websites cw       join active_events ae on ae.client_id = cw.client_id       where cw.is_published = true),
        'websiteStarted',    (select count(distinct cw.client_id)  from public.couple_websites cw       join active_events ae on ae.client_id = cw.client_id),
        'budgetConfigured',  (select count(distinct cb.event_id)   from public.couple_budgets cb        join active_events ae on ae.event_id = cb.event_id          where cb.total_budget > 0),
        'seatingStarted',    (select count(distinct csa.event_id)  from public.couple_seating_arrangements csa join active_events ae on ae.event_id = csa.event_id),
        'vendorsLinked',     (select count(distinct eva.event_id)  from public.event_vendor_assignments eva     join active_events ae on ae.event_id = eva.event_id  where eva.venue_id = v_venue_id),
        'documentsUploaded', (select count(distinct d.client_id)   from public.documents d              join active_events ae on ae.client_id = d.client_id         where d.venue_id = v_venue_id),
        'playbooksActive',   (select count(distinct et.event_id)   from public.event_tasks et           join active_events ae on ae.event_id = et.event_id          where et.venue_id = v_venue_id),
        'guestsAdded',       (select count(distinct cg.client_id)  from public.couple_guests cg        join active_events ae on ae.client_id = cg.client_id         where cg.venue_id = v_venue_id)
      )
      from n
    ),

    -- ── Couple Engagement ────────────────────────────────────────────────────
    'coupleEngagement', (
      with active_events as (
        select e.id as event_id, e.client_id
        from public.events e
        where e.venue_id = v_venue_id
          and e.event_date >= current_date
          and e.event_date <= current_date + interval '18 months'
      ),
      n as (select count(*) as total from active_events)
      select jsonb_build_object(
        'totalActiveClients', n.total,
        'portalAdoption', (
          select case when n.total > 0
            then round(100.0 * count(distinct cps.client_id) / n.total)
            else 0 end
          from public.client_portal_sessions cps
          where cps.venue_id = v_venue_id
            and cps.client_id in (select client_id from active_events)
        ),
        'activeThisWeek', (
          select count(distinct cps.client_id)
          from public.client_portal_sessions cps
          where cps.venue_id = v_venue_id
            and cps.last_accessed_at >= now() - interval '7 days'
            and cps.client_id in (select client_id from active_events)
        ),
        'rsvpCompletionAvg', (
          select coalesce(round(avg(
            case when guest_total > 0 then responded::numeric / guest_total * 100 else 0 end
          )), 0)
          from (
            select
              ae.client_id,
              count(*) as guest_total,
              count(*) filter (where cg.rsvp_status <> 'pending') as responded
            from public.couple_guests cg
            join active_events ae on ae.client_id = cg.client_id
            where cg.venue_id = v_venue_id
            group by ae.client_id
            having count(*) > 0
          ) r
        )
      )
      from n
    )

  );
end;
$$;

grant execute on function public.get_venue_analytics() to authenticated;


-- ── get_client_health_scores ──────────────────────────────────────────────────
-- Per-event health scores with signals — the raw data Luv will summarize in S88.
-- Scope: upcoming events within 24 months.

create or replace function public.get_client_health_scores()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
begin
  select id into v_venue_id
  from public.venues
  where owner_user_id = auth.uid();
  if not found then return jsonb_build_object('error', 'not_found'); end if;

  return jsonb_build_object(
    'clients', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'eventId',        e.id,
          'clientId',       c.id,
          'clientName',     c.first_name || coalesce(' & ' || c.partner_first_name, ''),
          'eventDate',      e.event_date,
          'daysUntilEvent', (e.event_date - current_date),
          'eventType',      e.event_type,
          'health',         h.health,
          'score',          h.score,
          'signals',        h.signals,
          'metrics',        h.metrics
        )
        order by e.event_date
      ), '[]')
      from public.events e
      join public.clients c on c.id = e.client_id
      cross join lateral (
        with
          -- ── Raw signal data ──────────────────────────────────────────────
          portal_data as (
            select
              count(*) > 0 as has_session,
              extract(days from now() - max(last_accessed_at))::int as days_since_login
            from public.client_portal_sessions
            where client_id = c.id and venue_id = v_venue_id
          ),
          guest_data as (
            select
              count(*) as guest_total,
              count(*) filter (where rsvp_status <> 'pending') as responded,
              count(*) filter (where rsvp_status = 'attending') as attending
            from public.couple_guests
            where client_id = c.id and venue_id = v_venue_id
          ),
          website_data as (
            select
              count(*) > 0 as started,
              coalesce(bool_or(is_published), false) as published
            from public.couple_websites
            where client_id = c.id and venue_id = v_venue_id
          ),
          budget_data as (
            select coalesce(bool_or(total_budget > 0), false) as configured
            from public.couple_budgets
            where event_id = e.id
          ),
          overdue_pay as (
            select count(*) as cnt
            from public.payment_line_items pli
            join public.payment_schedules ps on ps.id = pli.schedule_id
            where ps.event_id = e.id and ps.venue_id = v_venue_id
              and pli.status = 'overdue'
          ),
          overdue_tasks as (
            select count(*) as cnt
            from public.event_tasks et
            where et.event_id = e.id and et.venue_id = v_venue_id
              and (et.status = 'overdue' or (et.status = 'pending' and et.due_date < current_date))
          ),
          feedback_data as (
            select
              coalesce(max(overall_rating), 0) as rating,
              coalesce(bool_or(would_recommend), false) as recommends
            from public.couple_venue_feedback
            where event_id = e.id
          ),
          referral_data as (
            select count(*) > 0 as has_referral
            from public.couple_referrals
            where event_id = e.id and venue_id = v_venue_id
          ),
          doc_data as (
            select count(*) > 0 as has_docs
            from public.documents
            where client_id = c.id and venue_id = v_venue_id
          ),
          -- ── Score computation (computed once, referenced twice) ────────────
          score_data as (
            select greatest(0, least(100,
              60
              -- At Risk deductions
              + case when not p.has_session                                                                   then -25 else 0 end
              + case when p.has_session and coalesce(p.days_since_login,999) >= 14
                      and (e.event_date - current_date) <= 180                                               then -20 else 0 end
              + case when g.guest_total = 0 and (e.event_date - current_date) <= 180                        then -15 else 0 end
              + case when op.cnt > 0                                                                         then -20 * greatest(1, op.cnt::int) else 0 end
              + case when ot.cnt >= 3                                                                        then -10 else 0 end
              -- Healthy additions
              + case when p.has_session and coalesce(p.days_since_login, 999) < 7                           then  20 else 0 end
              + case when w.published                                                                        then  15 else 0 end
              + case when g.guest_total >= 5                                                                 then  10 else 0 end
              + case when g.guest_total > 0 and g.responded::numeric / g.guest_total > 0.25                 then  10 else 0 end
              + case when b.configured                                                                       then  10 else 0 end
              + case when d.has_docs                                                                         then   5 else 0 end
              -- Champion additions
              + case when f.rating >= 4                                                                      then  10 else 0 end
              + case when f.recommends                                                                       then  10 else 0 end
              + case when r.has_referral                                                                     then  15 else 0 end
            )) as score
            from portal_data p, guest_data g, website_data w, budget_data b,
                 overdue_pay op, overdue_tasks ot, feedback_data f, referral_data r, doc_data d
          )
        select
          sd.score,
          -- Health tier
          case
            when sd.score < 35 or op.cnt > 0 then 'at_risk'
            when sd.score < 60               then 'needs_attention'
            when sd.score < 80               then 'healthy'
            else                                  'champion'
          end as health,
          -- Signal objects (Luv reads these in Sprint 88)
          jsonb_build_object(
            'atRisk', (
              select coalesce(jsonb_agg(sig), '[]') from (
                select 'no_portal_setup'     as sig where not p.has_session
                union all select 'portal_inactive_14d' where p.has_session and coalesce(p.days_since_login,999) >= 14 and (e.event_date - current_date) <= 180
                union all select 'no_guests'           where g.guest_total = 0 and (e.event_date - current_date) <= 180
                union all select 'payment_overdue'     where op.cnt > 0
                union all select 'tasks_behind'        where ot.cnt >= 3
              ) t
            ),
            'healthy', (
              select coalesce(jsonb_agg(sig), '[]') from (
                select 'portal_active'      as sig where p.has_session and coalesce(p.days_since_login,999) < 7
                union all select 'website_published'  where w.published
                union all select 'website_started'    where w.started and not w.published
                union all select 'guests_adding'      where g.guest_total >= 5
                union all select 'rsvp_active'        where g.guest_total > 0 and g.responded::numeric / g.guest_total > 0.25
                union all select 'budget_set'         where b.configured
                union all select 'docs_shared'        where d.has_docs
              ) t
            ),
            'champion', (
              select coalesce(jsonb_agg(sig), '[]') from (
                select 'positive_feedback'  as sig where f.rating >= 4
                union all select 'recommends_venue'   where f.recommends
                union all select 'referral_sent'      where r.has_referral
              ) t
            )
          ) as signals,
          -- Raw metrics (for the table display and future Luv context)
          jsonb_build_object(
            'daysSinceLogin',   p.days_since_login,
            'hasPortal',        p.has_session,
            'guestCount',       g.guest_total,
            'rsvpResponded',    g.responded,
            'rsvpRate',         case when g.guest_total > 0 then round(100.0 * g.responded / g.guest_total) else 0 end,
            'websitePublished', w.published,
            'websiteStarted',   w.started,
            'budgetConfigured', b.configured,
            'paymentsOverdue',  op.cnt,
            'tasksOverdue',     ot.cnt
          ) as metrics
        from score_data sd, portal_data p, guest_data g, website_data w, budget_data b,
             overdue_pay op, overdue_tasks ot, feedback_data f, referral_data r, doc_data d
      ) h
      where e.venue_id = v_venue_id
        and e.event_date >= current_date
        and e.event_date <= current_date + interval '24 months'
    )
  );
end;
$$;

grant execute on function public.get_client_health_scores() to authenticated;


notify pgrst, 'reload schema';
