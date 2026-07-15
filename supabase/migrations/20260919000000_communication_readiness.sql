-- Communication Trust Experience — Phase 6, Communication Readiness.
--
-- "A venue should know before sending its first client message whether
-- everything is configured correctly." A real self-test (send a real
-- email/SMS to the venue's own address, confirm the send succeeded) needs
-- somewhere to record that it happened — these two timestamps are that
-- record. Null means "not yet tested," not "failed": a brand-new venue
-- hasn't had the chance yet, which is a different, honest state from
-- something being broken.

alter table public.venues
  add column if not exists communication_test_email_at timestamptz,
  add column if not exists communication_test_sms_at    timestamptz;
