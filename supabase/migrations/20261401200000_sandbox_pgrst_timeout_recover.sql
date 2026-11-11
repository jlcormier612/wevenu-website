-- PostgREST schema-cache load was failing under authenticator statement_timeout=8s
-- after large DDL/grant fan-out. Raise timeout, reload config+schema.

alter role authenticator set statement_timeout = '60s';
alter role authenticator set lock_timeout = '30s';

notify pgrst, 'reload config';
notify pgrst, 'reload schema';

do $$
declare cfg text;
begin
  select array_to_string(rolconfig, ',') into cfg from pg_roles where rolname = 'authenticator';
  raise notice 'authenticator rolconfig=%', coalesce(cfg, '<null>');
end $$;
