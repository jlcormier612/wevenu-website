-- Export only an explicit column allowlist per collection.
-- A column added to a table later is omitted until this list is updated.
-- message_events.payload is omitted because event payloads can carry provider secrets.
-- venue_export_redact still removes secret key names nested inside venue-authored JSON.

create or replace function public.venue_export_project(p_row jsonb, p_columns text[])
returns jsonb
language sql
immutable
as $$
  select coalesce(
    jsonb_object_agg(e.key, e.value) filter (where e.key = any (p_columns)),
    '{}'::jsonb
  )
  from jsonb_each(coalesce(p_row, '{}'::jsonb)) as e(key, value);
$$;

-- Scope the shared vendor directory through this venue's relationships.
-- vendors has no venue_id. Export only vendors linked to the active venue.
-- claim_token and Luv intro signals are stripped with the other secret keys.

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
    'secret_key', 'token', 'claim_token', 'luv_draft_id', 'luv_intro_seen_at'
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
      ('venues', 'id', 'accent_color,accepted_inquiry_event_types,access_disabled,account_status,address_line1,address_line2,allow_simultaneous_public_availability,allow_tours_during_booked_events,business_name,capacity,city,commercial_booking_prefs,communication_test_email_at,communication_test_sms_at,conversation_experience_enabled,country,created_at,currency,email,email_footer_show_email,email_footer_show_phone,email_footer_show_signature,email_intake_connected_at,email_signature,event_order_enabled,ga4_measurement_id,hero_image_url,hold_blocks_availability,id,inquiry_communication_settings,inquiry_event_date_mode,inquiry_form_fields,lead_email_key,logo_url,name,neutral_color,onboarding_dismissed,onboarding_persona,owner_user_id,phone,planning_floor_plan_enabled,planning_seating_enabled,planning_timeline_enabled,planning_vendors_enabled,postal_code,primary_color,public_review_url,secondary_color,setup_completed,setup_completed_at,setup_last_step,space_operating_mode,state_region,story,stripe_accepted_payment_methods,stripe_charges_enabled,stripe_charges_enabled_verified_at,stripe_onboarding_status,timezone,tour_buffer_minutes,tour_duration_minutes,tour_max_advance_days,tour_min_notice_hours,tour_page_description,tour_page_headline,tour_protection_fee_cents,tour_protection_mode,tour_scheduling_enabled,updated_at,venue_type,website,week_starts_on'),
      ('venue_business_hours', 'venue_id', 'close_time,day_of_week,id,is_open,open_time,venue_id'),
      ('venue_spaces', 'venue_id', 'capacity,created_at,description,id,is_active,name,permitted_uses,sort_order,updated_at,venue_id'),
      ('venue_capacity_rules', 'venue_id', 'created_at,id,max_simultaneous_events,max_simultaneous_tours,min_turnaround_hours,updated_at,venue_id'),
      ('venue_operational_info', 'venue_id', 'ceremony_instructions,created_at,faqs,hotel_blocks,id,important_contacts,nearby_accommodations,parking_info,policies,rain_plan,section_audiences,section_overrides,things_to_do,transportation,updated_at,venue_id'),
      ('venue_schedule_item_types', 'venue_id', 'archived_at,blocks_availability,builtin_key,created_at,custom_key,enabled,group_key,id,label,sort_order,source,updated_at,venue_id'),
      ('venue_reminder_cadence', 'venue_id', 'contract_before_due_offsets,payment_after_due_cadence,payment_before_due_offsets,task_after_due_cadence,updated_at,venue_id'),
      ('venue_notification_preferences', 'venue_id', 'channel_email,channel_push,channel_sms,daily_digest_enabled,digest_intro_dismissed,last_digest_sent_at,pref_client_submitted_info,pref_contract_requires_attention,pref_contract_signed,pref_feedback_received,pref_final_guest_count_submitted,pref_message_received,pref_new_lead,pref_payment_failed,pref_payment_overdue,pref_payment_received,pref_proposal_accepted,pref_referral_received,pref_rsvp_received,pref_task_completed,pref_tour_confirmed,pref_tour_scheduled,pref_vendor_checked_in,updated_at,venue_id'),
      ('venue_required_vendor_categories', 'venue_id', 'category,created_at,id,venue_id'),
      ('tour_availability_windows', 'venue_id', 'created_at,day_of_week,end_time,id,sort_order,start_time,updated_at,venue_id'),
      ('tour_availability_exceptions', 'venue_id', 'created_at,end_date,id,label,recurrence_rule,start_date,updated_at,venue_id'),
      ('calendar_blocks', 'venue_id', 'blocks_availability,client_id,client_name,converted_lead_id,created_at,end_date,end_time,estimated_revenue,event_type,guest_count,id,is_all_day,lead_id,notes,reason,recurrence_count,recurrence_ends_on,recurrence_interval,recurrence_rule,schedule_item_type_id,start_date,start_time,title,type,venue_id'),
      ('date_holds', 'venue_id', 'created_at,end_date,end_time,expires_at,hold_date,id,lead_id,notes,preference_id,space_id,start_time,status,title,updated_at,venue_id'),
      ('date_hold_spaces', 'venue_id', 'created_at,hold_id,id,space_id,venue_id'),
      ('venue_lead_capture_channels', 'venue_id', 'channel,configured_at,created_at,id,updated_at,venue_id,verified_at'),
      ('public_forms', 'venue_id', 'created_at,description,field_config,id,internal_name,public_key,public_title,status,updated_at,venue_id'),
      ('public_form_questions', 'venue_id', 'created_at,id,options,public_form_id,question_text,question_type,required,sort_order,updated_at,venue_id'),
      ('inquiry_form_questions', 'venue_id', 'created_at,id,options,question_text,question_type,required,sort_order,updated_at,venue_id'),
      ('clients', 'venue_id', 'ceremony_time,created_at,email,end_date,event_date,event_type,exclude_from_business_reporting,first_name,guest_count,id,import_batch_id,internal_notes,is_historical_import,last_name,lead_id,lifecycle_booked_at,lifecycle_booking_origin,partner_email,partner_first_name,partner_last_name,phone,preferred_communication_channels,quickbooks_customer_id,quickbooks_sync_status,quickbooks_synced_at,reception_time,rehearsal_date,relationship_id,status,updated_at,venue_id'),
      ('client_contacts', 'venue_id', 'client_id,created_at,email,first_name,id,invited_at,is_decision_maker,is_emergency_contact,is_payer,is_primary,last_activity_at,last_name,notes,phone,portal_role,receives_reminders,relationship,role_label,sort_order,status,updated_at,venue_id'),
      ('client_notes', 'venue_id', 'body,client_id,created_at,id,updated_at,venue_id'),
      ('client_activities', 'venue_id', 'client_id,created_at,description,id,title,type,venue_id'),
      ('client_media', 'venue_id', 'caption,category,client_id,created_at,file_name,file_size_bytes,file_url,id,media_type,mime_type,sort_order,uploaded_by_contact_id,venue_id,visibility'),
      ('client_invitations', 'venue_id', 'accepted_at,client_id,created_at,delivered_at,delivery_error,delivery_status,email,expires_at,id,invited_by,provider_message_id,status,venue_id'),
      ('leads', 'venue_id', 'acquisition_source,assigned_staff_id,commitment_score,created_at,email,end_date,estimated_budget,event_date,event_type,exclude_from_business_reporting,first_booked_at,first_name,follow_up_date,guest_count,id,import_batch_id,inquiry_date,inquiry_message,inquiry_message_origin,intake_confidence,interest_score,is_historical_import,last_contacted_at,last_name,lost_at,lost_reason,lost_reason_detail,next_action_due,next_action_text,partner_email,partner_first_name,partner_last_name,phone,pipeline_stage_id,planned_event_space_id,preferred_communication_channels,relationship_id,responsiveness_score,sales_stage,scores_updated_at,source,source_data,status,updated_at,venue_id,venue_seen_at'),
      ('lead_notes', 'venue_id', 'body,created_at,id,lead_id,updated_at,venue_id'),
      ('lead_activities', 'venue_id', 'created_at,description,id,lead_id,title,type,venue_id'),
      ('lead_tasks', 'venue_id', 'assigned_to_staff_id,completed,completed_at,created_at,due_date,id,lead_id,title,venue_id'),
      ('lead_event_space_preferences', 'venue_id', 'created_at,external_location,id,lead_id,preference_kind,scheduled_date,space_id,updated_at,use_key,venue_id'),
      ('events', 'venue_id', 'assigned_staff_id,booked_at,booking_celebration_pending,client_id,couple_selected_floor_plan_id,created_at,end_time,event_date,event_end_date,event_type,exclude_from_business_reporting,external_ceremony_location,external_reception_location,guest_count,id,name,operational_floor_plan_id,setup_time,space_id,start_time,status,teardown_time,updated_at,venue_id'),
      ('event_notes', 'venue_id', 'body,created_at,event_id,id,updated_at,venue_id'),
      ('event_activities', 'venue_id', 'created_at,description,event_id,id,title,type,venue_id'),
      ('event_space_assignments', 'venue_id', 'created_at,end_time,event_id,id,scheduled_date,sort_order,space_id,start_time,updated_at,use_key,use_label,venue_id'),
      ('event_team', 'venue_id', 'created_at,event_id,full_name,id,phone,role,venue_id'),
      ('event_setup_states', 'venue_id', 'collapsed_at,created_at,decisions,event_id,inherited_decisions,inherited_template_refs,overrides,profile_id,profile_name,updated_at,uses_profile,venue_id'),
      ('event_inventory', 'venue_id', 'created_at,event_id,finalized_at,id,status,template_id,updated_at,venue_id'),
      ('event_inventory_items', 'venue_id', 'added_to_event_order_at,category,created_at,event_inventory_id,id,inventory_item_id,is_included,name,notes,quantity,sort_order,unit_price,updated_at,venue_id'),
      ('event_orders', 'venue_id', 'client_id,created_at,event_id,finalized_at,id,revision,shared_at,status,template_id,updated_at,venue_id'),
      ('event_order_lines', 'venue_id', 'amount,created_at,description,description_detail,event_order_id,id,inventory_item_id,is_included,notes,offering_id,package_id,provenance,quantity,section_id,sort_order,unit,unit_price,updated_at,venue_id'),
      ('event_order_sections', 'venue_id', 'created_at,event_order_id,floor_plan_id,id,name,sort_order,updated_at,venue_id'),
      ('event_order_activities', 'venue_id', 'created_at,description,event_order_id,id,title,type,venue_id'),
      ('event_order_share_snapshots', 'venue_id', 'created_at,event_order_id,id,payload,revision,shared_at,venue_id'),
      ('event_order_templates', 'venue_id', 'created_at,description,id,is_archived,name,source_master_key,updated_at,venue_id'),
      ('event_order_template_groups', 'venue_id', 'allow_quantity,created_at,id,instructions,max_select,min_select,name,section_id,selection_mode,sort_order,template_id,updated_at,venue_id'),
      ('event_order_template_sections', 'venue_id', 'created_at,guidance,id,name,sort_order,template_id,updated_at,venue_id'),
      ('event_order_template_lines', 'venue_id', 'created_at,description,description_detail,id,included_by_default,offering_id,pricing_model,quantity,section_id,sort_order,template_id,unit,unit_price,updated_at,venue_id'),
      ('event_order_template_options', 'venue_id', 'created_at,description,group_id,id,is_default,is_included,label,offering_id,sort_order,template_id,unit_price,updated_at,venue_id'),
      ('packages', 'venue_id', 'base_price,category,created_at,description,eligible_event_types,eligible_space_ids,id,import_batch_id,is_active,max_guest_count,min_guest_count,name,offer_role,sort_order,source_master_key,updated_at,venue_id'),
      ('package_items', 'venue_id', 'created_at,description,id,package_id,quantity,sort_order,unit,venue_id'),
      ('offerings', 'venue_id', 'category_id,created_at,default_unit_price,description,id,inventory_item_id,is_archived,name,sort_order,unit,updated_at,venue_id'),
      ('offering_categories', 'venue_id', 'created_at,id,name,sort_order,updated_at,venue_id'),
      ('inventory_items', 'venue_id', 'available_for_floor_plans,category_id,color,created_at,height,id,image_url,import_batch_id,is_archived,length,name,printable_name,quantity_available,shape,updated_at,venue_id,width'),
      ('inventory_categories', 'venue_id', 'created_at,id,name,sort_order,source_master_key,updated_at,venue_id'),
      ('inventory_templates', 'venue_id', 'created_at,description,id,is_archived,name,source_master_key,updated_at,venue_id'),
      ('inventory_template_items', 'venue_id', 'category,created_at,id,inventory_item_id,is_included,name,notes,quantity,sort_order,template_id,unit_price,updated_at,venue_id'),
      ('contracts', 'venue_id', 'amends_contract_id,attention_notified_at,branding_snapshot,client_id,consent_confirmed,content,created_at,event_id,execution_origin,expires_at,id,is_couple_visible,sent_at,signed_at,signer_ip,signer_name,signer_user_agent,status,template_id,title,updated_at,venue_id'),
      ('contract_signers', 'venue_id', 'client_contact_id,consent_confirmed,consent_text,content_hash,contract_id,created_at,id,is_required,sign_order,signed_at,signer_email,signer_ip,signer_name,signer_ref_id,signer_role,signer_type,signer_user_agent,updated_at,venue_id'),
      ('contract_templates', 'venue_id', 'content,created_at,description,id,is_archived,is_default,name,source_master_key,updated_at,venue_id'),
      ('contract_activities', 'venue_id', 'actor_id,actor_label,contract_id,created_at,description,id,title,type,venue_id'),
      ('invoices', 'venue_id', 'amends_invoice_id,balance_due,branding_snapshot,client_id,created_at,discount_amount,display_name,due_date,event_id,event_order_dismissed_fingerprint,event_order_id,event_order_revision_at_freeze,id,invoice_number,is_couple_visible,issued_at,notes,quickbooks_invoice_id,quickbooks_sync_status,quickbooks_synced_at,status,subtotal,tax_amount,total,updated_at,venue_id'),
      ('invoice_line_items', 'venue_id', 'amount,created_at,description,discount_type,discount_value,event_order_line_id,id,invoice_id,package_id,quantity,revenue_category,sort_order,tax_rate_mode,tax_rate_value,type,unit_price,venue_id'),
      ('invoice_activities', 'venue_id', 'created_at,description,id,invoice_id,title,type,venue_id'),
      ('payment_schedules', 'venue_id', 'acknowledged_invoice_total,client_id,created_at,currency,event_id,id,invoice_id,notes,title,total_amount,updated_at,venue_id'),
      ('payment_line_items', 'venue_id', 'amount,created_at,due_date,id,label,notes,obligation_kind,paid_amount,paid_at,payment_method,quickbooks_payment_id,quickbooks_refund_id,quickbooks_refund_net_synced,quickbooks_sync_status,quickbooks_synced_at,reference_number,refund_reason,refunded_amount,refunded_at,schedule_id,sort_order,status,stripe_payment_method_type,updated_at,venue_id'),
      ('payment_activities', 'venue_id', 'created_at,description,id,schedule_id,title,type,venue_id'),
      ('venue_vendor_relationships', 'venue_id', 'added_at,added_by_user_id,display_order,id,is_in_house,is_required,notes,preference_level,promotion_details,promotion_headline,promotion_updated_at,special_pricing_note,status,updated_at,vendor_id,venue_id'),
      ('event_vendor_assignments', 'venue_id', 'agreed_fee,arrival_time,checked_in_at,client_id,created_at,event_id,id,internal_notes,load_in_notes,notes,payment_status,setup_complete_at,setup_location,share_couple_address,share_couple_email,share_couple_phone,vendor_id,venue_id'),
      ('event_vendor_recommendations', 'venue_id', 'created_at,event_id,id,note,picked_at,recommended_at,selected_at,source,vendor_id,venue_id'),
      ('vendor_inquiries', 'venue_id', 'contact_email,contact_name,created_at,event_date,event_type,event_vendor_assignment_id,follow_up_at,id,notes,source,status,updated_at,vendor_id,venue_id'),
      ('timeline_templates', 'venue_id', 'created_at,event_type,id,is_archived,is_default,name,source_master_key,space_id,updated_at,venue_id'),
      ('timeline_template_items', 'venue_id', 'audiences,created_at,day_offset,description,id,minutes_offset,needs_review,notes,sort_order,template_id,time_of_day,title,updated_at,venue_id'),
      ('timeline_sections', 'venue_id', 'client_can_add,client_id,created_at,event_id,id,name,sort_order,updated_at,venue_id'),
      ('timeline_entries', 'venue_id', 'assigned_to_staff_id,audiences,client_id,created_at,day_offset,description,end_time,entry_time,event_id,id,lock_state,notes,owner,section_id,sort_order,source_space_use_key,status,title,updated_at,venue_id'),
      ('timeline_entry_links', 'venue_id', 'created_at,id,label,sort_order,timeline_entry_id,url,venue_id'),
      ('timeline_entry_attachments', 'venue_id', 'created_at,document_id,id,sort_order,timeline_entry_id,venue_id'),
      ('timeline_entry_context_links', 'venue_id', 'conversation_id,created_at,floor_plan_id,id,invoice_id,timeline_entry_id,vendor_assignment_id,venue_id'),
      ('event_tasks', 'venue_id', 'action_label,action_type,action_url,assigned_at,assigned_to_staff_id,auto_complete_trigger,category,client_id,completed_at,completed_by,created_at,days_offset,depends_on_event_task_id,description,due_date,due_date_locked,due_date_rule_kind,escalated_at,escalation_after_days,event_id,id,instructions,is_required,location,milestone_kind,milestone_name,notes,notify_on_assign,notify_on_complete,owner_type,payment_line_item_id,progress_state,reminder_before_days,request_id,scheduled_date,scheduled_end_time,scheduled_start_time,sort_order,source_id,source_type,status,template_task_id,title,updated_at,venue_id,visibility'),
      ('event_task_context_links', 'venue_id', 'conversation_message_id,created_at,document_id,event_task_id,id,link_label,link_url,timeline_entry_id,venue_id'),
      ('task_reminders', 'venue_id', 'after_due_recur_interval_days,contract_id,created_at,event_task_id,id,notify_role,payment_line_item_id,reminder_type,scheduled_for,sent_at,status,tour_appointment_id,venue_id'),
      ('playbook_templates', 'venue_id', 'created_at,description,event_type,id,is_archived,is_default,kind,name,source_master_key,updated_at,venue_id'),
      ('playbook_tasks', 'venue_id', 'action_label,action_type,action_url,auto_complete_trigger,category,created_at,days_offset,depends_on_task_id,description,due_date_rule_kind,escalation_after_days,id,instructions,is_required,milestone_id,needs_review,notify_on_assign,notify_on_complete,owner_type,reminder_before_days,reminder_interval_days,reminder_max_count,sort_order,template_id,title,venue_id,visibility'),
      ('playbook_milestones', 'venue_id', 'created_at,id,kind,name,sort_order,template_id,updated_at,venue_id'),
      ('playbook_task_attachments', 'venue_id', 'created_at,document_id,id,link_label,link_url,playbook_task_id,sort_order,venue_id'),
      ('event_playbook_applications', 'venue_id', 'applied_at,client_id,event_id,id,kind,released_at,template_id,template_name,venue_id'),
      ('questionnaire_templates', 'venue_id', 'created_at,custom_fields,description,field_order,id,included_fields,is_archived,kind,master_overrides,name,required_fields,source_master_key,updated_at,venue_id'),
      ('conversations', 'venue_id', 'assigned_staff_id,contact_unread,conversation_kind,created_at,event_vendor_assignment_id,id,inbox_owner_client_id,inbox_owner_kind,inbox_owner_lead_id,inquiry_context,last_message_at,needs_response,relationship_id,vendor_relationship_id,venue_id,venue_unread'),
      ('conversation_messages', 'venue_id', 'body,body_html,channel,channel_metadata,contact_read_at,conversation_id,failure_reason,id,provider_account_sid,provider_id,sender_id,sender_type,sent_at,status,venue_id,venue_read_at'),
      ('conversation_participants', 'venue_id', 'conversation_id,created_at,id,participant_id,participant_type,venue_id'),
      ('messages', 'venue_id', 'body,body_html,channel,created_at,delivered_at,direction,error_message,from_email,from_name,id,provider_id,sent_at,status,subject,thread_id,to_email,to_phone,updated_at,venue_id'),
      ('message_threads', 'venue_id', 'channel,client_id,created_at,event_id,id,last_message_at,lead_id,message_count,status,subject,updated_at,vendor_id,venue_id'),
      ('message_thread_participants', 'venue_id', 'added_at,added_by,can_reply,can_view,contact_id,id,is_cc,participant_type,receives_notifications,thread_id,venue_id'),
      ('message_events', 'venue_id', 'event_type,id,message_id,occurred_at,venue_id'),
      ('message_attachments', 'venue_id', 'created_at,file_size,id,message_id,mime_type,name,storage_path,storage_url,venue_id'),
      ('scheduled_messages', 'venue_id', 'body,channel,created_at,email_subject,error_message,id,merge_payment_line_item_id,merge_task_name,merge_tour_appointment_id,relationship_id,scheduled_for,sent_at,sequence_enrollment_id,sequence_step_id,status,template_id,updated_at,venue_id'),
      ('message_templates', 'venue_id', 'category,created_at,email_body,email_subject,id,is_archived,name,sms_body,source_master_key,updated_at,venue_id'),
      ('message_template_attachments', 'venue_id', 'created_at,document_id,id,link_label,link_url,sort_order,template_id,venue_id'),
      ('message_sequences', 'venue_id', 'created_at,id,name,source_master_key,status,trigger_stage,trigger_type,update_pipeline_on_enroll,updated_at,venue_id'),
      ('sequence_steps', 'venue_id', 'channel,created_at,id,offset_days,sequence_id,sort_order,template_id,venue_id'),
      ('sequence_enrollments', 'venue_id', 'created_at,enrolled_at,exited_at,id,paused_at,relationship_id,resumed_at,sequence_id,status,venue_id'),
      ('documents', 'venue_id', 'category,client_id,created_at,event_id,expires_at,file_name,file_size,id,is_couple_visible,lead_id,mime_type,name,notes,shared_with_vendors,source_library_document_id,storage_path,storage_url,tags,updated_at,uploaded_by_id,uploaded_by_type,vendor_id,venue_id'),
      ('document_file_versions', 'venue_id', 'created_at,document_id,file_name,file_size,id,mime_type,replaced_by,storage_path,storage_url,venue_id,version_number'),
      ('floor_plans', 'venue_id', 'background_document_id,background_image_opacity,background_image_url,background_locked,client_access,client_id,created_at,event_id,finalized_at,id,measurement_unit,name,notes,room_depth_ft,room_width_ft,shared_with_couple,shared_with_vendors,source_template_id,space_id,updated_at,venue_id'),
      ('floor_plan_objects', 'venue_id', 'capacity,color,created_at,display_shape,floor_plan_id,height,id,inventory_item_id,label,locked,notes,object_type,rotation,sort_order,updated_at,venue_id,width,x,y'),
      ('floor_plan_templates', 'venue_id', 'background_document_id,background_image_opacity,background_image_url,background_locked,created_at,event_type,id,is_archived,is_default,measurement_unit,name,room_depth_ft,room_width_ft,source_master_key,space_id,updated_at,venue_id'),
      ('floor_plan_template_objects', 'venue_id', 'capacity,color,created_at,display_shape,height,id,inventory_item_id,label,locked,notes,object_type,rotation,sort_order,template_id,updated_at,venue_id,width,x,y'),
      ('venue_staff', 'venue_id', 'accepted_at,access_title,capability_overrides,created_at,email,full_name,id,invited_at,invited_by,is_active,is_owner,last_active_at,owner_invite_pending,role,title,title_basis,user_id,venue_id'),
      ('quickbooks_connections', 'venue_id', 'company_name,connected_at,created_at,default_income_account_name,default_income_account_quickbooks_id,default_item_quickbooks_id,disconnected_at,environment,id,last_error,last_error_at,last_health_check_at,last_health_check_ok,realm_id,status,updated_at,venue_id'),
      ('facebook_connections', 'venue_id', 'connected_at,created_at,disconnected_at,id,last_error,last_error_at,last_health_check_at,last_health_check_ok,page_id,page_name,status,updated_at,venue_id'),
      ('venue_twilio_accounts', 'venue_id', 'a2p_brand_sid,a2p_brand_status,a2p_campaign_sid,a2p_campaign_status,a2p_trust_product_sid,compliance_submitted_at,created_at,default_from_e164,messaging_service_sid,phone_a2p_status,phone_number_sid,provisioning_generation,secondary_profile_sid,status,status_detail,twilio_account_sid,updated_at,venue_id')
    ) as t(table_name, scope_column, column_list)
  loop
    if spec.table_name = 'venues' then
      execute format(
        'select public.venue_export_project(to_jsonb(t), string_to_array(%L, '','')) from public.venues t where t.id = $1',
        spec.column_list
      )
        into chunk
        using p_venue_id;
      result := result || jsonb_build_object('venues', chunk);
    else
      execute format(
        'select coalesce(jsonb_agg(public.venue_export_project(to_jsonb(t), string_to_array(%L, '',''))), ''[]''::jsonb) from public.%I t where t.%I = $1',
        spec.column_list,
        spec.table_name,
        spec.scope_column
      )
        into chunk
        using p_venue_id;
      result := result || jsonb_build_object(spec.table_name, chunk);
    end if;
  end loop;


  execute $q$
    select coalesce(jsonb_agg(public.venue_export_project(to_jsonb(v), string_to_array('accepting_inquiries,availability_notes,average_rating,business_name,category,contact_name,cover_image_url,created_at,description,email,facebook_url,hero_image_url,id,import_batch_id,instagram_url,insurance_expiry,is_claimed,is_marketplace_listed,logo_url,phone,pinterest_url,pricing_tier,profile_slug,review_count,service_area,subscription_status,subscription_tier,tiktok_url,trial_ends_at,updated_at,website_url', ','))), '[]'::jsonb)
    from public.vendors v
    where v.id in (
      select r.vendor_id
      from public.venue_vendor_relationships r
      where r.venue_id = $1
    )
  $q$
    into chunk
    using p_venue_id;
  result := result || jsonb_build_object('vendors', chunk);

  execute $q$
    select coalesce(jsonb_agg(public.venue_export_project(to_jsonb(a), string_to_array('created_at,file_name,file_size,file_url,id,message_id,mime_type', ','))), '[]'::jsonb)
    from public.conversation_message_attachments a
    join public.conversation_messages m on m.id = a.message_id
    where m.venue_id = $1
  $q$
    into chunk
    using p_venue_id;
  result := result || jsonb_build_object('conversation_message_attachments', chunk);

  execute $q$
    select coalesce(jsonb_agg(public.venue_export_project(to_jsonb(d), string_to_array('behavior,created_at,expires_at,id,name,notes,owner_id,owner_type,retention_policy,source,status,tags,type,updated_at', ','))), '[]'::jsonb)
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
    select coalesce(jsonb_agg(public.venue_export_project(to_jsonb(v), string_to_array('content,created_at,created_by_id,created_by_type,document_id,id,is_current,locked_at,sequence_number', ','))), '[]'::jsonb)
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
    select coalesce(jsonb_agg(public.venue_export_project(to_jsonb(r), string_to_array('byte_size,checksum,created_at,generated_by_id,generated_by_type,id,mime_type,representation_type,storage_path,storage_provider,storage_url,version_id', ','))), '[]'::jsonb)
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


revoke all on function public.venue_export_project(jsonb, text[]) from public, anon, authenticated;

notify pgrst, 'reload schema';

