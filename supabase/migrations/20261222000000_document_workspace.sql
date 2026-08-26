-- ============================================================================
-- Work Package D1 — Canonical Document Workspace
--
-- Per docs/document-workspace-inventory.md. This is the customer-facing
-- experience layer only: no producer migration, no Document Domain change,
-- no schema change to contracts/invoices/documents/floor_plans/
-- event_questionnaires. Everything below is additive:
--
--   1. get_venue_documents() — a new, read-only aggregation RPC. It unions
--      the five existing venue-side producers (documents, contracts,
--      invoices, floor_plans, event_questionnaires) into one normalized
--      shape, exactly the way the existing get_couple_documents() already
--      does for the portal — same pattern, venue-scoped instead of
--      couple-scoped, and covering more producers because the venue side
--      has more to show. It reads; it writes nothing.
--
--   2. document_workspace_pins / document_workspace_interactions — two
--      small new tables. Neither exists today under any name (confirmed in
--      the Step 1 inventory), and neither is optional: "Recent Documents,
--      ordered by most recently interacted with" and "Pinned Documents,
--      venue-controlled, always visible" cannot be real, multi-user,
--      durable features without persisting *something* — the alternative
--      is faking them client-side, which would reset per session and lie
--      about what "recent" means. These are workspace UI state only; they
--      carry a document's type+id as a loose reference (no FK into any
--      producer table, since a "document" here can come from five
--      different tables) and nothing else.
-- ============================================================================

-- ── document_workspace_pins ────────────────────────────────────────────────

create table if not exists public.document_workspace_pins (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues (id) on delete cascade,
  doc_type    text not null check (doc_type in ('document', 'contract', 'invoice', 'floor_plan', 'questionnaire')),
  doc_id      uuid not null,
  pinned_by   uuid references auth.users (id) on delete set null,
  pinned_at   timestamptz not null default now(),
  unique (venue_id, doc_type, doc_id)
);

create index if not exists document_workspace_pins_venue on public.document_workspace_pins (venue_id, pinned_at desc);

alter table public.document_workspace_pins enable row level security;

drop policy if exists document_workspace_pins_all on public.document_workspace_pins;
create policy document_workspace_pins_all on public.document_workspace_pins
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, delete on public.document_workspace_pins to authenticated;

-- ── document_workspace_interactions ────────────────────────────────────────
-- Insert-only log. "Viewed"/"Downloaded"/"Shared" in the Document Activity
-- feed (Step 2 §Section 5) come from here; "Generated"/"Uploaded"/"Edited"/
-- "Signed" are derived from each producer's own real timestamps/status —
-- this table only covers the three interaction types no producer tracks.

create table if not exists public.document_workspace_interactions (
  id            uuid primary key default gen_random_uuid(),
  venue_id      uuid not null references public.venues (id) on delete cascade,
  doc_type      text not null check (doc_type in ('document', 'contract', 'invoice', 'floor_plan', 'questionnaire')),
  doc_id        uuid not null,
  action        text not null check (action in ('viewed', 'downloaded', 'shared')),
  actor_user_id uuid references auth.users (id) on delete set null,
  occurred_at   timestamptz not null default now()
);

create index if not exists document_workspace_interactions_venue on public.document_workspace_interactions (venue_id, occurred_at desc);
create index if not exists document_workspace_interactions_doc   on public.document_workspace_interactions (venue_id, doc_type, doc_id, occurred_at desc);

alter table public.document_workspace_interactions enable row level security;

drop policy if exists document_workspace_interactions_select on public.document_workspace_interactions;
create policy document_workspace_interactions_select on public.document_workspace_interactions
  for select
  using (venue_id = public.current_user_venue_id());

drop policy if exists document_workspace_interactions_insert on public.document_workspace_interactions;
create policy document_workspace_interactions_insert on public.document_workspace_interactions
  for insert
  with check (venue_id = public.current_user_venue_id());

grant select, insert on public.document_workspace_interactions to authenticated;

-- ── get_venue_documents() ──────────────────────────────────────────────────
-- security definer, no caller-supplied venue_id (matches every sibling
-- analytics/aggregation RPC in this codebase — current_user_venue_id()
-- derives the venue from the session, never from a parameter). Optional
-- entity filters narrow the same one query to a Relationship Workspace
-- (lead/client/vendor) or an Event view — "the Relationship Workspace is a
-- filtered view, not another document system" (brief, Step 6).
--
-- Contracts/invoices only ever have client_id/event_id (never lead_id or
-- vendor_id — confirmed against their actual schema); floor_plans and
-- event_questionnaires only ever have event_id. Passing p_lead_id or
-- p_vendor_id therefore correctly excludes those three producers from the
-- result rather than guessing a join that doesn't exist.

create or replace function public.get_venue_documents(
  p_lead_id   uuid default null,
  p_client_id uuid default null,
  p_event_id  uuid default null,
  p_vendor_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_venue_id uuid := public.current_user_venue_id();
begin
  if v_venue_id is null then return jsonb_build_object('documents', '[]'::jsonb); end if;

  return jsonb_build_object(
    'documents', coalesce((
      select jsonb_agg(doc order by (doc->>'createdAt') desc)
      from (
        -- Generic uploads (contracts/insurance/inspiration/floor plans/
        -- menus/permits/questionnaire copies/invoice copies/other) —
        -- lead, client, event, or vendor scoped.
        select jsonb_build_object(
          'docType',        'document',
          'id',              d.id,
          'name',            d.name,
          'category',        d.category,
          'status',          null,
          'currentVersion',  1,
          'ownerType',       case
                                when d.lead_id   is not null then 'lead'
                                when d.client_id is not null then 'client'
                                when d.event_id  is not null then 'event'
                                when d.vendor_id is not null then 'vendor'
                                else 'venue'
                              end,
          'leadId',          d.lead_id,
          'clientId',        d.client_id,
          'eventId',         d.event_id,
          'vendorId',        d.vendor_id,
          'relationshipName', coalesce(
                                (select l.first_name || ' & ' || coalesce(nullif(l.partner_first_name, ''), l.last_name) from public.leads l where l.id = d.lead_id),
                                (select c.first_name || ' & ' || coalesce(nullif(c.partner_first_name, ''), c.last_name) from public.clients c where c.id = d.client_id),
                                (select v.business_name from public.vendors v where v.id = d.vendor_id)
                              ),
          'eventName',       (select e.name from public.events e where e.id = d.event_id),
          'fileUrl',         d.storage_url,
          'fileSize',        d.file_size,
          'mimeType',        d.mime_type,
          'isCoupleVisible', d.is_couple_visible,
          'isVendorVisible', d.shared_with_vendors,
          'uploadedByType',  d.uploaded_by_type,
          'createdAt',       d.created_at,
          'updatedAt',       d.updated_at
        ) as doc
        from public.documents d
        where d.venue_id = v_venue_id
          and (p_lead_id   is null or d.lead_id   = p_lead_id)
          and (p_client_id is null or d.client_id = p_client_id)
          and (p_event_id  is null or d.event_id  = p_event_id)
          and (p_vendor_id is null or d.vendor_id = p_vendor_id)

        union all

        -- Contracts — client/event scoped only.
        select jsonb_build_object(
          'docType',         'contract',
          'id',               c.id,
          'name',             c.title,
          'category',         'contract',
          'status',           c.status,
          'currentVersion',   1,
          'ownerType',        case when c.event_id is not null then 'event' else 'client' end,
          'leadId',           null,
          'clientId',         c.client_id,
          'eventId',          c.event_id,
          'vendorId',         null,
          'relationshipName', (select cl.first_name || ' & ' || coalesce(nullif(cl.partner_first_name, ''), cl.last_name) from public.clients cl where cl.id = c.client_id),
          'eventName',        (select e.name from public.events e where e.id = c.event_id),
          'fileUrl',          null,
          'fileSize',         null,
          'mimeType',         null,
          'isCoupleVisible',  c.is_couple_visible,
          'isVendorVisible',  false,
          'uploadedByType',   'venue',
          'signToken',        case when c.status <> 'signed' then c.sign_token else null end,
          'signedAt',         c.signed_at,
          'createdAt',        c.created_at,
          'updatedAt',        c.updated_at
        ) as doc
        from public.contracts c
        where c.venue_id = v_venue_id
          and p_lead_id is null and p_vendor_id is null
          and (p_client_id is null or c.client_id = p_client_id)
          and (p_event_id  is null or c.event_id  = p_event_id)

        union all

        -- Invoices — client/event scoped only.
        select jsonb_build_object(
          'docType',         'invoice',
          'id',               i.id,
          'name',             'Invoice ' || coalesce(i.invoice_number, '#'),
          'category',         'invoice',
          'status',           i.status,
          'currentVersion',   1,
          'ownerType',        case when i.event_id is not null then 'event' else 'client' end,
          'leadId',           null,
          'clientId',         i.client_id,
          'eventId',          i.event_id,
          'vendorId',         null,
          'relationshipName', (select cl.first_name || ' & ' || coalesce(nullif(cl.partner_first_name, ''), cl.last_name) from public.clients cl where cl.id = i.client_id),
          'eventName',        (select e.name from public.events e where e.id = i.event_id),
          'fileUrl',          null,
          'fileSize',         null,
          'mimeType',         null,
          'isCoupleVisible',  i.is_couple_visible,
          'isVendorVisible',  false,
          'uploadedByType',   'venue',
          'amount',           i.total,
          'balanceDue',       i.balance_due,
          'createdAt',        i.created_at,
          'updatedAt',        i.updated_at
        ) as doc
        from public.invoices i
        where i.venue_id = v_venue_id
          and p_lead_id is null and p_vendor_id is null
          and (p_client_id is null or i.client_id = p_client_id)
          and (p_event_id  is null or i.event_id  = p_event_id)

        union all

        -- Floor plans — event scoped only, one per event.
        select jsonb_build_object(
          'docType',         'floor_plan',
          'id',               fp.id,
          'name',             fp.name,
          'category',         'floor_plan',
          'status',           null,
          'currentVersion',   1,
          'ownerType',        'event',
          'leadId',           null,
          'clientId',         null,
          'eventId',          fp.event_id,
          'vendorId',         null,
          'relationshipName', null,
          'eventName',        (select e.name from public.events e where e.id = fp.event_id),
          'fileUrl',          fp.background_image_url,
          'fileSize',         null,
          'mimeType',         null,
          'isCoupleVisible',  false,
          'isVendorVisible',  true,
          'uploadedByType',   'venue',
          'createdAt',        fp.created_at,
          'updatedAt',        fp.updated_at
        ) as doc
        from public.floor_plans fp
        where fp.venue_id = v_venue_id
          and p_lead_id is null and p_client_id is null and p_vendor_id is null
          and (p_event_id is null or fp.event_id = p_event_id)

        union all

        -- Questionnaires — event scoped only. Draft (never sent) excluded —
        -- nothing to show yet, matches SentRequestedSection's own filter.
        select jsonb_build_object(
          'docType',         'questionnaire',
          'id',               q.id,
          'name',             'Final Details Questionnaire',
          'category',         'questionnaire',
          'status',           q.status,
          'currentVersion',   1,
          'ownerType',        'event',
          'leadId',           null,
          'clientId',         null,
          'eventId',          q.event_id,
          'vendorId',         null,
          'relationshipName', null,
          'eventName',        (select e.name from public.events e where e.id = q.event_id),
          'fileUrl',          null,
          'fileSize',         null,
          'mimeType',         null,
          'isCoupleVisible',  true,
          'isVendorVisible',  false,
          'uploadedByType',   'venue',
          'createdAt',        q.created_at,
          'updatedAt',        q.updated_at
        ) as doc
        from public.event_questionnaires q
        where q.venue_id = v_venue_id
          and q.status <> 'draft'
          and p_lead_id is null and p_client_id is null and p_vendor_id is null
          and (p_event_id is null or q.event_id = p_event_id)
      ) docs
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.get_venue_documents(uuid, uuid, uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
