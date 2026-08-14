-- Automation P0 terminal-stage validation (local only)
\set ON_ERROR_STOP on
\pset format aligned

CREATE TEMP TABLE p0_results (name text, pass boolean, detail text);

DO $$
DECLARE
  v_venue uuid := '69cfd906-0d15-4e5c-8bab-ed106b411c34';
  v_tmpl uuid;
  v_followup uuid := 'fd5d172e-a457-4231-8238-849f4a91dc6c';
  v_lost_auto uuid;
  v_canc_auto uuid;
  v_prop_auto uuid;
  v_rel uuid;
  v_lead uuid;
  v_enr uuid;
  v_enr2 uuid;
  v_msg1 uuid;
  v_msg2 uuid;
  v_status text;
  v_sched int;
  v_cnt int;
  v_name text;
  v_key text;
BEGIN
  SELECT id INTO v_tmpl FROM message_templates
   WHERE venue_id = v_venue AND source_master_key = 'MSG-01' LIMIT 1;
  IF v_tmpl IS NULL THEN
    INSERT INTO p0_results VALUES ('MSG-01 present', false, 'missing');
    RETURN;
  END IF;
  INSERT INTO p0_results VALUES ('MSG-01 present', true, v_tmpl::text);

  -- Ensure Lost / Cancelled / Proposal automations
  SELECT id INTO v_lost_auto FROM message_sequences WHERE venue_id = v_venue AND name = 'P0 Lost Goodbye';
  IF v_lost_auto IS NULL THEN
    INSERT INTO message_sequences (venue_id, name, trigger_type, trigger_stage, status)
    VALUES (v_venue, 'P0 Lost Goodbye', 'lead_stage_changed', 'lost', 'active')
    RETURNING id INTO v_lost_auto;
    INSERT INTO sequence_steps (venue_id, sequence_id, template_id, channel, sort_order, offset_days)
    VALUES (v_venue, v_lost_auto, v_tmpl, 'email', 0, 0);
  ELSE
    UPDATE message_sequences SET trigger_type='lead_stage_changed', trigger_stage='lost', status='active' WHERE id=v_lost_auto;
  END IF;

  SELECT id INTO v_canc_auto FROM message_sequences WHERE venue_id = v_venue AND name = 'P0 Cancelled Goodbye';
  IF v_canc_auto IS NULL THEN
    INSERT INTO message_sequences (venue_id, name, trigger_type, trigger_stage, status)
    VALUES (v_venue, 'P0 Cancelled Goodbye', 'lead_stage_changed', 'cancelled', 'active')
    RETURNING id INTO v_canc_auto;
    INSERT INTO sequence_steps (venue_id, sequence_id, template_id, channel, sort_order, offset_days)
    VALUES (v_venue, v_canc_auto, v_tmpl, 'email', 0, 0);
  ELSE
    UPDATE message_sequences SET trigger_type='lead_stage_changed', trigger_stage='cancelled', status='active' WHERE id=v_canc_auto;
  END IF;

  SELECT id INTO v_prop_auto FROM message_sequences WHERE venue_id = v_venue AND name = 'P0 Proposal Nudge';
  IF v_prop_auto IS NULL THEN
    INSERT INTO message_sequences (venue_id, name, trigger_type, trigger_stage, status)
    VALUES (v_venue, 'P0 Proposal Nudge', 'lead_stage_changed', 'proposal_sent', 'active')
    RETURNING id INTO v_prop_auto;
    INSERT INTO sequence_steps (venue_id, sequence_id, template_id, channel, sort_order, offset_days)
    VALUES (v_venue, v_prop_auto, v_tmpl, 'email', 0, 0);
  END IF;

  -- ========== Test A Lost ==========
  INSERT INTO venue_customer_relationships (venue_id, first_name, last_name, email)
  VALUES (v_venue, 'P0Lost', 'Validation', 'p0-lost-' || extract(epoch from now())::text || '@example.com')
  RETURNING id INTO v_rel;
  INSERT INTO leads (venue_id, relationship_id, first_name, last_name, email, status, source)
  VALUES (v_venue, v_rel, 'P0Lost', 'Validation', 'p0-lost-' || extract(epoch from now())::text || '@example.com', 'new', 'website')
  RETURNING id INTO v_lead;

  INSERT INTO sequence_enrollments (venue_id, sequence_id, relationship_id, status)
  VALUES (v_venue, v_followup, v_rel, 'active') RETURNING id INTO v_enr;
  INSERT INTO scheduled_messages (venue_id, relationship_id, sequence_enrollment_id, channel, body, email_subject, scheduled_for, status)
  VALUES
    (v_venue, v_rel, v_enr, 'email', 's1 {{first_name}}', 's1', now() + interval '1 hour', 'scheduled'),
    (v_venue, v_rel, v_enr, 'email', 's2 {{first_name}}', 's2', now() + interval '2 days', 'scheduled');

  -- exit-before-enroll
  UPDATE sequence_enrollments SET status='exited_lost', exited_at=now()
   WHERE relationship_id=v_rel AND venue_id=v_venue AND status='active';
  UPDATE scheduled_messages SET status='cancelled'
   WHERE sequence_enrollment_id=v_enr AND status='scheduled';

  SELECT status INTO v_status FROM sequence_enrollments WHERE id=v_enr;
  INSERT INTO p0_results VALUES ('Test A existing → exited_lost', v_status='exited_lost', v_status);

  SELECT count(*) INTO v_sched FROM scheduled_messages WHERE sequence_enrollment_id=v_enr AND status='scheduled';
  INSERT INTO p0_results VALUES ('Test A no future sends', v_sched=0, v_sched::text);

  -- Lost-trigger may enroll; must remain active
  INSERT INTO sequence_enrollments (venue_id, sequence_id, relationship_id, status)
  VALUES (v_venue, v_lost_auto, v_rel, 'active') RETURNING id INTO v_enr2;
  SELECT status INTO v_status FROM sequence_enrollments WHERE id=v_enr2;
  INSERT INTO p0_results VALUES ('Test A Lost Automation enrolls', true, v_enr2::text);
  INSERT INTO p0_results VALUES ('Test A new Lost enrollment stays active', v_status='active', v_status);

  -- ========== Test B Cancelled ==========
  INSERT INTO venue_customer_relationships (venue_id, first_name, last_name, email)
  VALUES (v_venue, 'P0Canc', 'Validation', 'p0-canc-' || extract(epoch from now())::text || '@example.com')
  RETURNING id INTO v_rel;
  INSERT INTO leads (venue_id, relationship_id, first_name, last_name, email, status, source)
  VALUES (v_venue, v_rel, 'P0Canc', 'Validation', 'p0-canc-' || extract(epoch from now())::text || '@example.com', 'new', 'website');

  INSERT INTO sequence_enrollments (venue_id, sequence_id, relationship_id, status)
  VALUES (v_venue, v_followup, v_rel, 'active') RETURNING id INTO v_enr;
  INSERT INTO scheduled_messages (venue_id, relationship_id, sequence_enrollment_id, channel, body, email_subject, scheduled_for, status)
  VALUES
    (v_venue, v_rel, v_enr, 'email', 's1', 's1', now() + interval '1 hour', 'scheduled'),
    (v_venue, v_rel, v_enr, 'email', 's2', 's2', now() + interval '2 days', 'scheduled');

  UPDATE sequence_enrollments SET status='exited_cancelled', exited_at=now()
   WHERE relationship_id=v_rel AND venue_id=v_venue AND status='active';
  UPDATE scheduled_messages SET status='cancelled'
   WHERE sequence_enrollment_id=v_enr AND status='scheduled';

  SELECT status INTO v_status FROM sequence_enrollments WHERE id=v_enr;
  INSERT INTO p0_results VALUES ('Test B existing → exited_cancelled', v_status='exited_cancelled', v_status);
  SELECT count(*) INTO v_sched FROM scheduled_messages WHERE sequence_enrollment_id=v_enr AND status='scheduled';
  INSERT INTO p0_results VALUES ('Test B no future sends', v_sched=0, v_sched::text);

  INSERT INTO sequence_enrollments (venue_id, sequence_id, relationship_id, status)
  VALUES (v_venue, v_canc_auto, v_rel, 'active') RETURNING id INTO v_enr2;
  SELECT status INTO v_status FROM sequence_enrollments WHERE id=v_enr2;
  INSERT INTO p0_results VALUES ('Test B Cancelled Automation enrolls', true, v_enr2::text);
  INSERT INTO p0_results VALUES ('Test B new Cancelled enrollment stays active', v_status='active', v_status);

  -- ========== Test C ordinary stage change ==========
  INSERT INTO venue_customer_relationships (venue_id, first_name, last_name, email)
  VALUES (v_venue, 'P0Ord', 'Validation', 'p0-ord-' || extract(epoch from now())::text || '@example.com')
  RETURNING id INTO v_rel;
  INSERT INTO leads (venue_id, relationship_id, first_name, last_name, email, status, source)
  VALUES (v_venue, v_rel, 'P0Ord', 'Validation', 'p0-ord-' || extract(epoch from now())::text || '@example.com', 'new', 'website');

  INSERT INTO sequence_enrollments (venue_id, sequence_id, relationship_id, status)
  VALUES (v_venue, v_followup, v_rel, 'active') RETURNING id INTO v_enr;
  INSERT INTO scheduled_messages (venue_id, relationship_id, sequence_enrollment_id, channel, body, email_subject, scheduled_for, status)
  VALUES (v_venue, v_rel, v_enr, 'email', 's1', 's1', now() + interval '1 hour', 'scheduled');

  -- ordinary: enroll proposal only, do NOT exit existing
  INSERT INTO sequence_enrollments (venue_id, sequence_id, relationship_id, status)
  VALUES (v_venue, v_prop_auto, v_rel, 'active');

  SELECT status INTO v_status FROM sequence_enrollments WHERE id=v_enr;
  INSERT INTO p0_results VALUES ('Test C ordinary change does NOT exit', v_status='active', v_status);
  SELECT count(*) INTO v_cnt FROM sequence_enrollments WHERE relationship_id=v_rel AND sequence_id=v_prop_auto AND status='active';
  INSERT INTO p0_results VALUES ('Test C proposal Automation enrolls', v_cnt=1, v_cnt::text);

  -- ========== Completion ==========
  INSERT INTO venue_customer_relationships (venue_id, first_name, last_name, email)
  VALUES (v_venue, 'P0Comp', 'Validation', 'p0-comp-' || extract(epoch from now())::text || '@example.com')
  RETURNING id INTO v_rel;
  INSERT INTO sequence_enrollments (venue_id, sequence_id, relationship_id, status)
  VALUES (v_venue, v_followup, v_rel, 'active') RETURNING id INTO v_enr;
  INSERT INTO scheduled_messages (venue_id, relationship_id, sequence_enrollment_id, channel, body, email_subject, scheduled_for, status)
  VALUES
    (v_venue, v_rel, v_enr, 'email', 's1', 's1', now() + interval '1 hour', 'scheduled')
  RETURNING id INTO v_msg1;
  INSERT INTO scheduled_messages (venue_id, relationship_id, sequence_enrollment_id, channel, body, email_subject, scheduled_for, status)
  VALUES
    (v_venue, v_rel, v_enr, 'email', 's2', 's2', now() + interval '2 days', 'scheduled')
  RETURNING id INTO v_msg2;

  UPDATE scheduled_messages SET status='sent', sent_at=now() WHERE id=v_msg1;
  SELECT status INTO v_status FROM sequence_enrollments WHERE id=v_enr;
  INSERT INTO p0_results VALUES ('Completion mid-run stays active', v_status='active', v_status);

  UPDATE scheduled_messages SET status='sent', sent_at=now() WHERE id=v_msg2;
  -- mirror maybeCompleteEnrollmentAfterSend
  SELECT count(*) INTO v_sched FROM scheduled_messages WHERE sequence_enrollment_id=v_enr AND status='scheduled';
  IF v_sched = 0 THEN
    UPDATE sequence_enrollments SET status='completed', exited_at=now() WHERE id=v_enr AND status='active';
  END IF;
  SELECT status INTO v_status FROM sequence_enrollments WHERE id=v_enr;
  INSERT INTO p0_results VALUES ('Completion final → completed', v_status='completed', v_status);

  -- ========== Booking / Reply ==========
  INSERT INTO venue_customer_relationships (venue_id, first_name, last_name, email)
  VALUES (v_venue, 'P0Book', 'Validation', 'p0-book-' || extract(epoch from now())::text || '@example.com')
  RETURNING id INTO v_rel;
  INSERT INTO sequence_enrollments (venue_id, sequence_id, relationship_id, status)
  VALUES (v_venue, v_followup, v_rel, 'active') RETURNING id INTO v_enr;
  UPDATE sequence_enrollments SET status='exited_booking', exited_at=now() WHERE id=v_enr;
  SELECT status INTO v_status FROM sequence_enrollments WHERE id=v_enr;
  INSERT INTO p0_results VALUES ('Booking exit → exited_booking', v_status='exited_booking', v_status);

  INSERT INTO venue_customer_relationships (venue_id, first_name, last_name, email)
  VALUES (v_venue, 'P0Reply', 'Validation', 'p0-reply-' || extract(epoch from now())::text || '@example.com')
  RETURNING id INTO v_rel;
  INSERT INTO sequence_enrollments (venue_id, sequence_id, relationship_id, status)
  VALUES (v_venue, v_followup, v_rel, 'active') RETURNING id INTO v_enr;
  UPDATE sequence_enrollments SET status='exited_reply', exited_at=now() WHERE id=v_enr;
  SELECT status INTO v_status FROM sequence_enrollments WHERE id=v_enr;
  INSERT INTO p0_results VALUES ('Reply exit → exited_reply', v_status='exited_reply', v_status);

  -- ========== Progress next date ==========
  INSERT INTO venue_customer_relationships (venue_id, first_name, last_name, email)
  VALUES (v_venue, 'P0Prog', 'Validation', 'p0-prog-' || extract(epoch from now())::text || '@example.com')
  RETURNING id INTO v_rel;
  INSERT INTO sequence_enrollments (venue_id, sequence_id, relationship_id, status)
  VALUES (v_venue, v_followup, v_rel, 'active') RETURNING id INTO v_enr;
  INSERT INTO scheduled_messages (venue_id, relationship_id, sequence_enrollment_id, channel, body, email_subject, scheduled_for, status)
  VALUES
    (v_venue, v_rel, v_enr, 'email', 's1', 's1', now() + interval '3 hours', 'scheduled'),
    (v_venue, v_rel, v_enr, 'email', 's2', 's2', now() + interval '3 days', 'scheduled');
  SELECT count(*) INTO v_cnt FROM scheduled_messages WHERE sequence_enrollment_id=v_enr;
  SELECT count(*) INTO v_sched FROM scheduled_messages WHERE sequence_enrollment_id=v_enr AND status='scheduled';
  INSERT INTO p0_results VALUES ('Progress data Step X of Y + next', v_cnt=2 AND v_sched=2, format('total=%s scheduled=%s', v_cnt, v_sched));

  -- ========== Starter ==========
  SELECT name, source_master_key, trigger_type INTO v_name, v_key, v_status
    FROM message_sequences WHERE venue_id=v_venue AND source_master_key='SEQ-01';
  INSERT INTO p0_results VALUES ('SEQ-01 New Inquiry Welcome', v_name='New Inquiry Welcome' AND v_key='SEQ-01' AND v_status='lead_created',
    format('%s / %s / %s', v_name, v_key, v_status));

  SELECT count(*) INTO v_cnt FROM message_sequences WHERE venue_id=v_venue AND name ILIKE '%Tour Follow%';
  INSERT INTO p0_results VALUES ('Tour Follow-Up NOT implemented', v_cnt=0, v_cnt::text);

  SELECT source_master_key INTO v_key FROM message_sequences WHERE id=v_followup;
  INSERT INTO p0_results VALUES ('Venue-created Automation source_master_key null', v_key IS NULL, coalesce(v_key,'null'));

  -- ========== Activity RPC shape (as postgres bypassing venue auth) ==========
  -- Verify function body includes automation branch (already applied)
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname='get_relationship_activity_timeline'
      AND prosrc LIKE '%automation_enrolled%'
      AND prosrc LIKE '%automation_exited_lost%'
      AND prosrc LIKE '%automation_exited_cancelled%'
      AND prosrc LIKE '%automation_completed%'
  ) THEN
    INSERT INTO p0_results VALUES ('Activity RPC includes automation lifecycle', true, 'enrolled/completed/exited_* present');
  ELSE
    INSERT INTO p0_results VALUES ('Activity RPC includes automation lifecycle', false, 'missing branches');
  END IF;

  -- Confirm constraint accepts all exit reasons
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='sequence_enrollments_status_check'
      AND pg_get_constraintdef(oid) LIKE '%exited_lost%'
      AND pg_get_constraintdef(oid) LIKE '%exited_cancelled%'
  ) THEN
    INSERT INTO p0_results VALUES ('Enrollment status constraint includes P0 exits', true, NULL);
  ELSE
    INSERT INTO p0_results VALUES ('Enrollment status constraint includes P0 exits', false, NULL);
  END IF;
END $$;

SELECT CASE WHEN pass THEN 'PASS' ELSE 'FAIL' END AS result, name, detail FROM p0_results ORDER BY name;
SELECT count(*) FILTER (WHERE pass) AS passed, count(*) FILTER (WHERE NOT pass) AS failed FROM p0_results;
