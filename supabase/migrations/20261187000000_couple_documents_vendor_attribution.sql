-- ============================================================================
-- Couple documents: attribute vendor-shared `documents` rows correctly.
--
-- Vendor Documents V1 writes into public.documents with uploaded_by_type =
-- 'vendor' and is_couple_visible when shared with the couple. get_couple_documents
-- previously hardcoded uploadedBy: 'venue' for all documents rows, so the portal
-- labeled COIs / task lists etc. as "From Your Venue".
--
-- Visibility for vendor event docs uses event_id (already set on share). Do NOT
-- stamp client_id — documents_one_entity allows at most one of
-- lead_id/client_id/event_id/vendor_id, and vendor shares already set event_id.
-- share_vendor_document_to_event is intentionally left unchanged (constraint-safe
-- version from 20261177000000_vendor_documents.sql).
-- ============================================================================

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

        -- Venue / vendor documents explicitly shared with this couple
        -- (contracts category excluded — the real Contract entity above
        -- already covers that). Vendor-authored rows (uploaded_by_type =
        -- 'vendor') are attributed as uploadedBy='vendor' with vendorName.
        select jsonb_build_object(
          'id',          d.id,
          'docType',     coalesce(d.category, 'other'),
          'name',        d.name,
          'status',      null,
          'signedAt',    null,
          'amount',      null,
          'fileUrl',     d.storage_url,
          'fileSize',    d.file_size,
          'mimeType',    d.mime_type,
          'uploadedBy',  case
            when d.uploaded_by_type = 'vendor' then 'vendor'
            else 'venue'
          end,
          'vendorName',  case
            when d.uploaded_by_type = 'vendor' then coalesce((
              select nullif(trim(vnd.business_name), '')
              from public.vendors vnd
              where vnd.id = d.uploaded_by_id
            ), 'Vendor')
            else null
          end,
          'createdAt',   d.created_at
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
          'vendorName',      null,
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
