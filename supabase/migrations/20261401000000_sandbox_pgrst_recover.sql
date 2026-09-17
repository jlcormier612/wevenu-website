-- Attempt recovery of Sandbox PostgREST schema-cache (PGRST002).
-- Does not change application data. Idempotent grants + reload signals.

do $$
declare
  cfg text;
begin
  select array_to_string(rolconfig, ',') into cfg
  from pg_roles where rolname = 'authenticator';
  raise notice 'authenticator rolconfig=%', coalesce(cfg, '<null>');
end $$;

grant usage on schema public to postgres, anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant execute on functions to anon, authenticated, service_role;

notify pgrst, 'reload config';
notify pgrst, 'reload schema';
