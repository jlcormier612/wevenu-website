-- ============================================================================
-- Client Collaboration Workspace — Documents unification (2026-07-22).
--
-- Per the architecture reconciliation: "the venue assigns a Contract → it
-- automatically appears in Documents," "the venue shares documents → they
-- automatically appear in Documents." Before this, get_couple_documents
-- returned contracts/invoices as inert summary rows (fileUrl always null,
-- no line items) and never queried the venue's real `documents` table at
-- all — confirmed live in the architecture assessment, not assumed.
-- ============================================================================

-- ── documents.is_couple_visible — same pattern as contracts/invoices ───────
-- Mirrors contracts.is_couple_visible / invoices.is_couple_visible exactly:
-- a venue-authored document is private by default; the venue explicitly
-- shares it. Reuses the existing `documents` table as the source of truth
-- (per "do not build parallel client-side systems") rather than requiring
-- every share to be copied into couple_documents.
alter table public.documents
  add column is_couple_visible boolean not null default false;

create index documents_couple_visible on public.documents (client_id, event_id) where is_couple_visible = true;

-- ── get_couple_documents — rebuilt with real content, not stub rows ────────
create or replace function public.get_couple_documents(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_ids record;
begin
  select * into v_ids from _resolve_portal_ids(p_token);
  if v_ids.client_id is null then return null; end if;

  return jsonb_build_object(
    'documents', coalesce((
      select jsonb_agg(doc order by (doc->>'createdAt') desc)
      from (
        -- Contracts shared by the venue — real content + sign link, not a
        -- stub row. A contract becomes couple-visible the moment it's sent
        -- (existing is_couple_visible-on-send behavior, unchanged here).
        select jsonb_build_object(
          'id',          c.id,
          'docType',     'contract',
          'name',        coalesce(nullif(trim(c.title),''), 'Venue Contract'),
          'status',      c.status,
          'signedAt',    c.signed_at,
          'amount',      null,
          'fileUrl',     null,
          'content',     c.content,
          'signToken',   case when c.status not in ('signed') then c.sign_token else null end,
          'uploadedBy',  'venue',
          'createdAt',   c.created_at
        )
        from contracts c
        where c.client_id = v_ids.client_id
          and c.is_couple_visible = true

        union all

        -- Invoices shared by the venue — real line items, not a stub row.
        select jsonb_build_object(
          'id',         i.id,
          'docType',    'invoice',
          'name',       'Invoice ' || coalesce(i.invoice_number, '#'),
          'status',     i.status,
          'signedAt',   null,
          'amount',     i.total,
          'balanceDue', i.balance_due,
          'fileUrl',    null,
          'lineItems', (
            select coalesce(jsonb_agg(jsonb_build_object(
              'id', li.id, 'description', li.description, 'quantity', li.quantity,
              'unitPrice', li.unit_price, 'amount', li.amount, 'type', li.type
            ) order by li.sort_order), '[]'::jsonb)
            from invoice_line_items li
            where li.invoice_id = i.id
          ),
          'uploadedBy', 'venue',
          'createdAt',  i.created_at
        )
        from invoices i
        where i.client_id = v_ids.client_id
          and i.is_couple_visible = true

        union all

        -- Venue documents explicitly shared with this couple (contracts
        -- category excluded — the real Contract entity above already
        -- covers that; this is everything else: floor plans, planning
        -- guides, brochures, insurance, permits, etc).
        select jsonb_build_object(
          'id',         d.id,
          'docType',    coalesce(d.category, 'other'),
          'name',       d.name,
          'status',     null,
          'signedAt',   null,
          'amount',     null,
          'fileUrl',    d.storage_url,
          'fileSize',   d.file_size,
          'mimeType',   d.mime_type,
          'uploadedBy', 'venue',
          'createdAt',  d.created_at
        )
        from documents d
        where d.is_couple_visible = true
          and (d.client_id = v_ids.client_id or (v_ids.event_id is not null and d.event_id = v_ids.event_id))
          and d.category != 'contract'

        union all

        -- Couple-uploaded or venue-shared documents (the couple's own
        -- uploads, plus anything routed through the older couple_documents
        -- path — kept for backward compatibility, not the primary venue
        -- share path going forward, which is documents.is_couple_visible above).
        select jsonb_build_object(
          'id',              cd.id,
          'docType',         coalesce(cd.source_type, 'upload'),
          'name',            cd.name,
          'status',          null,
          'signedAt',        null,
          'amount',          null,
          'fileUrl',         cd.file_url,
          'fileSize',        cd.file_size,
          'mimeType',        cd.mime_type,
          'uploadedBy',      cd.uploaded_by,
          'shareWithVenue',  cd.share_with_venue,
          'createdAt',       cd.created_at
        )
        from couple_documents cd
        where cd.client_id = v_ids.client_id
      ) docs(doc)
    ), '[]'::jsonb)
  );
end;
$$;

notify pgrst, 'reload schema';
