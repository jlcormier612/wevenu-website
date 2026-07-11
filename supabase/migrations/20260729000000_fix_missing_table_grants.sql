-- Fix: two tables created this week (event_task_context_links,
-- playbook_task_attachments) got RLS policies but never the base table-level
-- GRANT every other table in this schema has (see e.g.
-- 20260628040000_event_playbooks.sql). RLS policies only govern which ROWS a
-- role can see once it already has table-level access — without the GRANT,
-- Postgres denies the query before RLS is even evaluated ("permission
-- denied for table ..."). Surfaced 2026-07-09 when the Template Editor's
-- Attachments feature hit this live for the first time.

grant select, insert, update, delete on public.event_task_context_links to authenticated;
grant select, insert, update, delete on public.playbook_task_attachments to authenticated;
