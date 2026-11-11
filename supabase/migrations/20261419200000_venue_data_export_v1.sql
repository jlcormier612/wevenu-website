-- Venue data export v1.
-- Owner and Administrator may export. Other active members may export only
-- when capability_overrides.data.export is true. Every collection is scoped
-- to the active venue. Secret keys are removed before the payload is returned.
-- Couple websites, couple-entered planning rows, Luv, and platform CRM tables
-- are not queried.

create or replace function public.venue_export_redact(p_value jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  k text;
  v jsonb;
  elem jsonb;
  out jsonb;
  forbidden text[] := array[
    'stripe_account_id', 'embed_key', 'tour_embed_key', 'sign_token',
    'access_token', 'refresh_token', 'user_access_token', 'page_access_token',
    'client_secret', 'api_key', 'webhook_secret', 'password', 'password_hash',
    'secret_key', 'token', 'luv_draft_id'
  ];
begin
  if p_value is null then
    return null;
  elsif jsonb_typeof(p_value) = 'object' then
    out := '{}'::jsonb;
    for k, v in select key, value from jsonb_each(p_value) loop
      if k = any (forbidden) then
        continue;
      end if;
      out := out || jsonb_build_object(k, public.venue_export_redact(v));
    end loop;
    return out;
  elsif jsonb_typeof(p_value) = 'array' then
    out := '[]'::jsonb;
    for elem in select value from jsonb_array_elements(p_value) loop
      out := out || jsonb_build_array(public.venue_export_redact(elem));
    end loop;
    return out;
  end if;
  return p_value;
end;
$$;

create or replace function public.venue_export_allowed(p_venue_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s public.venue_staff%rowtype;
  basis text;
begin
  if p_venue_id is null or p_venue_id is distinct from public.current_user_venue_id() then
    return false;
  end if;

  select * into s
  from public.venue_staff
  where user_id = auth.uid()
    and venue_id = p_venue_id
    and is_active = true
    and accepted_at is not null;
  if not found then
    return false;
  end if;

  if s.is_owner is true then
    return true;
  end if;

  basis := case
    when s.access_title = 'custom' then s.title_basis
    else s.access_title
  end;
  if basis = 'administrator' then
    return true;
  end if;

  return coalesce(
    (coalesce(s.capability_overrides, '{}'::jsonb)->'data.export') = 'true'::jsonb,
    false
  );
end;
$$;

create or replace function public.get_venue_export(p_venue_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb := '{}'::jsonb;
  spec record;
  chunk jsonb;
begin
  if not public.venue_export_allowed(p_venue_id) then
    return jsonb_build_object('error', 'not_authorized');
  end if;

  for spec in
    select * from (values
      ('venues', 'id'),
      ('venue_business_hours', 'venue_id'),
      ('venue_spaces', 'venue_id'),
      ('venue_capacity_rules', 'venue_id'),
      ('venue_operational_info', 'venue_id'),
      ('venue_schedule_item_types', 'venue_id'),
      ('venue_reminder_cadence', 'venue_id'),
      ('venue_notification_preferences', 'venue_id'),
      ('venue_required_vendor_categories', 'venue_id'),
      ('tour_availability_windows', 'venue_id'),
      ('tour_availability_exceptions', 'venue_id'),
      ('calendar_blocks', 'venue_id'),
      ('date_holds', 'venue_id'),
      ('date_hold_spaces', 'venue_id'),
      ('venue_lead_capture_channels', 'venue_id'),
      ('public_forms', 'venue_id'),
      ('public_form_questions', 'venue_id'),
      ('inquiry_form_questions', 'venue_id'),
      ('clients', 'venue_id'),
      ('client_contacts', 'venue_id'),
      ('client_notes', 'venue_id'),
      ('client_activities', 'venue_id'),
      ('client_media', 'venue_id'),
      ('client_invitations', 'venue_id'),
      ('leads', 'venue_id'),
      ('lead_notes', 'venue_id'),
      ('lead_activities', 'venue_id'),
      ('lead_tasks', 'venue_id'),
      ('lead_event_space_preferences', 'venue_id'),
      ('events', 'venue_id'),
      ('event_notes', 'venue_id'),
      ('event_activities', 'venue_id'),
      ('event_space_assignments', 'venue_id'),
      ('event_team', 'venue_id'),
      ('event_setup_states', 'venue_id'),
      ('event_inventory', 'venue_id'),
      ('event_inventory_items', 'venue_id'),
      ('event_orders', 'venue_id'),
      ('event_order_lines', 'venue_id'),
      ('event_order_sections', 'venue_id'),
      ('event_order_activities', 'venue_id'),
      ('event_order_share_snapshots', 'venue_id'),
      ('event_order_templates', 'venue_id'),
      ('event_order_template_groups', 'venue_id'),
      ('event_order_template_sections', 'venue_id'),
      ('event_order_template_lines', 'venue_id'),
      ('event_order_template_options', 'venue_id'),
      ('packages', 'venue_id'),
      ('package_items', 'venue_id'),
      ('offerings', 'venue_id'),
      ('offering_categories', 'venue_id'),
      ('inventory_items', 'venue_id'),
      ('inventory_categories', 'venue_id'),
      ('inventory_templates', 'venue_id'),
      ('inventory_template_items', 'venue_id'),
      ('contracts', 'venue_id'),
      ('contract_signers', 'venue_id'),
      ('contract_templates', 'venue_id'),
      ('contract_activities', 'venue_id'),
      ('invoices', 'venue_id'),
      ('invoice_line_items', 'venue_id'),
      ('invoice_activities', 'venue_id'),
      ('payment_schedules', 'venue_id'),
      ('payment_line_items', 'venue_id'),
      ('payment_activities', 'venue_id'),
      ('vendors', 'venue_id'),
      ('venue_vendor_relationships', 'venue_id'),
      ('event_vendor_assignments', 'venue_id'),
      ('event_vendor_recommendations', 'venue_id'),
      ('vendor_inquiries', 'venue_id'),
      ('timeline_templates', 'venue_id'),
      ('timeline_template_items', 'venue_id'),
      ('timeline_sections', 'venue_id'),
      ('timeline_entries', 'venue_id'),
      ('timeline_entry_links', 'venue_id'),
      ('timeline_entry_attachments', 'venue_id'),
      ('timeline_entry_context_links', 'venue_id'),
      ('event_tasks', 'venue_id'),
      ('event_task_context_links', 'venue_id'),
      ('task_reminders', 'venue_id'),
      ('playbook_templates', 'venue_id'),
      ('playbook_tasks', 'venue_id'),
      ('playbook_milestones', 'venue_id'),
      ('playbook_task_attachments', 'venue_id'),
      ('event_playbook_applications', 'venue_id'),
      ('questionnaire_templates', 'venue_id'),
      ('conversations', 'venue_id'),
      ('conversation_messages', 'venue_id'),
      ('conversation_participants', 'venue_id'),
      ('messages', 'venue_id'),
      ('message_threads', 'venue_id'),
      ('message_thread_participants', 'venue_id'),
      ('message_events', 'venue_id'),
      ('message_attachments', 'venue_id'),
      ('scheduled_messages', 'venue_id'),
      ('message_templates', 'venue_id'),
      ('message_template_attachments', 'venue_id'),
      ('message_sequences', 'venue_id'),
      ('sequence_steps', 'venue_id'),
      ('sequence_enrollments', 'venue_id'),
      ('documents', 'venue_id'),
      ('document_file_versions', 'venue_id'),
      ('floor_plans', 'venue_id'),
      ('floor_plan_objects', 'venue_id'),
      ('floor_plan_templates', 'venue_id'),
      ('floor_plan_template_objects', 'venue_id'),
      ('venue_staff', 'venue_id'),
      ('quickbooks_connections', 'venue_id'),
      ('facebook_connections', 'venue_id'),
      ('venue_twilio_accounts', 'venue_id')
    ) as t(table_name, scope_column)
  loop
    if spec.table_name = 'venues' then
      execute 'select to_jsonb(t) from public.venues t where t.id = $1'
        into chunk
        using p_venue_id;
      result := result || jsonb_build_object('venues', chunk);
    else
      execute format(
        'select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from public.%I t where t.%I = $1',
        spec.table_name,
        spec.scope_column
      )
        into chunk
        using p_venue_id;
      result := result || jsonb_build_object(spec.table_name, chunk);
    end if;
  end loop;

  execute $q$
    select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb)
    from public.conversation_message_attachments a
    join public.conversation_messages m on m.id = a.message_id
    where m.venue_id = $1
  $q$
    into chunk
    using p_venue_id;
  result := result || jsonb_build_object('conversation_message_attachments', chunk);

  execute $q$
    select coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb)
    from public.canonical_documents d
    where (
      d.owner_type = 'venue' and d.owner_id = $1
    ) or (
      d.owner_type = 'event' and d.owner_id in (
        select e.id from public.events e where e.venue_id = $1
      )
    )
  $q$
    into chunk
    using p_venue_id;
  result := result || jsonb_build_object('canonical_documents', chunk);

  execute $q$
    select coalesce(jsonb_agg(to_jsonb(v)), '[]'::jsonb)
    from public.canonical_document_versions v
    join public.canonical_documents d on d.id = v.document_id
    where (
      d.owner_type = 'venue' and d.owner_id = $1
    ) or (
      d.owner_type = 'event' and d.owner_id in (
        select e.id from public.events e where e.venue_id = $1
      )
    )
  $q$
    into chunk
    using p_venue_id;
  result := result || jsonb_build_object('canonical_document_versions', chunk);

  execute $q$
    select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb)
    from public.canonical_document_representations r
    join public.canonical_document_versions v on v.id = r.version_id
    join public.canonical_documents d on d.id = v.document_id
    where (
      d.owner_type = 'venue' and d.owner_id = $1
    ) or (
      d.owner_type = 'event' and d.owner_id in (
        select e.id from public.events e where e.venue_id = $1
      )
    )
  $q$
    into chunk
    using p_venue_id;
  result := result || jsonb_build_object('canonical_document_representations', chunk);

  result := jsonb_build_object('exportedAt', now()) || result;
  return public.venue_export_redact(result);
end;
$$;

revoke all on function public.venue_export_redact(jsonb) from public, anon, authenticated;
revoke all on function public.venue_export_allowed(uuid) from public, anon, authenticated;
revoke all on function public.get_venue_export(uuid) from public, anon;
grant execute on function public.get_venue_export(uuid) to authenticated;

notify pgrst, 'reload schema';
