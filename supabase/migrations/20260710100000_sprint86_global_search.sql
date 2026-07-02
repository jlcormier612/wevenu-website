-- ============================================================================
-- Sprint 86: Global Search
--
-- search_global(p_query, p_limit) — searches 6 entity types for the venue:
--   leads · events · vendors · guests · documents · tasks
--
-- Returns up to p_limit results per type, grouped by kind with deep links.
-- Uses pg_trgm for fuzzy matching (GIN indexes keep it fast at scale).
-- ============================================================================

-- pg_trgm ships with Supabase; enable if not already active.
create extension if not exists pg_trgm;

-- ── GIN indexes for trigram search ───────────────────────────────────────────
-- Only created if they don't exist, safe to re-run.

create index if not exists idx_leads_search
  on public.leads using gin (
    (lower(first_name || ' ' || last_name || ' ' || coalesce(email, '') || ' ' || coalesce(event_type, ''))) gin_trgm_ops
  );

create index if not exists idx_events_search
  on public.events using gin (
    (lower(name || ' ' || coalesce(event_type, ''))) gin_trgm_ops
  );

create index if not exists idx_vendors_search
  on public.vendors using gin (
    (lower(name || ' ' || coalesce(category, '') || ' ' || coalesce(contact_name, ''))) gin_trgm_ops
  );

create index if not exists idx_couple_guests_search
  on public.couple_guests using gin (
    (lower(first_name || ' ' || coalesce(last_name, '') || ' ' || coalesce(email, ''))) gin_trgm_ops
  );

create index if not exists idx_documents_search
  on public.documents using gin (
    (lower(name || ' ' || file_name)) gin_trgm_ops
  );

create index if not exists idx_event_tasks_search
  on public.event_tasks using gin (
    (lower(title || ' ' || coalesce(description, ''))) gin_trgm_ops
  );


-- ── search_global ─────────────────────────────────────────────────────────────

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
        id::text,
        name                                                         as title,
        coalesce(category, contact_name, 'Vendor')                   as subtitle,
        '/vendors/' || id::text                                      as link,
        '🤝'                                                         as emoji,
        3                                                            as sort_order
      from public.vendors
      where venue_id = v_venue_id
        and (
          lower(name)                                                like v_term
          or lower(coalesce(category, ''))                           like v_term
          or lower(coalesce(contact_name, ''))                       like v_term
          or lower(coalesce(email, ''))                              like v_term
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

    ) r
  ));
end;
$$;

grant execute on function public.search_global(text, int) to authenticated;


notify pgrst, 'reload schema';
