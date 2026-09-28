-- SEQ-01 New Inquiry Welcome must not advance pipeline on enroll.
-- A venue that enabled "Also move their sales stage forward" on lead_created
-- was kicking brand-new leads from New Inquiry → In Workflow.
-- Code also ignores update_pipeline_on_enroll for trigger_type = lead_created;
-- this clears the misleading flag on existing SEQ-01 copies.

update public.message_sequences
set update_pipeline_on_enroll = false
where source_master_key = 'SEQ-01'
  and update_pipeline_on_enroll is distinct from false;
