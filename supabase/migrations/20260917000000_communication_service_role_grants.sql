-- Communication Platform — End-to-End Verification.
--
-- Found by walking the real inbound-email route with a real HTTP request
-- against a real test lead, not by reading code: `service_role` (the
-- identity every webhook route and the scheduled-sends cron processor runs
-- as, via createAdminClient()) had only REFERENCES/TRUNCATE/TRIGGER on
-- nearly every table this pipeline touches — no SELECT, INSERT, or UPDATE
-- at all. `rolbypassrls` bypasses RLS policies; it does not imply
-- table-level privileges — the same gap already found and fixed once for
-- Automation and the Platform Event framework (see
-- 20260909000000_notification_engine_service_role_grants.sql), recurring
-- here for the entire Communication table family, apparently never
-- re-checked since. Practical effect, confirmed directly: an inbound email
-- reply could never be matched to its Lead — the query failed with
-- "permission denied for table leads", the route's own code only checks
-- `leads?.length` truthiness (never the parallel `error`), so this has
-- been silently indistinguishable from "unknown sender" this entire time.
--
-- Every grant below is justified by a specific, already-read code path —
-- SELECT/INSERT/UPDATE only where that operation is actually performed by
-- an admin-client call, nothing granted speculatively:
--   leads                        — sender-match reads (inbound routes), score writes (lib/leads/scores.ts)
--   messages                     — thread/provider_id lookups, inbound inserts, status-webhook updates
--   message_threads              — thread lookups, inbound inserts, count/timestamp updates
--   message_thread_participants  — coordinator auto-participant insert on legacy send
--   message_events               — status-webhook audit log inserts
--   conversations                — find-or-create on inbound SMS / scheduled sends
--   conversation_messages        — inbound SMS inserts, scheduled-send mirror inserts
--   lead_signal_events           — email open/click signal inserts (lib/leads/signals.ts)
--   sequence_enrollments         — stop-on-reply / stop-on-booking exits
--   scheduled_messages           — the cron processor's own due-batch read + sent/failed writes
--   contracts, payment_schedules, payment_line_items, event_questionnaires
--                                 — read by lib/leads/scores.ts, invoked from these same webhooks

grant select, update on public.leads to service_role;
grant select, insert, update on public.messages to service_role;
grant select, insert, update on public.message_threads to service_role;
grant insert on public.message_thread_participants to service_role;
grant insert on public.message_events to service_role;
grant select, insert on public.conversations to service_role;
grant select, insert on public.conversation_messages to service_role;
grant select, insert on public.lead_signal_events to service_role;
grant select, update on public.sequence_enrollments to service_role;
grant select, update on public.scheduled_messages to service_role;
grant select on public.contracts to service_role;
grant select on public.payment_schedules to service_role;
grant select on public.payment_line_items to service_role;
grant select on public.event_questionnaires to service_role;
