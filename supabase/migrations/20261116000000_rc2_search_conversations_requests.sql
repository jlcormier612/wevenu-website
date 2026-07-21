-- ============================================================================
-- RC2 — Messaging & Conversations, Milestone 4: Conversations and Requests
-- join global search.
--
-- "Don't make people choose where to search. One search box." Extends
-- search_global (Sprint 86) with two more branches, following its exact
-- existing conventions (pg_trgm GIN index, lower(...) like predicate, one
-- UNION ALL arm per kind, jsonb_build_object row shape). Conversations
-- search matches message content and resolves up to the conversation
-- itself — never the raw message — since the destination people actually
-- want is the discussion, not one line out of context. A vendor-anchored
-- Conversation deep-links to its Event's Vendors tab (where that thread
-- actually lives, per RC2 Milestone 3); a relationship-anchored one
-- deep-links to /messaging?conversation={id} (RC2 Milestone 4's new
-- deep-link support in ConversationInbox).
--
-- Out of scope for this migration, deliberately: Payments, Timeline items,
-- and Event Orders are not yet searchable, and Couples/Clients search still
-- only exists via the (imperfectly-routed) Lead branch — all real,
-- disclosed gaps against the "one search box for everything" goal, but
-- unrelated to RC2's messaging charter. Documented in the Final Report as
-- a deferred Search Completeness follow-up, not silently dropped.
-- ============================================================================

create index if not exists idx_conversation_messages_search
  on public.conversation_messages using gin ((lower(body)) gin_trgm_ops);

create index if not exists idx_requests_search
  on public.requests using gin (
    (lower(title || ' ' || coalesce(description, ''))) gin_trgm_ops
  );

create or replace function public.search_global(
  p_query text,
  p_limit int default 5
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
  v_term     text;
begin
  select id into v_venue_id
  from public.venues
  where owner_user_id = auth.uid();
  if not found then return jsonb_build_object('error', 'not_found'); end if;

  p_query := trim(p_query);
  if p_query = '' then return jsonb_build_object('results', '[]'::jsonb); end if;

  v_term := '%' || lower(p_query) || '%';

  return jsonb_build_object('results', (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id',       r.id,
        'kind',     r.kind,
        'title',    r.title,
        'subtitle', r.subtitle,
        'link',     r.link,
        'emoji',    r.emoji
      )
      order by r.sort_order, r.title
    ), '[]'::jsonb)
    from (

      -- ── Leads ──────────────────────────────────────────────────────────────
      (select
        'lead'                                                       as kind,
        id::text,
        first_name || ' ' || last_name                               as title,
        coalesce(email, event_type, 'Lead inquiry')                  as subtitle,
        '/leads'                                                     as link,
        '✨'                                                         as emoji,
        1                                                            as sort_order
      from public.leads
      where venue_id = v_venue_id
        and (
          lower(first_name || ' ' || last_name)                     like v_term
          or lower(coalesce(email, ''))                              like v_term
          or lower(coalesce(event_type, ''))                         like v_term
          or lower(coalesce(partner_first_name, '') || ' ' || coalesce(partner_last_name, '')) like v_term
        )
      limit p_limit)

      union all

      -- ── Events ─────────────────────────────────────────────────────────────
      (select
        'event'                                                      as kind,
        e.id::text,
        e.name                                                       as title,
        coalesce(
          c.first_name || ' & ' || c.last_name,
          e.event_type,
          to_char(e.event_date, 'Mon DD, YYYY')
        )                                                            as subtitle,
        '/events/' || e.id::text                                     as link,
        '📅'                                                         as emoji,
        2                                                            as sort_order
      from public.events e
      left join public.clients c on c.id = e.client_id
      where e.venue_id = v_venue_id
        and (
          lower(e.name)                                              like v_term
          or lower(coalesce(e.event_type, ''))                       like v_term
          or lower(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, ''))          like v_term
          or lower(coalesce(c.partner_first_name, '') || ' ' || coalesce(c.partner_last_name, '')) like v_term
        )
      limit p_limit)

      union all

      -- ── Vendors ────────────────────────────────────────────────────────────
      (select
        'vendor'                                                     as kind,
        v.id::text,
        v.business_name                                              as title,
        coalesce(v.category, v.contact_name, 'Vendor')                as subtitle,
        '/vendors/' || v.id::text                                    as link,
        '🤝'                                                         as emoji,
        3                                                            as sort_order
      from public.vendors v
      join public.venue_vendor_relationships vvr
        on vvr.vendor_id = v.id and vvr.venue_id = v_venue_id
      -- Fixed here (RC2, Milestone 4): the original Sprint 86 predicate
      -- referenced vvr.is_active, a column that has never existed on
      -- venue_vendor_relationships (only status: invited/active/inactive),
      -- which broke this ENTIRE function — a bad column reference in any
      -- UNION ALL arm fails the whole query at parse time, not just this
      -- branch. Found while testing this migration's own new branches.
      where vvr.status != 'inactive'
        and (
          lower(v.business_name)                                     like v_term
          or lower(coalesce(v.category, ''))                         like v_term
          or lower(coalesce(v.contact_name, ''))                     like v_term
          or lower(coalesce(v.email, ''))                            like v_term
        )
      limit p_limit)

      union all

      -- ── Guests ─────────────────────────────────────────────────────────────
      (select
        'guest'                                                      as kind,
        g.id::text,
        g.first_name || coalesce(' ' || g.last_name, '')             as title,
        coalesce(g.email, 'Guest')                                   as subtitle,
        coalesce(
          '/events/' || e.id::text || '?tab=final-details',
          '/events'
        )                                                            as link,
        '👥'                                                         as emoji,
        4                                                            as sort_order
      from public.couple_guests g
      left join lateral (
        select id from public.events
        where client_id = g.client_id and venue_id = g.venue_id
        order by event_date asc
        limit 1
      ) e on true
      where g.venue_id = v_venue_id
        and (
          lower(g.first_name || coalesce(' ' || g.last_name, ''))   like v_term
          or lower(coalesce(g.email, ''))                            like v_term
        )
      limit p_limit)

      union all

      -- ── Documents ──────────────────────────────────────────────────────────
      (select
        'document'                                                   as kind,
        d.id::text,
        d.name                                                       as title,
        coalesce(d.category, d.file_name)                            as subtitle,
        coalesce(
          case when d.event_id  is not null then '/events/'  || d.event_id::text  || '?tab=documents' end,
          case when d.lead_id   is not null then '/leads'                                              end,
          '/documents'
        )                                                            as link,
        '📄'                                                         as emoji,
        5                                                            as sort_order
      from public.documents d
      where d.venue_id = v_venue_id
        and (
          lower(d.name)                                              like v_term
          or lower(d.file_name)                                      like v_term
          or lower(coalesce(d.category, ''))                         like v_term
        )
      limit p_limit)

      union all

      -- ── Tasks ──────────────────────────────────────────────────────────────
      (select
        'task'                                                       as kind,
        t.id::text,
        t.title                                                      as title,
        coalesce(e.name, t.category, 'Task')                         as subtitle,
        '/events/' || t.event_id::text || '?tab=playbook'           as link,
        '✅'                                                         as emoji,
        6                                                            as sort_order
      from public.event_tasks t
      left join public.events e on e.id = t.event_id
      where t.venue_id = v_venue_id
        and (
          lower(t.title)                                             like v_term
          or lower(coalesce(t.description, ''))                      like v_term
        )
      limit p_limit)

      union all

      -- ── Conversations — RC2, Milestone 4 ──────────────────────────────────
      -- Matches message content, resolved up to one result per Conversation
      -- (most recent matching message), never a raw message row. A
      -- relationship-anchored Conversation deep-links into the Inbox; a
      -- vendor-anchored one deep-links to its Event's Vendors tab, matching
      -- where each type's thread actually lives.
      (select
        'conversation'                                               as kind,
        x.id,
        x.title,
        x.subtitle,
        x.link,
        '💬'                                                         as emoji,
        7                                                            as sort_order
      from (
        select distinct on (c.id)
          c.id::text                                                 as id,
          coalesce(rel.title, ven.title, 'Conversation')              as title,
          left(cm.body, 100)                                          as subtitle,
          coalesce(rel.link, ven.link, '/messaging')                  as link,
          cm.sent_at
        from public.conversation_messages cm
        join public.conversations c on c.id = cm.conversation_id
        -- Matched via clients.relationship_id directly (Phase 2B), not
        -- through a lead join — see 20261117000000's fix to
        -- get_conversation_inbox for why the lead-join form silently
        -- produces nothing for a client created without a Lead row.
        left join lateral (
          select
            coalesce(
              (select cl.first_name || coalesce(' ' || cl.last_name, '') || coalesce(' & ' || cl.partner_first_name, '')
                 from public.clients cl
                where cl.relationship_id = c.relationship_id
                order by cl.created_at desc limit 1),
              (select l.first_name || coalesce(' ' || l.last_name, '') || coalesce(' & ' || l.partner_first_name, '')
                 from public.leads l where l.relationship_id = c.relationship_id
                order by l.created_at desc limit 1)
            )                                                        as title,
            '/messaging?conversation=' || c.id::text                 as link
          where c.relationship_id is not null
        ) rel on true
        left join lateral (
          select
            v.business_name || ' — ' || e.name                       as title,
            '/events/' || e.id::text || '#vendors'                   as link
          from public.event_vendor_assignments eva
          join public.vendors v on v.id = eva.vendor_id
          join public.events e on e.id = eva.event_id
          where eva.id = c.event_vendor_assignment_id
        ) ven on true
        where c.venue_id = v_venue_id
          and lower(cm.body) like v_term
        order by c.id, cm.sent_at desc
      ) x
      limit p_limit)

      union all

      -- ── Requests — RC2, Milestone 4 ───────────────────────────────────────
      (select
        'request'                                                    as kind,
        r.id::text,
        r.title                                                      as title,
        coalesce(
          cl.first_name || coalesce(' & ' || cl.partner_first_name, ''),
          initcap(replace(r.status, '_', ' '))
        )                                                            as subtitle,
        '/requests/' || r.id::text                                   as link,
        '📋'                                                         as emoji,
        8                                                            as sort_order
      from public.requests r
      left join public.clients cl on cl.id = r.client_id
      where r.venue_id = v_venue_id
        and (
          lower(r.title)                                             like v_term
          or lower(coalesce(r.description, ''))                      like v_term
        )
      limit p_limit)

    ) r
  ));
end;
$$;

grant execute on function public.search_global(text, int) to authenticated;

notify pgrst, 'reload schema';
