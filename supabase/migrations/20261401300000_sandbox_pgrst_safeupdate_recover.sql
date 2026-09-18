-- Diagnose/recover: safeupdate preload can interfere with PostgREST introspection.
-- Keep supautils; drop safeupdate from authenticator preload; reload.

alter role authenticator set session_preload_libraries = 'supautils';
alter role authenticator set statement_timeout = '120s';
alter role authenticator set lock_timeout = '60s';

notify pgrst, 'reload config';
notify pgrst, 'reload schema';

do $$
declare cfg text;
begin
  select array_to_string(rolconfig, ',') into cfg from pg_roles where rolname = 'authenticator';
  raise notice 'authenticator rolconfig=%', coalesce(cfg, '<null>');
end $$;
