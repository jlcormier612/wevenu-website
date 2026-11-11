-- Aggressive PostgREST recovery: clear stuck authenticator backends and
-- ensure timeouts allow schema-cache rebuild. No application data changes.

do $$
declare
  killed int := 0;
begin
  select count(*) into killed
  from pg_stat_activity
  where usename = 'authenticator'
    and pid <> pg_backend_pid()
    and state in ('active', 'idle in transaction', 'idle in transaction (aborted)');

  perform pg_terminate_backend(pid)
  from pg_stat_activity
  where usename = 'authenticator'
    and pid <> pg_backend_pid()
    and state in ('active', 'idle in transaction', 'idle in transaction (aborted)');

  raise notice 'TERMINATED_AUTHENTICATOR_BACKENDS=%', killed;
end $$;

alter role authenticator set statement_timeout = '180s';
alter role authenticator set lock_timeout = '60s';

notify pgrst, 'reload config';
notify pgrst, 'reload schema';

select pg_sleep(2);

do $$
declare cfg text;
begin
  select array_to_string(rolconfig, ',') into cfg from pg_roles where rolname = 'authenticator';
  raise notice 'authenticator rolconfig=%', coalesce(cfg, '<null>');
end $$;
