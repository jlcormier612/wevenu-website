-- Couple documents and portal payments use invoices.display_name.
-- invoice_number stays the secondary system reference. No new table or column.

create or replace function public.get_couple_documents(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids record;
begin
  select * into v_ids from _resolve_portal_ids(p_token);
  if v_ids.client_id is null then return null; end if;

  return jsonb_build_object(
    'documents', coalesce((
      select jsonb_agg(doc order by (doc->>'createdAt') desc)
      from (
        select jsonb_build_object(
          'id',          c.id,
          'docType',     'contract',
          'name',        coalesce(nullif(trim(c.title),''), 'Venue Contract'),
          'status',      c.status,
          'signedAt',    c.signed_at,
          'amount',      null,
          'fileUrl',     (
            select d.storage_url
            from public.documents d
            where d.is_couple_visible = true
              and d.category = 'contract'
              and d.storage_url is not null
              and (
                (c.event_id is not null and d.event_id = c.event_id)
                or d.client_id = c.client_id
              )
            order by d.created_at desc
            limit 1
          ),
          'content',     c.content,
          'signToken',   case when c.status not in ('signed') then c.sign_token else null end,
          'uploadedBy',  'venue',
          'createdAt',   c.created_at
        )
        from contracts c
        where c.client_id = v_ids.client_id
          and c.is_couple_visible = true

        union all

        select jsonb_build_object(
          'id',         i.id,
          'docType',    'invoice',
          'name',          coalesce(nullif(trim(i.display_name), ''), 'Invoice'),
          'invoiceNumber', i.invoice_number,
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

        union all

        select jsonb_build_object(
          'id',          cc.id,
          'docType',     'client_choices',
          'name',        cc.name,
          'status',      cc.status,
          'signedAt',    null,
          'amount',      null,
          'fileUrl',     null,
          'uploadedBy',  'venue',
          'vendorName',  null,
          'createdAt',   coalesce(cc.finalized_at, cc.submitted_at, cc.sent_at, cc.created_at)
        )
        from public.client_choices cc
        where cc.status = 'finalized'
          and (
            (v_ids.event_id is not null and cc.event_id = v_ids.event_id)
            or cc.client_id = v_ids.client_id
          )
      ) docs(doc)
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.get_couple_documents(text) to anon, authenticated;

create or replace function public.get_portal_payments(p_token text)
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
    and (expires_at is null or expires_at > now())
  limit 1;

  if v_session.id is null then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  if v_session.access_level = 'planning' then
    return jsonb_build_object('schedules', '[]'::jsonb, 'invoices', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'schedules', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id',          ps.id,
            'title',       ps.title,
            'totalAmount', ps.total_amount,
            'currency',    ps.currency,
            'notes',       ps.notes,
            'invoiceId',     ps.invoice_id,
            'displayName',   ps.invoice_display_name,
            'invoiceNumber', ps.invoice_number,
            'createdAt',     ps.created_at,
            'lineItems', (
              select coalesce(
                jsonb_agg(
                  jsonb_build_object(
                    'id',             pli.id,
                    'label',          pli.label,
                    'amount',         pli.amount,
                    'dueDate',        pli.due_date,
                    'status',         pli.status,
                    'paidAt',         pli.paid_at,
                    'paidAmount',     pli.paid_amount,
                    'refundedAmount', coalesce(pli.refunded_amount, 0),
                    'paymentMethod',  pli.payment_method,
                    'obligationKind', pli.obligation_kind,
                    'sortOrder',      pli.sort_order
                  )
                  order by pli.sort_order, pli.due_date nulls last
                ),
                '[]'::jsonb
              )
              from public.payment_line_items pli
              where pli.schedule_id = ps.id
                and pli.venue_id    = v_session.venue_id
                and pli.status     != 'cancelled'
            )
          )
          order by ps.created_at desc
        ),
        '[]'::jsonb
      )
      from (
        select distinct on (coalesce(ps0.invoice_id, ps0.id))
          ps0.*,
          inv.display_name as invoice_display_name,
          inv.invoice_number as invoice_number
        from public.payment_schedules ps0
        left join public.invoices inv on inv.id = ps0.invoice_id
        where ps0.client_id = v_session.client_id
          and ps0.venue_id  = v_session.venue_id
          and (ps0.invoice_id is null or inv.status != 'draft')
        order by coalesce(ps0.invoice_id, ps0.id), ps0.created_at desc, ps0.id desc
      ) ps
    ),
    'invoices', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id',            inv.id,
            'invoiceNumber', inv.invoice_number,
            'displayName',   inv.display_name,
            'dueDate',       inv.due_date,
            'total',         inv.total,
            'balanceDue',    inv.balance_due,
            'status',        inv.status
          )
          order by inv.created_at desc
        ),
        '[]'::jsonb
      )
      from public.invoices inv
      where inv.client_id = v_session.client_id
        and inv.venue_id  = v_session.venue_id
        and inv.status   != 'draft'
    )
  );
end;
$$;

grant execute on function public.get_portal_payments(text) to anon, authenticated;

notify pgrst, 'reload schema';
