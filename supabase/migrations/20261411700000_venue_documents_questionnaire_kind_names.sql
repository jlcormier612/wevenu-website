-- Venue Documents questionnaire titles: project by event_questionnaires.kind.
-- Canonical names match lib/questionnaire-family/definitions.ts kindLabel():
--   client_planning → Client Planning Questionnaire
--   final_details → Final Details
--   post_event_feedback → Post-Event Feedback
-- No schema change. Does not alter questionnaire rows or statuses.

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
  v_rel_client_id uuid := null;
begin
  if v_venue_id is null then return jsonb_build_object('documents', '[]'::jsonb); end if;

  -- Canonical Lead → Client link only (clients.lead_id). Venue-scoped.
  if p_lead_id is not null then
    select c.id
      into v_rel_client_id
    from public.clients c
    where c.venue_id = v_venue_id
      and c.lead_id = p_lead_id
    limit 1;
  end if;

  return jsonb_build_object(
    'documents', coalesce((
      select jsonb_agg(doc order by (doc->>'createdAt') desc)
      from (
        select distinct on (doc->>'docType', doc->>'id') doc
        from (
        select jsonb_build_object(
          'docType',        'document',
          'id',              d.id,
          'name',            d.name,
          'category',        d.category,
          'status',          null,
          'currentVersion',  1 + (select count(*) from public.document_file_versions v where v.document_id = d.id),
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
          and (
            case
              when p_lead_id is not null then (
                d.lead_id = p_lead_id
                or (v_rel_client_id is not null and d.client_id = v_rel_client_id)
                or (
                  v_rel_client_id is not null
                  and d.event_id is not null
                  and exists (
                    select 1 from public.events e
                    where e.id = d.event_id
                      and e.venue_id = v_venue_id
                      and e.client_id = v_rel_client_id
                  )
                )
              )
              else true
            end
          )
          and (p_client_id is null or d.client_id = p_client_id)
          and (p_event_id  is null or d.event_id  = p_event_id)
          and (p_vendor_id is null or d.vendor_id = p_vendor_id)

        union all

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
          and p_vendor_id is null
          and (
            case
              when p_lead_id is not null then
                v_rel_client_id is not null and c.client_id = v_rel_client_id
              else
                (p_client_id is null or c.client_id = p_client_id)
                and (p_event_id  is null or c.event_id  = p_event_id)
            end
          )

        union all

        select jsonb_build_object(
          'docType',         'invoice',
          'id',               i.id,
          'name',             coalesce(nullif(trim(i.display_name), ''), 'Invoice'),
          'invoiceNumber',    i.invoice_number,
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
          and p_vendor_id is null
          and (
            case
              when p_lead_id is not null then
                v_rel_client_id is not null and i.client_id = v_rel_client_id
              else
                (p_client_id is null or i.client_id = p_client_id)
                and (p_event_id  is null or i.event_id  = p_event_id)
            end
          )

        union all

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
          'relationshipName', (
            select cl.first_name || ' & ' || coalesce(nullif(cl.partner_first_name, ''), cl.last_name)
            from public.events e
            join public.clients cl on cl.id = e.client_id
            where e.id = fp.event_id
          ),
          'eventName',        (select e.name from public.events e where e.id = fp.event_id),
          'fileUrl',          null,
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
          and p_vendor_id is null
          and (
            case
              when p_lead_id is not null then
                v_rel_client_id is not null
                and exists (
                  select 1 from public.events e
                  where e.id = fp.event_id
                    and e.venue_id = v_venue_id
                    and e.client_id = v_rel_client_id
                )
              else
                p_client_id is null
                and (p_event_id is null or fp.event_id = p_event_id)
            end
          )

        union all

        select jsonb_build_object(
          'docType',         'questionnaire',
          'id',               q.id,
          'name',             case q.kind
                                when 'client_planning' then 'Client Planning Questionnaire'
                                when 'final_details' then 'Final Details'
                                when 'post_event_feedback' then 'Post-Event Feedback'
                                else coalesce(nullif(trim(q.kind), ''), 'Questionnaire')
                              end,
          'kind',              q.kind,
          'category',         'questionnaire',
          'status',           q.status,
          'currentVersion',   1,
          'ownerType',        'event',
          'leadId',           null,
          'clientId',         (select e.client_id from public.events e where e.id = q.event_id),
          'eventId',          q.event_id,
          'vendorId',         null,
          'relationshipName', (
            select cl.first_name || ' & ' || coalesce(nullif(cl.partner_first_name, ''), cl.last_name)
            from public.events e
            join public.clients cl on cl.id = e.client_id
            where e.id = q.event_id
          ),
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
          and p_vendor_id is null
          and (
            case
              when p_lead_id is not null then
                v_rel_client_id is not null
                and exists (
                  select 1 from public.events e
                  where e.id = q.event_id
                    and e.venue_id = v_venue_id
                    and e.client_id = v_rel_client_id
                )
              else
                p_client_id is null
                and (p_event_id is null or q.event_id = p_event_id)
            end
          )

        union all

        select jsonb_build_object(
          'docType',         'event_order',
          'id',               eo.id,
          'name',             coalesce(nullif(e.name, ''), 'Event') || ' Event Order',
          'category',         'event_order',
          'status',           case
                                when eo.status = 'finalized' then 'finalized'
                                when eo.shared_at is not null then 'shared'
                                else 'open'
                              end,
          'currentVersion',   greatest(eo.revision, 1),
          'ownerType',        'event',
          'leadId',           null,
          'clientId',         e.client_id,
          'eventId',          eo.event_id,
          'vendorId',         null,
          'relationshipName', (select cl.first_name || ' & ' || coalesce(nullif(cl.partner_first_name, ''), cl.last_name) from public.clients cl where cl.id = e.client_id),
          'eventName',        e.name,
          'fileUrl',          null,
          'fileSize',         null,
          'mimeType',         null,
          'isCoupleVisible',  eo.shared_at is not null,
          'isVendorVisible',  false,
          'uploadedByType',   'venue',
          'hasFinalArtifact', eo.shared_at is not null,
          'createdAt',        eo.created_at,
          'updatedAt',        eo.updated_at
        ) as doc
        from public.event_orders eo
        join public.events e on e.id = eo.event_id
        where eo.venue_id = v_venue_id
          and p_vendor_id is null
          and (
            case
              when p_lead_id is not null then
                v_rel_client_id is not null and e.client_id = v_rel_client_id
              else
                (p_client_id is null or e.client_id = p_client_id)
                and (p_event_id  is null or eo.event_id = p_event_id)
            end
          )

        union all

        select jsonb_build_object(
          'docType',         'client_choices',
          'id',               cc.id,
          'name',             cc.name,
          'category',         'client_choices',
          'status',           cc.status,
          'currentVersion',   greatest((
                                select coalesce(max(s.submission_number), 1)
                                from public.client_choices_submissions s
                                where s.client_choices_id = cc.id
                              ), 1),
          'ownerType',        'event',
          'leadId',           null,
          'clientId',         coalesce(cc.client_id, e.client_id),
          'eventId',          cc.event_id,
          'vendorId',         null,
          'relationshipName', (select cl.first_name || ' & ' || coalesce(nullif(cl.partner_first_name, ''), cl.last_name) from public.clients cl where cl.id = coalesce(cc.client_id, e.client_id)),
          'eventName',        e.name,
          'fileUrl',          null,
          'fileSize',         null,
          'mimeType',         null,
          'isCoupleVisible',  cc.status <> 'draft',
          'isVendorVisible',  false,
          'uploadedByType',   'venue',
          'hasFinalArtifact', cc.status = 'finalized',
          'createdAt',        cc.created_at,
          'updatedAt',        cc.updated_at
        ) as doc
        from public.client_choices cc
        join public.events e on e.id = cc.event_id
        where cc.venue_id = v_venue_id
          and cc.status <> 'draft'
          and p_vendor_id is null
          and (
            case
              when p_lead_id is not null then
                v_rel_client_id is not null
                and coalesce(cc.client_id, e.client_id) = v_rel_client_id
              else
                (p_client_id is null or coalesce(cc.client_id, e.client_id) = p_client_id)
                and (p_event_id  is null or cc.event_id = p_event_id)
            end
          )
        ) producers
        order by doc->>'docType', doc->>'id', (doc->>'createdAt') desc
      ) docs
    ), '[]'::jsonb)
  );
end;
$$;

comment on function public.get_venue_documents(uuid, uuid, uuid, uuid) is
  'Document Workspace union. When p_lead_id is set, resolves clients.lead_id (venue-scoped) and returns the Lead+Client relationship producers (lead files, client contracts/invoices, linked-event producers). Does not use p_lead_id AND p_client_id intersection semantics.';

grant execute on function public.get_venue_documents(uuid, uuid, uuid, uuid) to authenticated;
